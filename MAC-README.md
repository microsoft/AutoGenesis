# Appium MCP Server - macOS Testing

Appium MCP Server is a macOS application automated testing service based on Model Context Protocol (MCP), specifically supporting automated test script generation for macOS desktop applications.

## Features

- 🤖 AI-assisted test script generation based on MCP protocol
- 🖥️ macOS desktop application automation support

## Quick Start

### Prerequisites

- macOS 10.15+ (macOS 12+ recommended)
- Python 3.10 or higher
- [uv](https://docs.astral.sh/uv/) package manager
- VS Code or Cursor
- Xcode Command Line Tools
- Node.js 16+

#### Install uv

```bash
# Install uv for faster dependency management
curl -LsSf https://astral.sh/uv/install.sh | sh

# Or using Homebrew
brew install uv
```

### 1. Clone the Repository

Open Terminal and run:

    git clone https://github.com/ai-microsoft/AutoGenesis.git
    cd AutoGenesis

### 2. Install Dependencies

Navigate to the `appium-mcp-server` directory and install Python dependencies:

    cd appium-mcp-server
    uv sync

**Dependencies include:**
- `appium-python-client` - Appium Python client
- `mcp` - Model Context Protocol SDK
- `selenium` - WebDriver support
- Other necessary utility libraries

### 3. Configure Appium Environment

#### 3.1 Install and Configure Appium

For detailed instructions on installing Xcode Command Line Tools, initializing Xcode, and installing Appium with Mac2 driver, please refer to the [macOS Appium Setup Guide](bdd_ai_toolkit/docs/macOS_Appium_Setup_Guide.md).

If you encounter any issues during the setup process, please consult the [official Appium documentation](https://appium.io/docs/en/latest/) for troubleshooting.

#### 3.2 Configure System Permissions

##### Accessibility Permission

1. Open **System Settings** → **Privacy & Security** → **Accessibility**
2. Click **+** and add:
   - Terminal
   - VS Code (or your IDE)

##### Screen Recording Permission (Optional)

1. **Privacy & Security** → **Screen & System Audio Recording**
2. Add the same applications

#### 3.3 Configure Appium Connection

Edit the configuration file for Mac platform:

    # Open conf/appium_conf.json and update the "mac" section:
    # {
    #   "APPIUM_DRIVER_CONFIGS": {
    #     "mac": {
    #       "platformName": "Mac",
    #       "automationName": "Mac2",
    #       "bundleId": "com.example.yourapp",
    #       "appium:fullReset": false,
    #       "appium:sessionTimeout": 6000,
    #       "appium:newCommandTimeout": 6000,
    #       "shouldUseSingletonTestManager": false,
    #       "waitForQuiescence": false,
    #       "showServerLogs": true,
    #       "server_url": "http://127.0.0.1:4723"
    #     }
    #   }
    # }

**Configuration Details:**
- `platformName`: Platform type (Mac)
- `automationName`: Automation engine (Mac2 for macOS)
- `bundleId`: The bundle identifier of your macOS application 
- `appium:fullReset`: Whether to fully reset the app before testing
- `appium:sessionTimeout`: Session timeout in milliseconds
- `appium:newCommandTimeout`: New command timeout in milliseconds
- `shouldUseSingletonTestManager`: Whether to use singleton test manager
- `waitForQuiescence`: Whether to wait for UI to be idle
- `showServerLogs`: Whether to show server logs
- `server_url`: Local Appium server address

### 4. Start Appium Server

Before starting the MCP server, you need to start the Appium server locally:

**Option A: Using the Setup Script**

```bash
cd docs
./start_appium.sh
```

**Option B: Manual Start**

```bash
appium server --port 4723
```

Keep this terminal window open while running tests.

### 5. Start MCP Server (SSE Mode Only)

**This step is only required if you plan to use SSE (Server-Sent Events) mode. If you're using stdio mode, VS Code/Cursor will automatically manage the server process, so you can skip this step.**

    uv run python simple_server.py --platform mac

Default startup mode is SSE (Server-Sent Events).

### 6. Configure MCP Client

#### 6.1 VS Code Configuration

Create or edit `.vscode/mcp.json` in your project root:

**Method 1: Using SSE Mode (Server-Sent Events)**

    # Add MCP server configuration to .vscode/mcp.json:
    # {
    #   "servers": {
    #     "auto-genesis-mcp-sse-mac": {
    #       "url": "http://localhost:8000/sse"
    #     }
    #   }
    # }
    After configuration, you need to click start to launch

**Method 2: Using stdio Mode (Recommended for Local Development)**

    # Add MCP server configuration to .vscode/mcp.json:
    # {
    #   "servers": {
    #     "auto-genesis-mcp-mac": {
    #       "command": "uv",
    #       "args": [
    #         "run",
    #         "--project",
    #         "/Users/yourusername/projects/AutoGenesis/appium-mcp-server",
    #         "python",
    #         "/Users/yourusername/projects/AutoGenesis/appium-mcp-server/simple_server.py",
    #         "--transport",
    #         "stdio",
    #         "--platform",
    #         "mac"
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

**Note:** Please replace the paths with your actual project path.

#### 6.2 Cursor Configuration

Configure MCP server in Cursor settings:

**Method 1: Using SSE Mode (Server-Sent Events)**

    # Add to Cursor MCP configuration:
    # {
    #   "mcpServers": {
    #     "auto-genesis-mcp-sse-mac": {
    #       "url": "http://localhost:8000/sse"
    #     }
    #   }
    # }

**Method 2: Using stdio Mode**

    # Add to Cursor MCP configuration:
    # {
    #   "mcpServers": {
    #     "auto-genesis-mcp-mac": {
    #       "command": "uv",
    #       "args": [
    #         "run",
    #         "--project",
    #         "/Users/yourusername/projects/AutoGenesis/appium-mcp-server",
    #         "python",
    #         "/Users/yourusername/projects/AutoGenesis/appium-mcp-server/simple_server.py",
    #         "--transport",
    #         "stdio",
    #         "--platform",
    #         "mac"
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

**Note:** Please replace the paths with your actual project path.

### 7. Use MCP to Generate Test Code

#### 7.1 Write Test Cases

The project already includes a sample test case `behave-demo/features/demo.feature`, you can refer to it to write new test cases suitable for your macOS app.

#### 7.2 Send Prompt to Generate Code

Send the following prompt in VS Code or Cursor AI Chat.

**Note:** Replace the scenario below with your own test case steps based on your application's functionality.

**Example prompt:**
```
    Scenario: Test macOS Calculator app
    Given I have launched Calculator app
    When I click button "5"
    And I click button "+"
    And I click button "3"
    And I click button "="
    Then The result should be "8"

Please use appium-mcp-server to execute the following instructions: 
Requirements: 
1. Before executing the first step, call clear_cache, and after all steps are completed, sequentially call preview_code_changes and confirm_code_change. 
2. Execute each step exactly as written, in order. Each step must generate one block of test code. 
3. Do not modify, merge, skip, or add any step. 
4. Use only appium-mcp-server API calls.
```

AI will call MCP tools to automatically generate corresponding step definition code.

### 8. Run Generated Test Code

#### 8.1 Run Specific Scenario

Run a specific test scenario by name:

    behave --name "Scenario Name"

#### 8.2 More Options

For more Behave run options and usage, please refer to [Behave Official Documentation](https://behave.readthedocs.io/).

Common command examples:

    # Generate JSON report
    behave --format json -o reports/results.json
    
    # Filter using tags
    behave --tags=@smoke
    
    # Verbose output
    behave -v

## Advanced Configuration

### Azure GPT Integration (Optional)

#### Configure Azure OpenAI

Set environment variables for Azure OpenAI integration:

    export AZURE_OPENAI_ENDPOINT="your-endpoint"
    export AZURE_OPENAI_API_KEY="your-api-key"
    export AZURE_OPENAI_DEPLOYMENT="your-deployment-name"

Then configure Azure OpenAI credentials in `llm/chat.py` to enable screenshot analysis functionality.

## Troubleshooting

### MCP Server Cannot Start

Check Python version and dependencies:

    python --version
    uv pip list

Or try re-syncing:

    uv sync

Ensure Python version is 3.10 or higher. Check the log file `logs/mcp_server.log` for detailed error information.

### Appium Server Cannot Start

**WebDriverAgentMac SIGABRT Error:**
```bash
sudo xcodebuild -runFirstLaunch
```

**Permission Issues:**
- Check Accessibility permissions in System Settings
- Restart Terminal after granting permissions

**Missing Drivers:**
```bash
appium driver install mac2
```

### AI Client Cannot Recognize MCP Tools

- Restart VS Code or Cursor
- Check if MCP configuration file path is correct
- Confirm MCP Server has started successfully
- Verify Python path configuration
- Ensure Appium server is running on port 4723

### Generated Code Cannot Run

Run tests in verbose mode to see detailed logs:

    behave -v

Check Appium configuration file and ensure:
1. Appium server is running
2. The bundleId is correct for your application
3. System permissions are granted
4. The target application is installed on your Mac

### Application Not Found

If you get an error about the application not being found:
- Verify the `bundleId` in the configuration matches your application
- Check that the application is installed on your Mac
- Try launching the application manually first to verify it works

## Example Use Cases

View examples in the `behave-demo/features/` directory:

- `demo.feature` - Contains complete test scenario examples

## Additional Resources

- [macOS Appium Setup Guide](bdd_ai_toolkit/docs/macOS_Appium_Setup_Guide.md) - Detailed setup instructions
- [Appium Mac2 Driver Documentation](https://github.com/appium/appium-mac2-driver) - Official Mac2 driver documentation
- [Appium Documentation](https://appium.io/docs/en/latest/) - General Appium documentation

## Contributing

Contributions are welcome! Please check [CONTRIBUTING.md](CONTRIBUTING.md) for details.

## Contact

For questions or suggestions, please contact: fsqgroup@microsoft.com

## License

Please check [LICENSE](LICENSE)
