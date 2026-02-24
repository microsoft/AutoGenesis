// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

import * as vscode from "vscode";

/**
 * Test case generator parameters interface
 */
export interface ITestCaseGeneratorParameters {
  featureName?: string; // Optional feature name, if not provided, Copilot will infer from context
}

/**
 * XMind parser parameters interface
 */
export interface IXMindParserParameters {
  xmindFilePath: string;
  outputFormat?: "markdown" | "text";
  outputPath?: string;
}

/**
 * Figma context extractor parameters interface
 */
export interface IFigmaExtractorParameters {
  fileKey: string; // Figma file key, usually found in the URL figma.com/file/<fileKey>/...
  nodeId?: string; // Optional node ID, can be found in URL parameter node-id=<nodeId>
  outputPath?: string; // Optional output path, if not provided, will be saved in the same directory as the source file
}

/**
 * XMind to test case conversion parameters interface
 */
// export interface IXMindToTestCaseParameters {
//     xmindFilePath: string;
//     featureName?: string;  // Optional feature name, if not provided, will be inferred from XMind content
//     outputFilePath?: string;
// }

/**
 * Scenario information interface
 */
export interface ScenarioInfo {
  name: string;
  priority: string;
  type: string;
}

/**
 * Test case optimizer parameters interface
 */
export interface ITestCaseOptimizerParameters {
  featureName?: string; // Optional feature name, if not provided, will be inferred from file content
  inputFilePath: string; // Input file path
  outputPath?: string; // Optional output path, if not provided, will be generated based on input file path
}

/**
 * Tool helper function - convert to safe file name
 */
export function toSafeFileName(name: string): string {
  // Replace non-English characters with closest English equivalent or remove them
  // Then replace spaces with underscores and remove special characters
  return (
    name
      .toLowerCase()
      .replace(/[^\x00-\x7F]/g, "") // Remove non-ASCII characters
      .replace(/\s+/g, "_") // Replace spaces with underscores
      .replace(/[^a-z0-9_]/g, "") || // Remove any remaining special characters
    "feature"
  ); // Fallback if result is empty
}
