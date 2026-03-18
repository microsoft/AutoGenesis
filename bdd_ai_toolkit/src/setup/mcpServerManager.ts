// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * MCP Server Manager
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { spawn } from "child_process";
import { getExtensionStoragePath } from "./setupUtils";
import { executeInTerminal } from "./terminal";
import { DEFAULT_COPILOT_PROMPT } from "../constants/prompts";
import { VersionManager } from "./versionManager";

export interface McpServerConfig {
  name: string;
  projectPath: string;
  serverPath: string;
  browser: "edge" | "chrome";
  serverType: string;
  isRunning: boolean;
}

export class McpServerManager {
  private static instance: McpServerManager;
  private servers = new Map<string, McpServerConfig>();
  private _onServerStatusChanged = new vscode.EventEmitter<{
    name: string;
    isRunning: boolean;
  }>();
  public readonly onServerStatusChanged = this._onServerStatusChanged.event;

  private constructor() {}

  public static getInstance(): McpServerManager {
    if (!McpServerManager.instance) {
      McpServerManager.instance = new McpServerManager();
    }
    return McpServerManager.instance;
  }

  /**
   * Setup MCP server in extension storage (shared across all projects)
   */
  public async setupMcpServer(
    projectPath: string,
    browser: "edge" | "chrome" = "edge",
    serverType: string = "appium-common"
  ): Promise<string> {
    // Generate server name based on project and server type to support multiple servers
    const projectBaseName = path.basename(projectPath);
    const serverTypeSuffix =
      serverType === "windows-browser" ? "windows" : "appium";
    const serverName = `auto-genesis-extension-${projectBaseName}-${serverTypeSuffix}`;
    console.log(`Setting up MCP server: ${serverName}`);

    // Use extension's storage path instead of project path to keep MCP server hidden from users
    const extensionStoragePath = getExtensionStoragePath();

    // Determine server directory based on server type
    const serverDirName = this.getSourceDirectoryForServerType(serverType);
    const mcpServerPath = path.join(extensionStoragePath, serverDirName);

    try {
      // Close any existing MCP Server Setup terminals to prevent file locking
      this.closeExistingMcpTerminals();

      // Create mcp-server directory in extension storage if it doesn't exist
      if (!fs.existsSync(mcpServerPath)) {
        fs.mkdirSync(mcpServerPath, { recursive: true });
      }

      // Copy MCP server files from the appropriate source directory based on server type
      const sourceDirName = this.getSourceDirectoryForServerType(serverType);
      const extensionMcpPath = path.join(
        __dirname,
        "..",
        "..",
        "resources",
        sourceDirName
      );

      console.log(
        `Copying files from: ${extensionMcpPath} to: ${mcpServerPath}`
      );
      if (!fs.existsSync(extensionMcpPath)) {
        throw new Error(
          `MCP server compiled resources not found: ${extensionMcpPath}. Please run 'npm run compile' first.`
        );
      }

      console.log("Starting file copy process...");
      await this.copyMcpServerFiles(
        extensionMcpPath,
        mcpServerPath,
        serverName
      );
      console.log("File copy completed, starting UV sync...");
      await this.initializeUvEnvironment(mcpServerPath);
      console.log("UV sync completed, continuing with setup...");

      // Add server to configuration
      const serverConfig: McpServerConfig = {
        name: serverName,
        projectPath,
        serverPath: mcpServerPath,
        browser,
        serverType,
        isRunning: false,
      };
      this.servers.set(serverName, serverConfig);

      // Update VS Code settings
      await this.updateVSCodeMcpSettings(serverConfig);

      // Create version tracking file for this installation
      const currentExtensionVersion = VersionManager.getCurrentVersion();
      if (currentExtensionVersion) {
        VersionManager.writeVersionInfo(
          mcpServerPath,
          currentExtensionVersion,
          "manual_setup"
        );
      }

      console.log(`MCP server setup completed: ${serverName}`);
      return serverName;
    } catch (error) {
      throw new Error(`Failed to setup MCP server: ${error}`);
    }
  }

