// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { Platform } from "./platform";
import { getRequiredPackagesFromFile } from "./python";
import { executeInTerminal } from "./terminal";
import { GlobalState } from "../globalState";

/**
 * Get common UV installation paths for the current platform
 * @returns Array of potential UV executable paths
 */
function getUvCommonPaths(): string[] {
  const commonPaths: string[] = [];

  if (Platform.isWindows) {
    const userProfile = process.env.USERPROFILE || "";
    const localAppData = process.env.LOCALAPPDATA || "";

    commonPaths.push(
      // Most common: user local installation
      path.join(userProfile, ".local", "bin", "uv.exe"),
      // Cargo installation
      path.join(userProfile, ".cargo", "bin", "uv.exe"),
      // WinGet installations (common patterns)
      path.join(
        localAppData,
        "Microsoft",
        "WinGet",
        "Packages",
        "astral-sh.uv_Microsoft.Winget.Source_8wekyb3d8bbwe",
        "uv.exe"
      ),
      // Scoop installation
      path.join(userProfile, "scoop", "apps", "uv", "current", "uv.exe")
    );
  } else if (Platform.isMacOS) {
    commonPaths.push(
      // Homebrew installations
      "/opt/homebrew/bin/uv", // Apple Silicon Macs
      "/usr/local/bin/uv", // Intel Macs
      // Cargo installation
      path.join(os.homedir(), ".cargo", "bin", "uv"),
      // Manual installation
      path.join(os.homedir(), ".local", "bin", "uv")
    );
  }

  return commonPaths;
}

/**
 * Check UV availability with simplified logic to avoid infinite loops
 * This function performs a single-step check for UV without complex validation chains
 * @returns A promise that resolves to true if UV is available, false otherwise
 */
export async function checkUvAvailability(): Promise<boolean> {
  console.log("Checking UV availability (simplified check)...");

  // First try PATH detection (simple approach)
  const pathResult = await new Promise<boolean>((resolve) => {
    const checkCmd = Platform.getWhichCommand() + " uv";
    cp.exec(checkCmd, (error) => {
      resolve(!error);
    });
  });

  if (pathResult) {
    console.log("✅ UV found in PATH");
    return true;
  }

  console.log(
    "UV not found in PATH, checking common installation locations..."
  );

  // Check common installation locations using the shared function
  const commonPaths = getUvCommonPaths();

  // Check each common path (file existence only, no execution)
  for (const uvPath of commonPaths) {
    try {
      if (fs.existsSync(uvPath)) {
        console.log(`✅ UV found at: ${uvPath}`);
        return true;
      }
    } catch (fsError) {
      // Continue checking other paths
      console.log(`Error checking path ${uvPath}:`, fsError);
    }
  }

  console.log("❌ UV not found in PATH or common installation locations");
  return false;
}

/**
 * Get the path to the UV executable
 * This function first checks if UV is in PATH, then falls back to common installation locations
 * @returns A promise that resolves to the UV executable path, or null if not found
 */
export async function getUvExecutablePath(): Promise<string | null> {
  // First try standard PATH detection
  const pathResult = await new Promise<string | null>((resolve) => {
    const checkCmd = Platform.getWhichCommand() + " uv";
    cp.exec(checkCmd, (error, stdout) => {
      if (error) {
        resolve(null);
      } else {
        const uvPath = stdout.trim().split("\n")[0]; // Take first result
        resolve(uvPath);
      }
    });
  });

  if (pathResult) {
    console.log("UV found in PATH:", pathResult);
    return pathResult;
  }

  console.log(
    "UV not found in PATH, checking common installation locations..."
  );

  // Check common installation locations
  const commonPaths = getUvCommonPaths();

  // Check each common path
  for (const uvPath of commonPaths) {
    try {
      if (fs.existsSync(uvPath)) {
        console.log(`UV found at: ${uvPath}`);
        // Return the path immediately without complex validation
        // This avoids potential infinite loops in the validation chain
        return uvPath;
      }
    } catch (fsError) {
      // Continue checking other paths
      console.log(`Error checking path ${uvPath}:`, fsError);
    }
  }

  console.log(
    "❌ UV executable not found in PATH or common installation locations"
  );
  return null;
}

