// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import {
  NaturalLanguageTaskExecutor,
  executeNaturalLanguageTask,
} from "./naturalLanguageTaskExecutor";

export function registerTools(context: vscode.ExtensionContext) {
  // Register Language Model Tools

  // Internal tools - registered but not exposed in package.json contributions
  // These tools are used internally by other tools or workflows
  context.subscriptions.push(
    vscode.lm.registerTool(
      "sendNaturalLanguageTask",
      new NaturalLanguageTaskExecutor()
    )
  );
  // Register VS Code Commands
  registerNaturalLanguageTaskCommand(context);
}

// Re-export interfaces and the executeNaturalLanguageTask function for use in main extension
export { executeNaturalLanguageTask } from "./naturalLanguageTaskExecutor";
// Command registration function moved from naturalLanguageTaskExecutor.ts
function registerNaturalLanguageTaskCommand(
  context: vscode.ExtensionContext
): void {
  context.subscriptions.push(
    vscode.commands.registerCommand(
      "bddAiToolkit.executeNaturalLanguageTask",
      async () => {
        const taskDescription = await vscode.window.showInputBox({
          prompt: "Enter natural language task description",
          placeHolder:
            'Describe the task you want to execute (e.g., "Click the login button and enter credentials")',
          value: "",
        });

        if (taskDescription) {
          await executeNaturalLanguageTask(taskDescription);
        }
      }
    )
  );
}

// Re-export interfaces
export * from "./interfaces";
