// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * StepDefinitionLoader - Load step definitions from Python files
 */

import * as fs from 'fs';
import * as path from 'path';
import { StepDefinition, DecoratorType } from './types';

export class StepDefinitionLoader {
  private static readonly DECORATOR_PATTERNS = [
    /@given\s*\(\s*["'](.+?)["']\s*\)/i,
    /@when\s*\(\s*["'](.+?)["']\s*\)/i,
    /@then\s*\(\s*["'](.+?)["']\s*\)/i,
    /@step\s*\(\s*["'](.+?)["']\s*\)/i
  ];

  private static readonly DECORATOR_TYPES: DecoratorType[] = [
    DecoratorType.Given,
    DecoratorType.When,
    DecoratorType.Then,
    DecoratorType.Step
  ];

  /**
   * Load step definitions from a single Python file
   * @param filePath Absolute path to Python file
   * @returns Array of StepDefinition objects
   */
  loadFromFile(filePath: string): StepDefinition[] {
    try {
      if (!fs.existsSync(filePath)) {
        return [];
      }

      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split(/\r?\n/);

      return this.extractStepDefinitions(lines, filePath);
    } catch (error) {
      console.error(`Error loading step definitions from ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Load step definitions from multiple Python files
   * @param filePaths Array of absolute paths to Python files
   * @returns Array of all StepDefinition objects
   */
  loadFromFiles(filePaths: string[]): StepDefinition[] {
    const allDefinitions: StepDefinition[] = [];

    for (const filePath of filePaths) {
      const definitions = this.loadFromFile(filePath);
      allDefinitions.push(...definitions);
    }

    return allDefinitions;
  }

  /**
   * Load step definitions from a directory (recursive)
   * @param dirPath Directory path
   * @param recursive Whether to search recursively
   * @returns Array of StepDefinition objects
   */
  loadFromDirectory(dirPath: string, recursive: boolean = true): StepDefinition[] {
    const definitions: StepDefinition[] = [];

    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }

      const items = fs.readdirSync(dirPath);

      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const stat = fs.statSync(itemPath);

        if (stat.isDirectory() && recursive) {
          // Skip common non-step directories
          if (!this.shouldSkipDirectory(item)) {
            const subDefinitions = this.loadFromDirectory(itemPath, recursive);
            definitions.push(...subDefinitions);
          }
        } else if (stat.isFile() && this.isPythonStepFile(item)) {
          const fileDefinitions = this.loadFromFile(itemPath);
          definitions.push(...fileDefinitions);
        }
      }
    } catch (error) {
      console.error(`Error loading from directory ${dirPath}:`, error);
    }

    return definitions;
  }

  /**
   * Extract step definitions from lines of Python code
   */
  private extractStepDefinitions(lines: string[], filePath: string): StepDefinition[] {
    const definitions: StepDefinition[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const trimmedLine = line.trim();

      // Skip commented lines
      if (trimmedLine.startsWith('#')) {
        continue;
      }

      // Try each decorator pattern
      for (let j = 0; j < StepDefinitionLoader.DECORATOR_PATTERNS.length; j++) {
        const pattern = StepDefinitionLoader.DECORATOR_PATTERNS[j];
        const match = line.match(pattern);

        if (match) {
          const stepPattern = match[1];
          const decoratorType = StepDefinitionLoader.DECORATOR_TYPES[j];

          // Extract function name (next non-empty line starting with 'def')
          const functionName = this.extractFunctionName(lines, i + 1);

          // Skip if function definition is also commented
          if (functionName === undefined || this.isFunctionCommented(lines, i + 1)) {
            break;
          }

          definitions.push({
            file: filePath,
            lineNumber: i + 1, // 1-based
            pattern: stepPattern,
            stepType: decoratorType,
            functionName,
            rawDecorator: line.trim()
          });

          break; // Found a match, no need to try other patterns
        }
      }
    }

    return definitions;
  }

  /**
   * Extract function name from lines after a decorator
   */
  private extractFunctionName(lines: string[], startIndex: number): string | undefined {
    for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
      const line = lines[i].trim();
      
      if (line.startsWith('def ')) {
        const match = line.match(/def\s+([a-zA-Z_][a-zA-Z0-9_]*)\s*\(/);
        if (match) {
          return match[1];
        }
      }

      // Stop if we hit another decorator or class
      if (line.startsWith('@') || line.startsWith('class ')) {
        break;
      }
    }

    return undefined;
  }

  /**
   * Check if function definition is commented out
   */
  private isFunctionCommented(lines: string[], startIndex: number): boolean {
    for (let i = startIndex; i < Math.min(startIndex + 5, lines.length); i++) {
      const line = lines[i].trim();
      
      // If we find a 'def' line, check if it's commented
      if (line.includes('def ')) {
        return line.startsWith('#');
      }

      // Stop if we hit another decorator or class
      if (line.startsWith('@') || line.startsWith('class ')) {
        break;
      }
    }

    return false;
  }

  /**
   * Check if a file is a Python step definition file
   */
  private isPythonStepFile(filename: string): boolean {
    return filename.endsWith('.py') && !filename.startsWith('__');
  }

  /**
   * Check if a directory should be skipped
   */
  private shouldSkipDirectory(dirname: string): boolean {
    const skipList = [
      '__pycache__',
      'node_modules',
      '.git',
      '.venv',
      'venv',
      'env',
      '.pytest_cache',
      '.mypy_cache',
      'build',
      'dist',
      '.tox'
    ];

    return skipList.includes(dirname) || dirname.startsWith('.');
  }

  /**
   * Group step definitions by file
   * @param definitions Array of step definitions
   * @returns Map of file path to definitions
   */
  groupByFile(definitions: StepDefinition[]): Map<string, StepDefinition[]> {
    const grouped = new Map<string, StepDefinition[]>();

    for (const def of definitions) {
      const existing = grouped.get(def.file) || [];
      existing.push(def);
      grouped.set(def.file, existing);
    }

    return grouped;
  }

  /**
   * Group step definitions by decorator type
   * @param definitions Array of step definitions
   * @returns Map of decorator type to definitions
   */
  groupByType(definitions: StepDefinition[]): Map<DecoratorType, StepDefinition[]> {
    const grouped = new Map<DecoratorType, StepDefinition[]>();

    for (const def of definitions) {
      const existing = grouped.get(def.stepType) || [];
      existing.push(def);
      grouped.set(def.stepType, existing);
    }

    return grouped;
  }

  /**
   * Find step definitions by pattern
   * @param definitions Array of step definitions
   * @param searchPattern Pattern to search for (partial match)
   * @returns Matching step definitions
   */
  findByPattern(definitions: StepDefinition[], searchPattern: string): StepDefinition[] {
    const lowerSearch = searchPattern.toLowerCase();
    return definitions.filter(def => 
      def.pattern.toLowerCase().includes(lowerSearch)
    );
  }

  /**
   * Get statistics about step definitions
   */
  getStatistics(definitions: StepDefinition[]): {
    total: number;
    byType: Record<DecoratorType, number>;
    fileCount: number;
  } {
    const byType = definitions.reduce((acc, def) => {
      acc[def.stepType] = (acc[def.stepType] || 0) + 1;
      return acc;
    }, {} as Record<DecoratorType, number>);

    const uniqueFiles = new Set(definitions.map(d => d.file));

    return {
      total: definitions.length,
      byType,
      fileCount: uniqueFiles.size
    };
  }
}
