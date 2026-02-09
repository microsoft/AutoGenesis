/**
 * Default prompts and templates used throughout the BDD AI Toolkit
 */

/**
 * Default COPILOT_PROMPT value used across the extension
 * This prompt is used when sending test cases to Copilot for execution
 */
export const DEFAULT_COPILOT_PROMPT = `Please use native-mcp-server to execute the following instructions:

# Original BDD Test Case (strictly follow step-by-step):
\${scenario_text}

Requirements:
feature_file = '\${feature_file_path}'
1. Before executing the first step, call \`before_gen_code\`, and after all steps are completed, sequentially call \`preview_code_changes\` and \`confirm_code_change\`.
2. Execute **each step** exactly as written using native-mcp-server API calls, in order.
3. **MANDATORY: For EVERY step, you MUST call an MCP tool. Never judge results by screenshots/snapshots alone.**
4. **Do not modify, merge, skip, or add any step.** Do not lose bdd step keyword.
5. Do not close browser`;

/**
 * Default NATRUAL_LANGUAGE_TASK_PROMPT value used across the extension
 * This prompt is used when sending test cases to Copilot for execution
 */
export const DEFAULT_NATURAL_LANGUAGE_TASK_PROMPT = `**🤖 EXECUTE WITH MCP TOOLS ONLY**

Please use \`native-mcp-server\` MCP tools to **test** the following scenario:

**Task:** \${scenario_text}

**🔧 MANDATORY REQUIREMENTS:**
1. Operate in an interactive loop to complete the test
2. **ONLY USE MCP TOOLS** - Do not describe actions, actually execute them
3. For **EVERY action**, you **MUST call a native-mcp-server MCP tool**
4. Execute steps **in sequence** - consider previous results before next action

**⚠️ FORBIDDEN ACTIONS:**
- Do NOT call \`before_gen_code\`, \`preview_code_changes\`, or \`confirm_code_change\`
- Do NOT describe what you would do - actually DO it using MCP tools
- Do NOT skip MCP tool calls

**START EXECUTION NOW** 🚀`;
