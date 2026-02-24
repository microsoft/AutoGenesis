// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as cp from "child_process";
import { Platform } from "./platform";
import { checkPythonInstallation, PythonCheckResult } from "./python";
import { checkUvAvailability } from "./uv";
import { executeInTerminal } from "./terminal";

/**
 * Interface for environment check results
 */
export interface EnvironmentStatus {
  npm: boolean;
  code: boolean;
  python: boolean;
  uv: boolean;
  dotnetSdk: boolean;
  pythonVersion?: string;
  pythonError?: string;
  pythonDetailedError?: string;
  pythonInstallationGuidance?: string;
  pythonFoundVersions?: Array<{
    command: string;
    version: string;
    isCompatible: boolean;
  }>;
  allReady: boolean;
  // New fields for resolve button logic
  canAutoResolve: boolean; // True if we can auto-resolve some issues (cli/uv)
  manualInstallNeeded: string[]; // List of tools that need manual installation (npm/python)
  autoResolveNeeded: string[]; // List of tools that can be auto-resolved (cli/uv)
}

/**
 * Check if a command exists in the system path or UV tools
 * @param command The command to check
 * @returns A promise that resolves to true if the command exists, false otherwise
 */
export async function checkCommandExists(command: string): Promise<boolean> {
  // Special handling for UV command - use enhanced detection but avoid infinite loops
  if (command === "uv") {
    return await checkUvAvailability();
  }

  // Special handling for brew on macOS
  if (command === "brew" && Platform.isMacOS) {
    return new Promise<boolean>(async (resolve) => {
      // Try standard PATH check first
      const checkCmd = Platform.getWhichCommand() + " brew";

      cp.exec(checkCmd, async (error) => {
        if (!error) {
          resolve(true);
          return;
        }

        // If not found in PATH, check common Homebrew installation locations

        // Common Homebrew paths on Mac
        const commonBrewPaths = [
          "/opt/homebrew/bin/brew", // Apple Silicon Macs
          "/usr/local/bin/brew", // Intel Macs
          `${process.env.HOME}/homebrew/bin/brew`, // Custom installation
          `${process.env.HOME}/.homebrew/bin/brew`, // Custom installation
        ];

        // Check each path
        for (const brewPath of commonBrewPaths) {
          try {
            cp.execSync(`${brewPath} --version`, { timeout: 3000 });
            resolve(true);
            return;
          } catch (pathError) {
            // Continue to the next path
          }
        }

        // Try using the --prefix option to find brew
        try {
          const brewPrefix = cp
            .execSync("brew --prefix", { timeout: 3000 })
            .toString()
            .trim();
          if (brewPrefix) {
            resolve(true);
            return;
          }
        } catch (prefixError) {
          // Continue with checks
        }

        resolve(false);
      });
    });
  }

  // Special handling for VS Code CLI command with enhanced detection
  if (command === "code") {
    return new Promise<boolean>((resolve) => {
      // Helper function to check common paths
      const checkCommonPaths = () => {
        const commonPaths = Platform.isMacOS
          ? [
              "/usr/local/bin/code",
              "/opt/homebrew/bin/code",
              "/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code",
              "/Applications/Visual Studio Code - Insiders.app/Contents/Resources/app/bin/code",
              `${process.env.HOME}/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code`,
              `${process.env.HOME}/Downloads/Visual Studio Code.app/Contents/Resources/app/bin/code`,
              `${process.env.HOME}/Desktop/Visual Studio Code.app/Contents/Resources/app/bin/code`,
            ]
          : Platform.isWindows
            ? [
                "C:\\Users\\%USERNAME%\\AppData\\Local\\Programs\\Microsoft VS Code\\bin\\code.cmd",
                "C:\\Program Files\\Microsoft VS Code\\bin\\code.cmd",
                "C:\\Program Files (x86)\\Microsoft VS Code\\bin\\code.cmd",
              ]
            : ["/usr/bin/code", "/usr/local/bin/code"];

        console.log("Checking common VS Code CLI paths:", commonPaths);

        let pathsChecked = 0;
        let found = false;

        if (commonPaths.length === 0) {
          console.log("No common paths to check");
          resolve(false);
          return;
        }

        for (const codePath of commonPaths) {
          cp.exec(`"${codePath}" --version`, (pathError, pathStdout) => {
            pathsChecked++;

            if (!pathError && pathStdout.trim() && !found) {
              found = true;
              resolve(true);
              return;
            }

            if (pathsChecked === commonPaths.length && !found) {
              resolve(false);
            }
          });
        }
      };

      // Try standard PATH check first
      const checkCmd = Platform.getWhichCommand() + " code";

      cp.exec(checkCmd, (error, stdout) => {
        if (!error) {
          resolve(true);
          return;
        }

        // If not found in PATH, try direct execution with version check
        cp.exec("code --version", (versionError, versionStdout) => {
          if (!versionError && versionStdout.trim()) {
            resolve(true);
            return;
          }

          // If still not found, try to find VS Code app using Spotlight (macOS only)
          if (Platform.isMacOS) {
            cp.exec(
              "mdfind \"kMDItemCFBundleIdentifier == 'com.microsoft.VSCode'\"",
              (spotlightError, spotlightStdout) => {
                if (!spotlightError && spotlightStdout.trim()) {
                  const vsCodeAppPath = spotlightStdout.trim().split("\n")[0];
                  const vscodeCliPath = `${vsCodeAppPath}/Contents/Resources/app/bin/code`;

                  cp.exec(
                    `"${vscodeCliPath}" --version`,
                    (cliError, cliStdout) => {
                      if (!cliError && cliStdout.trim()) {
                        resolve(true);
                        return;
                      } else {
                        // Fall back to checking common paths
                        checkCommonPaths();
                      }
                    }
                  );
                } else {
                  // Fall back to checking common paths
                  checkCommonPaths();
                }
              }
            );
          } else {
            // For non-macOS, go directly to common paths
            checkCommonPaths();
          }
        });
      });
    });
  }

  // Standard check for other commands
  return new Promise<boolean>((resolve) => {
    const checkCmd = Platform.getWhichCommand() + ` ${command}`;

    cp.exec(checkCmd, { timeout: 5000 }, (error) => {
      if (!error) {
        // Command found in PATH
        resolve(true);
        return;
      }

      // If not found in PATH, check if it's a UV tool (for commands like 'keyring')
      if (command === "keyring") {
        try {
          // Check if keyring is installed as a UV tool
          cp.exec("uv tool list", { timeout: 5000 }, (toolError, stdout) => {
            if (toolError) {
              resolve(false);
            } else {
              const isKeyringInstalled = stdout
                .toLowerCase()
                .includes("keyring");
              console.log(`UV tool check for ${command}:`, isKeyringInstalled);
              resolve(isKeyringInstalled);
            }
          });
          return;
        } catch (uvError) {
          console.log(`Error checking UV tools for ${command}:`, uvError);
        }
      }
      // Command not found
      resolve(false);
    });
  });
}

