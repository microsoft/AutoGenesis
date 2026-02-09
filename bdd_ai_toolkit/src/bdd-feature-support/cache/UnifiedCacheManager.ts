/**
 * UnifiedCacheManager - Unified cache management for all caching needs
 */

import * as vscode from 'vscode';
import { PythonFileCache } from './PythonFileCache';
import { StepMatchCache } from './StepMatchCache';
import { AutomationStatusCache } from './AutomationStatusCache';
import { StepDefinition, AutomationStatus, StepImplementationResult } from '../core/matching/types';
import { Step } from '../core/gherkin/types';
import { StepMatcher } from '../core/matching/StepMatcher';
import { PatternConverter } from '../core/matching/PatternConverter';

export interface InvalidateOptions {
  target: 'all' | 'python' | 'feature' | 'status' | 'step-match';
  filePath?: string;
  scenarioLine?: number;
}

export class UnifiedCacheManager {
  private static instances = new Map<string, UnifiedCacheManager>();

  private pythonFileCache: PythonFileCache;
  private stepMatchCache: StepMatchCache;
  private automationStatusCache: AutomationStatusCache;

  private fileWatchers: vscode.Disposable[] = [];
  private initialized = false;

  private constructor(private workspaceFolder: string) {
    this.pythonFileCache = new PythonFileCache();
    this.stepMatchCache = new StepMatchCache();
    this.automationStatusCache = new AutomationStatusCache();
  }

  /**
   * Get or create instance for a workspace
   */
  public static getInstance(workspaceFolder: string): UnifiedCacheManager {
    if (!UnifiedCacheManager.instances.has(workspaceFolder)) {
      UnifiedCacheManager.instances.set(
        workspaceFolder,
        new UnifiedCacheManager(workspaceFolder)
      );
    }
    return UnifiedCacheManager.instances.get(workspaceFolder)!;
  }

  /**
   * Initialize cache manager
   * @param pythonFiles Array of Python file paths to preload
   */
  public async initialize(pythonFiles: string[]): Promise<void> {
    if (this.initialized) {
      return;
    }

    console.log(`[UnifiedCacheManager] Initializing with ${pythonFiles.length} Python files`);

    // Preload Python files
    await this.pythonFileCache.preload(pythonFiles);

    // Setup file watchers
    this.setupFileWatchers();

    this.initialized = true;
    console.log('[UnifiedCacheManager] Initialization complete');
  }

  /**
   * Check if initialized
   */
  public isInitialized(): boolean {
    return this.initialized;
  }

  /**
   * Setup file watchers for automatic cache invalidation
   */
  private setupFileWatchers(): void {
    // Watch Python files
    const pythonWatcher = vscode.workspace.createFileSystemWatcher('**/*.py');

    pythonWatcher.onDidChange(uri => {
      this.invalidate({ target: 'python', filePath: uri.fsPath });
    });

    pythonWatcher.onDidCreate(uri => {
      this.pythonFileCache.load(uri.fsPath);
      this.invalidate({ target: 'step-match' }); // Invalidate step matches
    });

    pythonWatcher.onDidDelete(uri => {
      this.invalidate({ target: 'python', filePath: uri.fsPath });
    });

    this.fileWatchers.push(pythonWatcher);

    // Watch Feature files
    const featureWatcher = vscode.workspace.createFileSystemWatcher('**/*.feature');

    featureWatcher.onDidChange(uri => {
      this.invalidate({ target: 'feature', filePath: uri.fsPath });
    });

    featureWatcher.onDidDelete(uri => {
      this.invalidate({ target: 'feature', filePath: uri.fsPath });
    });

    this.fileWatchers.push(featureWatcher);
  }

