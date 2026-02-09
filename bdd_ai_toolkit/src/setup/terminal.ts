import * as vscode from "vscode";
import * as cp from "child_process";
import * as fs from "fs";
import * as path from "path";
import { Platform } from "./platform";

/**
 * Create a terminal with platform-specific shell configuration and optionally show it
 * @param name The name for the terminal
 * @param options Optional configuration for terminal creation
 * @returns The created terminal
 */
export function createAndShowTerminal(
  name: string,
  options: {
    show?: boolean;
    hideFromUser?: boolean;
    shellPath?: string;
  } = {}
): vscode.Terminal & { dispose(): void } {
  const { show = true, hideFromUser = false, shellPath } = options;

  const terminal = vscode.window.createTerminal({
    name,
    hideFromUser,
    shellPath: shellPath || Platform.getShell(),
  });

  if (show) {
    terminal.show();
  }

  return terminal;
}

/**
 * Execute a command in a terminal with configurable options
 * @param command The command to execute
 * @param terminalName The name for the terminal
 * @param options Configuration options for execution
 * @returns A promise that resolves to true if the command was successful
 */
export async function executeInTerminal(
  command: string,
  terminalName: string,
  options: {
    hideFromUser?: boolean;
    useExistingTerminal?: vscode.Terminal;
    commandSuccessCheck?: () => Promise<boolean>;
    autoExit?: boolean;
    timeout?: number;
  } = {}
): Promise<boolean> {
  const {
    hideFromUser = false,
    useExistingTerminal,
    commandSuccessCheck,
    autoExit = false,
    timeout = 600000,
  } = options;

  // Use existing terminal or create new one
  const terminal =
    useExistingTerminal ||
    createAndShowTerminal(terminalName, {
      show: false,
      hideFromUser,
      shellPath: Platform.getShell(),
    });

  if (useExistingTerminal) {
    // For existing terminal, just execute and check
    console.log(`Executing ${terminalName} in existing terminal...`);

    // Make sure the terminal is visible when using an existing terminal
    if (!hideFromUser) {
      terminal.show();
    }

    // Apply autoExit for existing terminal too
    const commandToSend = autoExit ? `${command};exit` : command;
    terminal.sendText(commandToSend);

    // Wait for command execution with proper timeout handling
    return new Promise<boolean>((resolve) => {
      let isResolved = false;

      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          console.log(`❌ ${terminalName} timed out after ${timeout}ms`);
          vscode.window.showWarningMessage(
            `${terminalName} is taking longer than expected (>${timeout / 60000} minutes). Please check the terminal.`
          );
          resolve(false);
        }
      }, timeout);

      // Initial wait for command to start
      setTimeout(async () => {
        if (isResolved) return;

        if (commandSuccessCheck) {
          try {
            // Give more time for installation to complete before checking
            await new Promise((resolve) => setTimeout(resolve, 15000)); // Wait 15 seconds initially

            // Retry success check with limited retries (max 2 attempts after initial check)
            const maxRetries = 2; // Only retry 2 times to avoid excessive waiting on MacOS when auto resolve fails
            let retryCount = 0;

            const checkWithRetry = async (): Promise<void> => {
              if (isResolved) return;

              try {
                const isSuccessful = await commandSuccessCheck();
                if (isSuccessful) {
                  if (!isResolved) {
                    isResolved = true;
                    clearTimeout(timeoutHandle);
                    console.log(`✅ ${terminalName} completed successfully`);
                    // Note: Success message will be shown by the calling function to avoid duplication
                    resolve(true);
                  }
                } else {
                  retryCount++;
                  if (retryCount < maxRetries) {
                    console.log(
                      `${terminalName} not ready yet, retrying in 30 seconds... (attempt ${retryCount}/${maxRetries})`
                    );
                    setTimeout(checkWithRetry, 30000); // Wait 30 seconds before next retry
                  } else {
                    if (!isResolved) {
                      isResolved = true;
                      clearTimeout(timeoutHandle);
                      console.log(
                        `❌ ${terminalName} verification failed after ${maxRetries} attempts`
                      );
                      vscode.window.showWarningMessage(
                        `${terminalName} may have failed. Please check the terminal output.`
                      );
                      resolve(false);
                    }
                  }
                }
              } catch (error) {
                console.error(`Error checking ${terminalName} success:`, error);
                if (!isResolved) {
                  isResolved = true;
                  clearTimeout(timeoutHandle);
                  vscode.window.showErrorMessage(
                    `Error checking ${terminalName} completion: ${error}`
                  );
                  resolve(false);
                }
              }
            };

            await checkWithRetry();
          } catch (error) {
            console.error(`Error in ${terminalName} success check:`, error);
            if (!isResolved) {
              isResolved = true;
              clearTimeout(timeoutHandle);
              vscode.window.showErrorMessage(
                `Error checking ${terminalName} completion: ${error}`
              );
              resolve(false);
            }
          }
        } else {
          // No success check, just resolve after initial wait
          if (!isResolved) {
            isResolved = true;
            clearTimeout(timeoutHandle);
            resolve(true);
          }
        }
      }, 10000); // Initial 10 second wait
    });
  } else {
    // For new terminal, set up event handling
    return new Promise<boolean>((resolve) => {
      let isResolved = false;

      const disposable = vscode.window.onDidCloseTerminal(
        async (closedTerminal) => {
          if (closedTerminal === terminal && !isResolved) {
            isResolved = true;
            if (commandSuccessCheck) {
              try {
                const isSuccessful = await commandSuccessCheck();
                if (isSuccessful) {
                  console.log(`✅ ${terminalName} completed successfully`);
                  // vscode.window.showInformationMessage(`${terminalName} completed successfully.`);
                  resolve(true);
                } else {
                  console.log(
                    `❌ ${terminalName} may have failed - please check terminal output`
                  );
                  vscode.window.showWarningMessage(
                    `${terminalName} may have failed. Please check the terminal output for details.`
                  );
                  resolve(false);
                }
              } catch (error) {
                console.error(`Error in ${terminalName} success check:`, error);
                vscode.window.showErrorMessage(
                  `Error checking ${terminalName} completion: ${error}`
                );
                resolve(false);
              }
            } else {
              console.log(`${terminalName} terminal closed`);
              resolve(true);
            }
            disposable.dispose();
          }
        }
      );

      if (!hideFromUser) {
        terminal.show();
      }

      const commandToSend = autoExit ? `${command};exit` : command;
      terminal.sendText(commandToSend);

      // Timeout handler
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          vscode.window.showWarningMessage(
            `${terminalName} is taking longer than expected. Please check the terminal.`
          );
          resolve(false);
          disposable.dispose();
        }
      }, timeout);
    });
  }
}