/**
 * Check if all required environment tools are installed
 * FIXED: UV checking now uses simplified logic to prevent infinite loops
 * @returns An object with the status of each required tool
 */
export async function checkEnvironment(): Promise<EnvironmentStatus> {
  console.log(
    "Starting environment check with optimized order: NPM → VS Code CLI → Python → UV"
  );

  // Check in optimized order: NPM → VS Code CLI → Python → UV
  const npmReady = await checkCommandExists("npm");
  const codeReady = await checkCommandExists("code");

  // Enhanced Python detection with detailed error reporting
  const pythonCheck = await checkPythonInstallation();
  const pythonReady = pythonCheck.isValid;

  // UV checking now uses simplified checkUvAvailability() to avoid infinite loops
  const uvReady = await checkCommandExists("uv");

  // Note: dotnet support has been removed for macOS platform
  const dotnetReady = true; // Always true since we don't check dotnet anymore

  // All tools must be ready (npm, code, python, uv)
  const allReady = npmReady && codeReady && pythonReady && uvReady;

  // Determine resolve button logic based on platform
  const manualInstallNeeded: string[] = [];
  const autoResolveNeeded: string[] = [];

  if (Platform.isMacOS) {
    // On macOS, all tools can be auto-resolved
    if (!npmReady) {
      autoResolveNeeded.push("npm");
    }
    if (!pythonReady) {
      autoResolveNeeded.push("python");
    }
    if (!codeReady) {
      autoResolveNeeded.push("code");
    }
    if (!uvReady) {
      autoResolveNeeded.push("uv");
    }
  } else {
    // On Windows/other platforms, NPM and Python require manual installation
    if (!npmReady) {
      manualInstallNeeded.push("npm");
    }
    if (!pythonReady) {
      manualInstallNeeded.push("python");
    }

    // CLI and UV can be auto-resolved
    if (!codeReady) {
      autoResolveNeeded.push("code");
    }
    if (!uvReady) {
      autoResolveNeeded.push("uv");
    }
  }
  // Note: dotnet support removed for macOS

  // Can auto resolve if there are any auto-resolvable issues
  const canAutoResolve = autoResolveNeeded.length > 0;

  console.log("Environment check results:", {
    npm: npmReady,
    code: codeReady,
    python: pythonReady,
    pythonVersion: pythonCheck.version,
    pythonError: pythonCheck.error,
    pythonDetailedError: pythonCheck.detailedError,
    pythonFoundVersions: pythonCheck.foundVersions,
    uv: uvReady,
    dotnetSdk: dotnetReady,
    allReady,
    canAutoResolve,
    manualInstallNeeded,
    autoResolveNeeded,
  });

  return {
    npm: npmReady,
    code: codeReady,
    python: pythonReady,
    pythonVersion: pythonCheck.version,
    pythonError: pythonCheck.error,
    pythonDetailedError: pythonCheck.detailedError,
    pythonInstallationGuidance: pythonCheck.installationGuidance,
    pythonFoundVersions: pythonCheck.foundVersions,
    uv: uvReady,
    dotnetSdk: dotnetReady,
    allReady,
    canAutoResolve,
    manualInstallNeeded,
    autoResolveNeeded,
  };
}

