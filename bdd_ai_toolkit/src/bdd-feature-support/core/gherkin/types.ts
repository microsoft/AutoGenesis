/**
 * Unified Gherkin type definitions
 * This file contains all core data models for Feature file parsing
 */

/**
 * Step type enumeration
 */
export enum StepType {
  Given = 'Given',
  When = 'When',
  Then = 'Then',
  And = 'And',
  But = 'But',
  Star = '*'
}

/**
 * Unified Step definition
 */
export interface Step {
  /** Step type (Given/When/Then/And/But/*) */
  type: StepType;
  
  /** Step text without type keyword */
  text: string;
  
  /** Original text including type keyword (optional) */
  rawText?: string;
  
  /** Line number in the Feature file (1-based) */
  lineNumber?: number;
  
  /** Data table rows (optional) */
  dataTable?: string[][];
  
  /** Doc string content (optional) */
  docString?: string;
}

/**
 * Unified Scenario definition
 */
export interface Scenario {
  /** Scenario name */
  name: string;
  
  /** Tags (e.g., @smoke, @regression) */
  tags: string[];
  
  /** Steps in this scenario */
  steps: Step[];
  
  /** Starting line number (1-based) */
  lineNumber: number;
  
  /** Line range start (1-based) */
  lineStart: number;
  
  /** Line range end (1-based) */
  lineEnd: number;
  
  /** Scenario description (optional) */
  description?: string;
}

/**
 * Unified Background definition
 */
export interface Background {
  /** Steps in background */
  steps: Step[];
  
  /** Starting line number (1-based) */
  lineNumber: number;
  
  /** Line range start (1-based) */
  lineStart: number;
  
  /** Line range end (1-based) */
  lineEnd: number;
  
  /** Background description (optional) */
  description?: string;
}

/**
 * Unified Feature definition
 */
export interface ParsedFeature {
  /** Feature name */
  name: string;
  
  /** Feature description (optional) */
  description?: string;
  
  /** Feature tags */
  tags: string[];
  
  /** Background (optional) */
  background?: Background;
  
  /** Scenarios in this feature */
  scenarios: Scenario[];
  
  /** Feature file path */
  filePath: string;
  
  /** Starting line number (1-based) */
  lineNumber: number;
}

/**
 * Parse result for error handling
 */
export interface ParseResult<T> {
  /** Parsed data */
  data?: T;
  
  /** Error message if parsing failed */
  error?: string;
  
  /** Whether parsing was successful */
  success: boolean;
}
