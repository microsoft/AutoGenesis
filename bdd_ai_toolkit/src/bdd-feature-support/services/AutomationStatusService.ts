// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * AutomationStatusService - Service for checking automation status of scenarios
 */

import * as vscode from 'vscode';
import { FeatureParser } from '../core/gherkin/FeatureParser';
import { StepMatcher } from '../core/matching/StepMatcher';
import { AutomationStatus, StepImplementationResult } from '../core/matching/types';
import { Step } from '../core/gherkin/types';

export class AutomationStatusService {
  private featureParser: FeatureParser;
  private stepMatcher: StepMatcher;

  constructor(featureParser: FeatureParser, stepMatcher: StepMatcher) {
    this.featureParser = featureParser;
    this.stepMatcher = stepMatcher;
  }

  /**
   * Get automation status for a scenario at a specific line
   * @param document VS Code document
   * @param lineNumber Line number (1-based)
   * @returns AutomationStatus or null
   */
  async getScenarioStatus(
    document: vscode.TextDocument,
    lineNumber: number
  ): Promise<AutomationStatus | null> {
    try {
      const scenario = this.featureParser
        .getScenarioExtractor()
        .extractScenario(document, lineNumber);

      if (!scenario) {
        return null;
      }

      // Normalize step types for And/But/Star
      const normalizedSteps = this.featureParser
        .getStepExtractor()
        .normalizeStepTypes(scenario.steps);

      // Match steps
      const stepResults = this.stepMatcher.matchSteps(normalizedSteps);

      return this.buildAutomationStatus(stepResults);
    } catch (error) {
      console.error('Error getting scenario status:', error);
      return null;
    }
  }

  /**
   * Get automation status for background
   * @param document VS Code document
   * @returns AutomationStatus or null
   */
  async getBackgroundStatus(
    document: vscode.TextDocument
  ): Promise<AutomationStatus | null> {
    try {
      const background = this.featureParser
        .getBackgroundExtractor()
        .extractBackground(document);

      if (!background) {
        return null;
      }

      // Normalize step types
      const normalizedSteps = this.featureParser
        .getStepExtractor()
        .normalizeStepTypes(background.steps);

      // Match steps
      const stepResults = this.stepMatcher.matchSteps(normalizedSteps);

      return this.buildAutomationStatus(stepResults);
    } catch (error) {
      console.error('Error getting background status:', error);
      return null;
    }
  }

  /**
   * Get automation status for an entire feature file
   * @param document VS Code document
   * @returns AutomationStatus or null
   */
  async getFeatureStatus(
    document: vscode.TextDocument
  ): Promise<AutomationStatus | null> {
    try {
      const feature = this.featureParser.parseDocument(document);

      if (!feature) {
        return null;
      }

      // Collect all steps from all scenarios and background
      const allSteps: Step[] = [];

      if (feature.background) {
        allSteps.push(...feature.background.steps);
      }

      for (const scenario of feature.scenarios) {
        allSteps.push(...scenario.steps);
      }

      // Normalize and match
      const normalizedSteps = this.featureParser
        .getStepExtractor()
        .normalizeStepTypes(allSteps);

      const stepResults = this.stepMatcher.matchSteps(normalizedSteps);

      return this.buildAutomationStatus(stepResults);
    } catch (error) {
      console.error('Error getting feature status:', error);
      return null;
    }
  }

  /**
   * Build AutomationStatus from step results
   */
  private buildAutomationStatus(stepResults: StepImplementationResult[]): AutomationStatus {
    const implementedSteps = stepResults.filter(r => r.implemented && !r.hasMultipleImplementations);
    const missingSteps = stepResults.filter(r => !r.implemented).map(r => r.step);
    const conflictSteps = stepResults.filter(r => r.hasMultipleImplementations).map(r => r.step);

    const totalSteps = stepResults.length;
    const implementedCount = implementedSteps.length;

    return {
      isFullyAutomated: totalSteps > 0 && missingSteps.length === 0 && conflictSteps.length === 0,
      totalSteps,
      implementedSteps: implementedCount,
      missingSteps,
      conflictSteps,
      stepResults
    };
  }

  /**
   * Check if step results indicate full automation
   * @param results Step implementation results
   * @returns true if fully automated
   */
  isFullyAutomated(results: StepImplementationResult[]): boolean {
    if (results.length === 0) {
      return false;
    }

    return results.every(r => r.implemented && !r.hasMultipleImplementations);
  }

  /**
   * Get summary text for automation status
   * @param status AutomationStatus
   * @returns Human-readable summary
   */
  getStatusSummary(status: AutomationStatus): string {
    if (status.isFullyAutomated) {
      return `✓ Fully Automated (${status.implementedSteps}/${status.totalSteps} steps)`;
    }

    const parts: string[] = [];

    if (status.missingSteps.length > 0) {
      parts.push(`${status.missingSteps.length} missing`);
    }

    if (status.conflictSteps.length > 0) {
      parts.push(`${status.conflictSteps.length} conflicts`);
    }

    return `⚠ Partially Automated (${status.implementedSteps}/${status.totalSteps} steps, ${parts.join(', ')})`;
  }

  /**
   * Update step matcher (e.g., after cache refresh)
   * @param newMatcher New StepMatcher instance
   */
  updateStepMatcher(newMatcher: StepMatcher): void {
    this.stepMatcher = newMatcher;
  }

  /**
   * Get the current step matcher
   */
  getStepMatcher(): StepMatcher {
    return this.stepMatcher;
  }

  /**
   * Get the feature parser
   */
  getFeatureParser(): FeatureParser {
    return this.featureParser;
  }
}
