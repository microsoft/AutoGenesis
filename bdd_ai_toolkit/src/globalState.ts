// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

/**
 * GlobalState class for storing extension-wide state and context
 */
export class GlobalState {
  private static _context: vscode.ExtensionContext | undefined;

  /**
   * Initialize the GlobalState with the extension context
   * @param context The VSCode extension context
   */
  public static initialize(context: vscode.ExtensionContext): void {
    this._context = context;
  }

  /**
   * Get the extension context
   * @returns The VSCode extension context
   */
  public static get context(): vscode.ExtensionContext | undefined {
    return this._context;
  }
}
