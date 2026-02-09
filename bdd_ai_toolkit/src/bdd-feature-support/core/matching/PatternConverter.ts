/**
 * PatternConverter - Convert Behave patterns to JavaScript regex
 */

import { PatternMatchResult } from './types';

export class PatternConverter {
  /**
   * Convert Behave/Cucumber pattern to JavaScript RegExp
   * Supports:
   * - {param} - Behave style
   * - <param> - Cucumber style
   * - "{param}" - Quoted parameters
   * - :param - Cucumber style
   * 
   * @param behavePattern Original Behave pattern
   * @returns JavaScript RegExp
   */
  convertBehaveToJs(behavePattern: string): RegExp {
    let jsPattern = behavePattern;

    // Escape special regex characters except those used in patterns
    jsPattern = jsPattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    // Convert Behave placeholders
    // {param} or {param:type} -> (.+?)
    jsPattern = jsPattern.replace(/\\{[^}]+\\}/g, '(.+?)');

    // Convert Cucumber placeholders
    // <param> -> (.+?)
    jsPattern = jsPattern.replace(/\\<[^>]+\\>/g, '(.+?)');

    // Convert quoted parameter placeholders
    // "{param}" -> "([^"]*)"
    jsPattern = jsPattern.replace(/\\"\\{[^}]+\\}\\"/g, '"([^"]*)"');
    jsPattern = jsPattern.replace(/\\"\\<[^>]+\\>\\"/g, '"([^"]*)"');

    // Convert :param style
    jsPattern = jsPattern.replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, '(.+?)');

    // Handle optional spaces around parameters
    jsPattern = jsPattern.replace(/\\s+/g, '\\s+');

    // Add anchors for exact matching
    jsPattern = `^${jsPattern}$`;

    try {
      return new RegExp(jsPattern, 'i'); // Case insensitive
    } catch (error) {
      console.error(`Failed to convert pattern: ${behavePattern}`, error);
      // Fallback to exact match
      return new RegExp(`^${behavePattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i');
    }
  }

  /**
   * Test if a step text matches a pattern
   * @param stepText Step text to test
   * @param pattern Pattern (string or RegExp)
   * @returns true if matches
   */
  matches(stepText: string, pattern: string | RegExp): boolean {
    try {
      const regex = typeof pattern === 'string' 
        ? this.convertBehaveToJs(pattern)
        : pattern;
      
      return regex.test(stepText);
    } catch (error) {
      console.error(`Error matching pattern:`, error);
      return false;
    }
  }

  /**
   * Match a step text against a pattern and extract parameters
   * @param stepText Step text
   * @param pattern Pattern to match
   * @returns PatternMatchResult with match status and captured parameters
   */
  matchWithParameters(stepText: string, pattern: string | RegExp): PatternMatchResult {
    try {
      const regex = typeof pattern === 'string'
        ? this.convertBehaveToJs(pattern)
        : pattern;

      const match = stepText.match(regex);

      if (!match) {
        return { matches: false };
      }

      // Extract captured groups (excluding the full match at index 0)
      const parameters = match.slice(1);

      return {
        matches: true,
        parameters
      };
    } catch (error) {
      return {
        matches: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  /**
   * Check if a pattern is a regex pattern (contains regex special chars)
   * @param pattern Pattern string
   * @returns true if it looks like a regex
   */
  isRegexPattern(pattern: string): boolean {
    const regexIndicators = ['{', '<', '(', '[', '*', '+', '?', '^', '$', '\\', '|'];
    return regexIndicators.some(indicator => pattern.includes(indicator));
  }

  /**
   * Normalize a step text for matching
   * - Trim whitespace
   * - Normalize multiple spaces to single space
   * @param text Step text
   * @returns Normalized text
   */
  normalizeStepText(text: string): string {
    return text.trim().replace(/\s+/g, ' ');
  }

  /**
   * Extract parameter placeholders from a pattern
   * @param pattern Behave pattern
   * @returns Array of parameter names
   */
  extractParameterNames(pattern: string): string[] {
    const parameters: string[] = [];
    
    // Extract {param} style
    const behaveMatches = pattern.matchAll(/\{([^}:]+)(?::[^}]*)?\}/g);
    for (const match of behaveMatches) {
      parameters.push(match[1]);
    }

    // Extract <param> style
    const cucumberMatches = pattern.matchAll(/<([^>]+)>/g);
    for (const match of cucumberMatches) {
      parameters.push(match[1]);
    }

    // Extract :param style
    const colonMatches = pattern.matchAll(/:([a-zA-Z_][a-zA-Z0-9_]*)/g);
    for (const match of colonMatches) {
      parameters.push(match[1]);
    }

    return parameters;
  }

  /**
   * Test multiple patterns against a step text
   * @param stepText Step text
   * @param patterns Array of patterns
   * @returns Array of indices of matching patterns
   */
  matchMultiple(stepText: string, patterns: (string | RegExp)[]): number[] {
    const matchingIndices: number[] = [];

    for (let i = 0; i < patterns.length; i++) {
      if (this.matches(stepText, patterns[i])) {
        matchingIndices.push(i);
      }
    }

    return matchingIndices;
  }

  /**
   * Compare two patterns for similarity (useful for detecting conflicts)
   * @param pattern1 First pattern
   * @param pattern2 Second pattern
   * @returns Similarity score (0-1)
   */
  calculatePatternSimilarity(pattern1: string, pattern2: string): number {
    // Simple Levenshtein-based similarity
    // Replace parameters with placeholders for comparison
    const normalize = (p: string) => {
      return p
        .replace(/\{[^}]+\}/g, 'PARAM')
        .replace(/<[^>]+>/g, 'PARAM')
        .replace(/:[a-zA-Z_][a-zA-Z0-9_]*/g, 'PARAM')
        .toLowerCase()
        .trim();
    };

    const norm1 = normalize(pattern1);
    const norm2 = normalize(pattern2);

    if (norm1 === norm2) {
      return 1.0;
    }

    // Simple character-based similarity
    const maxLen = Math.max(norm1.length, norm2.length);
    if (maxLen === 0) {
      return 1.0;
    }

    let matches = 0;
    const minLen = Math.min(norm1.length, norm2.length);
    for (let i = 0; i < minLen; i++) {
      if (norm1[i] === norm2[i]) {
        matches++;
      }
    }

    return matches / maxLen;
  }
}
