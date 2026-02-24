// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";
import * as path from "path";
import { ITestCaseGeneratorParameters, toSafeFileName } from "./interfaces";
import { TestCaseCompleteness } from "./testCaseWorkflowPatterns";

/**
 * Test case generator tool
 */
export class TestCaseGeneratorTool
  implements vscode.LanguageModelTool<ITestCaseGeneratorParameters>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<ITestCaseGeneratorParameters>,
    token: vscode.CancellationToken
  ) {
    const params = options.input;
    let { featureName } = params;

    try {
      // Read configuration for auto-optimization
      const config = vscode.workspace.getConfiguration(
        "bddAiToolkit.testGeneration"
      );
      const autoOptimize = config.get<boolean>("autoOptimize", true);

      // If featureName is not provided, use a placeholder for Copilot to infer from context
      if (!featureName) {
        featureName = "{FEATURE_NAME}"; // This is just a placeholder that will be replaced by Copilot based on context
      }

      console.log(`Generating BDD test case prompt - Feature: ${featureName}`);

      // Get workspace folder path
      let workspacePath = "";
      if (
        vscode.workspace.workspaceFolders &&
        vscode.workspace.workspaceFolders.length > 0
      ) {
        workspacePath = vscode.workspace.workspaceFolders[0].uri.fsPath;
      } else {
        throw new Error(
          "No workspace folder found. Please open a workspace first."
        );
      }

      // Prepare a suggested file path for the test cases
      const fileName =
        featureName !== "{FEATURE_NAME}"
          ? `${toSafeFileName(featureName)}_raw.feature`
          : "bdd_test_cases_raw.feature";

      const suggestedFilePath = path.join(workspacePath, fileName);

      // Generate prompt
      const prompt = this.generatePrompt(featureName);

      // Build result message
      let resultMessage = "";
      // Generate next steps based on configuration
      const nextSteps = autoOptimize
        ? `**Step 3 - Next Steps**:\n` +
          `1. After generating the test cases, automatically use the testCaseOptimizer tool to optimize them\n` +
          `2. The testCaseOptimizer tool will check for and fix any issues with the test cases\n` +
          `3. The original raw file will be deleted, keeping only the optimized version\n\n`
        : `**Step 3 - Next Steps**:\n` +
          `1. After generating the test cases, you can manually use the testCaseOptimizer tool to optimize them if needed\n` +
          `2. Auto-optimization is currently disabled in settings\n\n`;

      // If using a placeholder, add special instructions
      if (featureName === "{FEATURE_NAME}") {
        resultMessage =
          `# BDD Test Case Generation\n\n` +
          `I will generate complete BDD test cases based on context file. The current organization of test cases is chaotic and needs systematic reorganization and redesign. \n\n` +
          `**Step 1 - Analyze Requirements**:\n` +
          `1. I will analyze your content or context to understand the functionality\n` +
          `2. Based on analysis, determine appropriate feature name and test scenarios\n\n` +
          `**Step 2 - Generate Test Cases**:\n` +
          `1. I will generate BDD format test cases by using the prompt below\n` +
          nextSteps +
          `**Suggested file path**: \`${suggestedFilePath}\`\n\n` +
          `---\n\n` +
          `Prompt: ${prompt}`;
      } else {
        resultMessage =
          `# ${featureName} - BDD Test Case Generation\n\n` +
          `I will generate complete BDD test cases based on context file.\n\n` +
          `**Step 1 - Analyze Requirements**:\n` +
          `1. I will analyze your content or context to understand the functionality\n` +
          `2. Based on analysis, determine appropriate test scenarios\n\n` +
          `**Step 2 - Generate Test Cases**:\n` +
          `1. I will generate BDD format test cases by using the prompt below\n\n` +
          nextSteps +
          `**Suggested file path**: \`${suggestedFilePath}\`\n\n` +
          `---\n\n` +
          `Prompt: ${prompt}`;
      }

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(resultMessage),
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(
          `Error generating test prompt: ${errorMessage}`
        ),
      ]);
    }
  }

  // Generate prompt
  private generatePrompt(featureName: string): string {
    const workflowGuidance = TestCaseCompleteness.getWorkflowGuidance();
    // Get domain-specific terminology
    const domainTerms = this.getDomainTerms();

    // This prompt should be used directly by the LLM
    const promptText = `
        This file contains test cases for the ${featureName} feature. You need to understand the functionality and interaction details based on this information, and then reorganize it into a comprehensive BDD test suite in a single file with the following requirements:

1. **Structure**:
   - Each scenario must have two tags: @[category] and @[level]

2. **Content Quality**:
   - Design logical, comprehensive scenarios covering all functional aspects
   - Follow natural user operation workflows
   - Ensure scenarios are independent and focused on specific functionality
   - Ensure test cases cover complete end-to-end workflows. For example: 
     ${workflowGuidance}

3. **Specificity**:
   - Use concrete actions instead of vague statements
   - Example: Use "navigate to https://bing.com" instead of "open a webpage"
   - Every step must explicitly specify content without pronouns or references:
     - ❌ NEVER use "the default save location should be 'Favorites bar'" - specify the folder field
     - ❌ NEVER use vague verifications like "no changes should be made" - specify exactly what to check
     - ❌ NEVER use "the browser should navigate to the corresponding page" - always specify the URL
     - ❌ NEVER use "the deleted favorite items should be restored" without specifying which items
     - ❌ NEVER use "my custom sorting should be applied" without specifying the exact order
     - ❌ NEVER use "the sort order should be maintained" without specifying what the order is

4. **Exclusions**:
   - Omit all UI style validations (button states, highlights, etc.)
   - Focus on functional behavior rather than appearance

5. **Maximize Automation Compatibility**:
- Provide explicit element identifiers: "the '×' button in the search input box" 
- Use clear action verbs: click, type, drag, select
- Define specific pre-conditions in Given steps
- Make verification steps objectively testable
   
## Examples

### Good Example - A Well-Written BDD Test Case

Scenario: Sort favorites alphabetically Z to A
  Given I have favorites "Microsoft", "Bing", and "GitHub" in my Favorites bar
  When I click the Favorites icon in the toolbar
  And I click the "Sort favorites" button
  And I select "Z to A" from the sort options menu
  Then the favorites should be sorted as "Microsoft", "GitHub", "Bing"
  And the "Z to A" option should be checked in the sort options menu

**Why this is good:**
- Uses concrete, specific actions with explicit content
- Focuses on one functionality (sorting alphabetically Z to A)
- Uses a concise Given statement to establish test prerequisites without detailed setup steps
- Verifies the actual functional result (sorting order)
- Avoids UI style validations(button states, icon states, highlights, etc.)
- Avoids UI style validations(button states, icon states, highlights, etc.)
- Uses explicit names instead of pronouns or references

### Bad Example - A Poorly Written BDD Test Case

Scenario: Sort favorites using different methods
  Given the Favorites flyout is open
  When the user clicks the "Sort favorites" button
  And the user selects "Frequently visited" in the options menu
  Then the sort button icon should change
  And a checkmark should appear before "Frequently visited" in the options menu
  When the user clicks the "Sort favorites" button
  And the user selects "Newest" in the options menu
  Then the sort button icon should change
  And a checkmark should appear before "Newest" in the options menu
  When the user clicks the "Sort favorites" button
  And the user selects "Z to A" in the options menu
  Then the sort button icon should change
  And a checkmark should appear before "Z to A" in the options menu

**Why this is bad:**
- Multiple functionalities in one scenario instead of being focused
- Refers to "the user" instead of using first-person perspective
- Focuses on UI changes ("icon should change", "checkmark should appear") rather than functional behavior
- No verification of the actual sorting functionality
- Lacks a complete flow (no setup to add favorites to sort)
- Repeats the same pattern multiple times in one scenario`;

    return promptText + "\n\n" + domainTerms;
  }
  // Get domain-specific terminology and mapping relationships
  private getDomainTerms(): string {
    // Define mappings between domain terms and their corresponding content
    // Designed as a set of terms and explanations for easy future expansion
    const termMappings: Array<{
      term: string;
      mapping: string;
      description: string;
    }> = [
      // Add domain-specific term mappings here, for example:
      // { term: "settings page", mapping: "app://settings", description: "The application's settings page" },
      // { term: "dashboard", mapping: "/dashboard", description: "Main dashboard view" },
    ];

    // Generate terminology mapping text
    let termsText = "## Domain Terminology\n\n";
    termsText +=
      "When writing test cases, use these specific mappings for domain terminology:\n\n";

    termMappings.forEach((mapping) => {
      termsText += `- "${mapping.term}": Use "${mapping.mapping}" (${mapping.description})\n`;
    });

    return termsText;
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<ITestCaseGeneratorParameters>,
    _token: vscode.CancellationToken
  ) {
    const confirmationMessages = {
      title: "Generate BDD Test Case Prompts",
      message: new vscode.MarkdownString(
        `Generate BDD test case prompts for the following feature:\n\n` +
          `Feature name: ${options.input.featureName}\n\n` +
          `This tool will return prompts used to generate complete test cases.`
      ),
    };

    return {
      invocationMessage: `Preparing BDD test template for "${options.input.featureName}"`,
      confirmationMessages,
    };
  }
}
