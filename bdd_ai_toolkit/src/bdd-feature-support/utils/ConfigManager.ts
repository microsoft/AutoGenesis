import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { DEFAULT_COPILOT_PROMPT } from "../../constants/prompts";

/**
 * Configuration Manager
 * Manages extension configuration (Copilot prompt and other settings)
 */
export class ConfigManager {
  private static instance: ConfigManager;

  private constructor() {}

  public static getInstance(): ConfigManager {
    if (!ConfigManager.instance) {
      ConfigManager.instance = new ConfigManager();
    }
    return ConfigManager.instance;
  }

  /**
   * Get Copilot prompt text from VS Code settings
   * Returns the configured value for the prompt appended to scenarios sent to Copilot
   */
  public getCopilotPrompt(): string {
    const config = vscode.workspace.getConfiguration("bddAiToolkit.cucumber");
    const prompt = config.get<string>("copilotPrompt");

    return prompt || DEFAULT_COPILOT_PROMPT;
  }

  /**
   * Set Copilot prompt text to VS Code settings
   */
  public async setCopilotPrompt(prompt: string): Promise<void> {
    const config = vscode.workspace.getConfiguration("bddAiToolkit.cucumber");
    await config.update(
      "copilotPrompt",
      prompt,
      vscode.ConfigurationTarget.Workspace
    );
  }

  /**
   * Get Copilot prompt text with priority: bdd_ai_conf.json > VS Code settings > default
   * @param featurePath Optional path to the feature file to help locate bdd_ai_conf.json
   * @returns The Copilot prompt text
   */
  public getCopilotPromptWithPriority(featurePath?: string): string {
    // Try to find bdd_ai_conf.json first
    let confJsonPath: string | null = null;

    if (featurePath) {
      // Try to find bdd_ai_conf.json in the same directory as the feature file or its parent directories
      let currentDir = path.dirname(featurePath);
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      while (
        currentDir &&
        (workspaceRoot ? currentDir.startsWith(workspaceRoot) : true)
      ) {
        const testPath = path.join(currentDir, "bdd_ai_conf.json");
        if (fs.existsSync(testPath)) {
          confJsonPath = testPath;
          break;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          break;
        } // Reached root
        currentDir = parentDir;
      }
    }

    // If not found through feature path, try workspace root
    if (!confJsonPath && vscode.workspace.workspaceFolders?.[0]) {
      const workspaceConfPath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        "bdd_ai_conf.json"
      );
      if (fs.existsSync(workspaceConfPath)) {
        confJsonPath = workspaceConfPath;
      }
    }

    // Try to read from bdd_ai_conf.json
    if (confJsonPath) {
      try {
        const confContent = fs.readFileSync(confJsonPath, "utf8");
        const confData = JSON.parse(confContent);
        if (
          confData.COPILOT_PROMPT &&
          typeof confData.COPILOT_PROMPT === "string" &&
          confData.COPILOT_PROMPT.trim() !== ""
        ) {
          console.log(
            `Using Copilot prompt from bdd_ai_conf.json: ${confJsonPath}`
          );
          return confData.COPILOT_PROMPT;
        }
      } catch (error) {
        console.warn(
          `Failed to read COPILOT_PROMPT from bdd_ai_conf.json (${confJsonPath}):`,
          error
        );
      }
    }

    // Fallback to VS Code settings or default
    console.log("Using Copilot prompt from VS Code settings or default");
    return this.getCopilotPrompt();
  }

  /**
   * Set Copilot prompt text with priority: save to conf.json if it exists, otherwise to VS Code settings
   * @param prompt The prompt text to save
   * @param featurePath Optional path to the feature file to help locate bdd_ai_conf.json
   */
  public async setCopilotPromptWithPriority(
    prompt: string,
    featurePath?: string
  ): Promise<void> {
    // Try to find bdd_ai_conf.json first
    let confJsonPath: string | null = null;

    if (featurePath) {
      // Try to find bdd_ai_conf.json in the same directory as the feature file or its parent directories
      let currentDir = path.dirname(featurePath);
      const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;

      while (
        currentDir &&
        (workspaceRoot ? currentDir.startsWith(workspaceRoot) : true)
      ) {
        const testPath = path.join(currentDir, "bdd_ai_conf.json");
        if (fs.existsSync(testPath)) {
          confJsonPath = testPath;
          break;
        }
        const parentDir = path.dirname(currentDir);
        if (parentDir === currentDir) {
          break;
        } // Reached root
        currentDir = parentDir;
      }
    }

    // If not found through feature path, try workspace root
    if (!confJsonPath && vscode.workspace.workspaceFolders?.[0]) {
      const workspaceConfPath = path.join(
        vscode.workspace.workspaceFolders[0].uri.fsPath,
        "bdd_ai_conf.json"
      );
      if (fs.existsSync(workspaceConfPath)) {
        confJsonPath = workspaceConfPath;
      }
    }

    // Try to save to bdd_ai_conf.json if it exists
    if (confJsonPath) {
      try {
        const confContent = fs.readFileSync(confJsonPath, "utf8");
        const confData = JSON.parse(confContent);
        confData.COPILOT_PROMPT = prompt;

        fs.writeFileSync(
          confJsonPath,
          JSON.stringify(confData, null, 4),
          "utf8"
        );
        console.log(
          `Copilot prompt saved to bdd_ai_conf.json: ${confJsonPath}`
        );
        return;
      } catch (error) {
        console.warn(
          `Failed to save COPILOT_PROMPT to bdd_ai_conf.json (${confJsonPath}):`,
          error
        );
      }
    }

    // Fallback to VS Code settings
    console.log("Saving Copilot prompt to VS Code settings");
    await this.setCopilotPrompt(prompt);
  }
}
