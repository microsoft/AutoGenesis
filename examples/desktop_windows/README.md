# Windows Desktop Testing Examples

This directory contains example tests for Windows desktop applications using pywinauto.

## Structure

```
desktop_windows/
├── features/
│   ├── notepad.feature      # Notepad automation example
│   ├── calculator.feature   # Calculator automation example
│   ├── environment.py       # Behave environment setup
│   └── steps/               # Step definitions
│       └── __init__.py
└── config/
    └── windows_config.json  # Windows testing configuration
```

## Prerequisites

1. **Windows OS** (Windows 10 or later)
2. **Python** with pywinauto installed
3. **Administrator privileges** may be required for some applications

## Running Tests

### With AutoGenesis CLI

```bash
# Start the MCP server
autogenesis server --platform windows --config config/windows_config.json

# Run tests
autogenesis run features/notepad.feature
```

### With Behave directly

```bash
cd examples/desktop_windows
behave features/notepad.feature
```

## Configuration

Edit `config/windows_config.json` to match your setup:

- `app_name`: Application name for identification
- `exe`: Path to executable
- `window_title_re`: Regex pattern to match window title
- `launch_args`: Command line arguments

## Tips

- Use `app_screenshot` to capture the current state
- Use `send_keystrokes` for keyboard shortcuts (e.g., `^o` for Ctrl+O)
- Element identification uses pywinauto's control identification

## Supported Controls

- Buttons, Menus, Menu Items
- Edit boxes, Text fields
- ListBox, ComboBox, TreeView
- TabControl, ToolBar
- And more pywinauto-supported controls
