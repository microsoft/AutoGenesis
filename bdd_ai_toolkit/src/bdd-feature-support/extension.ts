// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * BDD Feature Support - Main Extension Activation
 */

import * as vscode from "vscode";
import { CucumberCodeLensProvider } from "./providers/CodeLensProvider";
import { CucumberDecorationProvider } from "./providers/DecorationProvider";
import { McpServerManager } from "../setup/mcpServerManager";

// New refactored modules
import { FeatureParser } from "./core/gherkin/FeatureParser";
import { AutomationStatusService } from "./services/AutomationStatusService";
import { CopilotIntegrationService } from "./services/CopilotIntegrationService";
import { UnifiedCacheManager } from "./cache/UnifiedCacheManager";
import { CommandHandlers } from "./utils/CommandHandlers";
import { WebviewProvider } from "./providers/WebviewProvider";
import { PathResolver } from "./utils/PathResolver";
import { FileWatcherManager } from "./services/FileWatcherManager";

export function activate(context: vscode.ExtensionContext) {
  console.log('[BDD] Extension activating...');

  // 1. Initialize path resolver
  const pathResolver = new PathResolver();
  
  // 2. Initialize cache manager
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
  const cacheManager = UnifiedCacheManager.getInstance(workspaceFolder);
  
  // Find Python files and initialize cache
  const pythonFiles = pathResolver.findImplementationFiles(workspaceFolder);
  cacheManager.initialize(pythonFiles).then(() => {
    console.log('[BDD] Cache initialized with', pythonFiles.length, 'Python files');
  });

  // 3. Initialize core parsers and services
  const featureParser = new FeatureParser();
  const stepMatcher = cacheManager.createStepMatcher(pythonFiles);
  const automationService = new AutomationStatusService(featureParser, stepMatcher);
  const copilotService = new CopilotIntegrationService();
  
  // 4. Initialize providers
  const codeLensProvider = new CucumberCodeLensProvider();
  codeLensProvider.setAutomationService(automationService);
  
  const decorationProvider = CucumberDecorationProvider.getInstance();
  decorationProvider.activate(context);
  decorationProvider.setCodeLensProvider(codeLensProvider);
  decorationProvider.setAutomationService(automationService);
  
  const webviewProvider = new WebviewProvider(
    context.extensionPath,
    context
  );
  
  // 5. Initialize command handlers
  const commandHandlers = new CommandHandlers(
    featureParser,
    copilotService,
    automationService,
    webviewProvider
  );

  // 6. Initialize FileWatcherManager to handle all file monitoring
  const fileWatcherManager = new FileWatcherManager(
    workspaceFolder,
    pathResolver,
    cacheManager,
    automationService,
    codeLensProvider,
    decorationProvider,
    commandHandlers
  );
  
  // Register all file watchers
  fileWatcherManager.registerWatchers(context);

  // 7. Register CodeLens provider
  context.subscriptions.push(
    vscode.languages.registerCodeLensProvider(
      { language: "feature" },
      codeLensProvider
    )
  );

  // 8. Register commands using CommandHandlers
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "bddAiToolkit.executeScenario",
      (uri, lineNumber, scenarioName, isAutomated) =>
        commandHandlers.executeScenario(uri, lineNumber, scenarioName, isAutomated)
    ),
    vscode.commands.registerCommand(
      "bddAiToolkit.runBehaveScenario",
      (uri, lineNumber, scenarioName) =>
        commandHandlers.runBehaveScenario(uri, lineNumber, scenarioName)
    ),
    vscode.commands.registerCommand(
      "bddAiToolkit.executeBackground",
      (uri, lineNumber, backgroundName, isAutomated) =>
        commandHandlers.executeBackground(uri, lineNumber, backgroundName, isAutomated)
    ),
    vscode.commands.registerCommand(
      "bddAiToolkit.openAutomationFile",
      (uri, lineNumber, scenarioName) =>
        commandHandlers.openAutomationDetails(uri, lineNumber, scenarioName)
    ),
    vscode.commands.registerCommand(
      "bddAiToolkit.refreshAutomationDetails",
      () => commandHandlers.refreshAutomationDetails()
    )
  );

  // 9. Setup MCP server
  const mcpServerManager = McpServerManager.getInstance();
  // Note: MCP server initialization is not called here
  // It should be triggered by user action or workspace configuration

  // 10. Trigger initial decorations and CodeLens refresh
  if (vscode.window.activeTextEditor) {
    const editor = vscode.window.activeTextEditor;
    if (editor.document.languageId === "feature" || editor.document.fileName.endsWith(".feature")) {
      decorationProvider.triggerUpdateWithDebounce(editor);
    }
  }
  
  setTimeout(() => {
    codeLensProvider.refresh();
    
    // Delayed decoration update to ensure everything is loaded
    if (vscode.window.activeTextEditor) {
      const editor = vscode.window.activeTextEditor;
      if (editor.document.languageId === "feature" || editor.document.fileName.endsWith(".feature")) {
        decorationProvider.triggerUpdateWithDebounce(editor);
      }
    }
  }, 1000);

  console.log('[BDD] Extension activated successfully');
}

export function deactivate() {
  console.log('[BDD] Extension deactivating...');
}

