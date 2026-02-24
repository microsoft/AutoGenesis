// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * Version Manager
 * Handles extension version tracking and comparison using semantic versioning
 */

import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";

export interface VersionInfo {
  version: string;
  lastUpdated: string;
  updateSource: "manual_setup" | "auto_update" | "initial_install";
}

export class VersionManager {
  private static readonly VERSION_FILE = "mcp_version.json";
  private static readonly EXTENSION_ID = "liujingping.bdd-ai-toolkit";
  private static readonly VERSION_KEY = "bdd_ai_toolkit_version";

  /**
   * Get current extension version
   */
  public static getCurrentVersion(): string | null {
    try {
      const extension = vscode.extensions.getExtension(this.EXTENSION_ID);
      return extension?.packageJSON?.version || null;
    } catch (error) {
      console.error("Error getting extension version:", error);
      return null;
    }
  }

  /**
   * Read version info from MCP server path
   */
  public static readVersionInfo(mcpServerPath: string): VersionInfo | null {
    try {
      const versionFilePath = path.join(mcpServerPath, this.VERSION_FILE);

      if (!fs.existsSync(versionFilePath)) {
        return null;
      }

      const content = fs.readFileSync(versionFilePath, "utf8");
      const data = JSON.parse(content);

      return {
        version: data[this.VERSION_KEY] || data.version || null,
        lastUpdated: data.last_updated || data.lastUpdated || "",
        updateSource:
          data.update_source || data.updateSource || "initial_install",
      };
    } catch (error) {
      console.error("Error reading version info:", error);
      return null;
    }
  }

  /**
   * Write version info to MCP server path
   */
  public static writeVersionInfo(
    mcpServerPath: string,
    version: string,
    source: "manual_setup" | "auto_update" | "initial_install" = "auto_update"
  ): boolean {
    try {
      const versionFilePath = path.join(mcpServerPath, this.VERSION_FILE);
      const versionInfo = {
        [this.VERSION_KEY]: version,
        last_updated: new Date().toISOString(),
        update_source: source,
      };

      fs.writeFileSync(
        versionFilePath,
        JSON.stringify(versionInfo, null, 2),
        "utf8"
      );
      return true;
    } catch (error) {
      console.error("Error writing version info:", error);
      return false;
    }
  }

  /**
   * Compare two semantic version strings
   * Returns: 1 if v1 > v2, -1 if v1 < v2, 0 if equal
   */
  public static compareVersions(v1: string, v2: string): number {
    // Validate version format
    if (!this.isValidVersion(v1) || !this.isValidVersion(v2)) {
      // Fallback to string comparison if not valid semver
      return v1 === v2 ? 0 : v1 > v2 ? 1 : -1;
    }

    const parts1 = this.parseVersion(v1);
    const parts2 = this.parseVersion(v2);

    // Compare major, minor, patch
    for (let i = 0; i < 3; i++) {
      if (parts1[i] > parts2[i]) return 1;
      if (parts1[i] < parts2[i]) return -1;
    }

    return 0;
  }

  /**
   * Check if version string is valid semantic version (major.minor.patch)
   */
  public static isValidVersion(version: string): boolean {
    if (!version) return false;

    // Match semantic versioning: x.y.z or x.y.z-prerelease
    const semverRegex = /^\d+\.\d+\.\d+(-[\w.]+)?$/;
    return semverRegex.test(version);
  }

  /**
   * Parse version string into [major, minor, patch] array
   */
  private static parseVersion(version: string): number[] {
    // Remove pre-release suffix if exists (e.g., 1.2.3-beta -> 1.2.3)
    const mainVersion = version.split("-")[0];
    return mainVersion.split(".").map((v) => parseInt(v, 10) || 0);
  }

  /**
   * Check if MCP server needs update
   * Returns true if:
   * 1. Version file doesn't exist
   * 2. Stored version is older than current extension version
   * 3. Key files are missing
   */
  public static needsUpdate(
    mcpServerPath: string,
    currentVersion: string
  ): boolean {
    try {
      // Check if version file exists
      const versionInfo = this.readVersionInfo(mcpServerPath);

      if (!versionInfo || !versionInfo.version) {
        console.log("Version file not found or invalid, update needed");
        return true;
      }

      // Compare versions
      const comparison = this.compareVersions(
        currentVersion,
        versionInfo.version
      );
      if (comparison > 0) {
        console.log(
          `Extension updated: ${versionInfo.version} -> ${currentVersion}, update needed`
        );
        return true;
      }

      // Verify key files exist
      const keyFiles = ["simple_server.py", "pyproject.toml"];
      for (const file of keyFiles) {
        if (!fs.existsSync(path.join(mcpServerPath, file))) {
          console.log(`Key file missing: ${file}, update needed`);
          return true;
        }
      }

      // No update needed
      return false;
    } catch (error) {
      console.error("Error checking update status:", error);
      // On error, assume update is needed for safety
      return true;
    }
  }

  /**
   * Check if any configured MCP server needs update
   * Returns server names that need update
   */
  public static async checkAllServersForUpdate(
    mcpServerPaths: Map<string, string>
  ): Promise<string[]> {
    const currentVersion = this.getCurrentVersion();
    if (!currentVersion) {
      return [];
    }

    const serversNeedingUpdate: string[] = [];

    for (const [serverName, serverPath] of mcpServerPaths) {
      if (fs.existsSync(serverPath)) {
        if (this.needsUpdate(serverPath, currentVersion)) {
          serversNeedingUpdate.push(serverName);
        }
      }
    }

    return serversNeedingUpdate;
  }

  /**
   * Increment version for testing purposes
   * E.g., 1.2.3 -> 1.2.4
   */
  public static incrementPatchVersion(version: string): string {
    if (!this.isValidVersion(version)) {
      return version;
    }

    const parts = this.parseVersion(version);
    parts[2]++; // Increment patch version
    return parts.join(".");
  }
}
