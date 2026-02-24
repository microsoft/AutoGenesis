// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

/**
 * Workflow pattern definitions to ensure complete test case scenarios
 */
export interface WorkflowPattern {
  name: string;
  description: string;
  triggerActions: string[];
  requiredCompletionActions: string[];
  exampleFlow: string[];
}

export class TestCaseCompleteness {
  /**
   * Common workflow patterns that should be completed end-to-end
   */
  static readonly workflowPatterns: WorkflowPattern[] = [
    {
      name: "clipboard-workflow",
      description:
        "When a user copies content to clipboard, they should verify by pasting it",
      triggerActions: ["copy to clipboard", "add to clipboard", "copied"],
      requiredCompletionActions: ["paste", "pasted", "verify paste"],
      exampleFlow: [
        "When I copy the content to clipboard",
        "And I open a text editor",
        "And I paste the content",
        "Then I should see the correct content pasted",
      ],
    },
    {
      name: "save-workflow",
      description:
        "When a user saves a file, they should verify it was saved correctly",
      triggerActions: ["save", "download", "export"],
      requiredCompletionActions: [
        "verify file exists",
        "open saved file",
        "check saved content",
      ],
      exampleFlow: [
        "When I save the file",
        "And I navigate to the saved location",
        "Then the file should exist",
        "When I open the saved file",
        "Then the content should be correct",
      ],
    },
    {
      name: "settings-workflow",
      description:
        "When changing settings, verify the changes persist and affect functionality",
      triggerActions: ["change setting", "configure", "set option"],
      requiredCompletionActions: [
        "setting persists",
        "verify setting",
        "functionality changed",
      ],
      exampleFlow: [
        "When I change the setting",
        "And I close and reopen the application",
        "Then the setting should still be applied",
        "When I use the related feature",
        "Then it should work according to the new setting",
      ],
    },
    {
      name: "login-workflow",
      description:
        "Login flows should include verification of successful authentication",
      triggerActions: ["login", "sign in", "authenticate"],
      requiredCompletionActions: [
        "logged in",
        "authenticated",
        "access granted",
      ],
      exampleFlow: [
        "When I enter my credentials",
        "And I click the login button",
        "Then I should be logged in successfully",
        "And I should see my user dashboard",
      ],
    },
    {
      name: "create-edit-workflow",
      description:
        "When creating or editing content, verify changes are saved and displayed",
      triggerActions: ["create", "edit", "modify"],
      requiredCompletionActions: [
        "save changes",
        "verify changes",
        "changes displayed",
      ],
      exampleFlow: [
        "When I edit the content",
        "And I save the changes",
        "Then the changes should be saved",
        "When I view the content again",
        "Then I should see my changes",
      ],
    },
  ];

  /**
   * Generate prompt guidance to ensure complete workflows
   */
  static getWorkflowGuidance(): string {
    let guidance =
      "Ensure test cases cover complete end-to-end workflows. For example:\n\n";

    // Add examples from our patterns
    this.workflowPatterns.forEach((pattern) => {
      guidance += `-- ${pattern.description}\n`;
    });

    guidance +=
      "\nAvoid truncated workflows. Test cases should verify the final outcome of user actions.";
    return guidance;
  }
}
