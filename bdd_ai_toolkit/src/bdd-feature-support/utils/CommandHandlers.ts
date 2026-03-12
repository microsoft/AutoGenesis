// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * CommandHandlers - Unified command handling
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { FeatureParser } from '../core/gherkin/FeatureParser';
import { CopilotIntegrationService } from '../services/CopilotIntegrationService';
import { AutomationStatusService } from '../services/AutomationStatusService';
import { WebviewProvider } from '../providers/WebviewProvider';
import { Platform } from '../../setup/platform';

export class CommandHandlers {
  constructor(
    private featureParser: FeatureParser,
    private copilotService: CopilotIntegrationService,
    private automationService: AutomationStatusService,
    private webviewProvider: WebviewProvider
  ) {}

  /**
   * Execute scenario - Send scenario to Copilot
   */
  async executeScenario(
    uri: vscode.Uri,
    lineNumber: number,
    scenarioName: string,
    isAutomated: boolean
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      
      // Extract scenario
      const scenario = this.featureParser
        .getScenarioExtractor()
        .extractScenario(document, lineNumber);

      if (!scenario) {
        vscode.window.showErrorMessage(`Unable to parse scenario: ${scenarioName}`);
        return;
      }

      // Extract background if exists
      const background = this.featureParser
        .getBackgroundExtractor()
        .extractBackground(document);

      // Check if autoGenesis-run skill exists in the workspace
      const skillName = 'autoGenesis-run';
      let textToSend: string;

      if (this.copilotService.hasSkillInWorkspace(skillName)) {
        // Use skill invocation command
        textToSend = this.copilotService.generateSkillCommand(skillName, scenarioName);
      } else {
        // Fallback: generate full prompt text for Copilot
        textToSend = await this.copilotService.generateScenarioText(
          scenario,
          uri.fsPath,
          background || undefined
        );
      }

      // Copy to clipboard and open Copilot chat
      await vscode.env.clipboard.writeText(textToSend);
      await vscode.commands.executeCommand('workbench.action.chat.open', textToSend);
      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (error) {
      vscode.window.showErrorMessage(
        `Error executing scenario: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Run Behave scenario in terminal
   */
  async runBehaveScenario(
    uri: vscode.Uri,
    lineNumber: number,
    scenarioName: string
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      
      const scenario = this.featureParser
        .getScenarioExtractor()
        .extractScenario(document, lineNumber);

      if (!scenario) {
        vscode.window.showErrorMessage(`Unable to parse scenario: ${scenarioName}`);
        return;
      }

      // Escape scenario name for command line
      const escapedScenarioName = scenarioName.replace(/"/g, '\\"');
      const featureFilePath = uri.fsPath;
      let workingDirectory = path.dirname(featureFilePath);
      let cdCommand = '';

      // Find the features directory
      if (featureFilePath.includes('features')) {
        const featuresIndex = featureFilePath.lastIndexOf('features');
        if (featuresIndex > 0) {
          const featuresPath = featureFilePath.substring(
            0,
            featuresIndex + 'features'.length
          );
          workingDirectory = path.dirname(featuresPath);
          const command = `uv run python -m behave --name "^${escapedScenarioName}$"`;
          cdCommand = Platform.createCdCommand(workingDirectory, command);
        }
      }

      const behaveCommand = cdCommand || `uv run python -m behave --name "^${escapedScenarioName}$"`;
      
      // Get or create terminal
      let terminal = vscode.window.terminals.find(t => t.name === 'BDD Runner');
      if (!terminal) {
        terminal = vscode.window.createTerminal('BDD Runner');
      }

      terminal.show();
      terminal.sendText(behaveCommand);
      vscode.window.showInformationMessage(`Running: ${behaveCommand}`);

    } catch (error) {
      vscode.window.showErrorMessage(
        `Error running behave scenario: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Execute background - Send background to Copilot
   */
  async executeBackground(
    uri: vscode.Uri,
    lineNumber: number,
    backgroundName: string,
    isAutomated: boolean
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);
      
      const background = this.featureParser
        .getBackgroundExtractor()
        .extractBackground(document);

      if (!background) {
        vscode.window.showErrorMessage(`Unable to parse background: ${backgroundName}`);
        return;
      }

      // Generate text for Copilot
      const backgroundText = await this.copilotService.generateBackgroundText(
        background,
        uri.fsPath
      );

      // Copy to clipboard and open Copilot chat
      await vscode.env.clipboard.writeText(backgroundText);
      await vscode.commands.executeCommand('workbench.action.chat.open', backgroundText);
      await new Promise(resolve => setTimeout(resolve, 800));

    } catch (error) {
      vscode.window.showErrorMessage(
        `Error executing background: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Open automation details panel
   */
  async openAutomationDetails(
    uri: vscode.Uri,
    lineNumber: number,
    scenarioName: string
  ): Promise<void> {
    try {
      const document = await vscode.workspace.openTextDocument(uri);

      // Get automation status
      const status = await this.automationService.getScenarioStatus(document, lineNumber);

      if (!status) {
        vscode.window.showErrorMessage('Unable to get automation status');
        return;
      }

      // Extract scenario
      const scenario = this.featureParser
        .getScenarioExtractor()
        .extractScenario(document, lineNumber);

      if (!scenario) {
        vscode.window.showErrorMessage('Unable to parse scenario');
        return;
      }

      // Show in webview
      this.webviewProvider.showAutomationDetails(
        scenario,
        status.stepResults,
        uri.fsPath,
        lineNumber
      );

    } catch (error) {
      vscode.window.showErrorMessage(
        `Error opening automation details: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }

  /**
   * Refresh automation details (if panel is open)
   * Uses silent update to avoid interrupting user's workflow
   */
  async refreshAutomationDetails(): Promise<void> {
    if (!this.webviewProvider.isPanelOpen()) {
      return;
    }

    const context = this.webviewProvider.getCurrentContext();
    if (!context) {
      return;
    }

    try {
      const uri = vscode.Uri.file(context.filePath);
      const document = await vscode.workspace.openTextDocument(uri);

      // Get automation status
      const status = await this.automationService.getScenarioStatus(document, context.scenarioLine);

      if (!status) {
        return;
      }

      // Extract scenario
      const scenario = this.featureParser
        .getScenarioExtractor()
        .extractScenario(document, context.scenarioLine);

      if (!scenario) {
        return;
      }

      // Update in webview without changing focus
      this.webviewProvider.updateAutomationDetails(
        scenario,
        status.stepResults,
        context.filePath,
        context.scenarioLine
      );

    } catch (error) {
      console.error('Error refreshing automation details:', error);
    }
  }

  /**
   * Open step implementation file
   */
  async openStepImplementation(filePath: string, lineNumber: number): Promise<void> {
    try {
      const uri = vscode.Uri.file(filePath);
      const document = await vscode.workspace.openTextDocument(uri);
      const editor = await vscode.window.showTextDocument(document);

      // Navigate to line
      const position = new vscode.Position(lineNumber - 1, 0);
      editor.selection = new vscode.Selection(position, position);
      editor.revealRange(
        new vscode.Range(position, position),
        vscode.TextEditorRevealType.InCenter
      );
    } catch (error) {
      vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
    }
  }
}
