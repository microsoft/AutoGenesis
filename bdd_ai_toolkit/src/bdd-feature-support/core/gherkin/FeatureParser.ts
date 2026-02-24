// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * FeatureParser - Unified Feature file parser
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import { ParsedFeature, ParseResult } from './types';
import { StepExtractor } from './StepExtractor';
import { ScenarioExtractor } from './ScenarioExtractor';
import { BackgroundExtractor } from './BackgroundExtractor';

export class FeatureParser {
  private stepExtractor: StepExtractor;
  private scenarioExtractor: ScenarioExtractor;
  private backgroundExtractor: BackgroundExtractor;

  constructor() {
    this.stepExtractor = new StepExtractor();
    this.scenarioExtractor = new ScenarioExtractor(this.stepExtractor);
    this.backgroundExtractor = new BackgroundExtractor(this.stepExtractor);
  }

  /**
   * Parse an entire Feature file from file path
   * @param filePath Absolute path to the .feature file
   * @returns ParsedFeature object or null
   */
  parseFeatureFile(filePath: string): ParsedFeature | null {
    try {
      if (!fs.existsSync(filePath)) {
        console.error(`Feature file not found: ${filePath}`);
        return null;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      return this.parseFeatureFromLines(lines, filePath);
    } catch (error) {
      console.error(`Error parsing feature file ${filePath}:`, error);
      return null;
    }
  }

  /**
   * Parse a Feature from a VS Code document
   * @param document VS Code TextDocument
   * @returns ParsedFeature object or null
   */
  parseDocument(document: vscode.TextDocument): ParsedFeature | null {
    try {
      const content = document.getText();
      const lines = content.split(/\r?\n/);
      const filePath = document.uri.fsPath;

      return this.parseFeatureFromLines(lines, filePath);
    } catch (error) {
      console.error(`Error parsing document:`, error);
      return null;
    }
  }

  /**
   * Parse Feature from an array of lines
   * @param lines Array of text lines
   * @param filePath File path for reference
   * @returns ParsedFeature object or null
   */
  private parseFeatureFromLines(lines: string[], filePath: string): ParsedFeature | null {
    // Find Feature line
    let featureLineIndex = -1;
    let featureName = '';
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      if (line.startsWith('Feature:')) {
        featureLineIndex = i;
        featureName = line.substring('Feature:'.length).trim();
        break;
      }
    }

    if (featureLineIndex === -1) {
      console.error('No Feature line found in file');
      return null;
    }

    // Extract feature tags (lines before Feature:)
    const tags = this.extractFeatureTags(lines, featureLineIndex);

    // Extract feature description (lines between Feature: and first Background/Scenario)
    const description = this.extractFeatureDescription(lines, featureLineIndex);

    // Extract background
    const background = this.backgroundExtractor.extractBackgroundFromLines(lines);

    // Extract all scenarios
    const scenarios = this.scenarioExtractor.extractAllScenarios({
      getText: () => lines.join('\n'),
      uri: { fsPath: filePath }
    } as vscode.TextDocument);

    return {
      name: featureName,
      description,
      tags,
      background: background || undefined,
      scenarios,
      filePath,
      lineNumber: featureLineIndex + 1
    };
  }

  /**
   * Extract tags before the Feature line
   */
  private extractFeatureTags(lines: string[], featureLineIndex: number): string[] {
    const tags: string[] = [];

    for (let i = featureLineIndex - 1; i >= 0; i--) {
      const line = lines[i].trim();
      
      if (!line || line.startsWith('#')) {
        continue;
      }

      if (line.startsWith('@')) {
        const lineTags = line.split(/\s+/).filter(tag => tag.startsWith('@'));
        tags.unshift(...lineTags);
      } else {
        break;
      }
    }

    return tags;
  }

  /**
   * Extract Feature description
   */
  private extractFeatureDescription(lines: string[], featureLineIndex: number): string | undefined {
    const descriptionLines: string[] = [];
    
    for (let i = featureLineIndex + 1; i < lines.length; i++) {
      const line = lines[i].trim();

      // Stop at Background or Scenario
      if (
        line.startsWith('Background:') ||
        line.startsWith('Scenario:') ||
        line.startsWith('Scenario Outline:') ||
        line.startsWith('@')
      ) {
        break;
      }

      // Add non-empty, non-comment lines
      if (line && !line.startsWith('#')) {
        descriptionLines.push(line);
      }
    }

    return descriptionLines.length > 0 ? descriptionLines.join('\n') : undefined;
  }

  /**
   * Get step extractor instance (for external use)
   */
  getStepExtractor(): StepExtractor {
    return this.stepExtractor;
  }

  /**
   * Get scenario extractor instance (for external use)
   */
  getScenarioExtractor(): ScenarioExtractor {
    return this.scenarioExtractor;
  }

  /**
   * Get background extractor instance (for external use)
   */
  getBackgroundExtractor(): BackgroundExtractor {
    return this.backgroundExtractor;
  }

  /**
   * Validate a Feature file
   * @param filePath Path to the .feature file
   * @returns ParseResult with success status and error message
   */
  validateFeatureFile(filePath: string): ParseResult<ParsedFeature> {
    try {
      const feature = this.parseFeatureFile(filePath);
      
      if (!feature) {
        return {
          success: false,
          error: 'Failed to parse feature file'
        };
      }

      if (feature.scenarios.length === 0) {
        return {
          success: false,
          error: 'No scenarios found in feature file'
        };
      }

      return {
        success: true,
        data: feature
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Quick check if a file is a valid Feature file
   * @param filePath Path to check
   * @returns true if the file contains a Feature declaration
   */
  isFeatureFile(filePath: string): boolean {
    try {
      if (!fs.existsSync(filePath) || !filePath.endsWith('.feature')) {
        return false;
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      return content.includes('Feature:');
    } catch {
      return false;
    }
  }
}
