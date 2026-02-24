// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import { registerTools } from "./tools/index";
import {
  activateBddFeatureSupport,
  deactivateBddFeatureSupport,
} from "./bdd-feature-support";
import { GlobalState } from "./globalState";
import {
  SetupWebViewProvider,
  VersionManager,
  getExtensionStoragePath,
} from "./setup";
import * as path from "path";
import * as fs from "fs";

/**
 * WebView provider instance for the setup panel
 */
let setupWebViewProvider: SetupWebViewProvider | undefined = undefined;

/**
 * Extension activation entry point
 * Called when the extension is first activated by VS Code
 */
export async function activate(context: vscode.ExtensionContext) {
  // Initialize global state
  GlobalState.initialize(context);

  // Activate BDD Feature Support
  activateBddFeatureSupport(context);

  // Register Copilot language model tools
  registerTools(context);

  // Register setup panel WebView provider
  setupWebViewProvider = new SetupWebViewProvider(
    context.extensionUri,
    context
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      SetupWebViewProvider.viewType,
      setupWebViewProvider
    )
  );

  // Check for MCP server updates on activation (silent check)
  await checkForMcpServerUpdates(context);
}

/**
 * Check for MCP server updates and notify user if needed
 * This runs silently in the background during extension activation
 */
async function checkForMcpServerUpdates(
  context: vscode.ExtensionContext
): Promise<void> {
  try {
    const currentVersion = VersionManager.getCurrentVersion();
    if (!currentVersion) {
      return;
    }

    const extensionStoragePath = getExtensionStoragePath();
    const serverPaths = new Map<string, string>();

    // Check both possible server types
    const autoMcpPath = path.join(extensionStoragePath, "pywinauto-mcp-server");
    const appiumMcpPath = path.join(extensionStoragePath, "appium-mcp-server");

    if (fs.existsSync(autoMcpPath)) {
      serverPaths.set("Windows MCP", autoMcpPath);
    }
    if (fs.existsSync(appiumMcpPath)) {
      serverPaths.set("Appium MCP", appiumMcpPath);
    }

    // If no servers are installed, no need to check
    if (serverPaths.size === 0) {
      return;
    }

    // Check which servers need updates
    const serversNeedingUpdate =
      await VersionManager.checkAllServersForUpdate(serverPaths);

    // If updates are needed, show a notification
    if (serversNeedingUpdate.length > 0) {
      const serverNames = serversNeedingUpdate.join(", ");
      const message = `MCP server update available for: ${serverNames}`;

      const action = await vscode.window.showInformationMessage(
        message,
        "Update Now",
        "Remind Me Later"
      );

      if (action === "Update Now") {
        // Open the setup panel
        await vscode.commands.executeCommand(
          "bdd-ai-toolkit-extension.setupView.focus"
        );
      }
    }
  } catch (error) {
    // Silent failure - don't interrupt extension activation
    console.error("Error checking for MCP server updates:", error);
  }
}

/**
 * Extension deactivation cleanup
 * Called when the extension is deactivated by VS Code
 */
export function deactivate() {
  // Clean up BDD Feature Support resources
  if (deactivateBddFeatureSupport) {
    deactivateBddFeatureSupport();
  }
}
