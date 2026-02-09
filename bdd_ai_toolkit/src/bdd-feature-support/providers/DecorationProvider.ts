import * as vscode from "vscode";
import * as path from "path";
import { UnifiedCacheManager } from "../cache/UnifiedCacheManager";
import { AutomationStatusService } from "../services/AutomationStatusService";
import { FeatureParser } from "../core/gherkin/FeatureParser";
import { PathResolver } from "../utils/PathResolver";
import type { CucumberCodeLensProvider } from "./CodeLensProvider";

export class CucumberDecorationProvider {
  private static instance: CucumberDecorationProvider;
  private automatedDecorationType: vscode.TextEditorDecorationType;
  private notAutomatedDecorationType: vscode.TextEditorDecorationType;

  // Add three types of step decorators
  private stepImplementedDecorationType: vscode.TextEditorDecorationType;
  private stepNotImplementedDecorationType: vscode.TextEditorDecorationType;
  private stepConflictDecorationType: vscode.TextEditorDecorationType;
  // Add debounce mechanism to reduce decorator update frequency
  private updateTimeouts = new Map<string, NodeJS.Timeout>();
  private readonly DEBOUNCE_DELAY = 1000; // 1 second debounce delay for responsive editing experience
  // Track update start times for performance logging
  private updateStartTimes = new Map<string, number>();

  // Cache current decorator state for smart updates
  private currentDecorations = new Map<
    string,
    {
      stepImplemented: vscode.Range[];
      stepNotImplemented: vscode.Range[];
      stepConflict: vscode.Range[];
      automated: vscode.Range[];
      notAutomated: vscode.Range[];
    }
  >();
  private disposables: vscode.Disposable[] = [];
  private featureParser: FeatureParser;
  private automationService: AutomationStatusService | null = null;
  private pathResolver: PathResolver;
  private cacheManager: UnifiedCacheManager;
  private cacheManagerInitialized: Promise<void>;
  // CodeLens provider reference for synchronized refresh
  private codeLensProvider: CucumberCodeLensProvider | undefined;

