// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * Setup WebView Provider
 */

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import * as cp from "child_process";
import {
  checkEnvironment,
  getWebviewContent,
  generateNonce,
  getVSCodePromptsDir,
  getVSCodeUserDir,
  openInFileExplorer,
  createAndShowTerminal,
  installVsCodeCli,
  installUv,
  installNpm,
  handlePythonInstallation,
  Platform,
  getExtensionStoragePath,
} from "./setupUtils";
import { McpServerManager } from "./mcpServerManager";
import { VersionManager } from "./versionManager";

/**
 * Interface for MCP server status
 */
interface McpServerStatus {
  status: "none" | "complete" | "update_available";
  serverName?: string;
  message: string;
  needsUserAction: boolean;
}

/**
 * Webview Provider class for setup sidebar view
 * Handles all setup-related UI interactions and processes
 */
export class SetupWebViewProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = "bdd-ai-toolkit-extension.setupView";
  private _view?: vscode.WebviewView;
  private _isAutoResolveInProgress = false; // Track if auto-resolve is currently running
  private _isCheckingEnvironment = false; // Track if environment check is currently running

  constructor(
    private readonly _extensionUri: vscode.Uri,
    private readonly _extensionContext: vscode.ExtensionContext
  ) {}

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    // Store view reference
    this._view = webviewView;
    // Set options for the webview
    webviewView.webview.options = {
      // Enable JavaScript in the webview
      enableScripts: true,
      // Restrict the webview to only load resources from the extension's directory
      localResourceRoots: [this._extensionUri],
    };

    // Set the HTML content for the webview
    webviewView.webview.html = this._getWebviewContent(
      webviewView.webview,
      this._extensionUri
    );

    // Also check MCP status when view becomes visible again
    webviewView.onDidChangeVisibility(() => {
      if (webviewView.visible) {
        console.log("Setup webview became visible, checking environment status...");
        this.checkEnvironmentStatus(webviewView);
      }
    });

    // Check the environment status when view is loaded
    // Use setTimeout to ensure HTML is fully rendered and avoid blocking UI
    setTimeout(() => {
      this.checkEnvironmentStatus(webviewView);
    }, 100);

    // Inform the webview about the current platform
    webviewView.webview.postMessage({
      command: "platformInfo",
      status: process.platform === "darwin" ? "macos" : "other",
    });

    // Handle messages from the webview
    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message.command) {
        case "webviewLoaded":
          // Webview is loaded, send the stored API key if available
          const storedApiKey = this._extensionContext?.globalState.get(
            "figmaApiKey",
            ""
          );
          if (storedApiKey) {
            webviewView.webview.postMessage({
              command: "setFigmaApiKey",
              apiKey: storedApiKey,
            });
          }
          return;

        case "openExternalUrl":
          console.log("Opening external URL:", message.url);
          vscode.env.openExternal(vscode.Uri.parse(message.url));
          return;

        case "openSettingsJson":
          vscode.commands.executeCommand("workbench.action.openSettingsJson");
          return;

        case "checkEnvironment":
          this.checkEnvironmentStatus(webviewView, "user"); // Allow user-requested checks
          return;

        case "checkPlatform":
          webviewView.webview.postMessage({
            command: "platformInfo",
            status: process.platform === "darwin" ? "macos" : "other",
          });
          return;

        case "openInstructionsLocation":
          // Get the path to the VS Code User prompts directory
          let promptsDir = getVSCodePromptsDir();

          // Check if directory exists, if not, open the User directory instead
          if (!fs.existsSync(promptsDir)) {
            promptsDir = getVSCodeUserDir();
          }

          // Open folder in native file explorer
          openInFileExplorer(promptsDir);
          return;

        case "resolveEnvironmentIssues":
          // Call the method to resolve environment issues
          this.resolveEnvironmentIssues(webviewView);

          // Send confirmation back to webview
          webviewView.webview.postMessage({
            status: "success",
            command: message.command,
            message:
              "Environment issues resolution initiated. Check the terminal for progress.",
          });
          return;

        case "setupWindowsMcp":
          console.log("Setting up Windows MCP server");
          this.setupWindowsMcp(webviewView);
          return;

        case "setupAppiumMcp":
          console.log("Setting up Appium MCP server");
          this.setupAppiumMcp(webviewView);
          return;

        case "openMcpSettings":
          console.log("Opening MCP Settings");
          this.openMcpSettings(webviewView);
          return;

        default:
          console.warn(`Unknown command received: ${message.command}`);
      }
    });
  }

  private _getWebviewContent(
    webview: vscode.Webview,
    extensionUri: vscode.Uri
  ): string {
    // Generate a nonce for script security
    const nonce = this._getNonce();

    // Use the utility function to get the HTML content
    return getWebviewContent(webview, extensionUri, nonce);
  }

  private _getNonce(): string {
    return generateNonce();
  }

  // Method to send message to webview
  public postMessage(message: any): void {
    if (this._view) {
      this._view.webview.postMessage(message);
    }
  }

  /**
   * Public method to refresh MCP status and update sidebar badge
   * This can be called from other parts of the extension when needed
   */
  public async refreshMcpStatus(): Promise<void> {
    if (this._view) {
      console.log("Refreshing MCP status from external request...");

      // Check MCP server status
      const mcpStatus = await this.checkMcpServerStatus();

      // Update sidebar badge
      this.updateSidebarBadge(this._view, mcpStatus);

      // Send status to webview
      this._view.webview.postMessage({
        command: "mcpStatusUpdate",
        mcpServerStatus: mcpStatus,
      });
    }
  }

  // Method to check environment status and send results to the webview
  private async checkEnvironmentStatus(
    webviewView: vscode.WebviewView,
    source: "auto" | "user" | "autoResolveComplete" = "auto"
  ): Promise<void> {
    // If auto-resolve is in progress and this is an automatic check, skip to avoid UI interference
    if (this._isAutoResolveInProgress && source === "auto") {
      console.log("Skipping environment check: auto-resolve in progress");
      return;
    }

    // Prevent concurrent environment checks to avoid resource contention
    if (this._isCheckingEnvironment) {
      console.log("Skipping environment check: already checking");
      return;
    }

    try {
      this._isCheckingEnvironment = true;
      console.log(`Starting environment check (source: ${source})`);

      // On Windows, refresh environment variables before checking to ensure we pick up new installations
      if (Platform.isWindows) {
        await this.refreshEnvironmentVariables();
      }

      // Use the simplified checkEnvironment utility directly
      const envStatus = await checkEnvironment();

      // Check MCP server status
      const mcpStatus = await this.checkMcpServerStatus();

      // Update sidebar badge based on MCP status
      this.updateSidebarBadge(webviewView, mcpStatus);

      // Send environment status to the webview
      webviewView.webview.postMessage({
        command: "environmentStatus",
        environmentStatus: envStatus,
        source: source, // Include source information for button state management
      });

      // Send MCP server status separately
      webviewView.webview.postMessage({
        command: "mcpStatusUpdate",
        mcpServerStatus: mcpStatus,
      });

      console.log(`Environment check completed (source: ${source})`);
    } finally {
      this._isCheckingEnvironment = false;
    }
  }

  /**
   * Update the sidebar badge based on MCP server status
   */
  private updateSidebarBadge(
    webviewView: vscode.WebviewView,
    mcpStatus: McpServerStatus
  ): void {
    if (mcpStatus.status === "update_available") {
      // Show warning badge when update is available
      // Note: VS Code API only supports numeric badges, not custom icons
      // Using "!" character as number isn't supported, so we use 1 with warning tooltip
      webviewView.badge = {
        value: 1,
        tooltip:
          "⚠️ MCP server update available - please update via setup panel",
      };
    } else {
      // Remove badge when no update is needed
      webviewView.badge = undefined;
    }
  }

  // Method to resolve environment issues based on current status
  private async resolveEnvironmentIssues(
    webviewView: vscode.WebviewView
  ): Promise<void> {
    // Set auto-resolve in progress flag
    this._isAutoResolveInProgress = true;

    try {
      // First check current status to determine what needs to be fixed
      const envStatus = await checkEnvironment();

    // Determine which tools can be auto-resolved based on platform
    const autoResolveActions = [];

    if (Platform.isMacOS) {
      // On macOS, all tools can be auto-resolved
      if (!envStatus.npm) {
        autoResolveActions.push("npm");
      }
      if (!envStatus.python) {
        autoResolveActions.push("python");
      }
      if (!envStatus.code) {
        autoResolveActions.push("code");
      }
      if (!envStatus.uv) {
        autoResolveActions.push("uv");
      }
    } else {
      // On Windows/other platforms, only CLI and UV can be auto-resolved
      if (!envStatus.code) {
        autoResolveActions.push("code");
      }
      if (!envStatus.uv) {
        autoResolveActions.push("uv");
      }

      // Check if there are any manual installation issues on Windows
      const manualIssues = [];
      if (!envStatus.npm) {
        manualIssues.push("npm");
      }
      if (!envStatus.python) {
        manualIssues.push("python");
      }

      // If there are manual issues on Windows, inform the user
      if (manualIssues.length > 0) {
        const manualToolNames = manualIssues
          .map((tool) => {
            switch (tool) {
              case "npm":
                return "Node.js & NPM";
              case "python":
                return "Python (≥3.10)";
              default:
                return tool;
            }
          })
          .join(" and ");

        vscode.window.showWarningMessage(
          `Manual installation required for: ${manualToolNames}. The resolve button only handles VS Code CLI and UV tools automatically.`
        );
      }
    }

    // Execute auto-resolution for supported tools
    if (autoResolveActions.length > 0) {
      console.log(`Auto-resolving: ${autoResolveActions.join(", ")}`);

      // Install missing components sequentially
      for (const action of autoResolveActions) {
        // Create a new terminal for each installation to ensure clean execution
        const terminal = createAndShowTerminal(
          `Installing ${action}`,
          Platform.isWindows ? { shellPath: "powershell.exe" } : {}
        );

        // Send installing status
        webviewView.webview.postMessage({
          command: "installationStatus",
          tool: action,
          status: "installing",
        });

        let success = false;
        try {
          if (action === "npm") {
            success = await installNpm(terminal);
          } else if (action === "python") {
            success = await handlePythonInstallation(terminal);
          } else if (action === "code") {
            await installVsCodeCli(terminal);
            // Note: installVsCodeCli doesn't use executeInTerminal, so we manually exit
            terminal.sendText("exit");
            success = true; // No return value for this one
          } else if (action === "uv") {
            // installUv now uses autoExit: true, so don't manually call exit
            success = await installUv(terminal);

            // After UV installation, refresh VS Code environment variables (Windows only)
            if (success && Platform.isWindows) {
              await this.refreshEnvironmentVariables();
            }
          }
          // Note: dotnet installation support removed for macOS

          // Send success/error status
          webviewView.webview.postMessage({
            command: "installationStatus",
            tool: action,
            status: success ? "done" : "error",
          });

          // Dispose the terminal after installation to keep things clean
          setTimeout(() => {
            if (!terminal.exitStatus) {
              console.log(`Disposing terminal for ${action}`);
              terminal.dispose();
            }
          }, 4000); // Give more time for installation to complete, especially for Python

          if (!success) {
            vscode.window.showErrorMessage(
              `${action} installation failed. Please try installing manually.`
            );
          } else {
            // Show specific success message for UV installation on Windows
            if (action === "uv" && Platform.isWindows) {
              vscode.window.showInformationMessage(
                "✅ UV installed successfully! Environment variables have been refreshed automatically.",
                "OK"
              );
            } else {
              vscode.window.showInformationMessage(
                `✅ ${action} installed successfully!`
              );
            }

            // Don't check environment status immediately after each tool installation
            // to avoid interfering with other ongoing installations
            // The final environment check will happen after all tools are processed
          }
        } catch (error) {
          // Dispose terminal on error as well
          setTimeout(() => {
            if (!terminal.exitStatus) {
              console.log(`Disposing terminal for ${action} after error`);
              terminal.dispose();
            }
          }, 4000); // Give the same delay as success case

          webviewView.webview.postMessage({
            command: "installationStatus",
            tool: action,
            status: "error",
          });
          vscode.window.showErrorMessage(
            `Error installing ${action}: ${error instanceof Error ? error.message : String(error)}`
          );
        }
      }

    } else {
      // No issues to auto-resolve
      if (Platform.isMacOS) {
        vscode.window.showInformationMessage(
          "Environment is already set up correctly!"
        );
      } else {
        vscode.window.showInformationMessage(
          "Only manual installation issues found. Please install the required tools manually."
        );
      }
    }
    } catch (error) {
      console.error("Error in resolveEnvironmentIssues:", error);
      vscode.window.showErrorMessage(
        `Error resolving environment issues: ${error instanceof Error ? error.message : String(error)}`
      );
    } finally {
      // Always schedule environment recheck and clear flag, even if there were errors
      // Use different delays for different platforms:
      // - macOS: 8 seconds (Python installation via Homebrew needs more time)
      // - Windows: 5 seconds (only UV/CLI, environment variables already refreshed)
      const recheckDelay = Platform.isMacOS ? 8000 : 5000;
      
      setTimeout(() => {
        console.log(
          `Auto-checking environment status after auto-resolution (delay: ${recheckDelay}ms)...`
        );

        // Clear auto-resolve in progress flag
        this._isAutoResolveInProgress = false;

        // Send message to webview to show checking environment UI
        webviewView.webview.postMessage({
          command: "showCheckingEnvironment",
        });

        // Then trigger environment check
        this.checkEnvironmentStatus(webviewView, "autoResolveComplete");
      }, recheckDelay);
    }
  }

  // Method to check MCP server status
  private async checkMcpServerStatus(): Promise<McpServerStatus> {
    try {
      const mcpManager = McpServerManager.getInstance();

      // Check if workspace exists
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        return {
          status: "none",
          message: "Ready to setup",
          needsUserAction: false,
        };
      }

      const projectPath = workspaceFolder.uri.fsPath;

      // Check VS Code MCP configuration
      const config = vscode.workspace.getConfiguration();
      const mcpConfig = config.get("mcp") as any;

      if (!mcpConfig || !mcpConfig.servers) {
        return {
          status: "none",
          message: "Ready to setup",
          needsUserAction: false,
        };
      } // Look for BDD MCP server configurations (check both windows and appium servers)
      const projectBaseName = path.basename(projectPath);
      const windowsServerName = `auto-genesis-extension-${projectBaseName}-windows`;
      const appiumServerName = `auto-genesis-extension-${projectBaseName}-appium`;

      const windowsServerConfig = mcpConfig.servers[windowsServerName];
      const appiumServerConfig = mcpConfig.servers[appiumServerName];

      // If neither server is configured, show ready to setup
      if (!windowsServerConfig && !appiumServerConfig) {
        return {
          status: "none",
          message: "Ready to setup",
          needsUserAction: false,
        };
      }

      // Check if MCP server files exist and are up to date
      const extensionStoragePath = this.getExtensionStoragePath();

      // Check for both server types
      const autoMcpServerPath = path.join(
        extensionStoragePath,
        "pywinauto-mcp-server"
      );
      const appiumMcpServerPath = path.join(
        extensionStoragePath,
        "appium-mcp-server"
      );

      let setupServers = [];
      let missingServers = [];

      // Check Windows server
      if (windowsServerConfig) {
        if (fs.existsSync(autoMcpServerPath)) {
          setupServers.push("Windows (pywinauto)");
        } else {
          missingServers.push("Windows (pywinauto)");
        }
      }

      // Check Appium server
      if (appiumServerConfig) {
        if (fs.existsSync(appiumMcpServerPath)) {
          setupServers.push("Appium");
        } else {
          missingServers.push("Appium");
        }
      }

      // If some servers are missing files, show ready to setup
      if (missingServers.length > 0) {
        return {
          status: "none",
          message: "Ready to setup",
          needsUserAction: false,
        };
      } // Check if update is needed for any configured server
      const currentExtensionVersion = VersionManager.getCurrentVersion();
      if (currentExtensionVersion) {
        let needsUpdate = false;

        // Check update for Windows server if configured
        if (windowsServerConfig && fs.existsSync(autoMcpServerPath)) {
          needsUpdate = VersionManager.needsUpdate(
            autoMcpServerPath,
            currentExtensionVersion
          );
        }

        // Check update for Appium server if configured and no update needed yet
        if (
          !needsUpdate &&
          appiumServerConfig &&
          fs.existsSync(appiumMcpServerPath)
        ) {
          needsUpdate = VersionManager.needsUpdate(
            appiumMcpServerPath,
            currentExtensionVersion
          );
        }

        if (needsUpdate) {
          return {
            status: "update_available",
            serverName: setupServers.join(" & "),
            message: "MCP server update available, please setup again!",
            needsUserAction: true,
          };
        }
      }

      // MCP server(s) are complete and up to date
      return {
        status: "complete",
        serverName: setupServers.join(" & "),
        message: `MCP server(s) ready: ${setupServers.join(" & ")}`,
        needsUserAction: false,
      };
    } catch (error) {
      console.error("Error checking MCP server status:", error);
      return {
        status: "none",
        message: "Ready to setup",
        needsUserAction: false,
      };
    }
  } // Helper method to get extension storage path
  private getExtensionStoragePath(): string {
    return getExtensionStoragePath();
  } /**
   * Setup MCP server with detailed progress feedback
   * @param webviewView The webview to send progress updates to
   * @param serverType The type of MCP server to setup ('windows-browser' or 'appium-common')
   * @param displayName The display name for progress messages (e.g., 'Windows', 'Appium')
   */
  private async setupMcpServer(
    webviewView: vscode.WebviewView,
    serverType: "windows-browser" | "appium-common",
    displayName: string
  ): Promise<void> {
    try {
      console.log(`Starting ${displayName} MCP server setup...`);

      // Get current workspace folder
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        throw new Error("No workspace folder found");
      }

      const projectPath = workspaceFolder.uri.fsPath;
      const mcpManager = McpServerManager.getInstance();

      // Send initial status
      webviewView.webview.postMessage({
        command: "mcpSetupProgress",
        step: "initializing",
        message: `Initializing ${displayName} MCP server setup...`,
        progress: 0,
      });

      // Step 1: Setup MCP server
      webviewView.webview.postMessage({
        command: "mcpSetupProgress",
        step: "setting_up",
        message: `Setting up ${displayName} MCP server...`,
        progress: 30,
      });

      console.log(`Setting up ${displayName} MCP server...`);
      // Use 'edge' for windows-browser type, 'chrome' for others (appium doesn't use browser parameter)
      const browser: "edge" | "chrome" =
        serverType === "windows-browser" ? "edge" : "chrome";
      const serverName = await mcpManager.setupMcpServer(
        projectPath,
        browser,
        serverType
      );

      // Step 2: Start the server
      webviewView.webview.postMessage({
        command: "mcpSetupProgress",
        step: "starting",
        message: `Starting ${displayName} MCP server...`,
        progress: 90,
      });

      console.log(`Starting ${displayName} MCP server...`);
      await mcpManager.startMcpServer(serverName);

      // Final success message
      webviewView.webview.postMessage({
        command: "mcpSetupProgress",
        step: "completed",
        message: `${displayName} MCP server setup completed successfully!`,
        progress: 100,
      });

      console.log(`${displayName} MCP server setup completed successfully`);

      // Clear the sidebar badge since MCP is now up to date
      webviewView.badge = undefined;

      // Refresh MCP status to update the UI
      console.log("Refreshing MCP status after successful setup...");
      await this.refreshMcpStatus();

      // Auto-open MCP settings file after successful setup
      console.log("Auto-opening MCP settings file...");
      await this.openMcpSettings(webviewView);

      vscode.window.showInformationMessage(
        `${displayName} MCP server setup completed successfully!`
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error(`${displayName} MCP server setup failed:`, errorMessage);

      // Send error status
      webviewView.webview.postMessage({
        command: "mcpSetupProgress",
        step: "error",
        message: `${displayName} MCP server setup failed: ${errorMessage}`,
        progress: 0,
      });

      vscode.window.showErrorMessage(
        `${displayName} MCP server setup failed: ${errorMessage}`
      );
    }
  }

  /**
   * Setup Windows MCP server with detailed progress feedback
   */
  private async setupWindowsMcp(
    webviewView: vscode.WebviewView
  ): Promise<void> {
    return this.setupMcpServer(webviewView, "windows-browser", "Windows");
  }

  /**
   * Setup Appium MCP server with detailed progress feedback
   */
  private async setupAppiumMcp(webviewView: vscode.WebviewView): Promise<void> {
    return this.setupMcpServer(webviewView, "appium-common", "Appium");
  } /**
   * Open MCP settings file in VS Code
   */
  private async openMcpSettings(
    webviewView: vscode.WebviewView
  ): Promise<void> {
    try {
      // Check if workspace folder exists
      const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
      if (!workspaceFolder) {
        const errorMessage =
          "No workspace folder found. Please open a workspace first.";
        console.error(errorMessage);
        vscode.window.showErrorMessage(errorMessage);
        return;
      }

      // Check current MCP configuration in workspace settings
      const config = vscode.workspace.getConfiguration();
      const currentMcpConfig = config.get("mcp");

      // Option 1: Try to open dedicated MCP configuration file (.vscode/mcp.json)
      const mcpConfigPath = vscode.Uri.joinPath(
        workspaceFolder.uri,
        ".vscode",
        "mcp.json"
      );

      try {
        // Check if mcp.json exists
        await vscode.workspace.fs.stat(mcpConfigPath);
        const document = await vscode.workspace.openTextDocument(mcpConfigPath);
        await vscode.window.showTextDocument(document);
        return;
      } catch (mcpError) {
        console.log("MCP config file does not exist, will create it");
      }

      // Option 2: If mcp.json doesn't exist, create it with current MCP configuration
      // Get current MCP configuration or create default
      const mcpConfigToSave = currentMcpConfig || { servers: {} };

      // Ensure .vscode directory exists
      const vscodeDir = vscode.Uri.joinPath(workspaceFolder.uri, ".vscode");
      try {
        await vscode.workspace.fs.stat(vscodeDir);
      } catch {
        console.log("Creating .vscode directory...");
        await vscode.workspace.fs.createDirectory(vscodeDir);
      }

      // Create the mcp.json file
      const configContent = JSON.stringify(mcpConfigToSave, null, 4);
      await vscode.workspace.fs.writeFile(
        mcpConfigPath,
        Buffer.from(configContent, "utf8")
      );

      // Open the newly created file
      const document = await vscode.workspace.openTextDocument(mcpConfigPath);
      await vscode.window.showTextDocument(document);
      webviewView.webview.postMessage({
        command: "mcpServerSetup",
        status: "success",
        message: "MCP settings file opened",
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      console.error("Failed to open MCP settings:", errorMessage);

      webviewView.webview.postMessage({
        command: "mcpServerSetup",
        status: "error",
        message: `Failed to open MCP settings: ${errorMessage}`,
      });

      vscode.window.showErrorMessage(
        `Failed to open MCP settings: ${errorMessage}`
      );
    }
  }

  /**
   * Refresh VS Code's environment variables on Windows after UV installation
   * This helps VS Code pick up the newly installed UV tool
   */
  private async refreshEnvironmentVariables(): Promise<void> {
    if (!Platform.isWindows) {
      return; // Only needed on Windows
    }

    console.log("Refreshing VS Code environment variables ...");

    try {
      // Method 1: Update PATH from Windows registry (User Environment)
      const userPathResult = await new Promise<string>((resolve, reject) => {
        const command =
          "powershell -Command \"Get-ItemProperty -Path 'HKCU:\\Environment' -Name PATH -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PATH\"";

        cp.exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
          if (error) {
            console.log(
              "Could not read user PATH from registry:",
              error.message
            );
            resolve("");
          } else {
            resolve(stdout.trim());
          }
        });
      });

      // Method 2: Update PATH from Windows registry (System Environment)
      const systemPathResult = await new Promise<string>((resolve, reject) => {
        const command =
          "powershell -Command \"Get-ItemProperty -Path 'HKLM:\\SYSTEM\\CurrentControlSet\\Control\\Session Manager\\Environment' -Name PATH -ErrorAction SilentlyContinue | Select-Object -ExpandProperty PATH\"";

        cp.exec(command, { timeout: 10000 }, (error, stdout, stderr) => {
          if (error) {
            console.log(
              "Could not read system PATH from registry:",
              error.message
            );
            resolve("");
          } else {
            resolve(stdout.trim());
          }
        });
      });

      // Combine user and system PATH
      const combinedPath = [userPathResult, systemPathResult]
        .filter((p) => p)
        .join(";");

      if (combinedPath) {
        const oldPath = process.env.PATH || "";
        process.env.PATH = combinedPath;
        console.log("Updated VS Code process PATH from Windows registry");
        console.log(
          `Old PATH length: ${oldPath.length}, New PATH length: ${combinedPath.length}`
        );
      }

      // Method 3: Ensure UV local bin path is included
      const userProfile = process.env.USERPROFILE || "";
      const uvLocalBinPath = path.join(userProfile, ".local", "bin");

      if (!process.env.PATH?.includes(uvLocalBinPath)) {
        process.env.PATH = `${uvLocalBinPath};${process.env.PATH || ""}`;
        console.log(
          `Added UV local bin path to VS Code process PATH: ${uvLocalBinPath}`
        );
      }

      // Method 4: Also update Node.js process environment for completeness
      if (uvLocalBinPath && !process.env.PATH?.includes(uvLocalBinPath)) {
        const currentPath = process.env.PATH || "";
        process.env.PATH = `${uvLocalBinPath};${currentPath}`;
      }

      // Give a moment for the environment change to take effect
      await new Promise((resolve) => setTimeout(resolve, 1500));

      console.log("Environment variable refresh completed");
    } catch (error) {
      console.error("Failed to refresh environment variables:", error);
      // Don't throw error, just log it - this is a best-effort operation
    }
  }
}
