/**
 * StepMatchCache - Cache for step matching results
 */

import { Step } from '../core/gherkin/types';
import { StepImplementationResult } from '../core/matching/types';

export interface StepMatchCacheEntry {
  step: Step;
  result: StepImplementationResult;
  timestamp: number;
}

export class StepMatchCache {
  // Feature file -> Step text -> Match result
  private cache = new Map<string, Map<string, StepMatchCacheEntry>>();
  
  private readonly maxEntriesPerFile = 500;
  private readonly maxTotalEntries = 5000;

  /**
   * Get cached match result for a step
   * @param featureFile Feature file path
   * @param stepText Step text
   * @returns Cached result or null
   */
  get(featureFile: string, stepText: string): StepImplementationResult | null {
    const fileCache = this.cache.get(featureFile);
    
    if (!fileCache) {
      return null;
    }

    const entry = fileCache.get(stepText);
    
    if (!entry) {
      return null;
    }

    // Update access time for LRU
    entry.timestamp = Date.now();
    
    return entry.result;
  }

  /**
   * Set match result for a step
   * @param featureFile Feature file path
   * @param stepText Step text
   * @param result Match result
   */
  set(featureFile: string, stepText: string, result: StepImplementationResult): void {
    let fileCache = this.cache.get(featureFile);
    
    if (!fileCache) {
      fileCache = new Map();
      this.cache.set(featureFile, fileCache);
    }

    // Check if we need to evict entries
    if (fileCache.size >= this.maxEntriesPerFile) {
      this.evictLRU(fileCache);
    }

    fileCache.set(stepText, {
      step: result.step,
      result,
      timestamp: Date.now()
    });

    // Check total cache size
    if (this.getTotalSize() > this.maxTotalEntries) {
      this.evictOldestFile();
    }
  }

  /**
   * Get all cached results for a feature file
   * @param featureFile Feature file path
   * @returns Array of cached results
   */
  getAllForFile(featureFile: string): StepImplementationResult[] {
    const fileCache = this.cache.get(featureFile);
    
    if (!fileCache) {
      return [];
    }

    return Array.from(fileCache.values()).map(entry => entry.result);
  }

  /**
   * Invalidate cache for a specific feature file
   * @param featureFile Feature file path
   */
  invalidateFile(featureFile: string): void {
    this.cache.delete(featureFile);
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Evict least recently used entry from a file cache
   */
  private evictLRU(fileCache: Map<string, StepMatchCacheEntry>): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of fileCache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      fileCache.delete(oldestKey);
    }
  }

  /**
   * Evict oldest file from cache
   */
  private evictOldestFile(): void {
    let oldestFile: string | null = null;
    let oldestTime = Infinity;

    for (const [filePath, fileCache] of this.cache.entries()) {
      for (const entry of fileCache.values()) {
        if (entry.timestamp < oldestTime) {
          oldestTime = entry.timestamp;
          oldestFile = filePath;
        }
      }
    }

    if (oldestFile) {
      this.cache.delete(oldestFile);
    }
  }

  /**
   * Get total number of cached entries
   */
  private getTotalSize(): number {
    let total = 0;
    for (const fileCache of this.cache.values()) {
      total += fileCache.size;
    }
    return total;
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    filesCount: number;
    totalEntries: number;
    entriesPerFile: Record<string, number>;
  } {
    const entriesPerFile: Record<string, number> = {};
    let totalEntries = 0;

    for (const [filePath, fileCache] of this.cache.entries()) {
      entriesPerFile[filePath] = fileCache.size;
      totalEntries += fileCache.size;
    }

    return {
      filesCount: this.cache.size,
      totalEntries,
      entriesPerFile
    };
  }

  /**
   * Clear old entries (older than specified time)
   * @param maxAge Max age in milliseconds
   */
  clearOldEntries(maxAge: number): void {
    const now = Date.now();
    const threshold = now - maxAge;

    for (const [filePath, fileCache] of this.cache.entries()) {
      const keysToDelete: string[] = [];

      for (const [key, entry] of fileCache.entries()) {
        if (entry.timestamp < threshold) {
          keysToDelete.push(key);
        }
      }

      for (const key of keysToDelete) {
        fileCache.delete(key);
      }

      // Remove empty file caches
      if (fileCache.size === 0) {
        this.cache.delete(filePath);
      }
    }
  }
}
