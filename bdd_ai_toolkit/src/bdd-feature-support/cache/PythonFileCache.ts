// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * PythonFileCache - Cache for Python step definition files
 */

import * as fs from 'fs';
import { StepDefinition } from '../core/matching/types';
import { StepDefinitionLoader } from '../core/matching/StepDefinitionLoader';

export interface PythonFileCacheEntry {
  filePath: string;
  mtime: number;
  definitions: StepDefinition[];
}

export class PythonFileCache {
  private cache = new Map<string, PythonFileCacheEntry>();
  private loader: StepDefinitionLoader;

  constructor(loader?: StepDefinitionLoader) {
    this.loader = loader || new StepDefinitionLoader();
  }

  /**
   * Get definitions from cache or load from file
   * @param filePath Python file path
   * @returns Step definitions
   */
  get(filePath: string): StepDefinition[] {
    const entry = this.cache.get(filePath);
    
    if (!entry) {
      return this.load(filePath);
    }

    // Check if file has been modified
    try {
      const stats = fs.statSync(filePath);
      if (stats.mtimeMs > entry.mtime) {
        // File modified, reload
        return this.load(filePath);
      }
    } catch (error) {
      // File doesn't exist, remove from cache
      this.cache.delete(filePath);
      return [];
    }

    return entry.definitions;
  }

  /**
   * Load definitions from a file and cache them
   * @param filePath Python file path
   * @returns Step definitions
   */
  load(filePath: string): StepDefinition[] {
    try {
      if (!fs.existsSync(filePath)) {
        this.cache.delete(filePath);
        return [];
      }

      const definitions = this.loader.loadFromFile(filePath);
      const stats = fs.statSync(filePath);

      this.cache.set(filePath, {
        filePath,
        mtime: stats.mtimeMs,
        definitions
      });

      return definitions;
    } catch (error) {
      console.error(`Error loading Python file ${filePath}:`, error);
      return [];
    }
  }

  /**
   * Load multiple files
   * @param filePaths Array of file paths
   * @returns All definitions
   */
  loadAll(filePaths: string[]): StepDefinition[] {
    const allDefinitions: StepDefinition[] = [];
    
    for (const filePath of filePaths) {
      const definitions = this.get(filePath);
      allDefinitions.push(...definitions);
    }

    return allDefinitions;
  }

  /**
   * Invalidate cache for a specific file
   * @param filePath Python file path
   */
  invalidate(filePath: string): void {
    this.cache.delete(filePath);
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Check if a file is cached and up-to-date
   * @param filePath Python file path
   * @returns true if cached and valid
   */
  isValid(filePath: string): boolean {
    const entry = this.cache.get(filePath);
    
    if (!entry) {
      return false;
    }

    try {
      const stats = fs.statSync(filePath);
      return stats.mtimeMs <= entry.mtime;
    } catch {
      return false;
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    size: number;
    totalDefinitions: number;
    files: string[];
  } {
    const files = Array.from(this.cache.keys());
    const totalDefinitions = Array.from(this.cache.values())
      .reduce((sum, entry) => sum + entry.definitions.length, 0);

    return {
      size: this.cache.size,
      totalDefinitions,
      files
    };
  }

  /**
   * Get all cached definitions
   */
  getAllDefinitions(): StepDefinition[] {
    const allDefinitions: StepDefinition[] = [];
    
    for (const entry of this.cache.values()) {
      allDefinitions.push(...entry.definitions);
    }

    return allDefinitions;
  }

  /**
   * Preload files into cache
   * @param filePaths Array of file paths
   */
  async preload(filePaths: string[]): Promise<void> {
    for (const filePath of filePaths) {
      this.load(filePath);
    }
  }
}
