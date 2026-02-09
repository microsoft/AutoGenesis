/**
 * ScenarioExtractor - Extract scenarios from Feature files
 */

import * as vscode from 'vscode';
import { Scenario } from './types';
import { StepExtractor } from './StepExtractor';

export class ScenarioExtractor {
  private stepExtractor: StepExtractor;

  constructor(stepExtractor?: StepExtractor) {
    this.stepExtractor = stepExtractor || new StepExtractor();
  }

  /**
   * Extract a single scenario at a specific line number
   * @param document VS Code document
   * @param lineNumber Line number where the scenario is (1-based)
   * @returns Scenario object or null
   */
  extractScenario(document: vscode.TextDocument, lineNumber: number): Scenario | null {
    const lines = document.getText().split(/\r?\n/);
    
    // Adjust to 0-based index
    const startIndex = lineNumber - 1;
    
    if (startIndex < 0 || startIndex >= lines.length) {
      return null;
    }

    // Find the scenario line
    let scenarioLineIndex = -1;
    for (let i = startIndex; i >= 0; i--) {
      const line = lines[i].trim();
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        scenarioLineIndex = i;
        break;
      }
      // Stop if we hit another block
      if (line.startsWith('Feature:') || line.startsWith('Background:')) {
        break;
      }
    }

    if (scenarioLineIndex === -1) {
      return null;
    }

    return this.extractScenarioFromLine(lines, scenarioLineIndex);
  }

  /**
   * Extract all scenarios from a document
   * @param document VS Code document
   * @returns Array of Scenario objects
   */
  extractAllScenarios(document: vscode.TextDocument): Scenario[] {
    const lines = document.getText().split(/\r?\n/);
    const scenarios: Scenario[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Scenario:') || line.startsWith('Scenario Outline:')) {
        const scenario = this.extractScenarioFromLine(lines, i);
        if (scenario) {
          scenarios.push(scenario);
        }
      }
    }

    return scenarios;
  }

  /**
   * Extract scenario starting from a specific line index
   * @param lines Array of all lines
   * @param scenarioLineIndex Index of the scenario line (0-based)
   * @returns Scenario object or null
   */
  private extractScenarioFromLine(lines: string[], scenarioLineIndex: number): Scenario | null {
    const scenarioLine = lines[scenarioLineIndex].trim();
    
    // Extract scenario name
    let scenarioName = '';
    if (scenarioLine.startsWith('Scenario:')) {
      scenarioName = scenarioLine.substring('Scenario:'.length).trim();
    } else if (scenarioLine.startsWith('Scenario Outline:')) {
      scenarioName = scenarioLine.substring('Scenario Outline:'.length).trim();
    }

    // Extract tags (look backwards from scenario line)
    const tags = this.extractTags(lines, scenarioLineIndex);

    // Find the end of the scenario
    const lineEnd = this.findScenarioEnd(lines, scenarioLineIndex);

    // Extract steps
    const steps = this.stepExtractor.extractSteps(lines, scenarioLineIndex + 2, lineEnd);

    // Extract description (lines between scenario line and first step)
    const description = this.extractDescription(lines, scenarioLineIndex + 1, lineEnd, steps);

    return {
      name: scenarioName,
      tags,
      steps,
      lineNumber: scenarioLineIndex + 1, // Convert to 1-based
      lineStart: scenarioLineIndex + 1,
      lineEnd: lineEnd,
      description
    };
  }

  /**
   * Extract tags before a scenario
   */
  private extractTags(lines: string[], scenarioLineIndex: number): string[] {
    const tags: string[] = [];

    // Look backwards for tags
    for (let i = scenarioLineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith('#')) {
        continue;
      }

      if (line.startsWith('@')) {
        // Extract all tags from this line
        const lineTags = line.split(/\s+/).filter(tag => tag.startsWith('@'));
        tags.unshift(...lineTags);
      } else {
        // Stop if we hit a non-tag, non-empty line
        break;
      }
    }

    return tags;
  }

  /**
   * Find the end line of a scenario
   */
  private findScenarioEnd(lines: string[], startIndex: number): number {
    for (let i = startIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Check for next scenario or other blocks
      if (
        line.startsWith('Scenario:') ||
        line.startsWith('Scenario Outline:') ||
        line.startsWith('Background:') ||
        line.startsWith('Feature:') ||
        (line.startsWith('@') && i > startIndex + 1)
      ) {
        return i;
      }

      // Handle Examples section for Scenario Outline
      if (line.startsWith('Examples:')) {
        // Find the end of the examples table
        for (let j = i + 1; j < lines.length; j++) {
          const exampleLine = lines[j].trim();
          if (exampleLine && !exampleLine.startsWith('|') && !exampleLine.startsWith('#')) {
            return j;
          }
        }
      }
    }

    return lines.length;
  }

  /**
   * Extract description between scenario line and first step
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
   * Check if a line contains a scenario
   */
  isScenarioLine(line: string): boolean {
    const trimmed = line.trim();
    return trimmed.startsWith('Scenario:') || trimmed.startsWith('Scenario Outline:');
  }

  /**
   * Get scenario name from a scenario line
   */
  getScenarioName(line: string): string {
    const trimmed = line.trim();
    if (trimmed.startsWith('Scenario:')) {
      return trimmed.substring('Scenario:'.length).trim();
    } else if (trimmed.startsWith('Scenario Outline:')) {
      return trimmed.substring('Scenario Outline:'.length).trim();
    }
    return '';
  }
}
