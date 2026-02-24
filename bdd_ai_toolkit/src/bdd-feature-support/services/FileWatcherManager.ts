// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * FileWatcherManager - Centralized file monitoring and coordination
 * Handles all file watching logic and coordinates cache/provider updates
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { UnifiedCacheManager } from '../cache/UnifiedCacheManager';
import { AutomationStatusService } from './AutomationStatusService';
import { CucumberCodeLensProvider } from '../providers/CodeLensProvider';
import { CucumberDecorationProvider } from '../providers/DecorationProvider';
import { CommandHandlers } from '../utils/CommandHandlers';
import { PathResolver } from '../utils/PathResolver';
import { FileWatcher } from '../utils/FileWatcher';

export class FileWatcherManager {
  private disposables: vscode.Disposable[] = [];
  private fileWatcher: FileWatcher;
  private pythonFileDebounce = new Map<string, NodeJS.Timeout>();
  private readonly PYTHON_DEBOUNCE_DELAY = 1000; // 1 second debounce for Python files

  constructor(
    private workspaceFolder: string,
    private pathResolver: PathResolver,
    private cacheManager: UnifiedCacheManager,
    private automationService: AutomationStatusService,
    private codeLensProvider: CucumberCodeLensProvider,
    private decorationProvider: CucumberDecorationProvider,
    private commandHandlers: CommandHandlers
  ) {
    this.fileWatcher = new FileWatcher();
  }

  /**
   * Register all file watchers
   */
  public registerWatchers(context: vscode.ExtensionContext): void {
    this.registerPythonFileWatchers();
    this.registerFeatureFileWatchers();
    
    // Register all disposables to context at once
    context.subscriptions.push(...this.disposables);
  }

  /**
   * Register Python file watchers
   */
  private registerPythonFileWatchers(): void {
    // Monitor Python file content changes in editor - real-time refresh like feature files
    const onDocumentChange = vscode.workspace.onDidChangeTextDocument((event) => {
      const doc = event.document;
      const filePath = doc.uri.fsPath;
      
      if (doc.languageId === "python" && filePath.includes("steps") && filePath.endsWith(".py")) {
        // Use debounce to avoid too frequent updates while typing
        this.debouncedHandlePythonFileChanged(filePath);
      }
    });

    // Monitor file system events for Python files using FileWatcher utility
    const pythonWatcher = this.fileWatcher.watchPattern("**/steps/**/*.py", async (filePath) => {
      this.debouncedHandlePythonFileChanged(filePath);
    });

    this.disposables.push(onDocumentChange, pythonWatcher);
  }

