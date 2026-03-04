---
name: autoGenesis-run
description: Execute Appium BDD test scenarios via appium-mcp-server with auto code generation. Use when user provides a scenario name and asks to run, execute, or generate test code for it. Triggers on phrases like "execute scenario X", "run appium test for scenario", "generate test code for scenario", "use autoGenesis-run skill", or when a scenario name is provided alongside a request to automate or test it. Reads scenario steps from .feature files in behave-demo/features/, drives each step through MCP tool calls with persistent retry, then saves generated code via preview_code_changes + confirm_code_changes.
---

# AutoGenesis Run

## Input

- **scenario_name** (required): Name of the scenario to execute, matching the `Scenario:` line in the `.feature` file.
- **feature_file** (optional): Path to the `.feature` file. If omitted, search all files under `behave-demo/features/`.

## Workflow

### Step 1: Locate the Scenario

Search `behave-demo/features/**/*.feature` (or the specified `feature_file`) for a `Scenario:` line matching `scenario_name`. Extract the full step block (Given/When/Then/And lines).

If the scenario is not found, list available scenario names from the directory and ask the user to confirm.

### Step 2: Execute via MCP

Substitute `{{SCENARIO_NAME}}` and `{{SCENARIO_STEPS}}` in the prompt below, then execute it against appium-mcp-server:

---

```
Scenario: {{SCENARIO_NAME}}
{{SCENARIO_STEPS}}

Please use appium-mcp-server to execute the following instructions:

CRITICAL REQUIREMENTS - MUST FOLLOW EXACTLY:

1. **BEFORE STARTING**: Call before_gen_code FIRST

2. **FOR EACH STEP EXECUTION**:
   - Call the appropriate MCP tool(s) for the step
   - A step may require MULTIPLE MCP calls to complete (e.g., click then type, scroll then click)
   - WAIT for each MCP tool response
   - **MANDATORY**: IMMEDIATELY analyze and report each MCP response:
     * State the tool called and its parameters
     * Explicitly report the status: "Status: success" or "Status: error"
     * If error: Quote the exact error message
     * If success: Confirm what was accomplished
   - **CRITICAL**: If ANY MCP call returns status ≠ "success", you MUST:
     * **IMMEDIATELY acknowledge the failure**
     * **Quote the exact error message** from the response
     * **Analyze why it failed** (wrong locator, element not ready, etc.)
     * **Implement retry strategy** - try alternative approaches immediately
     * **Continue retrying** until this specific operation succeeds
     * Do not proceed to next operation until current one succeeds
   - Only proceed to next step when current step is fully completed and verified

3. **VERIFICATION STEPS**:
   - ALL verification/validation steps (like "I should see...") MUST use MCP tools
   - NEVER perform verification by analyzing page source yourself
   - Use verify_element_exists, verify_element_attribute, or other MCP verification tools
   - If verification fails, try alternative locator strategies

4. **AFTER ALL STEPS COMPLETE**:
   - MANDATORY: Call preview_code_changes MCP tool
   - MANDATORY: Call confirm_code_changes MCP tool
   - These two steps are REQUIRED and cannot be skipped

5. **ERROR HANDLING & RETRY STRATEGY**:
   - Retry alternative approaches in this order (keep trying until one succeeds):
     * Try different locator strategies (NAME, ACCESSIBILITY_ID, XPATH, etc.)
     * Try alternative element attributes or text values
     * Try finding similar elements with different properties
     * Try scrolling or waiting before retrying the action
     * Break complex steps into smaller MCP operations if needed
     * For navigation: try different ways to access address bar (tap vs long press vs menu)
   - **MANDATORY**: After each retry attempt, explicitly report the result
   - **PERSISTENCE RULE**: Keep trying alternatives until the step operation succeeds
   - **DO NOT ASSUME SUCCESS** - every MCP call must be verified
   - **Only stop the entire step** if you've exhausted ALL reasonable alternatives

6. **EXECUTION RULES**:
   - Execute steps in exact order as written
   - Each step may require MULTIPLE MCP calls to complete fully
   - Use ONLY appium-mcp-server MCP tools
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

### Step 3: Post-Execution

After all steps complete and code is saved, remind the user to run:

```bash
behave --name "{{SCENARIO_NAME}}"
```
