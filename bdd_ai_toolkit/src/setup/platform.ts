// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * Platform Management
 */

import * as os from "os";
import * as path from "path";

/**
 * Platform detection utilities
 */
export const Platform = {
  /**
   * Determine if the current platform is Windows
   */
  isWindows: os.platform() === "win32",

  /**
   * Determine if the current platform is macOS
   */
  isMacOS: os.platform() === "darwin",

  /**
   * Get platform-specific shell
   */
  getShell(): string | undefined {
    return Platform.isWindows ? "powershell.exe" : undefined;
  },

  /**
   * Get platform-specific command checker
   */
  getWhichCommand(): string {
    return Platform.isWindows ? "where" : "which";
  },

  /**
   * Get platform-specific shell for cp.exec
   */
  getExecShell(): string | undefined {
    return Platform.isWindows ? "cmd.exe" : undefined;
  },

  /**
   * Get platform-specific command separator for command chaining
   * Uses semicolon for Windows PowerShell and && for Unix-like systems
   */
  getCommandSeparator(): string {
    return Platform.isWindows ? ";" : "&&";
  },

  /**
   * Create a command that changes directory and executes another command, using platform-specific syntax
   * @param directory The directory to change to
   * @param command The command to execute after changing directory
   * @returns The combined command with proper platform-specific syntax
   */
  createCdCommand(directory: string, command: string): string {
    const separator = Platform.getCommandSeparator();
    if (Platform.isWindows) {
      // Windows: include drive letter change and use semicolon separator
      const driveLetter = directory[0];
      return `${driveLetter}:${separator} cd "${directory}"${separator} ${command}`;
    } else {
      // Unix-like systems: use && for command chaining
      return `cd "${directory}" ${separator} ${command}`;
    }
  },
};

/**
 * Platform-specific constants for path resolution
 */
export const PlatformPaths = {
  /**
   * Get the VS Code user directory based on the current platform
   */
  vsCodeUserDir: (() => {
    if (Platform.isMacOS) {
      // macOS
      return path.join(
        os.homedir(),
        "Library",
        "Application Support",
        "Code",
        "User"
      );
    } else if (Platform.isWindows) {
      // Windows
      return path.join(os.homedir(), "AppData", "Roaming", "Code", "User");
    } else {
      // Default fallback
      return path.join(os.homedir(), ".config", "Code", "User");
    }
  })(),

  /**
   * Get the VS Code prompts directory path
   */
  get vsCodePromptsDir(): string {
    return path.join(this.vsCodeUserDir, "prompts");
  },
};

/**
 * Get the VS Code user directory path based on the current platform
 * @returns The path to the VS Code User directory
 */
export function getVSCodeUserDir(): string {
  return PlatformPaths.vsCodeUserDir;
}

/**
 * Get the VS Code prompts directory path based on the current platform
 * @returns The path to the VS Code prompts directory
 */
export function getVSCodePromptsDir(): string {
  return PlatformPaths.vsCodePromptsDir;
}