/**
 * Install NPM tool
 * @param terminal The terminal to use for installation
 */
export async function installNpm(terminal: vscode.Terminal): Promise<boolean> {
  console.log("Starting NPM installation...");
  const platform = require("os").platform();
  let command = "";

  if (platform === "darwin") {
    // First check if Homebrew is installed
    const brewAvailable = await checkCommandExists("brew");
    console.log(`Homebrew availability check: ${brewAvailable}`);

    if (!brewAvailable) {
      console.log("Homebrew is not installed, installing it first...");
      vscode.window.showInformationMessage(
        "Homebrew is required for NPM installation on macOS. Installing Homebrew first..."
      );

      const brewInstallSuccess = await installHomebrew(terminal);
      if (!brewInstallSuccess) {
        console.error(
          "Failed to install Homebrew, cannot proceed with NPM installation"
        );
        vscode.window.showErrorMessage(
          "Failed to install Homebrew. NPM installation cannot proceed. Please install Homebrew manually from https://brew.sh/"
        );
        return false;
      }

      console.log(
        "✅ Homebrew installed successfully, proceeding with NPM installation..."
      );
    }

    // On macOS, we install Node.js using Homebrew which includes npm
    command = "brew install node";
    console.log(`Using macOS installation command: ${command}`);
  } else if (platform === "win32") {
    // For Windows, use winget to install Node.js
    command = "winget install --id=OpenJS.NodeJS -e";
    console.log(`Using Windows installation command: ${command}`);
  } else {
    console.error(`Unsupported platform for NPM installation: ${platform}`);
    vscode.window.showErrorMessage(
      "NPM installation is not supported on this platform."
    );
    return false;
  }

  try {
    console.log("Executing NPM installation command...");
    const result = await executeInTerminal(command, "NPM Installation", {
      useExistingTerminal: terminal, // Use the same terminal that was passed in
      commandSuccessCheck: async () => {
        console.log("Running post-installation success check for NPM...");
        // Wait longer for NPM/Node.js installation to complete (especially on Homebrew)
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // On macOS, refresh PATH after Homebrew installation
        if (platform === "darwin") {
          console.log("Refreshing PATH after Homebrew installation...");
          terminal.sendText(
            'echo "Reloading shell environment for npm/node..."'
          );

          // Try to reload common shell profiles
          const shellProfiles = [
            "~/.zshrc",
            "~/.bash_profile",
            "~/.bashrc",
            "~/.profile",
          ];
          for (const profile of shellProfiles) {
            terminal.sendText(`[ -f ${profile} ] && source ${profile} || true`);
          }

          // Also explicitly add Homebrew paths
          terminal.sendText(
            'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"'
          );

          // Wait for PATH commands to execute
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Check both npm and node commands
        const npmAvailable = await checkCommandExists("npm");
        const nodeAvailable = await checkCommandExists("node");
        console.log(`NPM availability after installation: ${npmAvailable}`);
        console.log(
          `Node.js availability after installation: ${nodeAvailable}`
        );

        // Both npm and node should be available after installation
        const success = npmAvailable && nodeAvailable;

        if (success) {
          console.log("✅ NPM/Node.js installation verification successful");
        } else {
          console.log("❌ NPM/Node.js installation verification failed");

          // Additional diagnostic information
          if (!npmAvailable && !nodeAvailable) {
            console.log("❌ Neither npm nor node.js found after installation");
            if (platform === "darwin") {
              vscode.window.showWarningMessage(
                "npm/node.js installed but may not be immediately available in PATH. " +
                  "The binaries should be in /opt/homebrew/bin/ or /usr/local/bin/. " +
                  "Try restarting VS Code or opening a new terminal if not detected."
              );
            }
          } else if (!npmAvailable) {
            console.log("❌ npm not found but node.js is available");
          } else if (!nodeAvailable) {
            console.log("❌ node.js not found but npm is available");
          }
        }

        return success;
      },
      autoExit: false, // Don't exit automatically to allow for longer installation time
      timeout: 900000, // Increase timeout to 15 minutes for Node.js installation
    });

    console.log(`NPM installation result: ${result}`);

    if (result) {
      console.log("✅ NPM installation completed successfully");
    } else {
      console.log("❌ NPM installation failed or verification failed");
    }

    return result;
  } catch (error) {
    console.error(
      `Error installing NPM: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("Full error details:", error);
    vscode.window.showErrorMessage(
      `Failed to install NPM: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Install VS Code CLI
 * @param terminal The terminal to use for installation
 */
export async function installVsCodeCli(
  terminal: vscode.Terminal
): Promise<void> {
  console.log("Installing VS Code CLI...");

  try {
    // Try the standard command first
    await vscode.commands.executeCommand("workbench.action.installCommandLine");
    vscode.window.showInformationMessage(
      "VS Code CLI installation started. This will add the `code` command to your PATH."
    );
  } catch (error: unknown) {
    console.log("Standard command failed, trying alternative approaches...");

    try {
      // Try alternative command for Insiders builds
      await vscode.commands.executeCommand(
        "workbench.action.terminal.installShellCommand"
      );
      vscode.window.showInformationMessage(
        "VS Code CLI installation started. This will add the `code` command to your PATH."
      );
    } catch (secondError: unknown) {
      console.log(
        "Alternative command also failed, providing manual instructions..."
      );

      // Provide manual installation instructions
      const isInsiders = vscode.env.appName.toLowerCase().includes("insiders");
      const commandKey = Platform.isMacOS ? "Cmd+Shift+P" : "Ctrl+Shift+P";
      const installCommand = isInsiders
        ? "Install 'code-insiders' command in PATH"
        : "Install 'code' command in PATH";

      // Show terminal with manual instructions
      terminal.show();
      terminal.sendText(
        'echo "=============================================="'
      );
      terminal.sendText(
        'echo "   VS Code CLI Manual Installation Required   "'
      );
      terminal.sendText(
        'echo "=============================================="'
      );
      terminal.sendText('echo ""');
      terminal.sendText(
        `echo "The automatic CLI installation failed in ${isInsiders ? "VS Code Insiders" : "VS Code"}."`
      );
      terminal.sendText('echo ""');
      terminal.sendText(
        'echo "Please install manually using Command Palette:"'
      );
      terminal.sendText(`echo "1. Press ${commandKey}"`);
      terminal.sendText(`echo "2. Type: ${installCommand}"`);
      terminal.sendText('echo "3. Select the command and press Enter"');
      terminal.sendText('echo ""');
      terminal.sendText(
        'echo "After installation, restart this VS Code window to detect the CLI."'
      );
      terminal.sendText('echo ""');
      terminal.sendText(
        'echo "=============================================="'
      );

      // Show user-friendly error message
      vscode.window
        .showWarningMessage(
          `VS Code CLI auto-installation failed. Please install manually:\n\n` +
            `1. Press ${commandKey}\n` +
            `2. Type: "${installCommand}"\n` +
            `3. Select the command and press Enter\n\n` +
            `After installation, restart VS Code to detect the CLI.`,
          "Open Command Palette"
        )
        .then((selection) => {
          if (selection === "Open Command Palette") {
            vscode.commands.executeCommand("workbench.action.showCommands");
          }
        });
    }
  }
}

/**
 * Install .NET SDK (required for Azure auth on macOS)
 * @param terminal The terminal to use for installation
 */
export async function installDotNetSdk(
  terminal: vscode.Terminal
): Promise<boolean> {
  console.log("Installing .NET SDK...");

  const platform = require("os").platform();
  if (platform === "darwin") {
    try {
      // First check if Homebrew is installed
      const brewAvailable = await checkCommandExists("brew");
      console.log(`Homebrew availability check: ${brewAvailable}`);

      if (!brewAvailable) {
        console.log("Homebrew is not installed, installing it first...");
        vscode.window.showInformationMessage(
          "Homebrew is required for .NET SDK installation on macOS. Installing Homebrew first..."
        );

        const brewInstallSuccess = await installHomebrew(terminal);
        if (!brewInstallSuccess) {
          console.error(
            "Failed to install Homebrew, cannot proceed with .NET SDK installation"
          );
          vscode.window.showErrorMessage(
            "Failed to install Homebrew. .NET SDK installation cannot proceed. Please install Homebrew manually from https://brew.sh/"
          );
          return false;
        }

        console.log(
          "✅ Homebrew installed successfully, proceeding with .NET SDK installation..."
        );
      }

      return executeInTerminal(
        "brew install dotnet-sdk",
        ".NET SDK Installation",
        {
          useExistingTerminal: terminal,
          commandSuccessCheck: async () => {
            // Wait a bit for installation to complete
            await new Promise((resolve) => setTimeout(resolve, 3000));

            // Refresh PATH after Homebrew installation
            console.log("Refreshing PATH after .NET SDK installation...");
            terminal.sendText(
              'echo "Reloading shell environment for dotnet..."'
            );

            // Try to reload common shell profiles
            const shellProfiles = [
              "~/.zshrc",
              "~/.bash_profile",
              "~/.bashrc",
              "~/.profile",
            ];
            for (const profile of shellProfiles) {
              terminal.sendText(
                `[ -f ${profile} ] && source ${profile} || true`
              );
            }

            // Also explicitly add Homebrew paths
            terminal.sendText(
              'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"'
            );

            // Wait for PATH commands to execute
            await new Promise((resolve) => setTimeout(resolve, 2000));

            const dotnetAvailable = await checkCommandExists("dotnet");

            if (!dotnetAvailable) {
              vscode.window.showWarningMessage(
                ".NET SDK installed but may not be immediately available in PATH. " +
                  "The binary should be in /opt/homebrew/bin/dotnet or /usr/local/bin/dotnet. " +
                  "Try restarting VS Code or opening a new terminal if not detected."
              );
            }

            return dotnetAvailable;
          },
        }
      );
    } catch (error) {
      console.error(
        `Error installing .NET SDK: ${error instanceof Error ? error.message : String(error)}`
      );
      vscode.window.showErrorMessage(
        `Failed to install .NET SDK: ${error instanceof Error ? error.message : String(error)}`
      );
      return false;
    }
  } else {
    vscode.window.showErrorMessage(
      ".NET SDK installation is only required on macOS for this extension."
    );
    return false;
  }
}

/**
 * Install Homebrew on macOS
 * @param terminal The terminal to use for installation
 */
export async function installHomebrew(
  terminal: vscode.Terminal
): Promise<boolean> {
  console.log("Installing Homebrew...");

  // Homebrew installation command from official website
  const command =
    '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"';
  console.log(`Using Homebrew installation command: ${command}`);

  try {
    console.log("Executing Homebrew installation command...");
    const result = await executeInTerminal(command, "Homebrew Installation", {
      useExistingTerminal: undefined,
      commandSuccessCheck: async () => {
        console.log("Running post-installation success check for Homebrew...");
        // Wait a bit for installation to complete
        await new Promise((resolve) => setTimeout(resolve, 5000));

        const brewAvailable = await checkCommandExists("brew");
        console.log(
          `Homebrew availability after installation: ${brewAvailable}`
        );

        if (brewAvailable) {
          console.log("✅ Homebrew installation verification successful");
        } else {
          console.log("❌ Homebrew installation verification failed");
        }

        return brewAvailable;
      },
      autoExit: true,
      timeout: 900000, // 15 minutes timeout for Homebrew installation
    });

    console.log(`Homebrew installation result: ${result}`);

    if (result) {
      console.log("✅ Homebrew installation completed successfully");
      // Only show one success message to avoid duplication
      vscode.window.showInformationMessage(
        "✅ Homebrew installed successfully!"
      );
    } else {
      console.log("❌ Homebrew installation failed or verification failed");
      vscode.window.showErrorMessage("❌ Homebrew installation failed");
    }

    return result;
  } catch (error) {
    console.error(
      `Error installing Homebrew: ${error instanceof Error ? error.message : String(error)}`
    );
    console.error("Full error details:", error);
    vscode.window.showErrorMessage(
      `Failed to install Homebrew: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}