/**
 * Validate UV executable works by running a simple version check
 * This is separated from getUvExecutablePath to avoid infinite loops
 * @param uvPath The path to the UV executable to validate
 * @returns A promise that resolves to true if UV is working, false otherwise
 */
export async function validateUvExecutable(uvPath: string): Promise<boolean> {
  try {
    // Build the command avoiding the & parameter issue on Windows
    let fullCommand: string;
    if (Platform.isWindows) {
      fullCommand = `"${uvPath}" --version`;
    } else {
      fullCommand = `"${uvPath}" --version`;
    }

    const result = await new Promise<boolean>((resolve) => {
      const execOptions = {
        maxBuffer: 1024 * 1024,
        shell: Platform.getExecShell(),
      };

      cp.exec(fullCommand, execOptions, (error, stdout, stderr) => {
        if (error) {
          console.log(
            `UV validation failed at ${uvPath}:`,
            stderr || error.message
          );
          resolve(false);
        } else {
          console.log(`UV validation successful at ${uvPath}:`, stdout.trim());
          resolve(true);
        }
      });
    });

    return result;
  } catch (error) {
    console.log(
      `Error validating UV at ${uvPath}:`,
      error instanceof Error ? error.message : String(error)
    );
    return false;
  }
}

/**
 * Get the UV PATH setup command for the current platform
 * @param command The command to run after setting up UV PATH
 * @returns The command with UV PATH setup if needed (Windows) or just the command (other platforms)
 */
export function getUvPathCommand(command: string): string {
  if (Platform.isWindows) {
    // Add the UV path to the terminal's PATH for this session on Windows
    const userProfile = process.env.USERPROFILE || "";
    const uvLocalBinPath = path.join(userProfile, ".local", "bin");

    // Use PowerShell syntax to set PATH and then run the command
    return `$env:Path = "${uvLocalBinPath};$env:Path"; ${command}`;
  } else {
    // On Unix-like systems, UV should be in PATH after installation
    return command;
  }
}

/**
 * Execute a UV command with error handling in VS Code terminal
 * NOTE: This function now uses simplified getUvExecutablePath() which avoids infinite loops
 * @param uvCommand The UV command to execute (without the uv prefix)
 * @param description Description of the operation for logging
 * @param options Command execution options
 * @returns Promise that resolves to true if successful or rejects with error
 */
export async function executeUvCommand(
  uvCommand: string,
  description: string,
  options: { maxBuffer?: number; cwd?: string } = {}
): Promise<boolean> {
  const uvPath = await getUvExecutablePath();
  if (!uvPath) {
    throw new Error(`UV not found - cannot execute: ${description}`);
  }

  // Build the full command with proper quoting
  // Use PowerShell call operator & when on Windows to handle quoted executables
  const fullCommand = Platform.isWindows
    ? `& "${uvPath}" ${uvCommand}`
    : `"${uvPath}" ${uvCommand}`;
  console.log(`Executing UV command in terminal: ${fullCommand}`);

  // Add change directory command if cwd is specified
  let commandToExecute = fullCommand;
  if (options.cwd) {
    commandToExecute = Platform.createCdCommand(options.cwd, fullCommand);
  }

  // Execute in terminal with visible output
  const success = await executeInTerminal(commandToExecute, description, {
    hideFromUser: false,
    useExistingTerminal: undefined,
    commandSuccessCheck: async () => {
      // For UV commands, we consider it successful if the terminal completes without error
      // The terminal execution framework will handle error detection
      return true;
    },
    autoExit: false, // Don't auto-exit on failure - let users see the error
  });

  if (!success) {
    console.error(
      `${description} failed - terminal will remain open for error inspection`
    );
    throw new Error(
      `${description} failed - please check the terminal output for details`
    );
  }

  return success;
}

/**
 * Execute a UV command and capture its output, avoiding cp.exec issues with & parameter on Windows
 * NOTE: This function now uses simplified getUvExecutablePath() which avoids infinite loops
 * @param uvCommand The UV command to execute (without the uv prefix)
 * @param description Description of the operation for logging
 * @param options Command execution options
 * @returns Promise that resolves to the stdout output
 */
