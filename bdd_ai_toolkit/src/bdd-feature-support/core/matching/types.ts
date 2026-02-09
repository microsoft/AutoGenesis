/**
 * Unified Step matching type definitions
 * This file contains all data models for Step implementation matching
 */

import { Step, StepType } from '../gherkin/types';

/**
 * Python step decorator type
 */
export enum DecoratorType {
  Given = 'given',
  When = 'when',
  Then = 'then',
  Step = 'step'
}

/**
 * Step definition from Python file
 */
export interface StepDefinition {
  /** Python file path */
  file: string;
  
  /** Line number in Python file (1-based) */
  lineNumber: number;
  
  /** Regex pattern or string pattern */
  pattern: string;
  
  /** Step type (Given/When/Then/Step) */
  stepType: DecoratorType;
  
  /** Function name */
  functionName?: string;
  
  /** Raw decorator line */
  rawDecorator?: string;
}

/**
 * Single step implementation location
 */
export interface StepImplementation {
  /** Python file path */
  file: string;
  
  /** Line number in Python file (1-based) */
  lineNumber: number;
  
  /** Matched pattern */
  pattern: string;
  
  /** Step type */
  stepType: StepType;
  
  /** Function name (optional) */
  functionName?: string;
}

/**
 * Result of step implementation check
 */
export interface StepImplementationResult {
  /** The step being checked */
  step: Step;
  
  /** Whether the step is implemented */
  implemented: boolean;
  
  /** All matching implementations */
  implementations: StepImplementation[];
  
  /** Whether there are multiple implementations (conflict) */
  hasMultipleImplementations: boolean;
  
  /** Error message if any */
  error?: string;
}

/**
 * Automation status for a scenario or background
 */
export interface AutomationStatus {
  /** Whether all steps are implemented */
  isFullyAutomated: boolean;
  
  /** Total number of steps */
  totalSteps: number;
  
  /** Number of implemented steps */
  implementedSteps: number;
  
  /** Steps without implementation */
  missingSteps: Step[];
  
  /** Steps with multiple implementations */
  conflictSteps: Step[];
  
  /** Detailed results for each step */
  stepResults: StepImplementationResult[];
}

/**
 * Pattern matching result
 */
export interface PatternMatchResult {
  /** Whether the pattern matches */
  matches: boolean;
  
  /** Captured parameters */
  parameters?: string[];
  
  /** Error message if matching failed */
  error?: string;
}

/**
 * Step definition cache entry
 */
export interface StepDefinitionCacheEntry {
  /** Python file path */
  filePath: string;
  
  /** File modification time */
  mtime: number;
  
  /** Step definitions in this file */
  definitions: StepDefinition[];
}

/**
 * Step match cache entry
 */
export interface StepMatchCacheEntry {
  /** Step text */
  stepText: string;
  
  /** Step type */
  stepType: StepType;
  
  /** Matching implementations */
  implementations: StepImplementation[];
  
  /** Cache timestamp */
  timestamp: number;
}
