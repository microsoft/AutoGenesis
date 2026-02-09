/**
 * Natural Language Task Executor
 */

import * as vscode from "vscode";
import { DEFAULT_NATURAL_LANGUAGE_TASK_PROMPT } from "../constants/prompts";

interface NaturalLanguageTaskRequest {
  taskDescription: string;
}

export class NaturalLanguageTaskExecutor
  implements vscode.LanguageModelTool<NaturalLanguageTaskRequest>
{
  async invoke(
    options: vscode.LanguageModelToolInvocationOptions<NaturalLanguageTaskRequest>,
    token: vscode.CancellationToken
  ): Promise<vscode.LanguageModelToolResult> {
    try {
      const { taskDescription } = options.input;

      if (!taskDescription || taskDescription.trim() === "") {
        return new vscode.LanguageModelToolResult([
          new vscode.LanguageModelTextPart(
            "Error: Task description is required"
          ),
        ]);
      }

      // Replace placeholder in the prompt template
      const finalPrompt = DEFAULT_NATURAL_LANGUAGE_TASK_PROMPT.replace(
        "${scenario_text}",
        taskDescription.trim()
      );

      // Enhanced formatting with clear MCP instruction markers
      const formattedResponse = `🤖 **MCP EXECUTION REQUIRED**

${finalPrompt}

---
**⚡ IMMEDIATE ACTION REQUIRED:**
Copilot, you must now execute the above task using native-mcp-server MCP tools. Do not provide explanations - start tool execution immediately.`;

      // Return the enhanced prompt that will be executed by Copilot using MCP
      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(formattedResponse),
      ]);
    } catch (error) {
      const errorMessage = `Failed to prepare natural language task: ${error}`;

      return new vscode.LanguageModelToolResult([
        new vscode.LanguageModelTextPart(`Error: ${errorMessage}`),
      ]);
    }
  }

  async prepareInvocation(
    options: vscode.LanguageModelToolInvocationPrepareOptions<NaturalLanguageTaskRequest>,
    _token: vscode.CancellationToken
  ) {
    const { taskDescription } = options.input;

    const messageText =
      `🤖 **Prepare MCP Task Execution**\n\n` +
      `**Task:** ${taskDescription}\n\n` +
      `This will generate a formatted prompt that instructs Copilot to immediately execute the task using native-mcp-server MCP tools.\n\n` +
      `⚠️ **Important:** After this tool runs, Copilot will receive explicit instructions to use MCP tools for every action in the task.`;

    return {
      invocationMessage: `Preparing MCP execution prompt for: "${taskDescription}"`,
      confirmationMessages: {
        title: "Generate MCP Execution Prompt",
        message: new vscode.MarkdownString(messageText),
      },
    };
  }
}

// Keep the direct execution function for the VS Code command
export async function executeNaturalLanguageTask(
  taskDescription: string
): Promise<void> {
  try {
    if (!taskDescription || taskDescription.trim() === "") {
      vscode.window.showErrorMessage("Task description is required");
      return;
    }

    // Replace placeholder in the prompt template
    const finalPrompt = DEFAULT_NATURAL_LANGUAGE_TASK_PROMPT.replace(
      "${scenario_text}",
      taskDescription.trim()
    );

    // Copy to clipboard for backup
    await vscode.env.clipboard.writeText(finalPrompt);

    // Open Copilot chat with the prompt to trigger MCP execution
    await vscode.commands.executeCommand(
      "workbench.action.chat.open",
      finalPrompt
    );

    // Wait for the panel to open
    await new Promise((resolve) => setTimeout(resolve, 800));

    vscode.window.showInformationMessage(
      "Natural language task sent to Copilot for execution"
    );
  } catch (error) {
    const errorMessage = `Failed to execute natural language task: ${error}`;
    vscode.window.showErrorMessage(errorMessage);
  }
}