export async function executeUvCommandWithOutput(
  uvCommand: string,
  description: string,
  options: { maxBuffer?: number; cwd?: string } = {}
): Promise<string> {
  const uvPath = await getUvExecutablePath();
  if (!uvPath) {
    throw new Error(`UV not found - cannot execute: ${description}`);
  }

  console.log(`Executing UV command for output: ${uvCommand}`);

  // Build the command avoiding the & parameter issue on Windows
  // For Windows PowerShell, we need to use proper escaping and avoid & in cp.exec
  let fullCommand: string;
  if (Platform.isWindows) {
    // Use cmd.exe style command to avoid PowerShell & issues in cp.exec
    fullCommand = `"${uvPath}" ${uvCommand}`;
  } else {
    fullCommand = `"${uvPath}" ${uvCommand}`;
  }

  return new Promise<string>((resolve, reject) => {
    const execOptions = {
      maxBuffer: options.maxBuffer || 1024 * 1024 * 2,
      cwd: options.cwd,
      shell: Platform.getExecShell(),
    };

    cp.exec(fullCommand, execOptions, (error, stdout, stderr) => {
      if (error) {
        console.error(`${description} failed:`, stderr || error.message);
        reject(new Error(`${description} failed: ${stderr || error.message}`));
      } else {
        resolve(stdout);
      }
    });
  });
}

/**
 * Check if UV keyring is installed
 * @returns A promise that resolves to true if the UV keyring is installed, false otherwise
 */
export async function checkUvKeyringExists(): Promise<boolean> {
  console.log("Checking UV keyring installation...");

  // Try UV tool list first (most reliable method)
  try {
    // Since executeUvCommand now returns boolean, we need a different approach
    // We'll use a direct execution to get the output for parsing
    const uvPath = await getUvExecutablePath();
    if (!uvPath) {
      console.log("UV not found, cannot check keyring");
      return false;
    }

    // Execute the command directly to get stdout for parsing
    const stdout = await executeUvCommandWithOutput(
      "tool list",
      "UV tool list check"
    );

    const isKeyringInstalled = stdout.toLowerCase().includes("keyring");
    console.log("UV tool list output:", stdout);
    console.log("Keyring found in UV tools:", isKeyringInstalled);

    if (isKeyringInstalled) {
      console.log("✅ UV keyring detected via UV tool list");
      return true;
    }
  } catch (error) {
    console.log(
      "UV tool list check failed:",
      error instanceof Error ? error.message : String(error)
    );
  }

  // Try direct keyring command as fallback
  try {
    const keyringCommandResult = await new Promise<boolean>((resolve) => {
      const checkCmd = Platform.getWhichCommand() + " keyring";
      cp.exec(checkCmd, (error, stdout) => {
        if (error) {
          console.log("Keyring command not found in PATH");
          resolve(false);
        } else {
          console.log("Keyring command found in PATH:", stdout.trim());
          // Verify it actually works
          cp.exec("keyring --help", (helpError) => {
            if (helpError) {
              console.log("Keyring command exists but does not work");
              resolve(false);
            } else {
              console.log("✅ Keyring command works");
              resolve(true);
            }
          });
        }
      });
    });

    if (keyringCommandResult) {
      console.log("✅ UV keyring detected via direct command");
      return true;
    }
  } catch (error) {
    console.log(
      "Direct keyring command check failed:",
      error instanceof Error ? error.message : String(error)
    );
  }

  console.log("❌ UV keyring not detected");
  return false;
}

/**
 * Install UV keyring for Azure authentication
 * @param terminal The terminal to use for installation
 */
export async function installUvKeyring(
  terminal: vscode.Terminal
): Promise<boolean> {
  console.log("Installing UV keyring...");

  try {
    // First check if UV is installed
    const uvExists = await checkUvAvailability();
    if (!uvExists) {
      console.log("UV is not installed. Installing UV first...");
      const uvInstalled = await installUv(terminal);
      if (!uvInstalled) {
        throw new Error(
          "Failed to install UV - cannot proceed with keyring installation"
        );
      }
    }

    // On Windows, ensure the UV path is added to the terminal session
    const keyringInstallCommand = getUvPathCommand(
      "uv tool install keyring --with artifacts-keyring"
    );
    console.log(
      `Setting up UV PATH and installing keyring: ${keyringInstallCommand}`
    );
    // Install keyring with artifacts-keyring support for Azure authentication
    return executeInTerminal(keyringInstallCommand, "UV Keyring Installation", {
      useExistingTerminal: undefined,
      commandSuccessCheck: async () => {
        // Wait a bit for installation to complete
        await new Promise((resolve) => setTimeout(resolve, 3000));
        // Check if keyring was successfully installed
        return await checkUvKeyringExists();
      },
      autoExit: true, // Auto-exit after completion to properly close terminal and update UI
    });
  } catch (error) {
    console.error("Error installing UV keyring:", error);
    vscode.window.showErrorMessage(`Failed to install UV keyring: ${error}`);
    return false;
  }
}

