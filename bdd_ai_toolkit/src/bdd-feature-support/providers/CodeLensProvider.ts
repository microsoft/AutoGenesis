import * as vscode from "vscode";
import { FeatureParser } from "../core/gherkin/FeatureParser";
import { AutomationStatusService } from "../services/AutomationStatusService";

export class CucumberCodeLensProvider implements vscode.CodeLensProvider {
  private onDidChangeCodeLensesEmitter = new vscode.EventEmitter<void>();
  public readonly onDidChangeCodeLenses =
    this.onDidChangeCodeLensesEmitter.event;
  
  private featureParser: FeatureParser;
  private automationService: AutomationStatusService | null = null;

  constructor() {
    this.featureParser = new FeatureParser();
  }

  /**
   * Initialize with AutomationStatusService
   * Called after service is created in extension.ts
   */
  public setAutomationService(service: AutomationStatusService): void {
    this.automationService = service;
  }

  refresh(): void {
    this.onDidChangeCodeLensesEmitter.fire();
  }

  async provideCodeLenses(
    document: vscode.TextDocument,
    token: vscode.CancellationToken
  ): Promise<vscode.CodeLens[]> {
    // Check if it is a feature file
    const isFeatureFile =
      document.languageId === "feature" ||
      document.fileName.endsWith(".feature");
    if (!isFeatureFile) {
      return [];
    }

    if (!this.automationService) {
      return []; // Service not initialized yet
    }

    const codeLenses: vscode.CodeLens[] = [];

    // Extract background
    const background = this.featureParser
      .getBackgroundExtractor()
      .extractBackground(document);

    if (background) {
      const range = new vscode.Range(
        background.lineNumber - 1,
        0,
        background.lineNumber - 1,
        document.lineAt(background.lineNumber - 1).text.length
      );

      const status = await this.automationService.getBackgroundStatus(document);
      
      if (status) {
        // Add automation status button for Background
        if (status.isFullyAutomated) {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `$(verified) Background Automated`,
              command: "bddAiToolkit.openAutomationFile",
              arguments: [
                document.uri,
                background.lineNumber,
                "Background",
              ],
            })
          );
        } else {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `$(circle-slash) Background Not Fully Automated`,
              tooltip: "Some background steps are missing implementations",
              command: "bddAiToolkit.openAutomationFile",
              arguments: [
                document.uri,
                background.lineNumber,
                "Background",
              ],
            })
          );
        }

        // Add "Send to Copilot" button for Background
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `$(comment-discussion) Send Background to Copilot`,
            command: "bddAiToolkit.executeBackground",
            arguments: [
              document.uri,
              background.lineNumber,
              "Background",
              status.isFullyAutomated,
            ],
          })
        );
      }
    }

    // Extract all scenarios
    const scenarios = this.featureParser
      .getScenarioExtractor()
      .extractAllScenarios(document);

    for (const scenario of scenarios) {
      const lineIdx = scenario.lineNumber - 1;
      const range = new vscode.Range(
        lineIdx,
        0,
        lineIdx,
        document.lineAt(lineIdx).text.length
      );

      const status = await this.automationService.getScenarioStatus(
        document,
        scenario.lineNumber
      );

      if (status) {
        // Add automation status button
        if (status.isFullyAutomated) {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `$(verified) Automated`,
              command: "bddAiToolkit.openAutomationFile",
              arguments: [
                document.uri,
                scenario.lineNumber,
                scenario.name,
              ],
            })
          );
        } else {
          codeLenses.push(
            new vscode.CodeLens(range, {
              title: `$(circle-slash) Not Fully Automated`,
              tooltip: "Some steps are missing implementations",
              command: "bddAiToolkit.openAutomationFile",
              arguments: [
                document.uri,
                scenario.lineNumber,
                scenario.name,
              ],
            })
          );
        }

        // Add "Send to Copilot" button
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `$(comment-discussion) Send to Copilot`,
            command: "bddAiToolkit.executeScenario",
            arguments: [
              document.uri,
              scenario.lineNumber,
              scenario.name,
              status.isFullyAutomated,
            ],
          })
        );

        // Add "Run" button for behave command
        codeLenses.push(
          new vscode.CodeLens(range, {
            title: `$(play) Run`,
            command: "bddAiToolkit.runBehaveScenario",
            arguments: [document.uri, scenario.lineNumber, scenario.name],
          })
        );
      }
    }

    return codeLenses;
  }
}