  /**
   * Start MCP server
   */
  public async startMcpServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    if (server.isRunning) {
      vscode.window.showInformationMessage(
        `MCP Server ${serverName} is already running`
      );
      return;
    }

    try {
      // The server will be started automatically by VS Code MCP extension
      // We just need to make sure the configuration is correct
      server.isRunning = true;
      this._onServerStatusChanged.fire({ name: serverName, isRunning: true });
    } catch (error) {
      throw new Error(`Failed to start MCP server: ${error}`);
    }
  }

  /**
   * Stop MCP server
   */
  public async stopMcpServer(serverName: string): Promise<void> {
    const server = this.servers.get(serverName);
    if (!server) {
      throw new Error(`Server ${serverName} not found`);
    }

    try {
      // Remove from VS Code settings to stop the server
      await this.removeMcpServerFromSettings(serverName);

      server.isRunning = false;
      this._onServerStatusChanged.fire({ name: serverName, isRunning: false });

      vscode.window.showInformationMessage(
        `MCP Server ${serverName} stopped successfully`
      );
    } catch (error) {
      throw new Error(`Failed to stop MCP server: ${error}`);
    }
  }

  /**
   * Get all configured servers
   */
  public getServers(): McpServerConfig[] {
    return Array.from(this.servers.values());
  }

  /**
   * Get server by name
   */
  public getServer(name: string): McpServerConfig | undefined {
    return this.servers.get(name);
  }

  /**
   * Copy MCP server files from extension to storage (always update to latest)
   */
  private async copyMcpServerFiles(
    sourcePath: string,
    targetPath: string,
    serverName?: string
  ): Promise<void> {
    console.log(`Starting copy from ${sourcePath} to ${targetPath}`);

    if (!fs.existsSync(sourcePath)) {
      const error = `Source MCP server path does not exist: ${sourcePath}`;
      console.error(error);
      throw new Error(error);
    }

    // Always clean and recreate to ensure we have the latest code
    if (fs.existsSync(targetPath)) {
      console.log(`Target directory exists, removing: ${targetPath}`);
      await this.removeDirectoryWithRetry(targetPath, 2, 1000, serverName);
      console.log(`Target directory removed successfully`);
    }

    console.log("Starting recursive file copy...");
    let copiedCount = 0;

    const copyRecursive = (src: string, dest: string) => {
      const stat = fs.statSync(src);
      if (stat.isDirectory()) {
        if (!fs.existsSync(dest)) {
          fs.mkdirSync(dest, { recursive: true });
        }
        const files = fs.readdirSync(src);
        for (const file of files) {
          if (
            file === "__pycache__" ||
            file === ".venv" ||
            file.endsWith(".log")
          ) {
            continue; // Skip cache and environment files
          }
          copyRecursive(path.join(src, file), path.join(dest, file));
        }
      } else {
        fs.copyFileSync(src, dest);
        copiedCount++;
      }
    };
    copyRecursive(sourcePath, targetPath);
    console.log(`File copy completed. Copied ${copiedCount} files.`);
  }

  /**
   * Remove directory with retry mechanism for Windows file locking issues
   */
  private async removeDirectoryWithRetry(
    dirPath: string,
    maxRetries = 2,
    delayMs = 1000,
    serverName?: string
  ): Promise<void> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // For Windows, try to remove readonly attributes using Node.js fs instead of terminal
        if (process.platform === "win32") {
          try {
            this.removeReadonlyAttributes(dirPath);
          } catch (attrError) {
            // Continue if we can't remove readonly attributes
          }
        }

        // Try to remove the directory
        fs.rmSync(dirPath, { recursive: true, force: true });
        return;
      } catch (error: any) {
        if (attempt === maxRetries) {
          // Last attempt failed, provide helpful error message
          let errorMessage =
            "Setup failed: Failed to setup MCP server: This may be due to files being locked by another process. ";

          if (serverName) {
            errorMessage += `Please stop the MCP server "${serverName}" and try again.`;
          } else {
            errorMessage +=
              "Please stop any running MCP servers and try again.";
          }

          console.error(errorMessage);
          throw new Error(errorMessage);
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }
  }

  /**
   * Remove readonly attributes from files in directory recursively
   */
  private removeReadonlyAttributes(dirPath: string): void {
    if (!fs.existsSync(dirPath)) {
      return;
    }

    const entries = fs.readdirSync(dirPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);

      try {
        if (entry.isDirectory()) {
          // Recursively process subdirectories
          this.removeReadonlyAttributes(fullPath);
        } else if (entry.isFile()) {
          // Remove readonly attribute from file
          const stats = fs.statSync(fullPath);
          if (!(stats.mode & 0o200)) {
            // Check if write permission is missing
            fs.chmodSync(fullPath, stats.mode | 0o200); // Add write permission
          }
        }
      } catch (error) {
        // Continue with other files even if one fails
      }
    }
  }

  /**
   * Initialize uv environment (always sync to get latest dependencies)
   */
  private async initializeUvEnvironment(mcpServerPath: string): Promise<void> {
    try {
      // Always run uv sync to ensure we have the latest dependencies
      await new Promise<void>((resolve, reject) => {
        // Spawn uv sync process
        const uvProcess = spawn("uv", ["sync"], {
          cwd: mcpServerPath,
          stdio: "pipe", // Capture output
          shell: true,
        });

        let output = "";
        let errorOutput = "";

        // Capture stdout
        uvProcess.stdout.on("data", (data: Buffer) => {
          const text = data.toString();
          output += text;
        });

        // Capture stderr (uv outputs progress info to stderr, which is normal)
        uvProcess.stderr.on("data", (data: Buffer) => {
          const text = data.toString();
          errorOutput += text;
        });

        // Handle process completion
        uvProcess.on("close", (code: number) => {
          if (code === 0) {
            resolve();
          } else {
            console.error("UV sync failed with code:", code);
            console.error("Error output:", errorOutput);
            // Don't reject, just resolve to continue setup
            resolve();
          }
        });

        // Handle process error
        uvProcess.on("error", (error: Error) => {
          console.error("UV sync process error:", error);
          // Don't reject, just resolve to continue setup
          resolve();
        });

        // Add timeout
        setTimeout(() => {
          uvProcess.kill("SIGTERM");
          resolve();
        }, 120000); // 2 minutes timeout
      });
    } catch (error) {
      const errorMessage = `Failed to initialize uv environment: ${error}`;
      console.error(errorMessage);
      // Don't throw error, just log it and continue
    }
  }

  /**
   * Update VS Code MCP settings (workspace-specific)
   */
  private async updateVSCodeMcpSettings(
    serverConfig: McpServerConfig
  ): Promise<void> {
    // Handle conf.json file creation/update before updating VS Code settings
    await this.ensureConfJsonExists(serverConfig.projectPath, serverConfig);

    const config = vscode.workspace.getConfiguration();
    const currentMcpConfig = (config.get("mcp") as any) || { servers: {} };

    // Create a new plain object from the configuration to avoid proxy issues
    const mcpConfig = JSON.parse(JSON.stringify(currentMcpConfig));

    if (!mcpConfig.servers) {
      mcpConfig.servers = {};
    }

    // Remove unwanted server configurations that may have been added automatically
    const unwantedServers = ["mcp-server-time"];
    unwantedServers.forEach((unwantedServerName) => {
      if (mcpConfig.servers[unwantedServerName]) {
        delete mcpConfig.servers[unwantedServerName];
      }
    });

    // Check if server configuration already exists
    if (mcpConfig.servers[serverConfig.name]) {
      // Check if bdd_ai_conf.json exists in the project root directory for default config comparison
      const confJsonPath = path.join(
        serverConfig.projectPath,
        "bdd_ai_conf.json"
      );
      const hasConfJson = fs.existsSync(confJsonPath);

      // Build the expected default args array based on server type
      const confJsonPathToUse = hasConfJson ? confJsonPath : null;
      const defaultArgs = this.getArgsForServerType(
        serverConfig,
        serverConfig.serverPath,
        confJsonPathToUse
      );

      // Create the expected default configuration
      const defaultConfig = {
        command: "uv",
        args: defaultArgs,
        env: {
          PYTHONIOENCODING: "utf-8",
          PYTHONUTF8: "1",
          LANG: "en_US.UTF-8",
          LC_ALL: "en_US.UTF-8",
        },
      };

      // Check if the existing configuration is different from the default
      const existingConfig = mcpConfig.servers[serverConfig.name];
      const isConfigModified =
        JSON.stringify(existingConfig) !== JSON.stringify(defaultConfig);

      // For appium servers, also check if SSE server exists and has correct config
      let sseConfigModified = false;
      if (serverConfig.serverType === "appium-common") {
        const sseServerName = `${serverConfig.name}-sse`;
        const expectedSseConfig = {
          type: "sse",
          url: "http://localhost:8000/sse",
        };
        const existingSseConfig = mcpConfig.servers[sseServerName];
        sseConfigModified =
          JSON.stringify(existingSseConfig) !==
          JSON.stringify(expectedSseConfig);
      }

      // Only show confirmation dialog if the configuration has been modified
      if (isConfigModified || sseConfigModified) {
        const choice = await vscode.window.showWarningMessage(
          `MCP server configuration '${serverConfig.name}' already exists and has been modified. This will overwrite your custom configuration.`,
          {
            modal: true,
            detail:
              "Your custom modifications to the MCP server configuration will be lost. Do you want to continue and reset the configuration to default settings?",
          },
          "Reset to Default"
        );

        if (choice !== "Reset to Default") {
          const error =
            "Setup cancelled by user. Existing MCP configuration preserved.";
          throw new Error(error);
        }

        vscode.window.showInformationMessage(
          `Resetting MCP server '${serverConfig.name}' to default configuration...`
        );
      }
    }

    // Check if bdd_ai_conf.json exists in the project root directory
    const confJsonPath = path.join(
      serverConfig.projectPath,
      "bdd_ai_conf.json"
    );
    const hasConfJson = fs.existsSync(confJsonPath);

    // Get arguments for this server type
    const confJsonPathToUse = hasConfJson ? confJsonPath : null;
    const args = this.getArgsForServerType(
      serverConfig,
      serverConfig.serverPath,
      confJsonPathToUse
    );

    const newConfig = {
      command: "uv",
      args: args,
      env: {
        PYTHONIOENCODING: "utf-8",
        PYTHONUTF8: "1",
        LANG: "en_US.UTF-8",
        LC_ALL: "en_US.UTF-8",
      },
    };

    mcpConfig.servers[serverConfig.name] = newConfig;

    // For appium server type, also add an SSE server configuration
    if (serverConfig.serverType === "appium-common") {
      const sseServerName = `${serverConfig.name}-sse`;
      const sseConfig = {
        type: "sse",
        url: "http://localhost:8000/sse",
      };
      mcpConfig.servers[sseServerName] = sseConfig;
      console.log(`Added SSE server configuration: ${sseServerName}`);
    }

    // Store configuration in workspace settings instead of global settings
    await config.update("mcp", mcpConfig, vscode.ConfigurationTarget.Workspace);
  }

  /**
   * Remove MCP server from VS Code settings (workspace-specific)
   */ private async removeMcpServerFromSettings(
    serverName: string
  ): Promise<void> {
    const config = vscode.workspace.getConfiguration();
    const currentMcpConfig = (config.get("mcp") as any) || { servers: {} };

    // Create a new plain object from the configuration to avoid proxy issues
    const mcpConfig = JSON.parse(JSON.stringify(currentMcpConfig));

    if (mcpConfig.servers && mcpConfig.servers[serverName]) {
      delete mcpConfig.servers[serverName];

      // Also remove the corresponding SSE server if it exists
      const sseServerName = `${serverName}-sse`;
      if (mcpConfig.servers[sseServerName]) {
        delete mcpConfig.servers[sseServerName];
        console.log(`Removed SSE server configuration: ${sseServerName}`);
      }

      // Remove configuration from workspace settings instead of global settings
      await config.update(
        "mcp",
        mcpConfig,
        vscode.ConfigurationTarget.Workspace
      );
    }
  }

  /**
   * Close any existing MCP Server Setup terminals to prevent file locking
   */
  private closeExistingMcpTerminals(): void {
    try {
      // Get all terminals and close any with "MCP Server Setup" name
      const terminals = vscode.window.terminals;
      let closedCount = 0;

      terminals.forEach((terminal) => {
        if (terminal.name === "MCP Server Setup") {
          terminal.dispose();
          closedCount++;
        }
      });
    } catch (error) {
      // Don't throw error as this is not critical
    }
  }

  /**
   * Read and process DRIVER_CONFIGS from appium-mcp-server conf/appium_conf.template.json
   */
  private async extractAppiumDriverConfigs(serverPath: string): Promise<any> {
    try {
      const driverConfPath = path.join(
        serverPath,
        "conf",
        "appium_conf.template.json"
      );

      if (!fs.existsSync(driverConfPath)) {
        console.warn(
          `conf/appium_conf.template.json not found at: ${driverConfPath}`
        );
        return {};
      }

      const content = fs.readFileSync(driverConfPath, "utf8");

      try {
        const configs = JSON.parse(content);

        // Extract APPIUM_DRIVER_CONFIGS from the JSON structure
        const driverConfigs = configs.APPIUM_DRIVER_CONFIGS || {};

        // Process each config to remove sensitive data and clean up
        const processedConfigs: any = {};
        for (const [platform, config] of Object.entries(driverConfigs)) {
          const processedConfig = JSON.parse(JSON.stringify(config)); // Deep clone

          // Clear userName and accessKey values from bstack:options (keep keys but set empty values)
          if (processedConfig["bstack:options"]) {
            if (processedConfig["bstack:options"].userName) {
              processedConfig["bstack:options"].userName = "";
            }
            if (processedConfig["bstack:options"].accessKey) {
              processedConfig["bstack:options"].accessKey = "";
            }
          }

          processedConfigs[platform] = processedConfig;
        }

        console.log(
          "Successfully extracted and processed DRIVER_CONFIGS from conf/appium_conf.template.json"
        );
        return processedConfigs;
      } catch (parseError) {
        console.warn(
          "Failed to parse conf/appium_conf.template.json as JSON:",
          parseError
        );
        return {};
      }
    } catch (error) {
      console.error(
        "Error extracting DRIVER_CONFIGS from conf/appium_conf.template.json:",
        error
      );
      return {};
    }
  }


  private async extractPywinautoConfig(serverPath: string): Promise<any> {
    try {
      const confJsonPath = path.join(serverPath, "conf", "pywinauto_conf.json");

      if (!fs.existsSync(confJsonPath)) {
        console.warn(`conf/pywinauto_conf.json not found at: ${confJsonPath}`);
        return {};
      }

      const content = fs.readFileSync(confJsonPath, "utf8");
      try {
        const pywinautoConf = JSON.parse(content);

        console.log(
          "Successfully extracted and processed PYWINAUTO_CONFIGS from conf/pywinauto_conf.json"
        );
        return pywinautoConf.PYWINAUTO_CONFIG;
      } catch (parseError) {
        console.warn(
          "Failed to parse conf/pywinauto_conf.json as JSON:",
          parseError
        );
        return {};
      }
    } catch (error) {
      console.error(
        "Error extracting PYWINAUTO_CONFIG from conf/pywinauto_conf.json:",
        error
      );
      return {};
    }
  }
  /**
   * Ensure bdd_ai_conf.json exists in the project directory.
   * If it doesn't exist, create it with default values
   * If it exists, merge default values with existing configuration
   */
  private async ensureConfJsonExists(
    projectPath: string,
    serverConfig?: McpServerConfig
  ): Promise<void> {
    const confJsonPath = path.join(projectPath, "bdd_ai_conf.json");

    // Default configuration that should be merged
    const defaultConfig: any = {
      LLM_API_KEY: "",
      AZURE_ENDPOINT: "",
      MODEL_NAME: "azure gpt-4o 2025-01-01-preview",
      COPILOT_PROMPT: DEFAULT_COPILOT_PROMPT,
    };

    // If this is an appium server, add APPIUM_DRIVER_CONFIGS
    if (serverConfig && serverConfig.serverType === "appium-common") {
      const appiumConfigs = await this.extractAppiumDriverConfigs(
        serverConfig.serverPath
      );
      if (Object.keys(appiumConfigs).length > 0) {
        defaultConfig.APPIUM_DRIVER_CONFIGS = appiumConfigs;
      }
    }

    // If this is a windows-browser server, add PYWINAUTO_CONFIG
    if (serverConfig && serverConfig.serverType === "windows-browser") {
      // For Windows browser automation, set BROWSER_TYPE based on serverConfig.browser
      const pywinautoConfig = await this.extractPywinautoConfig(
        serverConfig.serverPath
      );
      defaultConfig.PYWINAUTO_CONFIG = pywinautoConfig;
    }

    try {
      if (fs.existsSync(confJsonPath)) {
        // File exists, perform incremental update
        try {
          const existingContent = fs.readFileSync(confJsonPath, "utf8");
          const existingConfig = JSON.parse(existingContent);

          // Merge default config with existing config (existing values take precedence)
          const mergedConfig = { ...defaultConfig, ...existingConfig };

          // Only write if there are changes
          const currentContentString = JSON.stringify(existingConfig, null, 4);
          const mergedContentString = JSON.stringify(mergedConfig, null, 4);
          if (currentContentString !== mergedContentString) {
            fs.writeFileSync(confJsonPath, mergedContentString, "utf8");
          }
        } catch (parseError) {
          console.warn(
            "Failed to parse existing bdd_ai_conf.json, will recreate with default values:",
            parseError
          );
          fs.writeFileSync(
            confJsonPath,
            JSON.stringify(defaultConfig, null, 4),
            "utf8"
          );
        }
      } else {
        // File doesn't exist, create it with default configuration
        fs.writeFileSync(
          confJsonPath,
          JSON.stringify(defaultConfig, null, 4),
          "utf8"
        );
      }
    } catch (error) {
      console.error("Error ensuring bdd_ai_conf.json exists:", error);
      // Don't throw error as this is not critical for MCP server setup
    }
  }

  /**
   * Get the source directory name based on server type
   */
  private getSourceDirectoryForServerType(serverType: string): string {
    switch (serverType) {
      case "windows-browser":
        return "pywinauto-mcp-server";
      case "appium-common":
        return "appium-mcp-server";
      default:
        console.warn(
          `Unknown server type: ${serverType}, using default pywinauto-mcp-server`
        );
        return "pywinauto-mcp-server";
    }
  }

  /**
   * Get command line arguments based on server type
   */
  private getArgsForServerType(
    serverConfig: McpServerConfig,
    serverPath: string,
    confJsonPath: string | null = null
  ): string[] {
    const baseArgs = ["run", "--project", serverConfig.serverPath, "python"];

    // Get the script file and additional args based on server type
    switch (serverConfig.serverType) {
      case "windows-browser":
        // For Windows browser automation (pywinauto-mcp-server)
        const browserArgs = [
          path.join(serverConfig.serverPath, "simple_server.py"),
          "--transport",
          "stdio",
          "--app",
          serverConfig.browser,
        ];
        if (confJsonPath) {
          browserArgs.push("--config", confJsonPath);
        }
        return [...baseArgs, ...browserArgs];

      case "appium-common":
        // For appium automation (defaults to iOS platform regardless of host OS)
        const appiumArgs = [
          path.join(serverConfig.serverPath, "simple_server.py"),
          "--transport",
          "stdio",
          "--platform",
          "mac",
        ];
        if (confJsonPath) {
          appiumArgs.push("--config", confJsonPath);
        }
        return [...baseArgs, ...appiumArgs];

      default:
        // Fallback to basic configuration
        console.warn(
          `Unknown server type: ${serverConfig.serverType}, using default arguments`
        );
        return [
          ...baseArgs,
          path.join(serverConfig.serverPath, "simple_server.py"),
          "--transport",
          "stdio",
        ];
    }
  }
}
