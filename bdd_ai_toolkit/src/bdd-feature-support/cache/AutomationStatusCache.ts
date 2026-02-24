// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * AutomationStatusCache - Cache for automation status results
 */

import { AutomationStatus } from '../core/matching/types';

export interface AutomationStatusCacheEntry {
  featureFile: string;
  scenarioLine: number;
  status: AutomationStatus;
  timestamp: number;
}

export class AutomationStatusCache {
  // Key: featureFile:scenarioLine
  private cache = new Map<string, AutomationStatusCacheEntry>();
  
  private readonly maxEntries = 1000;

  /**
   * Generate cache key
   */
  private getCacheKey(featureFile: string, scenarioLine: number): string {
    return `${featureFile}:${scenarioLine}`;
  }

  /**
   * Get cached automation status
   * @param featureFile Feature file path
   * @param scenarioLine Scenario line number
   * @returns Cached status or null
   */
  get(featureFile: string, scenarioLine: number): AutomationStatus | null {
    const key = this.getCacheKey(featureFile, scenarioLine);
    const entry = this.cache.get(key);

    if (!entry) {
      return null;
    }

    // Update timestamp for LRU
    entry.timestamp = Date.now();

    return entry.status;
  }

  /**
   * Set automation status in cache
   * @param featureFile Feature file path
   * @param scenarioLine Scenario line number
   * @param status Automation status
   */
  set(featureFile: string, scenarioLine: number, status: AutomationStatus): void {
    const key = this.getCacheKey(featureFile, scenarioLine);

    // Check if we need to evict
    if (this.cache.size >= this.maxEntries && !this.cache.has(key)) {
      this.evictLRU();
    }

    this.cache.set(key, {
      featureFile,
      scenarioLine,
      status,
      timestamp: Date.now()
    });
  }

  /**
   * Invalidate cache for a specific scenario
   * @param featureFile Feature file path
   * @param scenarioLine Scenario line number
   */
  invalidate(featureFile: string, scenarioLine: number): void {
    const key = this.getCacheKey(featureFile, scenarioLine);
    this.cache.delete(key);
  }

  /**
   * Invalidate all cache entries for a feature file
   * @param featureFile Feature file path
   */
  invalidateFile(featureFile: string): void {
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.featureFile === featureFile) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }

  /**
   * Invalidate all cache entries
   */
  invalidateAll(): void {
    this.cache.clear();
  }

  /**
   * Evict least recently used entry
   */
  private evictLRU(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < oldestTime) {
        oldestTime = entry.timestamp;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  /**
   * Get cache statistics
   */
  getStatistics(): {
    size: number;
    entries: Array<{ featureFile: string; scenarioLine: number; timestamp: number }>;
  } {
    const entries = Array.from(this.cache.values()).map(entry => ({
      featureFile: entry.featureFile,
      scenarioLine: entry.scenarioLine,
      timestamp: entry.timestamp
    }));

    return {
      size: this.cache.size,
      entries
    };
  }

  /**
   * Clear old entries
   * @param maxAge Max age in milliseconds
   */
  clearOldEntries(maxAge: number): void {
    const now = Date.now();
    const threshold = now - maxAge;
    const keysToDelete: string[] = [];

    for (const [key, entry] of this.cache.entries()) {
      if (entry.timestamp < threshold) {
        keysToDelete.push(key);
      }
    }

    for (const key of keysToDelete) {
      this.cache.delete(key);
    }
  }
}
