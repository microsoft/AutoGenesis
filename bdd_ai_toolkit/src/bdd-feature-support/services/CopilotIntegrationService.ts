// Copyright (c) Microsoft Corporation.
// Licensed under the MIT license.

/**
 * CopilotIntegrationService - Service for integrating with GitHub Copilot
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import { Scenario, Background } from '../core/gherkin/types';
import { ConfigManager } from '../utils/ConfigManager';

export class CopilotIntegrationService {
  private configManager: ConfigManager;

  constructor() {
    this.configManager = ConfigManager.getInstance();
  }

  /**
   * Generate text for a scenario to send to Copilot
   * @param scenario Scenario object
   * @param featureFilePath Optional feature file path for context
   * @param includeBackground Optional background to include
   * @returns Generated text
   */
  async generateScenarioText(
    scenario: Scenario,
    featureFilePath?: string,
    includeBackground?: Background
  ): Promise<string> {
    let fullText = "";

    // Build scenario header
    fullText += `Scenario: ${scenario.name}\n`;

    // Include background steps if provided (without Background: header)
    if (includeBackground && includeBackground.steps.length > 0) {
      for (const step of includeBackground.steps) {
        fullText += `  ${step.type} ${step.text}\n`;
      }
    }

    // Add all scenario steps
    for (const step of scenario.steps) {
      fullText += `  ${step.type} ${step.text}\n`;
    }

    // Apply custom prompt with placeholders
    return this.applyCustomPrompt(fullText.trim(), featureFilePath);
  }

  /**
   * Generate text for background to send to Copilot
   * @param background Background object
   * @param featureFilePath Optional feature file path for context
   * @returns Generated text
   */
  async generateBackgroundText(
    background: Background,
    featureFilePath?: string
  ): Promise<string> {
    let fullText = "Background:\n";

    // Add all background steps
    for (const step of background.steps) {
      fullText += `  ${step.type} ${step.text}\n`;
    }

    // Apply custom prompt with placeholders
    return this.applyCustomPrompt(fullText.trim(), featureFilePath);
  }

  /**
   * Apply custom prompt with placeholder replacement
   * @param scenarioText Scenario or background text
   * @param featureFilePath Optional feature file path
   * @returns Text with custom prompt applied
   */
  private applyCustomPrompt(scenarioText: string, featureFilePath?: string): string {
    // Get custom prompt from config
    let customPrompt = this.configManager.getCopilotPromptWithPriority(featureFilePath);

    // Check if prompt contains scenario_text placeholder
    if (customPrompt.includes("${scenario_text}")) {
      // Replace scenario_text placeholder
      customPrompt = customPrompt.replace(/\$\{scenario_text\}/g, scenarioText);

      // Replace feature_file_path placeholder if present
      if (featureFilePath && customPrompt.includes("${feature_file_path}")) {
        customPrompt = customPrompt.replace(/\$\{feature_file_path\}/g, featureFilePath);
      }

      // Replace profiles_path placeholder if present
      if (featureFilePath && customPrompt.includes("${profiles_path}")) {
        const profilesPath = this.findProfilesPath(featureFilePath);
        if (profilesPath) {
          customPrompt = customPrompt.replace(/\$\{profiles_path\}/g, profilesPath);
        }
      }

      // Return the customized prompt (scenario text is already included)
      return customPrompt;
    } else {
      // Legacy behavior: append prompt to scenario text
      // Replace feature_file_path placeholder if present
      if (featureFilePath && customPrompt.includes("${feature_file_path}")) {
        customPrompt = customPrompt.replace(/\$\{feature_file_path\}/g, featureFilePath);
      }

      // Replace profiles_path placeholder if present
      if (featureFilePath && customPrompt.includes("${profiles_path}")) {
        const profilesPath = this.findProfilesPath(featureFilePath);
        if (profilesPath) {
          customPrompt = customPrompt.replace(/\$\{profiles_path\}/g, profilesPath);
        }
      }

      return `${scenarioText}\n\n${customPrompt}`;
    }
  }

  /**
   * Find profiles directory path
   * Traverses up two levels from feature file
   * @param featureFilePath Feature file path
   * @returns Profiles path or null
   */
  private findProfilesPath(featureFilePath: string): string | null {
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
      const profilesPath = path.join(currentDir, "profiles");
      if (fs.existsSync(profilesPath) && fs.statSync(profilesPath).isDirectory()) {
        return profilesPath;
      }

      return null;
    } catch (error) {
      console.error("Error finding profiles path:", error);
      return null;
    }
  }

  /**
   * Check if a specific skill exists in the current workspace repository
   * Looks for .github/skills/{skillName}/SKILL.md in workspace folders
   * @param skillName Name of the skill to search for
   * @returns true if the skill exists
   */
  hasSkillInWorkspace(skillName: string): boolean {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
      return false;
    }

    for (const folder of workspaceFolders) {
      const skillPath = path.join(
        folder.uri.fsPath,
        '.github',
        'skills',
        skillName,
        'SKILL.md'
      );
      if (fs.existsSync(skillPath)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Generate a skill invocation command for Copilot
   * @param skillName Name of the skill
   * @param scenarioName Name of the scenario
   * @returns Skill invocation string (e.g. "/autoGenesis-run Scenario Name")
   */
  generateSkillCommand(skillName: string, scenarioName: string): string {
    return `/${skillName} ${scenarioName}`;
  }

  /**
   * Send text to Copilot chat
   * @param text Text to send
   */
  async sendToCopilot(text: string): Promise<void> {
    try {
      await vscode.commands.executeCommand('workbench.panel.chat.view.copilot.focus');
      await vscode.commands.executeCommand('workbench.action.chat.open', { query: text });
    } catch (error) {
      console.error('Error sending to Copilot:', error);
      vscode.window.showErrorMessage('Failed to send to Copilot');
    }
  }

  /**
   * Get config manager instance
   */
  getConfigManager(): ConfigManager {
    return this.configManager;
  }
}
