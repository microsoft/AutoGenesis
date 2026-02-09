/**
 * StepExtractor - Unified step extraction logic
 */

import { Step, StepType } from './types';

export class StepExtractor {
  private static readonly STEP_KEYWORDS = ['Given', 'When', 'Then', 'And', 'But', '*'];
  private static readonly DATA_TABLE_REGEX = /^\s*\|/;
  private static readonly DOC_STRING_DELIMITER = '"""';

  /**
   * Extract steps from an array of lines
   * @param lines Array of text lines
   * @param startLine Starting line number (1-based)
   * @param endLine Ending line number (1-based, optional)
   * @returns Array of Step objects
   */
  extractSteps(lines: string[], startLine: number, endLine?: number): Step[] {
    const steps: Step[] = [];
    const actualEndLine = endLine ?? lines.length;
    let currentStep: Step | null = null;
    let inDocString = false;
    let docStringContent: string[] = [];
    let dataTableRows: string[][] = [];

    for (let i = startLine - 1; i < actualEndLine && i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip empty lines and comments
      if (!trimmedLine || trimmedLine.startsWith('#')) {
        continue;
      }

      // Handle doc strings
      if (trimmedLine.startsWith(StepExtractor.DOC_STRING_DELIMITER)) {
        if (inDocString) {
          // End of doc string
          if (currentStep) {
            currentStep.docString = docStringContent.join('\n');
          }
          docStringContent = [];
          inDocString = false;
        } else {
          // Start of doc string
          inDocString = true;
        }
        continue;
      }

      if (inDocString) {
        docStringContent.push(line);
        continue;
      }

      // Handle data table
      if (StepExtractor.DATA_TABLE_REGEX.test(line)) {
        const cells = line
          .split('|')
          .map(cell => cell.trim())
          .filter(cell => cell.length > 0);
        
        if (cells.length > 0) {
          dataTableRows.push(cells);
        }
        continue;
      }

      // Check if this is a step line
      const stepMatch = this.matchStepLine(trimmedLine);
      if (stepMatch) {
        // Save previous step's data table
        if (currentStep && dataTableRows.length > 0) {
          currentStep.dataTable = dataTableRows;
          dataTableRows = [];
        }

        // Create new step
        currentStep = {
          type: stepMatch.type,
          text: stepMatch.text,
          rawText: trimmedLine,
          lineNumber: i + 1
        };
        steps.push(currentStep);
      } else {
        // If we're inside a step context but it's not a recognized keyword,
        // it might be a continuation or end of scenario
        if (currentStep && dataTableRows.length > 0) {
          currentStep.dataTable = dataTableRows;
          dataTableRows = [];
        }
        
        // Check if this line indicates end of scenario/background
        if (this.isEndOfBlock(trimmedLine)) {
          break;
        }
      }
    }

    // Handle any remaining data table
    if (currentStep && dataTableRows.length > 0) {
      currentStep.dataTable = dataTableRows;
    }

    return steps;
  }

  /**
   * Match a step line and extract type and text
   */
  private matchStepLine(line: string): { type: StepType; text: string } | null {
    for (const keyword of StepExtractor.STEP_KEYWORDS) {
      const regex = new RegExp(`^${keyword}\\s+(.+)$`, 'i');
      const match = line.match(regex);
      if (match) {
        return {
          type: keyword as StepType,
          text: match[1].trim()
        };
      }
    }
    return null;
  }

  /**
   * Check if a line indicates the end of a scenario/background block
   */
  private isEndOfBlock(line: string): boolean {
    const blockKeywords = [
      'Scenario:',
      'Scenario Outline:',
      'Background:',
      'Feature:',
      'Examples:',
      '@'
    ];

    return blockKeywords.some(keyword => 
      line.startsWith(keyword) || line.includes(keyword)
    );
  }

  /**
   * Extract steps from a specific range in text
   * @param text Full text content
   * @param startLine Starting line number (1-based)
   * @param endLine Ending line number (1-based)
   * @returns Array of Step objects
   */
  extractStepsFromText(text: string, startLine: number, endLine: number): Step[] {
    const lines = text.split(/\r?\n/);
    return this.extractSteps(lines, startLine, endLine);
  }

  /**
   * Normalize step type for And/But steps
   * And/But steps inherit the type from the previous step
   * @param steps Array of steps
   * @returns Array of steps with normalized types
   */
  normalizeStepTypes(steps: Step[]): Step[] {
    let lastRealType: StepType = StepType.Given;

    return steps.map(step => {
      if (step.type === StepType.And || step.type === StepType.But || step.type === StepType.Star) {
        return { ...step, type: lastRealType };
      } else {
        lastRealType = step.type;
        return step;
      }
    });
  }

  /**
   * Extract step text without parameters
   * Useful for pattern matching
   */
  extractStepTextWithoutParams(stepText: string): string {
    // Remove quoted strings, numbers, and other parameters
    return stepText
      .replace(/"[^"]*"/g, '""')  // Replace quoted strings
      .replace(/'\w+'/g, "''")     // Replace single-quoted strings
      .replace(/\d+/g, '0')         // Replace numbers
      .trim();
  }
}