/**
 * Clone a Git repository to a specific directory
 * @param repoUrl The URL of the Git repository to clone
 * @param targetDir The target directory where the repository should be cloned
 * @param terminalName Optional name for the terminal (defaults to 'Git Clone')
 * @returns A promise that resolves to true if the clone was successful
 */
export async function cloneGitRepository(
  repoUrl: string,
  targetDir: string,
  terminalName = "Git Clone",
  expectedFiles: string[] = []
): Promise<boolean> {
  try {
    // Check if git is available
    const gitAvailable = await new Promise<boolean>((resolve) => {
      const checkCmd = Platform.getWhichCommand() + " git";
      cp.exec(checkCmd, (error, stdout) => {
        if (error) {
          console.log("Git not found in PATH");
          resolve(false);
        } else {
          console.log("Git found:", stdout.trim());
          resolve(true);
        }
      });
    });

    if (!gitAvailable) {
      vscode.window.showErrorMessage(
        "Git is not available in the system PATH. Please install Git first."
      );
      return false;
    }

    // Ensure parent directory exists
    const parentDir = path.dirname(targetDir);
    if (!fs.existsSync(parentDir)) {
      fs.mkdirSync(parentDir, { recursive: true });
    }

    // Remove existing directory if it exists
    if (fs.existsSync(targetDir)) {
      console.log(`Removing existing directory: ${targetDir}`);
      fs.rmSync(targetDir, { recursive: true, force: true });
    }

    // Create terminal and execute git clone
    const terminal = createAndShowTerminal(terminalName);

    // Navigate to parent directory and clone (platform-aware)
    let cloneCommand: string;
    if (Platform.isWindows) {
      // PowerShell syntax: use semicolon for command chaining
      cloneCommand = `cd "${parentDir}"; git clone "${repoUrl}" "${path.basename(targetDir)}"`;
    } else {
      // Unix/Linux/macOS syntax: use && for command chaining
      cloneCommand = `cd "${parentDir}" && git clone "${repoUrl}" "${path.basename(targetDir)}"`;
    }

    console.log(`Cloning repository from ${repoUrl} to ${targetDir}`);
    vscode.window.showInformationMessage(
      `Cloning repository from GitHub, please wait...`
    );
    terminal.sendText(cloneCommand);

    // Wait for clone to complete and verify
    return new Promise<boolean>((resolve) => {
      let isResolved = false;
      const maxWait = 60000; // 60 seconds timeout

      const checkCloneCompletion = () => {
        // Check if the target directory exists and has a .git folder
        const gitDir = path.join(targetDir, ".git");
        if (fs.existsSync(targetDir) && fs.existsSync(gitDir)) {
          if (!isResolved) {
            isResolved = true;
            clearInterval(interval);
            console.log(`✅ Repository cloned successfully to ${targetDir}`);
            vscode.window.showInformationMessage(
              "Repository cloned successfully!"
            );

            // Debug repository structure if expected files provided
            if (expectedFiles.length > 0) {
              debugRepositoryStructure(targetDir, expectedFiles);
            }

            resolve(true);
          }
        }
      };

      // Check periodically for completion
      const interval = setInterval(checkCloneCompletion, 2000);

      // Set timeout
      setTimeout(() => {
        if (!isResolved) {
          isResolved = true;
          clearInterval(interval);
          console.error(`Git clone timeout after ${maxWait}ms`);
          vscode.window.showErrorMessage(
            "Git clone operation timed out. Please check the terminal for details."
          );
          resolve(false);
        }
      }, maxWait);

      // Also check immediately after a short delay
      setTimeout(checkCloneCompletion, 5000);
    });
  } catch (error) {
    console.error("Error cloning repository:", error);
    vscode.window.showErrorMessage(
      `Failed to clone repository: ${error instanceof Error ? error.message : String(error)}`
    );
    return false;
  }
}

