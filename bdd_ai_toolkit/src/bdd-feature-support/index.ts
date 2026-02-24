// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * Feature Enhancement Module - Main exports
 * 
 * This module provides unified BDD feature file support with:
 * - Gherkin parsing (Feature, Scenario, Background, Steps)
 * - Step definition matching
 * - Automation status tracking
 * - CodeLens and decorations
 * - Copilot integration
 */

// Module exports
export * from './core';
export * from './services';
export { 
  PythonFileCache, 
  StepMatchCache, 
  UnifiedCacheManager 
} from './cache';
export * from './providers';
export * from './utils';

// Re-export the main activation function as a named export
export {
  activate as activateBddFeatureSupport,
  deactivate as deactivateBddFeatureSupport,
} from "./extension";