  private constructor() {
    this.featureParser = new FeatureParser();
    this.pathResolver = new PathResolver();
    
    // Initialize UnifiedCacheManager
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
    this.cacheManager = UnifiedCacheManager.getInstance(workspaceFolder);
    
    // Initialize in background (async) - loads all Python files
    const pythonFiles = this.pathResolver.findImplementationFiles(workspaceFolder);
    this.cacheManagerInitialized = this.cacheManager.initialize(pythonFiles);

    // Create decoration type for automated scenarios - empty (removed checkmark)
    this.automatedDecorationType = vscode.window.createTextEditorDecorationType(
      {
        before: {
          contentText: "",
          color: "#4CAF50",
          margin: "0",
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      }
    );

    // Decoration type for non-automated scenarios - empty (removed circle)
    this.notAutomatedDecorationType =
      vscode.window.createTextEditorDecorationType({
        before: {
          contentText: "",
          color: "#888888",
          margin: "0",
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });

    // Create step decoration type - implemented (green checkmark)
    this.stepImplementedDecorationType =
      vscode.window.createTextEditorDecorationType({
        before: {
          contentText: "✓",
          color: "#4CAF50",
          margin: "0 3px 0 0",
          width: "12px", // Control size by specifying width
          height: "12px", // Control size by specifying height
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });

    // Create step decoration type - not implemented (yellow cross)
    this.stepNotImplementedDecorationType =
      vscode.window.createTextEditorDecorationType({
        before: {
          contentText: "✗",
          color: "#FFC107",
          margin: "0 3px 0 0",
          width: "12px", // Control size by specifying width
          height: "12px", // Control size by specifying height
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });

    // Create step decoration type - conflict (red warning)
    this.stepConflictDecorationType =
      vscode.window.createTextEditorDecorationType({
        before: {
          contentText: "⚠",
          color: "#F44336",
          margin: "0 3px 0 0",
          width: "12px", // Control size by specifying width
          height: "12px", // Control size by specifying height
        },
        rangeBehavior: vscode.DecorationRangeBehavior.ClosedClosed,
      });
  }

  public static getInstance(): CucumberDecorationProvider {
    if (!CucumberDecorationProvider.instance) {
      CucumberDecorationProvider.instance = new CucumberDecorationProvider();
    }
    return CucumberDecorationProvider.instance;
  }
  
  // Activate decoration provider
  public activate(context: vscode.ExtensionContext): void {
    // Register disposal function
    context.subscriptions.push(...this.disposables);
  }

  /**
   * Public method: Update decorations for a specific editor with debounce
   * Called from extension.ts for feature file changes
   */
  public triggerUpdateWithDebounce(editor: vscode.TextEditor): void {
    this.updateDecorationsWithDebounce(editor);
  }

  /**
   * Public method: Update decorations immediately
   * Called from extension.ts for file opening/switching
   */
  public async triggerUpdateImmediate(editor: vscode.TextEditor): Promise<void> {
    await this.updateDecorations(editor);
  }

  /**
   * Public method: Clear cache and decorations for a file
   */
  public clearCacheForFile(filePath: string): void {
    this.cacheManager.invalidate({ target: 'feature', filePath });
    this.currentDecorations.delete(filePath);
  }

  // Decorator update method with debounce functionality
  // When user modifies the feature file again, cancel the previous update task and start a new one
  private updateDecorationsWithDebounce(editor: vscode.TextEditor): void {
    const filePath = editor.document.uri.fsPath;
    const fileName = path.basename(filePath);

    // Clear previous timeout - this ensures that if user modifies again,
    // the previous update task is cancelled to improve performance
    const existingTimeout = this.updateTimeouts.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Record trigger time
    const triggerTime = Date.now();
    this.updateStartTimes.set(filePath, triggerTime);

    // Set new timeout - will execute after DEBOUNCE_DELAY milliseconds
    const timeout = setTimeout(() => {
      this.updateDecorations(editor);
      this.updateTimeouts.delete(filePath);
    }, this.DEBOUNCE_DELAY);

    this.updateTimeouts.set(filePath, timeout);
  }

  // Update decorations for a specific editor
  public async updateDecorations(editor: vscode.TextEditor): Promise<void> {
    // Wait for CacheManager to be initialized
    await this.cacheManagerInitialized;
    
    if (!this.automationService) {
      return; // Service not initialized yet
    }

    const document = editor.document;
    const filePath = document.uri.fsPath;
    const fileName = path.basename(filePath);
    const updateStartTime = Date.now();
    const triggerTime = this.updateStartTimes.get(filePath);

    // Only process feature files
    if (
      document.languageId !== "feature" &&
      !document.fileName.endsWith(".feature")
    ) {
      return;
    }

    const automatedRanges: vscode.Range[] = [];
    const notAutomatedRanges: vscode.Range[] = [];

    // Array of step decoration ranges
    const stepImplementedRanges: vscode.Range[] = [];
    const stepNotImplementedRanges: vscode.Range[] = [];
    const stepConflictRanges: vscode.Range[] = [];

    try {
      // Extract background
      const background = this.featureParser
        .getBackgroundExtractor()
        .extractBackground(document);

      if (background) {
        const status = await this.automationService.getBackgroundStatus(document);
        
        if (status) {
          // Process background steps decorations
          for (const stepResult of status.stepResults) {
            const stepLine = stepResult.step.lineNumber;
            if (stepLine !== undefined) {
              const range = new vscode.Range(stepLine - 1, 0, stepLine - 1, 0);
              
              if (!stepResult.implemented) {
                stepNotImplementedRanges.push(range);
              } else if (stepResult.hasMultipleImplementations) {
                stepConflictRanges.push(range);
              } else {
                stepImplementedRanges.push(range);
              }
            }
          }
        }
      }

      // Extract all scenarios using new parser
      const scenarios = this.featureParser
        .getScenarioExtractor()
        .extractAllScenarios(document);

      for (const scenario of scenarios) {
        const status = await this.automationService.getScenarioStatus(
          document,
          scenario.lineNumber
        );

        if (status) {
          // Add scenario line decoration
          const scenarioRange = new vscode.Range(
            scenario.lineNumber - 1,
            0,
            scenario.lineNumber - 1,
            0
          );

          if (status.isFullyAutomated) {
            automatedRanges.push(scenarioRange);
          } else {
            notAutomatedRanges.push(scenarioRange);
          }

          // Process steps decorations
          for (const stepResult of status.stepResults) {
            const stepLine = stepResult.step.lineNumber;
            if (stepLine !== undefined) {
              const range = new vscode.Range(stepLine - 1, 0, stepLine - 1, 0);
              
              if (!stepResult.implemented) {
                stepNotImplementedRanges.push(range);
              } else if (stepResult.hasMultipleImplementations) {
                stepConflictRanges.push(range);
              } else {
                stepImplementedRanges.push(range);
              }
            }
          }
        }
      }

      // Cache current decorations for smart updates
      this.currentDecorations.set(filePath, {
        stepImplemented: stepImplementedRanges,
        stepNotImplemented: stepNotImplementedRanges,
        stepConflict: stepConflictRanges,
        automated: automatedRanges,
        notAutomated: notAutomatedRanges,
      });

      // Apply all decorations
      editor.setDecorations(
        this.stepImplementedDecorationType,
        stepImplementedRanges
      );
      editor.setDecorations(
        this.stepNotImplementedDecorationType,
        stepNotImplementedRanges
      );
      editor.setDecorations(
        this.stepConflictDecorationType,
        stepConflictRanges
      );
      editor.setDecorations(
        this.automatedDecorationType,
        automatedRanges
      );
      editor.setDecorations(
        this.notAutomatedDecorationType,
        notAutomatedRanges
      );

    } catch (error) {
      console.error(`Error updating decorations for ${fileName}:`, error);
    }
  }

  // Compare if two decorator configurations are the same
  private decorationsEqual(a: any, b: any): boolean {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  // Disposal method
  public dispose(): void {
    // Clear all unfinished debounce timeouts
    for (const timeout of this.updateTimeouts.values()) {
      clearTimeout(timeout);
    }
    this.updateTimeouts.clear();

    // Clear decorator state cache
    this.currentDecorations.clear();
    
    // Dispose CacheManager
    this.cacheManager.dispose();

    this.automatedDecorationType.dispose();
    this.notAutomatedDecorationType.dispose();

    // Release step decorator resources
    this.stepImplementedDecorationType.dispose();
    this.stepNotImplementedDecorationType.dispose();
    this.stepConflictDecorationType.dispose();

    for (const disposable of this.disposables) {
      disposable.dispose();
    }
    this.disposables = [];
  }

  /**
   * Set CodeLens provider reference for synchronized refresh
   */
  public setCodeLensProvider(codeLensProvider: CucumberCodeLensProvider): void {
    this.codeLensProvider = codeLensProvider;
  }

  /**
   * Set AutomationStatusService reference
   * Called from extension.ts after service is created
   */
  public setAutomationService(service: AutomationStatusService): void {
    this.automationService = service;
  }
}
