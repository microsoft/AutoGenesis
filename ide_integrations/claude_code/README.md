# Claude Code Integration for AutoGenesis

This guide explains how to integrate AutoGenesis with Claude Code for AI-powered test automation.

## Quick Setup

### 1. Install Dependencies

```bash
cd /path/to/AutoGenesis
pip install -r requirements.txt
```

### 2. Configure AutoGenesis

Copy and customize the configuration file:

```bash
cp conf/autogenesis_conf.json conf/my_config.json
# Edit my_config.json with your settings
```

### 3. Configure Claude Code

Add the AutoGenesis MCP server to your Claude Code settings.

**Option A: Project-level configuration**

Create `.claude/settings.json` in your project:

```json
{
  "mcpServers": {
    "autogenesis": {
      "command": "python",
      "args": ["/path/to/AutoGenesis/servers/unified_mcp_server.py", "--transport", "stdio"],
      "env": {
        "PYTHONPATH": "/path/to/AutoGenesis",
        "AUTOGENESIS_CONFIG": "/path/to/AutoGenesis/conf/autogenesis_conf.json"
      }
    }
  }
}
```

**Option B: User-level configuration**

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "autogenesis": {
      "command": "python",
      "args": ["/path/to/AutoGenesis/servers/unified_mcp_server.py", "--transport", "stdio"],
      "env": {
        "PYTHONPATH": "/path/to/AutoGenesis"
      }
    }
  }
}
```

### 4. Verify Installation

Restart Claude Code and verify the tools are available:

```
> What tools do you have available for testing?
```

Claude should list the AutoGenesis testing tools.

## Usage Examples

### Mobile Testing (iOS/Android)

```
User: Test the login flow on iOS - launch the app, tap the login button, enter username "test@example.com" and password "secret", then tap submit

Claude: I'll help you test the login flow. Let me execute these steps:

1. Launching the iOS app...
2. Tapping the login button...
3. Entering username...
4. Entering password...
5. Tapping submit...

All steps completed successfully.
```

### Desktop Testing (Windows)

```
User: Test opening a file in Notepad - launch Notepad, click File menu, click Open, type "test.txt" and press Enter

Claude: I'll automate this test on Windows:

1. Launching Notepad...
2. Clicking File menu...
3. Clicking Open...
4. Entering filename...
5. Pressing Enter...

Test completed.
```

### Desktop Testing (Mac)

```
User: Test creating a new document in TextEdit - launch TextEdit, use keyboard shortcut Cmd+N, type "Hello World"

Claude: I'll execute this Mac automation:

1. Launching TextEdit...
2. Pressing Cmd+N...
3. Typing "Hello World"...

Done!
```

### BDD Test Generation

AutoGenesis can automatically generate BDD step definitions:

```
User: I want to record a test for login.feature - execute the steps and generate the Python code

Claude: I'll start a recording session and generate BDD step definitions.

1. Initializing code generation session...
2. Executing test steps...
3. Previewing generated code...
4. Code has been saved to features/steps/login_steps.py
```

## Available Tools

### Common Tools (All Platforms)

| Tool | Description |
|------|-------------|
| `before_gen_code` | Initialize BDD code generation session |
| `preview_code_changes` | Preview generated step definitions |
| `confirm_code_changes` | Save generated code to file |

### Mobile Tools

| Tool | Description |
|------|-------------|
| `app_launch` | Launch the mobile app |
| `app_close` | Close the mobile app |
| `click_element` | Click/tap an element |
| `send_keys` | Enter text in an element |
| `swipe` | Perform swipe gesture |
| `get_page_source_tree` | Get current UI tree |
| `verify_visual_task` | AI-powered visual verification |

### Windows Tools

| Tool | Description |
|------|-------------|
| `app_launch` | Launch Windows application |
| `app_close` | Close application |
| `element_click` | Click an element |
| `send_keystrokes` | Send keyboard input |
| `enter_text` | Enter text in a field |
| `app_screenshot` | Capture screenshot |

### Mac Tools

| Tool | Description |
|------|-------------|
| `app_launch` | Launch Mac application |
| `app_close` | Close application |
| `click_element` | Click an element |
| `send_keys_on_macos` | Enter text |
| `press_key` | Press keyboard shortcut |
| `drag_element_to_element` | Drag and drop |

## Configuration Options

### Platform Selection

You can specify which platforms to enable:

```json
{
  "mcpServers": {
    "autogenesis": {
      "command": "python",
      "args": [
        "/path/to/AutoGenesis/servers/unified_mcp_server.py",
        "--transport", "stdio",
        "--platform", "mobile",
        "--platform", "mac"
      ]
    }
  }
}
```

Available platforms: `all`, `mobile`, `ios`, `android`, `windows`, `mac`

### Custom Configuration File

```json
{
  "mcpServers": {
    "autogenesis": {
      "command": "python",
      "args": [
        "/path/to/AutoGenesis/servers/unified_mcp_server.py",
        "--config", "/path/to/custom_config.json"
      ]
    }
  }
}
```

## Troubleshooting

### Server Not Starting

1. Check Python is in PATH
2. Verify all dependencies are installed
3. Check config file path is correct
4. Review logs for errors

### Tools Not Available

1. Restart Claude Code
2. Check MCP server configuration
3. Verify the server starts without errors:
   ```bash
   python servers/unified_mcp_server.py --transport stdio
   ```

### Connection Issues

For mobile/Mac testing, ensure:
- Appium server is running (`appium`)
- Device/simulator is connected
- Correct server URL in config

For Windows testing, ensure:
- Application path is correct
- Running with appropriate permissions

## Best Practices

1. **Start with `before_gen_code`** when recording new tests
2. **Use `get_page_source_tree`** to understand available elements
3. **Prefer accessibility IDs** for more stable locators
4. **Review generated code** with `preview_code_changes` before saving
5. **Use visual verification** (`verify_visual_task`) for complex UI checks

## Support

- GitHub Issues: https://github.com/anthropics/autogenesis/issues
- Documentation: https://github.com/anthropics/autogenesis/docs