/**
 * Check if Homebrew is available on macOS
 * @returns A promise that resolves to true if Homebrew is available, false otherwise
 */
async function checkBrewAvailability(): Promise<boolean> {
  return new Promise<boolean>((resolve) => {
    // Try standard PATH check first
    cp.exec("which brew", (error) => {
      if (!error) {
        resolve(true);
        return;
      }

      // If not found in PATH, check common Homebrew installation locations
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

      resolve(false);
    });
  });
}

/**
 * Install UV tool
 * @param terminal The terminal to use for installation
 * @returns A promise that resolves when installation completes
 */
export async function installUv(terminal: vscode.Terminal): Promise<boolean> {
  console.log("Installing UV tool...");

  try {
    // Install UV using platform-appropriate method
    let installCommand: string;
    if (Platform.isWindows) {
      // Use official UV PowerShell installation script
      installCommand =
        'powershell -ExecutionPolicy ByPass -c "irm https://astral.sh/uv/install.ps1 | iex"';
    } else if (Platform.isMacOS) {
      // Check if Homebrew is available before using it
      const brewAvailable = await checkBrewAvailability();
      if (!brewAvailable) {
        console.log("Homebrew not found, installing Homebrew first...");
        vscode.window.showInformationMessage(
          "Homebrew is required to install UV. Installing Homebrew first..."
        );

        // Install Homebrew first
        const { installHomebrew } = await import("./environment");
        const brewInstallSuccess = await installHomebrew(terminal);

        if (!brewInstallSuccess) {
          throw new Error(
            "Failed to install Homebrew, which is required for UV installation on macOS"
          );
        }

        console.log(
          "✅ Homebrew installed successfully, proceeding with UV installation"
        );
      }

      // Use Homebrew on macOS
      installCommand = "brew install uv";
    } else {
      throw new Error("UV installation is not supported on this platform");
    }
    return executeInTerminal(installCommand, "UV Installation", {
      useExistingTerminal: terminal, // Use the same terminal that was passed in
      commandSuccessCheck: async () => {
        // Wait a bit for installation to complete
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Update PATH in the current terminal session for both Windows and macOS
        if (Platform.isWindows) {
          const userProfile = process.env.USERPROFILE || "";
          const uvLocalBinPath = path.join(userProfile, ".local", "bin");

          console.log(
            `Adding UV to PATH in terminal session: ${uvLocalBinPath}`
          );
          terminal.sendText(`$env:Path = "${uvLocalBinPath};$env:Path"`);

          // Wait a moment for the PATH command to execute
          await new Promise((resolve) => setTimeout(resolve, 1000));
        } else if (Platform.isMacOS) {
          // On macOS, reload the shell profile to pick up Homebrew PATH changes
          console.log(
            "Reloading shell profile to pick up Homebrew PATH changes..."
          );

          // Try to reload common shell profiles
          const shellProfiles = [
            "~/.zshrc",
            "~/.bash_profile",
            "~/.bashrc",
            "~/.profile",
          ];

          // Source the profiles that exist
          terminal.sendText('echo "Reloading shell environment..."');
          for (const profile of shellProfiles) {
            terminal.sendText(`[ -f ${profile} ] && source ${profile} || true`);
          }

          // Also explicitly add Homebrew paths
          terminal.sendText(
            'export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"'
          );

          // Wait a moment for the PATH commands to execute
          await new Promise((resolve) => setTimeout(resolve, 2000));
        }

        // Use enhanced UV detection instead of just PATH-based detection
        console.log("Verifying UV installation with enhanced detection...");
        const uvPath = await getUvExecutablePath();
        const uvDetected = uvPath !== null;

        if (uvDetected) {
          console.log("✅ UV installation verified successfully");

          // Platform-specific success messages
          if (Platform.isWindows) {
            vscode.window.showInformationMessage(
              "UV installed successfully! The PATH has been updated for this terminal session."
            );
          } else if (Platform.isMacOS) {
            vscode.window.showInformationMessage(
              "UV installed successfully! The PATH has been updated for this terminal session."
            );
          }
        } else {
          console.log("❌ UV installation could not be verified");
          console.log(
            "This may be due to PATH not being refreshed. Please restart VS Code if UV detection fails."
          );

          // Platform-specific guidance about PATH
          if (Platform.isWindows) {
            const userProfile = process.env.USERPROFILE || "";
            const uvLocalBinPath = path.join(userProfile, ".local", "bin");

            vscode.window.showWarningMessage(
              `UV installed but may not be in PATH. The UV binary is located at: ${uvLocalBinPath}\\uv.exe`
            );
          } else if (Platform.isMacOS) {
            vscode.window.showWarningMessage(
              "UV installed but may not be immediately available in PATH. " +
                "The UV binary should be in /opt/homebrew/bin/uv or /usr/local/bin/uv. " +
                "Try restarting VS Code or opening a new terminal if UV is not detected."
            );
          }
        }

        return uvDetected;
      },
      autoExit: true, // Auto-exit after completion to properly close terminal and update UI
    });
  } catch (error) {
    console.error("Failed to install UV:", error);
    vscode.window.showErrorMessage("Failed to install UV: " + error);
    return false;
  }
}

