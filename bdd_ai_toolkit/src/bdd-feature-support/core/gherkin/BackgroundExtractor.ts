// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * BackgroundExtractor - Extract Background from Feature files
 */

import * as vscode from 'vscode';
import { Background } from './types';
import { StepExtractor } from './StepExtractor';

export class BackgroundExtractor {
  private stepExtractor: StepExtractor;

  constructor(stepExtractor?: StepExtractor) {
    this.stepExtractor = stepExtractor || new StepExtractor();
  }

  /**
   * Extract Background from a document
   * @param document VS Code document
   * @returns Background object or null
   */
  extractBackground(document: vscode.TextDocument): Background | null {
    const lines = document.getText().split(/\r?\n/);
    return this.extractBackgroundFromLines(lines);
  }

  /**
   * Extract Background from an array of lines
   * @param lines Array of text lines
   * @returns Background object or null
   */
  extractBackgroundFromLines(lines: string[]): Background | null {
    // Find the Background line
    let backgroundLineIndex = -1;
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Background:')) {
        backgroundLineIndex = i;
        break;
      }
    }

    if (backgroundLineIndex === -1) {
      return null;
    }

    // Find the end of the background (next scenario or feature element)
    const lineEnd = this.findBackgroundEnd(lines, backgroundLineIndex);

    // Extract steps
    const steps = this.stepExtractor.extractSteps(
      lines, 
      backgroundLineIndex + 2,  // Start after "Background:" line
      lineEnd
    );

    // Extract description (lines between Background: and first step)
    const description = this.extractDescription(lines, backgroundLineIndex + 1, lineEnd, steps);

    return {
      steps,
      lineNumber: backgroundLineIndex + 1, // Convert to 1-based
      lineStart: backgroundLineIndex + 1,
      lineEnd: lineEnd,
      description
    };
  }

  /**
   * Find the end line of a background section
   */
  private findBackgroundEnd(lines: string[], startIndex: number): number {
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for next scenario or other blocks
      if (
        line.startsWith('Scenario:') ||
        line.startsWith('Scenario Outline:') ||
        line.startsWith('Feature:') ||
        line.startsWith('@')  // Tags before a scenario
      ) {
        return i;
      }
    }

    return lines.length;
  }

  /**
   * Extract description between Background line and first step
   */
  private extractDescription(
    lines: string[],
    startIndex: number,
    endIndex: number,
    steps: any[]
  ): string | undefined {
    const descriptionLines: string[] = [];
    const firstStepLine = steps.length > 0 ? steps[0].lineNumber - 1 : endIndex;

    for (let i = startIndex; i < firstStepLine && i < endIndex; i++) {
      const line = lines[i].trim();
      if (line && !line.startsWith('#')) {
        descriptionLines.push(line);
      }
    }

    return descriptionLines.length > 0 ? descriptionLines.join('\n') : undefined;
  }

  /**
   * Check if a line contains a Background
   */
  isBackgroundLine(line: string): boolean {
    return line.trim().startsWith('Background:');
  }
}
