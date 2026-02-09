/**
 * DryRunService - Simplified dry run service
 */

import * as fs from 'fs';
import { FeatureParser } from '../core/gherkin/FeatureParser';
import { StepMatcher } from '../core/matching/StepMatcher';
import { AutomationStatus } from '../core/matching/types';
import { ParsedFeature } from '../core/gherkin/types';

export interface DryRunResult {
  feature: ParsedFeature;
  automationStatus: AutomationStatus;
  success: boolean;
  error?: string;
}

export class DryRunService {
  private featureParser: FeatureParser;
  private stepMatcher: StepMatcher;

  constructor(featureParser: FeatureParser, stepMatcher: StepMatcher) {
    this.featureParser = featureParser;
    this.stepMatcher = stepMatcher;
  }

  /**
   * Execute dry run on a feature file
   * @param featureFilePath Absolute path to .feature file
   * @returns DryRunResult or null
   */
  async dryRun(featureFilePath: string): Promise<DryRunResult | null> {
    try {
      // Check if file exists
      if (!fs.existsSync(featureFilePath)) {
        return {
          feature: null as any,
          automationStatus: null as any,
          success: false,
          error: `Feature file not found: ${featureFilePath}`
        };
      }

      // Parse feature file
      const feature = this.featureParser.parseFeatureFile(featureFilePath);

      if (!feature) {
        return {
          feature: null as any,
          automationStatus: null as any,
          success: false,
          error: 'Failed to parse feature file'
        };
      }

      // Collect all steps
      const allSteps = this.collectAllSteps(feature);

      // Normalize step types
      const normalizedSteps = this.featureParser
        .getStepExtractor()
        .normalizeStepTypes(allSteps);

      // Match steps
      const stepResults = this.stepMatcher.matchSteps(normalizedSteps);

      // Build automation status
      const automationStatus: AutomationStatus = {
        isFullyAutomated: stepResults.every(r => r.implemented && !r.hasMultipleImplementations),
        totalSteps: stepResults.length,
        implementedSteps: stepResults.filter(r => r.implemented && !r.hasMultipleImplementations).length,
        missingSteps: stepResults.filter(r => !r.implemented).map(r => r.step),
        conflictSteps: stepResults.filter(r => r.hasMultipleImplementations).map(r => r.step),
        stepResults
      };

      return {
        feature,
        automationStatus,
        success: true
      };
    } catch (error) {
      console.error('Error during dry run:', error);
      return {
        feature: null as any,
        automationStatus: null as any,
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Collect all steps from a feature (background + all scenarios)
   */
  private collectAllSteps(feature: ParsedFeature) {
    const steps = [];

    if (feature.background) {
      steps.push(...feature.background.steps);
    }

    for (const scenario of feature.scenarios) {
      steps.push(...scenario.steps);
    }

    return steps;
  }

  /**
   * Generate dry run report text
   * @param result Dry run result
   * @returns Formatted report text
   */
  generateReport(result: DryRunResult): string {
    if (!result.success) {
      return `Dry Run Failed: ${result.error}`;
    }

    const { feature, automationStatus } = result;
    const lines: string[] = [];

    lines.push(`Feature: ${feature.name}`);
    lines.push(`File: ${feature.filePath}`);
    lines.push('');
    lines.push('Automation Status:');
    lines.push(`  Total Steps: ${automationStatus.totalSteps}`);
    lines.push(`  Implemented: ${automationStatus.implementedSteps}`);
    lines.push(`  Missing: ${automationStatus.missingSteps.length}`);
    lines.push(`  Conflicts: ${automationStatus.conflictSteps.length}`);
    lines.push(`  Status: ${automationStatus.isFullyAutomated ? '✓ Fully Automated' : '⚠ Partially Automated'}`);

    if (automationStatus.missingSteps.length > 0) {
      lines.push('');
      lines.push('Missing Steps:');
      for (const step of automationStatus.missingSteps) {
        lines.push(`  - ${step.type} ${step.text}`);
      }
    }

    if (automationStatus.conflictSteps.length > 0) {
      lines.push('');
      lines.push('Conflict Steps (Multiple Implementations):');
      for (const step of automationStatus.conflictSteps) {
        lines.push(`  - ${step.type} ${step.text}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Update step matcher
   * @param newMatcher New StepMatcher instance
   */
  updateStepMatcher(newMatcher: StepMatcher): void {
    this.stepMatcher = newMatcher;
  }

  /**
   * Get step matcher
   */
  getStepMatcher(): StepMatcher {
    return this.stepMatcher;
  }

  /**
   * Get feature parser
   */
  getFeatureParser(): FeatureParser {
    return this.featureParser;
  }
}
