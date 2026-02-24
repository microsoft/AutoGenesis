// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * StepMatcher - Match Feature steps with Python step definitions
 */

import { Step, StepType } from '../gherkin/types';
import { 
  StepDefinition, 
  StepImplementation, 
  StepImplementationResult,
  DecoratorType 
} from './types';
import { PatternConverter } from './PatternConverter';

export class StepMatcher {
  private patternConverter: PatternConverter;
  private stepDefinitions: StepDefinition[];

  constructor(
    stepDefinitions: StepDefinition[],
    patternConverter?: PatternConverter
  ) {
    this.stepDefinitions = stepDefinitions;
    this.patternConverter = patternConverter || new PatternConverter();
  }

  /**
   * Find all implementations for a single step
   * @param step Step to find implementations for
   * @returns Array of StepImplementation objects
   */
  findImplementations(step: Step): StepImplementation[] {
    const implementations: StepImplementation[] = [];
    const normalizedStepText = this.patternConverter.normalizeStepText(step.text);

    // Normalize step type for And/But/Star
    const effectiveStepType = this.normalizeStepType(step.type);

    for (const definition of this.stepDefinitions) {
      // Check if step type matches (or if definition is @step which matches all)
      if (!this.stepTypeMatches(effectiveStepType, definition.stepType)) {
        continue;
      }

      // Check if pattern matches
      if (this.patternConverter.matches(normalizedStepText, definition.pattern)) {
        implementations.push({
          file: definition.file,
          lineNumber: definition.lineNumber,
          pattern: definition.pattern,
          stepType: effectiveStepType,
          functionName: definition.functionName
        });
      }
    }

    return implementations;
  }

  /**
   * Match a single step and return detailed result
   * @param step Step to match
   * @returns StepImplementationResult
   */
  matchStep(step: Step): StepImplementationResult {
    const implementations = this.findImplementations(step);

    return {
      step,
      implemented: implementations.length > 0,
      implementations,
      hasMultipleImplementations: implementations.length > 1
    };
  }

  /**
   * Match multiple steps
   * @param steps Array of steps to match
   * @returns Array of StepImplementationResult objects
   */
  matchSteps(steps: Step[]): StepImplementationResult[] {
    return steps.map(step => this.matchStep(step));
  }

  /**
   * Check if a step type matches a decorator type
   */
  private stepTypeMatches(stepType: StepType, decoratorType: DecoratorType): boolean {
    // @step matches all types
    if (decoratorType === DecoratorType.Step) {
      return true;
    }

    // Direct mapping
    const typeMap: Record<StepType, DecoratorType | null> = {
      [StepType.Given]: DecoratorType.Given,
      [StepType.When]: DecoratorType.When,
      [StepType.Then]: DecoratorType.Then,
      [StepType.And]: null,  // And should have been normalized
      [StepType.But]: null,  // But should have been normalized
      [StepType.Star]: null  // Star should have been normalized
    };

    const expectedDecorator = typeMap[stepType];
    return expectedDecorator === decoratorType;
  }

  /**
   * Normalize step type (And/But/Star inherit from context)
   * This is a simple version - for full context, use StepExtractor.normalizeStepTypes
   */
  private normalizeStepType(stepType: StepType): StepType {
    // If it's And/But/Star, default to Given
    // In practice, this should be resolved by the context
    if (stepType === StepType.And || stepType === StepType.But || stepType === StepType.Star) {
      return StepType.Given;
    }
    return stepType;
  }

  /**
   * Update step definitions (for cache refresh)
   * @param newDefinitions New step definitions
   */
  updateDefinitions(newDefinitions: StepDefinition[]): void {
    this.stepDefinitions = newDefinitions;
  }

  /**
   * Add step definitions
   * @param additionalDefinitions Definitions to add
   */
  addDefinitions(additionalDefinitions: StepDefinition[]): void {
    this.stepDefinitions.push(...additionalDefinitions);
  }

  /**
   * Get all step definitions
   * @returns Array of all step definitions
   */
  getAllDefinitions(): StepDefinition[] {
    return [...this.stepDefinitions];
  }

  /**
   * Get definitions for a specific file
   * @param filePath Python file path
   * @returns Step definitions from that file
   */
  getDefinitionsForFile(filePath: string): StepDefinition[] {
    return this.stepDefinitions.filter(def => def.file === filePath);
  }

  /**
   * Remove definitions from a specific file
   * @param filePath Python file path
   */
  removeDefinitionsForFile(filePath: string): void {
    this.stepDefinitions = this.stepDefinitions.filter(def => def.file !== filePath);
  }

  /**
   * Find conflicts - steps with multiple implementations
   * @param steps Array of steps
   * @returns Steps with multiple implementations
   */
  findConflicts(steps: Step[]): StepImplementationResult[] {
    const results = this.matchSteps(steps);
    return results.filter(result => result.hasMultipleImplementations);
  }

  /**
   * Find missing implementations
   * @param steps Array of steps
   * @returns Steps without implementations
   */
  findMissing(steps: Step[]): StepImplementationResult[] {
    const results = this.matchSteps(steps);
    return results.filter(result => !result.implemented);
  }

  /**
   * Calculate implementation coverage
   * @param steps Array of steps
   * @returns Coverage statistics
   */
  calculateCoverage(steps: Step[]): {
    total: number;
    implemented: number;
    missing: number;
    conflicts: number;
    percentage: number;
  } {
    const results = this.matchSteps(steps);
    
    const total = results.length;
    const implemented = results.filter(r => r.implemented && !r.hasMultipleImplementations).length;
    const missing = results.filter(r => !r.implemented).length;
    const conflicts = results.filter(r => r.hasMultipleImplementations).length;
    const percentage = total > 0 ? (implemented / total) * 100 : 0;

    return {
      total,
      implemented,
      missing,
      conflicts,
      percentage
    };
  }

  /**
   * Get pattern converter instance
   */
  getPatternConverter(): PatternConverter {
    return this.patternConverter;
  }

  /**
   * Find duplicate patterns (same pattern in different files)
   * @returns Map of pattern to array of definitions
   */
  findDuplicatePatterns(): Map<string, StepDefinition[]> {
    const patternMap = new Map<string, StepDefinition[]>();

    for (const definition of this.stepDefinitions) {
      const normalized = definition.pattern.toLowerCase().trim();
      const existing = patternMap.get(normalized) || [];
      existing.push(definition);
      patternMap.set(normalized, existing);
    }

    // Filter to only duplicates
    const duplicates = new Map<string, StepDefinition[]>();
    for (const [pattern, definitions] of patternMap.entries()) {
      if (definitions.length > 1) {
        duplicates.set(pattern, definitions);
      }
    }

    return duplicates;
  }

  /**
   * Get usage statistics for step definitions
   * @param steps Steps to check against
   * @returns Map of definition to usage count
   */
  getUsageStatistics(steps: Step[]): Map<StepDefinition, number> {
    const usageMap = new Map<StepDefinition, number>();

    // Initialize all definitions with 0 usage
    for (const def of this.stepDefinitions) {
      usageMap.set(def, 0);
    }

    // Count usages
    for (const step of steps) {
      const implementations = this.findImplementations(step);
      for (const impl of implementations) {
        // Find the original definition
        const definition = this.stepDefinitions.find(
          d => d.file === impl.file && d.lineNumber === impl.lineNumber
        );
        if (definition) {
          usageMap.set(definition, (usageMap.get(definition) || 0) + 1);
        }
      }
    }

    return usageMap;
  }
}
