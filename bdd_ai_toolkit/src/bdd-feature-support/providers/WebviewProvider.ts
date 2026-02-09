/**
 * WebviewProvider - Manages webview panels for automation details
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { Scenario } from '../core/gherkin/types';
import { StepImplementationResult } from '../core/matching/types';
import { HtmlTemplateManager } from '../utils/HtmlTemplateManager';

export class WebviewProvider {
  private currentPanel: vscode.WebviewPanel | undefined;
  private currentPanelContext: {
    filePath: string;
    scenarioLine: number;
    scenarioName: string;
  } | undefined;

  private htmlTemplateManager: HtmlTemplateManager;

  constructor(
    private extensionPath: string,
    private extensionContext: vscode.ExtensionContext
  ) {
    this.htmlTemplateManager = HtmlTemplateManager.getInstance(extensionContext);
  }

  /**
   * Show automation details in a webview panel
   * @param scenario Scenario object
   * @param stepResults Step implementation results
   * @param filePath Feature file path
   * @param scenarioLine Scenario line number
   */
  public showAutomationDetails(
    scenario: Scenario,
    stepResults: StepImplementationResult[],
    filePath: string,
    scenarioLine: number
  ): void {
    const panel = this.getOrCreatePanel(scenario.name, true);

    // Update context
    this.currentPanelContext = {
      filePath,
      scenarioLine,
      scenarioName: scenario.name
    };

    // Set content
    this.setWebviewContent(panel, scenario, stepResults);
  }

  /**
   * Update automation details for an already open panel without changing focus
   * @param scenario Scenario object
   * @param stepResults Step implementation results
   * @param filePath Feature file path
   * @param scenarioLine Scenario line number
   */
  public updateAutomationDetails(
    scenario: Scenario,
    stepResults: StepImplementationResult[],
    filePath: string,
    scenarioLine: number
  ): void {
    // Only update if panel exists
    if (!this.currentPanel) {
      return;
    }

    // Update context
    this.currentPanelContext = {
      filePath,
      scenarioLine,
      scenarioName: scenario.name
    };

    // Update title
    this.currentPanel.title = `Automation Details: ${scenario.name}`;

    // Set content
    this.setWebviewContent(this.currentPanel, scenario, stepResults);
  }

  /**
   * Set webview HTML content
   * @param panel Webview panel
   * @param scenario Scenario object
   * @param stepResults Step implementation results
   */
  private setWebviewContent(
    panel: vscode.WebviewPanel,
    scenario: Scenario,
    stepResults: StepImplementationResult[]
  ): void {
    // Build steps HTML
    const stepsHtml = stepResults.map(result => {
      const statusClass = result.implemented 
        ? (result.hasMultipleImplementations ? 'conflict' : 'implemented')
        : 'not-implemented';
      
      const implementations = result.implementations.map(impl => 
        `<div class="impl-file" data-file="${impl.file}" data-line="${impl.lineNumber}">${impl.file}:${impl.lineNumber}</div>`
      ).join('');

      return `
        <div class="step ${statusClass}">
          <div class="step-text">${result.step.type} ${result.step.text}</div>
          ${implementations ? `<div class="implementations">${implementations}</div>` : ''}
        </div>
      `;
    }).join('');

    const implementedCount = stepResults.filter(r => r.implemented && !r.hasMultipleImplementations).length;
    const notImplementedCount = stepResults.filter(r => !r.implemented).length;

    const htmlContent = this.htmlTemplateManager.renderAutomationDetails(
      scenario.name,
      stepResults.length,
      implementedCount,
      notImplementedCount,
      stepsHtml
    );

    panel.webview.html = htmlContent;
  }

  /**
   * Get or create automation details panel
   * Reuses existing panel if available
   * @param scenarioName Scenario name for panel title
   * @param shouldReveal Whether to reveal the panel (set to false for silent updates)
   */
  private getOrCreatePanel(scenarioName: string, shouldReveal: boolean = true): vscode.WebviewPanel {
    // If panel already exists and has not been disposed, reuse it
    if (this.currentPanel) {
      try {
        // Update title
        this.currentPanel.title = `Automation Details: ${scenarioName}`;
        // Only reveal if explicitly requested
        if (shouldReveal) {
          // Ensure panel is visible and displayed on the right, but preserve focus
          this.currentPanel.reveal(vscode.ViewColumn.Two, true);
        }
        return this.currentPanel;
      } catch (error) {
        // If panel has been disposed, current variable reference is invalid
        this.currentPanel = undefined;
      }
    }

    // Create new panel, specify to open on the right side of the editor
    this.currentPanel = vscode.window.createWebviewPanel(
      'automationDetails',
      `Automation Details: ${scenarioName}`,
      vscode.ViewColumn.Two,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.file(path.join(this.extensionPath, 'resources'))]
      }
    );

    // Handle panel close event
    this.currentPanel.onDidDispose(() => {
      this.currentPanel = undefined;
      this.currentPanelContext = undefined;
    }, undefined);

    // Handle messages from the webview
    this.currentPanel.webview.onDidReceiveMessage(
      message => this.handleWebviewMessage(message),
      undefined
    );

    return this.currentPanel;
  }

  /**
   * Handle messages from webview
   */
  private handleWebviewMessage(message: any): void {
    switch (message.command) {
      case 'openFile':
      case 'openStepImplementation':
        if (message.file && message.line) {
          this.openFileAtLine(message.file, message.line);
        }
        break;
      case 'refresh':
        if (this.currentPanelContext) {
          // Trigger refresh (would need to be connected to automation status service)
          vscode.commands.executeCommand('bddAiToolkit.refreshAutomationDetails');
        }
        break;
    }
  }

  /**
   * Open a file at a specific line
   */
  private async openFileAtLine(filePath: string, lineNumber: number): Promise<void> {
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
      console.error('Error opening file:', error);
      vscode.window.showErrorMessage(`Failed to open file: ${filePath}`);
    }
  }

  /**
   * Get current panel context
   */
  public getCurrentContext() {
    return this.currentPanelContext;
  }

  /**
   * Check if panel is open
   */
  public isPanelOpen(): boolean {
    return this.currentPanel !== undefined;
  }

  /**
   * Close current panel
   */
  public closePanel(): void {
    if (this.currentPanel) {
      this.currentPanel.dispose();
      this.currentPanel = undefined;
      this.currentPanelContext = undefined;
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.closePanel();
  }
}
