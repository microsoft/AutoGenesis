/**
 * PathResolver - Utility for resolving paths
 */

import * as path from 'path';
import * as fs from 'fs';

export class PathResolver {
  /**
   * Find profiles directory path
   * Traverses up two levels from feature file
   * @param featureFilePath Feature file path
   * @returns Profiles path or null
   */
  public findProfilesPath(featureFilePath: string): string | null {
    try {
      let currentDir = path.dirname(featureFilePath);

      // Traverse up two levels
      for (let i = 0; i < 2; i++) {
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          // Reached root directory
          break;
        }
        currentDir = parentDir;
      }

      // Look for profiles directory in the current level
      const profilesPath = path.join(currentDir, 'profiles');
      if (fs.existsSync(profilesPath) && fs.statSync(profilesPath).isDirectory()) {
        return profilesPath;
      }

      return null;
    } catch (error) {
      console.error('Error finding profiles path:', error);
      return null;
    }
  }

  /**
   * Find related feature files for a Python file
   * @param pythonFilePath Python file path
   * @returns Array of related feature file paths
   */
  public findRelatedFeatureFiles(pythonFilePath: string): string[] {
    try {
      const relatedFiles: string[] = [];
      const dir = path.dirname(pythonFilePath);

      // Look for .feature files in the same directory and parent directories
      const searchDirs = [
        dir,
        path.dirname(dir),
        path.join(path.dirname(dir), 'features'),
        path.join(path.dirname(path.dirname(dir)), 'features')
      ];

      for (const searchDir of searchDirs) {
        if (fs.existsSync(searchDir)) {
          const files = this.findFeatureFilesInDirectory(searchDir);
          relatedFiles.push(...files);
        }
      }

      // Remove duplicates
      return [...new Set(relatedFiles)];
    } catch (error) {
      console.error('Error finding related feature files:', error);
      return [];
    }
  }

  /**
   * Find all .feature files in a directory (non-recursive)
   */
  private findFeatureFilesInDirectory(dirPath: string): string[] {
    try {
      const files = fs.readdirSync(dirPath);
      return files
        .filter(file => file.endsWith('.feature'))
        .map(file => path.join(dirPath, file));
    } catch {
      return [];
    }
  }

  /**
   * Get workspace folder path from a file path
   * @param filePath File path
   * @returns Workspace folder path or null
   */
  public getWorkspaceFolderPath(filePath: string): string | null {
    try {
      let currentDir = path.dirname(filePath);
      const maxDepth = 10;
      let depth = 0;

      // Look for common workspace indicators
      while (depth < maxDepth) {
        // Check for .git directory
        if (fs.existsSync(path.join(currentDir, '.git'))) {
          return currentDir;
        }

        // Check for package.json
        if (fs.existsSync(path.join(currentDir, 'package.json'))) {
          return currentDir;
        }

        // Check for pyproject.toml
        if (fs.existsSync(path.join(currentDir, 'pyproject.toml'))) {
          return currentDir;
        }

        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          // Reached root
          break;
        }

        currentDir = parentDir;
        depth++;
      }

      return null;
    } catch (error) {
      console.error('Error getting workspace folder:', error);
      return null;
    }
  }

  /**
   * Normalize path separators to forward slashes
   */
  public normalizePath(filePath: string): string {
    return filePath.replace(/\\/g, '/');
  }

  /**
   * Get relative path from base to target
   */
  public getRelativePath(from: string, to: string): string {
    return path.relative(from, to);
  }

  /**
   * Check if a path is a subdirectory of another path
   */
  public isSubdirectory(parent: string, child: string): boolean {
    const relative = path.relative(parent, child);
    return !relative.startsWith('..') && !path.isAbsolute(relative);
  }

  /**
   * Get suitable search directories based on feature file location
   * @param featurePath Full path of the feature file
   * @returns List of directories where step implementations should be searched
   */
  public getSearchDirectories(featurePath: string): string[] {
    const featureDir = path.dirname(featurePath);
    const searchDirs: string[] = [];

    // 1. Add feature file current directory (for steps/ subdirectory)
    searchDirs.push(featureDir);

    // 2. Add parent directory (for steps/ subdirectory at parent level)
    const parentDir = path.dirname(featureDir);
    searchDirs.push(parentDir);

    // 3. Add grandparent directory (for steps/ subdirectory at grandparent level)
    const grandParentDir = path.dirname(parentDir);
    searchDirs.push(grandParentDir);

    return searchDirs;
  }

  /**
   * Find all Python implementation files in 'steps' directories
   * @param workspaceRoot Workspace root path (required)
   * @param featurePath Optional path of the feature file (for scoped search)
   * @returns List of all Python implementation file paths found in 'steps' directories
   */
  public findImplementationFiles(workspaceRoot: string, featurePath?: string): string[] {
    let searchDirs: string[] = [];
    
    // If featurePath is provided, search from feature file location
    if (featurePath && featurePath.trim() !== "") {
      searchDirs = this.getSearchDirectories(featurePath);
    } else {
      // Search from workspace root
      searchDirs = [workspaceRoot];
    }
    
    const implementationFiles: string[] = [];
    const visitedDirs = new Set<string>();

    // Recursively find all 'steps' directories and Python files within them
    const findStepsDirectories = (dir: string, depth: number = 0) => {
      // Stop if max depth reached or directory already visited
      if (depth > 5 || visitedDirs.has(dir)) {
        return;
      }
      visitedDirs.add(dir);

      try {
        if (!fs.existsSync(dir)) {
          return;
        }
        
        const files = fs.readdirSync(dir);

        for (const file of files) {
          // Skip hidden files
          if (file.startsWith('.')) {
            continue;
          }

          const fullPath = path.join(dir, file);
          
          try {
            const stats = fs.statSync(fullPath);

            if (stats.isDirectory()) {
              // Skip common system/build/cache directories
              const skipDirs = [
                'node_modules', '__pycache__', '.pytest_cache', '.git', '.svn', '.hg',
                '.venv', 'venv', 'env', 'dist', 'build', 'target', 'out',
                '.idea', '.vscode', 'coverage', 'htmlcov', '.tox', '.eggs',
                '.mypy_cache', '.ruff_cache'
              ];
              
              if (skipDirs.includes(file)) {
                continue;
              }

              // If this is a 'steps' directory, find all Python files in it
              if (file === 'steps') {
                this.findPythonFilesInDirectory(fullPath, implementationFiles);
              } else {
                // Continue searching subdirectories
                findStepsDirectories(fullPath, depth + 1);
              }
            }
          } catch (fileError) {
            // Skip files that can't be accessed
            continue;
          }
        }
      } catch (error) {
        console.error(`Error searching directory (${dir}): ${error}`);
      }
    };

    // Start searching from each search directory
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        findStepsDirectories(dir);
      }
    }
    
    if (implementationFiles.length === 0) {
      console.warn(`⚠️ No Python step files found in 'steps' directories`);
    }

    return implementationFiles;
  }

  /**
   * Find all Python files in a directory (recursive)
   */
  private findPythonFilesInDirectory(dir: string, results: string[]): void {
    try {
      const files = fs.readdirSync(dir);
      
      for (const file of files) {
        if (file.startsWith('.')) {
          continue;
        }
        
        const fullPath = path.join(dir, file);
        
        try {
          const stats = fs.statSync(fullPath);
          
          if (stats.isFile() && file.endsWith('.py')) {
            results.push(fullPath);
          } else if (stats.isDirectory()) {
            // Recursively search subdirectories within steps folder
            this.findPythonFilesInDirectory(fullPath, results);
          }
        } catch (error) {
          continue;
        }
      }
    } catch (error) {
      console.error(`Error reading directory ${dir}: ${error}`);
    }
  }
}
