# PyWinauto MCP Server

A Windows automation server based on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) that uses the [pywinauto](https://pywinauto.readthedocs.io/) library to automate Windows applications.

## Overview

The MCP (Model Context Protocol) server acts as a bridge between AI assistants and Windows applications, enabling automated testing and UI interactions. It provides a standardized set of tools for AI systems to interact with Windows desktop applications.

Key Features:
- Launch and control Windows application instances
- Perform mouse and keyboard interactions
- Generate and manage automated test code
- Support for multiple transport methods (SSE and stdio)
- Comprehensive application UI element inspection and verification

## Prerequisites

- Python 3.10 or later
- Windows operating system
- [uv](https://docs.astral.sh/uv/) package manager (recommended)

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd pywinauto-mcp-server
```

2. Install dependencies using [uv](https://docs.astral.sh/uv/):
```bash
uv sync
```

> **Alternative**: If you prefer pip, you can still use `pip install -r requirements.txt`.

## Usage

### Starting the MCP Server

Run the following command to start the MCP server:

```bash
uv run simple_server.py [--transport TRANSPORT] [--config CONFIG]
```

Options:
- `--transport`: Choose the transport method (default: `sse`)
  - Supported values: `sse`, `stdio`
- `--config`: Configuration file path (optional)

Example:
```bash
uv run simple_server.py --transport sse
```

This will start the MCP server on port 8000 using Server-Sent Events (SSE) transport.

### Integration with MCP Clients

To use this MCP server with your MCP client, edit the client's configuration file.

**Example configuration path**: `%APPDATA%\<ClientName>\config.json`

Add the following configuration:

```json
{
  "mcpServers": {
    "bdd-auto-mcp-pywinauto": {
      "command": "uv",
      "args": [
        "run",
        "--directory",
        "C:\\Users\\<your-username>\\code\\AutoGenesis\\pywinauto-mcp-server",
        "simple_server.py",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

**Note**: Replace `<your-username>` in the path with your actual Windows username.

### Configuration Verification

After configuration:
1. Restart your MCP client
2. Check the log file to confirm the server started successfully
   - Log location: `logs/mcp_server_YYYYMMDD.log`

## Configuration

Application configuration is defined in the `conf/pywinauto_conf.json` file. You can configure the application information to be automated here.

Configuration example:
```json
{
  "PYWINAUTO_CONFIG": {
    "app_name": "Your Application Name",
    "exe": "C:\\Path\\To\\Your\\App.exe",
    "window_title_re": "window name",
    "launch_args": ["--arg1", "--arg2"]
  }
}
```

Configuration fields:
- `app_name`: Friendly name for the application (for logging purposes)
- `exe`: Full path to the application executable file
- `window_title_re`: Regular expression pattern to match the main window title. This helps the server identify and connect to the correct application window. For example:
  - `".*Notepad"` - Matches any window title ending with "Notepad"
  - `"Untitled.*"` - Matches any window title starting with "Untitled"
  - `"My App"` - Exact match for "My App"
- `launch_args`: (Optional) List of command-line arguments to pass to the application when launching. For example:
  - `["--maximized"]` - Launch in maximized mode
  - `["--safe-mode", "--no-plugins"]` - Launch with multiple arguments
  - `["file.txt"]` - Open a specific file on launch

## Test Code Generation

The server supports generating Behave-compatible BDD test code:

1. Call `before_gen_code` to initialize code generation
2. Perform the application actions you want to record
3. Call `preview_code_changes` to view the generated test code
4. Call `confirm_code_changes` to save the code to a step file

## Usage Examples

### Example: Automating Notepad Operations

After configuration, you can use natural language through your MCP client to interact with Windows applications:

- "Launch Notepad application"
- "Enter 'Hello World' in the text box"
- "Click the save button"
- "Verify the title bar shows the filename"
- "Take a screenshot of the application window"
- "Close the application"

## Project Structure

```
pywinauto-mcp-server/
├── simple_server.py       # MCP server main program
├── app_session.py         # Application session manager
├── pyproject.toml         # uv/project configuration
├── requirements.txt       # Dependencies list (legacy)
├── conf/                  # Configuration directory
│   └── pywinauto_conf.json
├── tools/                 # Tool modules
│   ├── common_tool.py     # Common tools
│   ├── mouse_tool.py      # Mouse operation tools
│   ├── gen_code_tool.py   # Code generation tools
│   └── verify_tool.py     # Verification tools
├── utils/                 # Utility functions
├── llm/                   # LLM integration
├── logs/                  # Logs directory
└── WINDOWS-README.md      # Documentation (this file)
```

## Supported Tools

The server provides the following tools to automate Windows applications through the MCP protocol:

### 📱 Application Management
- **app_launch** - Launch the application
- **app_close** - Close the application
- **app_screenshot** - Take a screenshot of the application window

### 🎯 Element Operations
- **element_click** - Click an element
- **right_click** - Right-click an element
- **enter_text** - Enter text into an element
- **send_keystrokes** - Send keyboard keystrokes
- **select_item** - Select a list item
- **open_folder** - Open a folder

### 🖱️ Mouse Operations
- **mouse_drag_drop** - Mouse drag and drop operations
- **mouse_hover** - Mouse hover
- **mouse_scroll** - Mouse scroll

### ✅ Verification Tools
- **verify_element_exists** - Verify element exists
- **verify_element_not_exist** - Verify element does not exist
- **verify_checkbox_state** - Verify checkbox state
- **verify_element_value** - Verify element value
- **verify_elements_order** - Verify elements order
- **verify_visual_task** - Visual verification task

### 🔧 Code Generation
- **before_gen_code** - Initialize code generation session
- **preview_code_changes** - Preview generated code changes
- **confirm_code_changes** - Confirm and apply code changes

## Troubleshooting

### Common Issues

1. **Server fails to start**
   - Confirm Python 3.10+ is installed and `uv` is available (`uv --version`)
   - Run `uv sync` to ensure all dependencies are installed

2. **Cannot find element**
   - Ensure the target application is open and active
   - Some applications may require administrator privileges
   - Use `verify_element_exists` to check if element is available
   - Verify element's title, control_type, and automation_id are correct

3. **Permission issues**
   - Run your MCP client or command line as administrator
   - Some system windows may be protected and cannot be automated

4. **Code generation errors**
   - Ensure `before_gen_code` is called for initialization before performing actions
   - Check that path settings in configuration file are correct

## Development

### Local Testing

```bash
# Run server directly
uv run simple_server.py --transport sse

# Use custom configuration
uv run simple_server.py --config path/to/your/config.json
```