  /**
   * Register feature file watchers
   */
  private registerFeatureFileWatchers(): void {
    // Monitor feature file opening
    this.disposables.push(
      vscode.workspace.onDidOpenTextDocument((doc) => {
        if (this.isFeatureFile(doc)) {
          this.handleFeatureFileOpened(doc);
        }
      })
    );

    // Monitor feature file content changes
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (this.isFeatureFile(event.document)) {
          this.handleFeatureFileChanged(event.document);
        }
      })
    );

    // Monitor feature file saves
    this.disposables.push(
      vscode.workspace.onDidSaveTextDocument((doc) => {
        if (this.isFeatureFile(doc)) {
          this.handleFeatureFileSaved(doc);
        }
      })
    );

    // Monitor active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor && this.isFeatureFile(editor.document)) {
          this.handleFeatureFileActivated(editor);
        }
      })
    );
  }

  /**
   * Handle Python file changed with debounce
   */
  private debouncedHandlePythonFileChanged(filePath: string): void {
    // Clear existing timeout for this file
    const existingTimeout = this.pythonFileDebounce.get(filePath);
    if (existingTimeout) {
      clearTimeout(existingTimeout);
    }

    // Set new timeout
    const timeout = setTimeout(async () => {
      await this.handlePythonFileChanged(filePath);
      this.pythonFileDebounce.delete(filePath);
    }, this.PYTHON_DEBOUNCE_DELAY);

    this.pythonFileDebounce.set(filePath, timeout);
  }

  /**
   * Handle Python file changed - update cache and refresh all
   */
  private async handlePythonFileChanged(filePath: string): Promise<void> {
    // Invalidate cache
    this.cacheManager.invalidate({ target: 'python', filePath });
    
    // Reload all Python files
    const pythonFiles = this.pathResolver.findImplementationFiles(this.workspaceFolder);
    await this.cacheManager.initialize(pythonFiles);
    
    // Update step matcher
    const updatedStepMatcher = this.cacheManager.createStepMatcher(pythonFiles);
    this.automationService.updateStepMatcher(updatedStepMatcher);
    
    // Clear ALL feature file caches (important!)
    this.cacheManager.invalidate({ target: 'all' });
    
    // Refresh UI
    this.codeLensProvider.refresh();
    
    // Refresh all visible feature files
    this.refreshAllVisibleFeatureFiles();
    
    // Refresh automation details panel if open
    await this.commandHandlers.refreshAutomationDetails();
  }

  /**
   * Handle feature file opened
   */
  private handleFeatureFileOpened(doc: vscode.TextDocument): void {
    this.decorationProvider.clearCacheForFile(doc.uri.fsPath);
    
    // Update decorations for all visible editors with this file
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.fsPath === doc.uri.fsPath) {
        this.decorationProvider.triggerUpdateImmediate(editor);
      }
    }
  }

  /**
   * Handle feature file content changed
   */
  private handleFeatureFileChanged(doc: vscode.TextDocument): void {
    const filePath = doc.uri.fsPath;
    this.decorationProvider.clearCacheForFile(filePath);
    
    // Find corresponding editor and update with debounce
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.fsPath === filePath) {
        this.decorationProvider.triggerUpdateWithDebounce(editor);
      }
    }
  }

  /**
   * Handle feature file saved
   */
  private handleFeatureFileSaved(doc: vscode.TextDocument): void {
    const filePath = doc.uri.fsPath;
    this.decorationProvider.clearCacheForFile(filePath);
    
    // Update with debounce
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.fsPath === filePath) {
        this.decorationProvider.triggerUpdateWithDebounce(editor);
      }
    }
  }

  /**
   * Handle feature file activated (editor switched)
   */
  private handleFeatureFileActivated(editor: vscode.TextEditor): void {
    // Always clear cache and refresh when switching to a feature file
    // This ensures we pick up any Python changes that happened while the file wasn't active
    this.decorationProvider.clearCacheForFile(editor.document.uri.fsPath);
    this.decorationProvider.triggerUpdateImmediate(editor);
  }

  /**
   * Refresh all visible feature files
   */
  private async refreshAllVisibleFeatureFiles(): Promise<void> {
    // Get all visible editors
    const visibleFeatureEditors = vscode.window.visibleTextEditors.filter(editor => 
      this.isFeatureFile(editor.document)
    );
    
    // Also get all open text documents (including those not currently visible)
    const allFeatureDocuments = vscode.workspace.textDocuments.filter(doc => 
      this.isFeatureFile(doc)
    );
    
    // Clear cache for ALL open feature files (not just visible ones)
    for (const doc of allFeatureDocuments) {
      this.decorationProvider.clearCacheForFile(doc.uri.fsPath);
    }
    
    // Trigger immediate update for visible editors
    for (const editor of visibleFeatureEditors) {
      await this.decorationProvider.triggerUpdateImmediate(editor);
    }
    
    // Also refresh CodeLens for all feature files
    this.codeLensProvider.refresh();
  }

  /**
   * Check if document is a feature file
   */
  private isFeatureFile(doc: vscode.TextDocument): boolean {
    return doc.languageId === "feature" || doc.fileName.endsWith(".feature");
  }

  /**
   * Dispose all watchers
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables = [];
    this.fileWatcher?.dispose();
  }
}