  /**
   * Unified cache invalidation
   */
  public invalidate(options: InvalidateOptions): void {
    switch (options.target) {
      case 'all':
        this.pythonFileCache.invalidateAll();
        this.stepMatchCache.invalidateAll();
        this.automationStatusCache.invalidateAll();
        break;

      case 'python':
        if (options.filePath) {
          this.pythonFileCache.invalidate(options.filePath);
          // Python file change affects all step matches and automation statuses
          this.stepMatchCache.invalidateAll();
          this.automationStatusCache.invalidateAll();
        } else {
          this.pythonFileCache.invalidateAll();
          this.stepMatchCache.invalidateAll();
          this.automationStatusCache.invalidateAll();
        }
        break;

      case 'feature':
        if (options.filePath) {
          this.stepMatchCache.invalidateFile(options.filePath);
          this.automationStatusCache.invalidateFile(options.filePath);
        }
        break;

      case 'status':
        if (options.filePath && options.scenarioLine !== undefined) {
          this.automationStatusCache.invalidate(options.filePath, options.scenarioLine);
        } else if (options.filePath) {
          this.automationStatusCache.invalidateFile(options.filePath);
        } else {
          this.automationStatusCache.invalidateAll();
        }
        break;

      case 'step-match':
        if (options.filePath) {
          this.stepMatchCache.invalidateFile(options.filePath);
        } else {
          this.stepMatchCache.invalidateAll();
        }
        break;
    }
  }

  /**
   * Get all step definitions (from cache or load)
   * @param pythonFiles Array of Python file paths
   * @returns All step definitions
   */
  public getAllStepDefinitions(pythonFiles: string[]): StepDefinition[] {
    return this.pythonFileCache.loadAll(pythonFiles);
  }

  /**
   * Create a StepMatcher with cached step definitions
   * @param pythonFiles Array of Python file paths
   * @returns StepMatcher instance
   */
  public createStepMatcher(pythonFiles: string[]): StepMatcher {
    const definitions = this.getAllStepDefinitions(pythonFiles);
    return new StepMatcher(definitions, new PatternConverter());
  }

  /**
   * Get cached step match result
   */
  public getCachedStepMatch(featureFile: string, stepText: string): StepImplementationResult | null {
    return this.stepMatchCache.get(featureFile, stepText);
  }

  /**
   * Cache step match result
   */
  public cacheStepMatch(featureFile: string, stepText: string, result: StepImplementationResult): void {
    this.stepMatchCache.set(featureFile, stepText, result);
  }

  /**
   * Get cached automation status
   */
  public getCachedAutomationStatus(featureFile: string, scenarioLine: number): AutomationStatus | null {
    return this.automationStatusCache.get(featureFile, scenarioLine);
  }

  /**
   * Cache automation status
   */
  public cacheAutomationStatus(featureFile: string, scenarioLine: number, status: AutomationStatus): void {
    this.automationStatusCache.set(featureFile, scenarioLine, status);
  }

  /**
   * Get cache statistics
   */
  public getStatistics(): {
    python: any;
    stepMatch: any;
    automationStatus: any;
  } {
    return {
      python: this.pythonFileCache.getStatistics(),
      stepMatch: this.stepMatchCache.getStatistics(),
      automationStatus: this.automationStatusCache.getStatistics()
    };
  }

  /**
   * Cleanup old cache entries
   * @param maxAge Max age in milliseconds (default: 1 hour)
   */
  public cleanupOldEntries(maxAge: number = 3600000): void {
    this.stepMatchCache.clearOldEntries(maxAge);
    this.automationStatusCache.clearOldEntries(maxAge);
    console.log(`[UnifiedCacheManager] Cleaned up entries older than ${maxAge}ms`);
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    for (const watcher of this.fileWatchers) {
      watcher.dispose();
    }
    this.fileWatchers = [];
    this.initialized = false;
    console.log('[UnifiedCacheManager] Disposed');
  }

  /**
   * Get Python file cache (for advanced usage)
   */
  public getPythonFileCache(): PythonFileCache {
    return this.pythonFileCache;
  }

  /**
   * Get step match cache (for advanced usage)
   */
  public getStepMatchCache(): StepMatchCache {
    return this.stepMatchCache;
  }

  /**
   * Get automation status cache (for advanced usage)
   */
  public getAutomationStatusCache(): AutomationStatusCache {
    return this.automationStatusCache;
  }
}
