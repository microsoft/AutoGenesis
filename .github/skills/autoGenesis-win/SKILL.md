---
name: autoGenesis-win
description: Execute Windows application BDD test scenarios via pywinauto-mcp-server with auto code generation. Use when user provides a scenario name and asks to run, execute, or generate test code for Windows applications. Triggers on phrases like "execute Windows scenario X", "run pywinauto test for scenario", "generate test code for Windows scenario", "use autoGenesis-win skill", or when a scenario name is provided alongside a request to automate or test Windows apps. Reads scenario steps from .feature files, drives each step through MCP tool calls with persistent retry, then saves generated code via preview_code_changes + confirm_code_changes.
---

# AutoGenesis Win

Execute Windows application BDD test scenarios and automatically generate Python step implementation files using pywinauto.

## Project Structure

**CRITICAL**: This skill works with the following project structure:

```
behave-demo/
├── features/
│   ├── *.feature           # Feature files (e.g., demo.feature)
│   ├── environment.py      # Behave environment setup
│   └── steps/
│       └── *_steps.py      # Generated step implementations (OUTPUT HERE)
```

**Generated step files MUST be saved to**: `behave-demo/features/steps/`

**NOTE**: The MCP server may try to save to `pywinauto-mcp-server/behave_demo/features/steps/`. After code generation, you MUST verify the files are in the correct `behave-demo/features/steps/` directory and copy them if needed.

## Input

- **scenario_name** (required): Name of the scenario to execute, matching the `Scenario:` line in the `.feature` file.
- **feature_file** (optional): Path to the `.feature` file. If omitted, search all files under `behave-demo/features/`.

## Workflow

### Step 1: Locate the Scenario

Search `behave-demo/features/**/*.feature` (or the specified `feature_file`) for a `Scenario:` line matching `scenario_name`. Extract the full step block (Given/When/Then/And lines).

If the scenario is not found, list available scenario names from the directory and ask the user to confirm.

### Step 2: Execute via MCP

Substitute `{{SCENARIO_NAME}}` and `{{SCENARIO_STEPS}}` in the prompt below, then execute it against pywinauto-mcp-server:

---