/**
 * Create a UV virtual environment
 * @param envPath Path to create the virtual environment at
 * @returns A promise that resolves to true if the environment was created successfully
 */
export async function createUvVirtualEnvironment(
  envPath: string
): Promise<boolean> {
  console.log(`Creating UV virtual environment at ${envPath}...`);

  try {
    await executeUvCommand(
      `venv "${envPath}"`,
      "UV virtual environment creation"
    );
    console.log(`UV virtual environment created successfully at ${envPath}`);
    vscode.window.showInformationMessage(
      `UV virtual environment created successfully.`
    );
    return true;
  } catch (error) {
    console.error("Error creating UV virtual environment:", error);
    vscode.window.showErrorMessage(
      `Failed to create UV virtual environment: ${error}`
    );
    return false;
  }
}

/**
 * Get the extension storage path for consistency between venv and repository locations
 * @returns The path to the extension's global storage directory
 */
export function getExtensionStoragePath(): string {
  const extensionStoragePath = GlobalState.context?.globalStorageUri.fsPath;
  if (!extensionStoragePath) {
    throw new Error("Extension context not initialized");
  }
  return extensionStoragePath;
}

/**
 * Get the path to the default UV virtual environment for the extension
 * @returns The path to the default UV virtual environment
 */
export function getDefaultUvVenvPath(): string {
  return path.join(getExtensionStoragePath(), ".venv");
}

/**
 * Ensure the default UV virtual environment exists
 * @returns A promise that resolves to true if the environment exists or was created successfully
 */
export async function ensureDefaultUvVenvExists(): Promise<boolean> {
  const venvPath = getDefaultUvVenvPath();
  console.log(
    `No existing UV environment found, creating new one at ${venvPath}`
  );

  // Check if the virtual environment already exists at default location
  if (fs.existsSync(venvPath)) {
    const activateScript = path.join(
      venvPath,
      Platform.isWindows ? "Scripts" : "bin",
      Platform.isWindows ? "activate.ps1" : "activate"
    );

    if (fs.existsSync(activateScript)) {
      console.log(`UV virtual environment exists at ${venvPath}`);
      return true;
    }
  }

  // Virtual environment doesn't exist or is incomplete, create it
  return await createUvVirtualEnvironment(venvPath);
}

/**
 * Get the activate command for the UV virtual environment
 * @param venvPath Path to the virtual environment (optional, will auto-discover if not provided)
 * @returns Promise that resolves to the command to activate the virtual environment
 */
export async function getUvVenvActivateCommand(
  venvPath?: string
): Promise<string> {
  const actualVenvPath = venvPath || getDefaultUvVenvPath();

  if (Platform.isWindows) {
    return `. "${path.join(actualVenvPath, "Scripts", "activate.ps1")}"`;
  } else {
    return `source "${path.join(actualVenvPath, "bin", "activate")}"`;
  }
}