/**
 * Debug function to display repository structure after cloning
 * @param targetDir The directory to inspect
 * @param expectedFiles List of expected files to specifically check
 */
export function debugRepositoryStructure(
  targetDir: string,
  expectedFiles: string[] = []
): void {
  console.log(`\n=== Repository Structure Debug ===`);
  console.log(`Target directory: ${targetDir}`);
  console.log(`Directory exists: ${fs.existsSync(targetDir)}`);

  if (fs.existsSync(targetDir)) {
    try {
      const items = fs.readdirSync(targetDir);
      console.log(`Root contents (${items.length} items):`);
      items.forEach((item) => {
        const itemPath = path.join(targetDir, item);
        const stats = fs.statSync(itemPath);
        const type = stats.isDirectory() ? "DIR " : "FILE";
        const size = stats.isFile() ? ` (${stats.size} bytes)` : "";
        console.log(`  ${type}: ${item}${size}`);

        // If it's a directory, show first level contents
        if (stats.isDirectory() && item !== ".git") {
          try {
            const subItems = fs.readdirSync(itemPath);
            console.log(
              `    Contents: ${subItems.slice(0, 5).join(", ")}${subItems.length > 5 ? "..." : ""}`
            );
          } catch (error) {
            console.log(`    Error reading subdirectory: ${error}`);
          }
        }
      });

      // Check expected files specifically
      if (expectedFiles.length > 0) {
        console.log(`\nExpected files check:`);
        expectedFiles.forEach((file) => {
          const filePath = path.join(targetDir, file);
          const exists = fs.existsSync(filePath);
          const status = exists ? "✅ EXISTS" : "❌ MISSING";
          console.log(`  ${status}: ${file}`);

          if (exists) {
            const stats = fs.statSync(filePath);
            console.log(
              `    Size: ${stats.size} bytes, Modified: ${stats.mtime}`
            );
          }
        });
      }
    } catch (error) {
      console.error(`Error reading directory structure: ${error}`);
    }
  }
  console.log(`=== End Repository Debug ===\n`);
}