```
Scenario: {{SCENARIO_NAME}}
{{SCENARIO_STEPS}}

Please use pywinauto-mcp-server to execute the following instructions:

CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY:

0. **PARAMETER DISCIPLINE — READ TOOL SCHEMAS FIRST**:
   - BEFORE calling ANY MCP tool, you MUST inspect its input schema to learn the EXACT parameter names, types, required/optional status, and allowed values.
   - Pass ALL required parameters — do NOT omit any.
   - Do NOT invent, guess, or fabricate parameters that are not in the schema. If a parameter does not appear in the tool's schema, it does not exist — do NOT pass it.
   - Use parameter values EXACTLY as defined (e.g., if the schema shows enum values with a specific prefix, use that prefix).
   - If you are unsure about a parameter, re-check the tool schema. Never assume.

1. **BEFORE STARTING**: Call before_gen_code FIRST

2. **FOR EACH STEP EXECUTION**:
   - Call the appropriate MCP tool(s) for the step
   - A step may require MULTIPLE MCP calls to complete (e.g., find element, click, type text)
   - WAIT for each MCP tool response
   - **MANDATORY**: IMMEDIATELY analyze and report each MCP response:
     * State the tool called and its parameters
     * Explicitly report the status: "Status: success" or "Status: error"
     * If error: Quote the exact error message
     * If success: Confirm what was accomplished
   - **CRITICAL**: If ANY MCP call returns status ≠ "success", you MUST:
     * **IMMEDIATELY acknowledge the failure**
     * **Quote the exact error message** from the response
     * **Analyze why it failed** (wrong locator, window not found, element not visible, etc.)
     * **Implement retry strategy** - try alternative approaches immediately
     * **Continue retrying** until this specific operation succeeds
     * Do not proceed to next operation until current one succeeds
   - Only proceed to next step when current step is fully completed and verified

3. **VERIFICATION STEPS**:
   - ALL verification/validation steps (like "I should see...") MUST use MCP tools
   - NEVER perform verification by analyzing element properties yourself
   - Use verify_element_exists, verify_element_value, or other MCP verification tools
   - If verification fails, try alternative locator strategies or window searches

4. **AFTER ALL STEPS COMPLETE**:
   - MANDATORY: Call preview_code_changes MCP tool to view generated code
   - MANDATORY: Call confirm_code_changes MCP tool to save the code
   - These two steps are REQUIRED and cannot be skipped
   - **PATH VERIFICATION**: After confirm_code_changes, verify the save location:
     * MCP server reports the path where it saved the file
     * If saved to `pywinauto-mcp-server/behave_demo/...`, copy to `behave-demo/features/steps/`
     * Confirm the correct final location to the user

5. **ERROR HANDLING & RETRY STRATEGY**:
   - Retry alternative approaches in this order (keep trying until one succeeds):
     * Try different locator strategies (class_name, control_type, title, etc.)
     * Try alternative element attributes or text values
     * Try finding similar elements with different properties
     * Try waiting for window/element to be ready before retrying the action
     * Use send_keys for keyboard input if mouse clicks don't work
     * Break complex steps into smaller MCP operations if needed
     * For window navigation: try different ways to find and interact with windows
   - **MANDATORY**: After each retry attempt, explicitly report the result
   - **PERSISTENCE RULE**: Keep trying alternatives until the step operation succeeds
   - **DO NOT ASSUME SUCCESS** - every MCP call must be verified
   - **Only stop the entire step** if you've exhausted ALL reasonable alternatives

6. **EXECUTION RULES**:
   - Execute steps in exact order as written
   - Each step may require MULTIPLE MCP calls to complete fully
   - Use ONLY pywinauto-mcp-server MCP tools
   - Never modify, merge, skip, or add steps
   - When retrying, use the most successful approach in final generated code

REMEMBER: Every step must be validated through MCP tools, not through your own analysis. When encountering errors, **RETRY with different approaches**. **Continue retrying until each operation succeeds**.

**CRITICAL SUCCESS VERIFICATION PROTOCOL**:
- After each MCP tool call, explicitly state: "✅ SUCCESS: [tool_name] completed" or "❌ FAILED: [tool_name] with error [message]"
- **RETRY UNTIL SUCCESS**: If you get "❌ FAILED", immediately try alternative approaches for the SAME operation
- Before moving to next step, confirm: "✅ STEP COMPLETED: [step_name] - all required actions successful"
- **DEFINITION OF SUCCESS**: Every operation in a step must return "status: success" before proceeding
```

---

### Step 3: Post-Execution & Path Verification

**CRITICAL - Verify File Location**:

After `preview_code_changes` and `confirm_code_changes` are called, you MUST:

1. **Check where the MCP server saved the files**:
   - The server may report: `pywinauto-mcp-server/behave_demo/features/steps/common_steps.py`
   - This is the WRONG location for the behave project

2. **Copy files to the correct location**:
   - Read the generated code from the MCP server's location
   - Create/update the file in: `behave-demo/features/steps/<scenario_name>_steps.py`
   - Use a descriptive filename based on the scenario or feature name

3. **Confirm the final location** to the user:
   ```
   ✅ Step file saved to: behave-demo/features/steps/demo_steps.py
   ```

4. **Provide run instructions**:

```bash
cd behave-demo
behave --name "{{SCENARIO_NAME}}"
```

Or run the entire feature file:

```bash
behave behave-demo/features/<feature_file>.feature
```

## Configuration

Before running tests, ensure `pywinauto-mcp-server/conf/pywinauto_conf.json` is configured with the target Windows application:

```json
{
  "PYWINAUTO_CONFIG": {
    "app_name": "Your Application Name",
    "exe": "C:\\Path\\To\\Your\\App.exe",
    "window_title_re": "window name pattern",
    "launch_args": []
  }
}
```

## MCP Tools Available

- **common_tool**: Window and application management (find_window, launch_app, etc.)
- **mouse_tool**: Mouse interactions (click, drag, move, etc.)
- **verify_tool**: Element verification (verify_element_exists, verify_element_value, etc.)
- **gen_code_tool**: Code generation (before_gen_code, preview_code_changes, confirm_code_changes)
