// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as path from "path";
import * as os from "os";
import * as fs from "fs";
import * as cp from "child_process";

// Internal imports - organized by module
import { Platform, PlatformPaths, getVSCodeUserDir } from "./platform";
import { createAndShowTerminal } from "./terminal";
import { handlePythonInstallation } from "./python";
import {
  checkCommandExists,
  checkEnvironment,
  installNpm,
  installVsCodeCli,
  installDotNetSdk,
  installHomebrew,
} from "./environment";

// Re-export functions for backwards compatibility
export {
  // Platform and file system utilities
  getVSCodeUserDir,
  Platform,

  // Terminal utilities
  createAndShowTerminal,

  // Environment utilities
  checkEnvironment,
  installNpm,
  installVsCodeCli,
  installDotNetSdk,
  installHomebrew,
  checkCommandExists,

  // Python utilities
  handlePythonInstallation,
};

// Re-export UV utilities
export {
  installUv,
  installUvKeyring,
  getDefaultUvVenvPath,
  getExtensionStoragePath,
  ensureDefaultUvVenvExists,
  getUvVenvActivateCommand,
  createUvVirtualEnvironment,
  getUvExecutablePath,
  validateUvExecutable,
  getUvPathCommand,
} from "./uv";

// Re-export file system utilities that might be used by other modules
export { openInFileExplorer } from "./fileSystem";

/**
 * Get the VS Code prompts directory path based on the current platform
 * @returns The path to the VS Code prompts directory
 */
export function getVSCodePromptsDir(): string {
  return PlatformPaths.vsCodePromptsDir;
}

/**
 * Loads the HTML template file and replaces placeholders with actual values
 *
 * @param webview The webview to get resources from
 * @param extensionUri The extension URI to resolve paths against
 * @param nonce Security nonce for script execution
 * @returns The HTML content with placeholders replaced
 */
export function getWebviewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  nonce: string
): string {
  // Get the paths to resources
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "resources", "styles.css")
  );
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, "out/resources", "main.js")
  );
  console.log("styleUri:", styleUri);
  console.log("scriptUri:", scriptUri);
  // Read the HTML template
  const templatePath = path.join(
    extensionUri.fsPath,
    "resources",
    "webview.html"
  );
  let htmlContent = fs.readFileSync(templatePath, "utf8");

  // Replace placeholders with actual values
  htmlContent = htmlContent
    .replace(/{{cspSource}}/g, webview.cspSource)
    .replace(/{{nonce}}/g, nonce)
    .replace(/{{styleUri}}/g, styleUri.toString())
    .replace(/{{scriptUri}}/g, scriptUri.toString());

  return htmlContent;
}

/**
 * Generates a random nonce for CSP
 *
 * @returns A random nonce string
 */
export function generateNonce(): string {
  let text = "";
  const possible =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
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
      const checkCmd = Platform.isWindows ? "where git" : "which git";
      cp.exec(checkCmd, (error, stdout) => {
        if (error) {
          resolve(false);
        } else {
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
    } // Create terminal and execute git clone
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
    terminal.sendText(cloneCommand); // Wait for clone to complete and verify
    return new Promise<boolean>((resolve) => {
      let isResolved = false;
      const maxWait = 60000; // 60 seconds timeout

      const checkCloneCompletion = () => {
        // Check if the target directory exists and has a .git folder
        const gitDir = path.join(targetDir, ".git");
        if (fs.existsSync(targetDir) && fs.existsSync(gitDir)) {
          // If specific files are expected, verify they exist too
          if (expectedFiles.length > 0) {
            const allFilesExist = expectedFiles.every((file) => {
              const filePath = path.join(targetDir, file);
              const exists = fs.existsSync(filePath);
              if (!exists) {
                console.log(`Still waiting for file: ${file}`);
              }
              return exists;
            });

            if (!allFilesExist) {
              return; // Not yet complete, keep waiting
            }
          }

          if (!isResolved) {
            isResolved = true;
            console.log(`Repository cloned successfully to ${targetDir}`);
            if (expectedFiles.length > 0) {
              console.log(
                `All expected files verified: ${expectedFiles.join(", ")}`
              );
            }
            vscode.window.showInformationMessage(
              `Repository cloned successfully.`
            );
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
            subItems.slice(0, 5).forEach((subItem) => {
              // Show first 5 items
              const subItemPath = path.join(itemPath, subItem);
              const subStats = fs.statSync(subItemPath);
              const subType = subStats.isDirectory() ? "DIR " : "FILE";
              console.log(`    ${subType}: ${item}/${subItem}`);
            });
            if (subItems.length > 5) {
              console.log(`    ... and ${subItems.length - 5} more items`);
            }
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
