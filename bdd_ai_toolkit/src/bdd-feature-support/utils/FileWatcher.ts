/**
 * FileWatcher - Unified file watching utility
 */

import * as vscode from 'vscode';

export type FileChangeCallback = (filePath: string) => void;

export class FileWatcher {
  private watchers: vscode.Disposable[] = [];

  /**
   * Watch Python files for changes
   * @param callback Callback function called when a Python file changes
   * @returns Disposable to stop watching
   */
  public watchPythonFiles(callback: FileChangeCallback): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.py');

    const onChanged = watcher.onDidChange(uri => callback(uri.fsPath));
    const onCreate = watcher.onDidCreate(uri => callback(uri.fsPath));
    const onDelete = watcher.onDidDelete(uri => callback(uri.fsPath));

    const disposable = vscode.Disposable.from(watcher, onChanged, onCreate, onDelete);
    this.watchers.push(disposable);

    return disposable;
  }

  /**
   * Watch Feature files for changes
   * @param callback Callback function called when a Feature file changes
   * @returns Disposable to stop watching
   */
  public watchFeatureFiles(callback: FileChangeCallback): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher('**/*.feature');

    const onChanged = watcher.onDidChange(uri => callback(uri.fsPath));
    const onCreate = watcher.onDidCreate(uri => callback(uri.fsPath));
    const onDelete = watcher.onDidDelete(uri => callback(uri.fsPath));

    const disposable = vscode.Disposable.from(watcher, onChanged, onCreate, onDelete);
    this.watchers.push(disposable);

    return disposable;
  }

  /**
   * Watch specific file pattern
   * @param pattern Glob pattern to watch
   * @param callback Callback function
   * @returns Disposable to stop watching
   */
  public watchPattern(pattern: string, callback: FileChangeCallback): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);

    const onChanged = watcher.onDidChange(uri => callback(uri.fsPath));
    const onCreate = watcher.onDidCreate(uri => callback(uri.fsPath));
    const onDelete = watcher.onDidDelete(uri => callback(uri.fsPath));

    const disposable = vscode.Disposable.from(watcher, onChanged, onCreate, onDelete);
    this.watchers.push(disposable);

    return disposable;
  }

  /**
   * Watch for file changes only (no create/delete)
   * @param pattern Glob pattern to watch
   * @param callback Callback function
   * @returns Disposable to stop watching
   */
  public watchChangesOnly(pattern: string, callback: FileChangeCallback): vscode.Disposable {
    const watcher = vscode.workspace.createFileSystemWatcher(pattern);
    const onChanged = watcher.onDidChange(uri => callback(uri.fsPath));

    const disposable = vscode.Disposable.from(watcher, onChanged);
    this.watchers.push(disposable);

    return disposable;
  }

  /**
   * Stop all watchers
   */
  public stopAll(): void {
    for (const watcher of this.watchers) {
      watcher.dispose();
    }
    this.watchers = [];
  }

  /**
   * Dispose all watchers
   */
  public dispose(): void {
    this.stopAll();
  }
}
