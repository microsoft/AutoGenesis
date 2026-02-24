// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Platform } from "./platform";

/**
 * Ensure a directory exists, creating it if necessary
 * @param dirPath The directory path to check/create
 */
export function ensureDirectoryExists(dirPath: string): void {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

/**
 * Open a directory in the native file explorer
 * @param dirPath The directory path to open
 */
export function openInFileExplorer(dirPath: string): void {
  const { exec } = require("child_process");

  if (Platform.isMacOS) {
    // macOS - Use 'open' command to open in Finder
    exec(`open "${dirPath}"`);
  } else if (Platform.isWindows) {
    // Windows - Use 'explorer' command
    exec(`explorer "${dirPath}"`);
  } else {
    // Linux - Try xdg-open (fallback, though we removed Linux support)
    exec(`xdg-open "${dirPath}"`);
  }
}

/**
 * Check if a path is within the current workspace
 * @param absolutePath The absolute path to check
 * @returns True if the path is within the workspace, false otherwise
 */
export function isPathInWorkspace(absolutePath: string): boolean {
  if (
    !vscode.workspace.workspaceFolders ||
    vscode.workspace.workspaceFolders.length === 0
  ) {
    return false;
  }

  const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
  return absolutePath.startsWith(workspaceRoot);
}

/**
 * Reads and optionally adds frontmatter to a markdown file
 * @param filePath Path to the markdown file to read
 * @param addFrontmatter Whether to add frontmatter if not present
 * @returns The content of the markdown file, potentially with added frontmatter
 */
export function readMarkdownWithFrontmatter(
  filePath: string,
  addFrontmatter = false
): string {
  let content = fs.readFileSync(filePath, "utf8");

  // Add frontmatter if requested and not already present
  if (addFrontmatter && !content.includes("---\napplyTo:")) {
    // Remove any existing frontmatter
    if (content.startsWith("---")) {
      const secondDashes = content.indexOf("---", 3);
      if (secondDashes !== -1) {
        content = content.substring(secondDashes + 3).trim();
      }
    }
    content = `---\napplyTo: '**'\n---\n${content}`;
  }

  return content;
}

/**
 * Copy file and ensure target directory exists
 * @param sourcePath Path to the source file
 * @param targetPath Path to the target file
 */
export function copyFileWithDir(sourcePath: string, targetPath: string): void {
  // Ensure the target directory exists
  const targetDir = path.dirname(targetPath);
  ensureDirectoryExists(targetDir);

  // Copy the file
  fs.copyFileSync(sourcePath, targetPath);
}

/**
 * Clean up a temporary file with proper error handling
 * @param filePath The path to the file to clean up
 */
export async function cleanupTempFile(filePath: string): Promise<void> {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      console.log("Temporary file cleaned up");
    }
  } catch (err) {
    console.error(`Failed to delete temporary file: ${err}`);
  }
}
