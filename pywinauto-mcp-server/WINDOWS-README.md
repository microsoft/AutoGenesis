# PyWinauto MCP Server - Windows Testing

A Windows automation server based on the [Model Context Protocol (MCP)](https://modelcontextprotocol.io) that uses the [pywinauto](https://pywinauto.readthedocs.io/) library to automate Windows applications.

## Features

- 🤖 AI-assisted test script generation based on MCP protocol
- 🖥️ Windows desktop application automation support
- 🎯 Automatic generation of BDD format test code
- 🔄 Mouse and keyboard interactions

## Quick Start

### Prerequisites

- Python 3.10 or higher
- Windows operating system
- [uv](https://docs.astral.sh/uv/) package manager
- VS Code or Cursor

#### Install uv

```powershell
# Install uv for faster dependency management
powershell -c "irm https://astral.sh/uv/install.ps1 | iex"

# Or download from https://github.com/astral-sh/uv/releases/latest
```

### 1. Clone the Repository

Open PowerShell and run:

    git clone https://github.com/microsoft/AutoGenesis.git
    cd AutoGenesis

### 2. Install Dependencies

Navigate to the `pywinauto-mcp-server` directory and install Python dependencies:

    cd pywinauto-mcp-server
    uv sync

**Dependencies include:**
- `pywinauto` - Windows UI automation library
- `mcp` - Model Context Protocol SDK
- Other necessary utility libraries

## Usage

### 3. Configure Application

Application configuration is defined in the `conf/pywinauto_conf.json` file. Configure the application information to be automated here.

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

### 4. Start MCP Server

Run the following command to start the MCP server:

    cd pywinauto-mcp-server
    uv run python simple_server.py --transport sse

Default startup mode is SSE (Server-Sent Events).

### 5. Configure MCP Client

#### 5.1 VS Code Configuration

Create or edit `.vscode/mcp.json` in your project root:

**Method 1: Using SSE Mode (Server-Sent Events)**

    # Add MCP server configuration to .vscode/mcp.json:
    # {
    #   "servers": {
    #     "auto-genesis-mcp-pywinauto-sse": {
    #       "url": "http://localhost:8000/sse"
    #     }
    #   }
    # }
    After configuration, you need to click start to launch

**Method 2: Using stdio Mode (Recommended for Local Development)**

    # Add MCP server configuration to .vscode/mcp.json:
    # {
    #   "servers": {
    #     "auto-genesis-mcp-pywinauto-stdio": {
    #       "command": "uv",
    #       "args": [
    #         "run",
    #         "--project",
    #         "c:\\Users\\username\\code\\AutoGenesis\\pywinauto-mcp-server",
    #         "python",
    #         "c:\\Users\\username\\code\\AutoGenesis\\pywinauto-mcp-server\\simple_server.py",
    #         "--transport",
    #         "stdio"
    #       ],
    #       "env": {
    #         "PYTHONIOENCODING": "utf-8",
    #         "PYTHONUTF8": "1",
    #         "LANG": "en_US.UTF-8",
    #         "LC_ALL": "en_US.UTF-8"
    #       }
    #     }
    #   }
    # }

**Note:**
- stdio mode: VS Code automatically starts and manages the MCP server process, suitable for local development
- SSE mode: Requires manual start of MCP server (`uv run python simple_server.py --transport sse`), suitable for remote servers or multi-client scenarios
- Please replace the paths with your actual project paths

#### 5.2 Cursor Configuration

Configure MCP server in Cursor settings:

**Method 1: Using SSE Mode (Server-Sent Events)**

    # Add to Cursor MCP configuration:
    # {
    #   "mcpServers": {
    #     "auto-genesis-mcp-pywinauto-sse": {
    #       "url": "http://localhost:8000/sse"
    #     }
    #   }
    # }

**Method 2: Using stdio Mode**

    # Add to Cursor MCP configuration:
    # {
    #   "mcpServers": {
    #     "auto-genesis-mcp-pywinauto-stdio": {
    #       "command": "uv",
    #       "args": [
    #         "run",
    #         "--project",
    #         "c:\\Users\\username\\code\\AutoGenesis\\pywinauto-mcp-server",
    #         "python",
    #         "c:\\Users\\username\\code\\AutoGenesis\\pywinauto-mcp-server\\simple_server.py",
    #         "--transport",
    #         "stdio"
    #       ],
    #       "env": {
    #         "PYTHONIOENCODING": "utf-8",
    #         "PYTHONUTF8": "1",
    #         "LANG": "en_US.UTF-8",
    #         "LC_ALL": "en_US.UTF-8"
    #       }
    #     }
    #   }
    # }

**Note:**
- SSE mode: Need to manually start the server first (`uv run python simple_server.py --transport sse`), then VS Code/Cursor connects via HTTP
- stdio mode: VS Code/Cursor automatically starts and manages the server process
- Please replace the paths with your actual project paths

### 6. Use MCP to Generate Test Code

#### 6.1 Write Test Cases

The project already includes a sample test case `behave-demo/features/demo.feature`, you can refer to it to write new test cases suitable for your Windows app.

View example:

```gherkin
# Reference behave-demo/features/demo.feature
Feature: Edge Browser Testing

  Scenario: Open Edge browser and visit Bing search
    Given Launch Edge browser
    When Navigate to "https://www.bing.com"
    Then Verify tab title contains "Bing"
```

#### 6.2 Generate Test Code

Use the autoGenesis-win skill to automatically generate test code from your scenarios:

This project includes a pre-configured skill that simplifies the test execution process. Simply provide your scenario name and steps in natural language:

**Quick Example:**
```
Use skill autoGenesis-win to execute scenario: Test msn.com website on Edge
```

The skill will automatically:
- Locate the scenario from .feature files in behave-demo/features/
- Parse all scenario steps
- Execute each step through MCP tool calls
- Handle retry logic and error recovery
- Generate BDD test code
- Save the generated code to your project

**For more examples and usage details, see:** [.github/skills/autoGenesis-win/](.github/skills/autoGenesis-win/)

### 7. Run Generated Test Code

#### 7.1 Run Specific Scenario

Run a specific test scenario by name:

    behave --name "Scenario Name"

#### 7.2 More Options

For more Behave run options and usage, please refer to [Behave Official Documentation](https://behave.readthedocs.io/).

Common command examples:

    # Generate JSON report
    behave --format json -o reports/results.json
    
    # Filter using tags
    behave --tags=@smoke
    
    # Verbose output
    behave -v

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

## Advanced Configuration

### Azure OpenAI Integration (Optional)

#### Configure Azure OpenAI

Set environment variables for Azure OpenAI integration:

    $env:AZURE_OPENAI_ENDPOINT = "your-endpoint"
    $env:AZURE_OPENAI_API_KEY = "your-api-key"
    $env:AZURE_OPENAI_DEPLOYMENT = "your-deployment-name"

Then configure Azure OpenAI credentials in `llm/chat.py` to enable screenshot analysis functionality.

## Troubleshooting

### MCP Server Cannot Start

Check Python version and dependencies:

    python --version
    uv pip list

Or try re-syncing:

    uv sync

Ensure Python version is 3.10 or higher. Check the log file `logs/mcp_server.log` for detailed error information.

### Cannot Find Element

- Ensure the target application is open and active
- Some applications may require administrator privileges
- Use `verify_element_exists` to check if element is available
- Verify element's title, control_type, and automation_id are correct

### Permission Issues

- Run your MCP client or command line as administrator
- Some system windows may be protected and cannot be automated

### AI Client Cannot Recognize MCP Tools

- Restart VS Code or Cursor
- Check if MCP configuration file path is correct
- Confirm MCP Server has started successfully
- Verify Python path configuration

### Generated Code Cannot Run

Run tests in verbose mode to see detailed logs:

    behave -v

Check PyWinauto configuration file and ensure:
1. The target application is installed on your Windows system
2. The executable path in the configuration is correct
3. The window title pattern matches your application
4. Administrator privileges are granted if needed

## Example Use Cases

View examples in the `behave-demo/features/` directory:

- `demo.feature` - Contains complete test scenario examples

## Contributing

Contributions are welcome! Please check [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

## Contact

For questions or suggestions, please contact: fsqgroup@microsoft.com

## License

Please check [LICENSE](LICENSE)


