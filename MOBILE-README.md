# Appium MCP Server - Mobile Testing

Appium MCP Server is a mobile application automated testing service based on Model Context Protocol (MCP), specifically supporting automated test script generation for iOS and Android mobile platforms.

## Features

- 🤖 AI-assisted test script generation based on MCP protocol
- 📱 Multi-platform support (iOS, Android)
- 🔄 Cloud testing capabilities integrated with BrowserStack
- 🎯 Automatic generation of BDD format test code
- 🚀 Support for various AI programming clients (VS Code, Cursor, etc.)

## Quick Start

### Prerequisites

- Python 3.10 or higher
- pip package manager
- VS Code or Cursor

### 1. Clone the Repository

Open PowerShell and run:

    git clone https://github.com/ai-microsoft/AutoGenesis.git
    cd AutoGenesis

### 2. Install Dependencies

Navigate to the `appium-mcp-server` directory and install Python dependencies:

    cd appium-mcp-server
    pip install -r requirements.txt

**Dependencies include:**
- `appium-python-client` - Appium Python client
- `mcp` - Model Context Protocol SDK
- `selenium` - WebDriver support
- Other necessary utility libraries

### 3. Configure Appium Environment

#### 3.1 Register for BrowserStack Free Trial

1. Visit [BrowserStack](https://www.browserstack.com/app-automate) official website
2. Click "Start Free Trial" to register an account (free trial available)
3. After registration, enter the **App Automate** console
4. Find your username and access key on the **Access Key** page

#### 3.1.1 Upload Test Application to BrowserStack

Upload your mobile application to BrowserStack for testing:

**Method 1: Upload via BrowserStack Console**

1. Login to [BrowserStack App Automate](https://app-automate.browserstack.com/)
2. Click the "Upload" button
3. Select your application file (`.apk` for Android, `.ipa` or `.app` for iOS)
4. After successful upload, copy the returned application URL (format: `bs://xxxxxx`)

**Method 2: Upload via Command Line**

Use curl command to upload application:

```powershell
# Android APK
curl -u "your_username:your_access_key" -X POST "https://api-cloud.browserstack.com/app-automate/upload" -F "file=@C:\path\to\your\app.apk"

# iOS IPA
curl -u "your_username:your_access_key" -X POST "https://api-cloud.browserstack.com/app-automate/upload" -F "file=@C:\path\to\your\app.ipa"
```

#### 3.2 Configure Appium Connection

Edit the configuration file with your BrowserStack credentials:

    # Open conf/appium_conf.json and update with your credentials:
    # {
    #   "android": {
    #     "platformName": "Android",
    #     "deviceName": "Google Pixel 8",
    #     "platformVersion": "14.0",
    #     "appium:fullReset": true,
    #     "autoLaunch": false,
    #     "automationName": "UiAutomator2",
    #     "server_url": "http://hub.browserstack.com/wd/hub",
    #     "bstack:options": {
    #       "projectName": "Your Project Name",
    #       "buildName": "android automation",
    #       "userName": "your_browserstack_username",
    #       "accessKey": "your_browserstack_access_key",
    #       "buildIdentifier": "your_build_id",
    #       "appiumVersion": "2.12.1",
    #       "idleTimeout": 900,
    #       "interactiveDebugging": true
    #     },
    #     "appium:app": "bs://your_app_id"
    #   }
    # }

**Configuration Details:**
- `platformName`: Platform type (Android/iOS)
- `deviceName`: Device name (e.g., Google Pixel 8)
- `platformVersion`: OS version
- `appium:fullReset`: Whether to fully reset the app before testing
- `autoLaunch`: Whether to automatically launch the app
- `automationName`: Automation engine (UiAutomator2 for Android, XCUITest for iOS)
- `server_url`: BrowserStack Hub address
- `bstack:options`: BrowserStack specific configurations
  - `projectName`: Project name
  - `buildName`: Build name
  - `userName`: BrowserStack username
  - `accessKey`: BrowserStack access key
  - `buildIdentifier`: Build identifier
  - `appiumVersion`: Appium version
  - `idleTimeout`: Idle timeout in seconds
  - `interactiveDebugging`: Whether to enable interactive debugging
- `appium:app`: BrowserStack app URL (bs:// format link obtained after uploading the app)

### 4. Start MCP Server

Start the MCP server:
Default startup mode is SSE
    python simple_server.py --platform android

### 5. Configure MCP Client

#### 5.1 VS Code Configuration

Create or edit `.vscode/mcp.json` in your project root:

**Method 1: Using SSE Mode (Server-Sent Events)**

    # Add MCP server configuration to .vscode/mcp.json:
    # {
    #   "github.copilot.chat.mcp.servers": {
    #     "appium-mcp-sse": {
    #       "url": "http://localhost:8000/sse"
    #     }
    #   }
    # }
    After configuration, you need to click start to launch

**Method 2: Using stdio Mode (Recommended for Local Development)**

    # Add MCP server configuration to .vscode/mcp.json:
    # {
    #   "github.copilot.chat.mcp.servers": {
    #     "appium-mcp-server-stdio": {
    #       "command": "c:\\Users\\username\\projects\\AutoGenesis\\.venv\\Scripts\\python.exe",
    #       "args": [
    #         "c:\\Users\\username\\projects\\AutoGenesis\\appium-mcp-server\\simple_server.py",
    #         "--transport",
    #         "stdio",
    #         "--platform",
    #         "ios"
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
- SSE mode: Requires manual start of MCP server (`python simple_server.py --transport sse`), suitable for remote servers or multi-client scenarios
- Use virtual environment Python path (`.venv\\Scripts\\python.exe`) for better dependency isolation
- `--platform` parameter: specify `ios` or `android` based on your testing needs
- Environment variables ensure proper UTF-8 encoding for international character support
- Please replace the paths with your actual project paths

#### 5.2 Cursor Configuration

Configure MCP server in Cursor settings:

**Method 1: Using SSE Mode (Server-Sent Events)**

    # Add to Cursor MCP configuration:
    # {
    #   "mcpServers": {
    #     "appium-mcp-sse": {
    #       "url": "http://localhost:8000/sse"
    #     }
    #   }
    # }

**Method 2: Using stdio Mode**

    # Add to Cursor MCP configuration:
    # {
    #   "mcpServers": {
    #     "appium-mcp-server-stdio": {
    #       "command": "c:\\Users\\username\\projects\\AutoGenesis\\.venv\\Scripts\\python.exe",
    #       "args": [
    #         "c:\\Users\\username\\projects\\AutoGenesis\\appium-mcp-server\\simple_server.py",
    #         "--transport",
    #         "stdio",
    #         "--platform",
    #         "ios"
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
- SSE mode: Need to manually start the server first (`python simple_server.py --platform android`, uses SSE by default), then Cursor connects via HTTP
- stdio mode: Cursor automatically starts and manages the server process
- Use virtual environment Python path (`.venv\\Scripts\\python.exe`) for better dependency isolation
- `--platform` parameter: specify `ios` or `android` based on your testing needs
- Environment variables ensure proper UTF-8 encoding for international character support
- Please replace the paths with your actual project paths

### 6. Use MCP to Generate Test Code

#### 6.1 Write Test Cases

The project already includes a sample test case `behave-demo/features/demo.feature`, you can refer to it to write new test cases suitable for your app.

View example:

```gherkin
# Reference behave-demo/features/demo.feature
Feature: Mobile Browser Testing

  Scenario: Open webpage and verify title
    Given Open Edge browser
    When Visit "https://www.bing.com"
    Then Page title should contain "Bing"
```

#### 6.2 Send Prompt to Generate Code

Send the following prompt in VS Code or Cursor AI Chat.

**Note:** Replace the scenario below with your own test case steps based on your application's functionality. In the example below, "I navigate to URL" step would typically require multiple MCP operations: click address bar, clear existing content, input URL, and click go button.

**Example prompt:**
```
    Scenario: Test msn.com website on Edge
    Given I have launched Edge browser
    When I click the search box in NTP page
    And I input "msn.com" in the search box
    And I press enter to navigate to the page
    And I wait for the page to load completely
    Then I should see the tab with the title "msn.com"

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
   - **PERSISTENT RETRY REQUIRED**: If any MCP tool returns error status, you MUST:
     * **Acknowledge the failure** immediately but continue working on this step
     * **Quote the exact error message** from the response
     * **Analyze why it failed** (wrong locator, element not ready, etc.)
     * **Report what you will try next** before attempting
     * **Immediately try the next alternative approach**
   - Retry alternative approaches in this order (keep trying until one succeeds):
     * Try different locator strategies (NAME, ACCESSIBILITY_ID, XPATH, etc.)
     * Try alternative element attributes or text values
     * Try finding similar elements with different properties
     * Try scrolling or waiting before retrying the action
     * Break complex steps into smaller MCP operations if needed
     * For navigation: try different ways to access address bar (tap vs long press vs menu)
   - **MANDATORY**: After each retry attempt, explicitly report the result
   - **PERSISTENCE RULE**: Keep trying alternatives until the step operation succeeds
   - For multi-step operations, if one sub-operation fails, retry that part before continuing
   - **DO NOT ASSUME SUCCESS** - every MCP call must be verified
   - **Only stop the entire step** if you've exhausted ALL reasonable alternatives
   - **Success requirement**: The step is only complete when all required operations succeed
   - **Final requirement**: Report what was tried and what finally worked (or total failure)

6. **EXECUTION RULES**:
   - Execute steps in exact order as written
   - Each step may require MULTIPLE MCP calls to complete fully
   - Examples: "navigate to URL" might need click_element (search box) + send_keys (URL) + click_element (go button)
   - Examples: "verify page loaded" might need scroll_to_element + verify_element_exists + verify_element_attribute
   - **MANDATORY VERIFICATION**: After each individual MCP call within a step:
     * Check and report the response status
     * If successful: Confirm the action was completed successfully  
     * If failed: **IMMEDIATELY retry with alternative approaches**
     * **RETRY PERSISTENCE**: Continue trying until the operation succeeds
     * Never proceed to next operation while current one is failing
   - Generate one block of test code per step (may contain multiple MCP operations)
   - Use ONLY appium-mcp-server MCP tools
   - Never modify, merge, skip, or add steps
   - **STEP-BY-STEP VALIDATION**: Each step must be fully verified before proceeding
   - When retrying, use the most successful approach in final generated code

REMEMBER: Every step must be validated through MCP tools, not through your own analysis. When encountering errors, **RETRY with different approaches** rather than giving up. **Continue retrying until each operation succeeds**. Complete each step fully before moving to the next.

**CRITICAL SUCCESS VERIFICATION PROTOCOL**:
- After each MCP tool call, you MUST explicitly state: "✅ SUCCESS: [tool_name] completed" or "❌ FAILED: [tool_name] with error [message]"  
- **RETRY UNTIL SUCCESS**: If you get "❌ FAILED", immediately try alternative approaches for the SAME operation
- **NO STOPPING ON FIRST FAILURE**: Keep trying different methods until you achieve success
- Before moving to next step, confirm: "✅ STEP COMPLETED: [step_name] - all required actions successful"
- **STEP COMPLETION RULE**: A step is only complete when ALL its required operations succeed
- If you proceed without explicit success confirmation, you are violating the protocol
- Never assume operations worked - always verify through MCP tool responses
- **DEFINITION OF SUCCESS**: Every operation in a step must return "status: success" before proceeding
```
AI will call MCP tools to automatically generate corresponding step definition code.


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


## Advanced Configuration

### Azure GPT Integration (Optional)

#### Configure Azure OpenAI

Set environment variables for Azure OpenAI integration:

    $env:AZURE_OPENAI_ENDPOINT = "your-endpoint"
    $env:AZURE_OPENAI_API_KEY = "your-api-key"
    $env:AZURE_OPENAI_DEPLOYMENT = "your-deployment-name"

Then configure Azure OpenAI credentials in `llm/chat.py` to enable screenshot analysis functionality.

### Local Appium Server (Optional)

If not using BrowserStack, you can configure a local Appium Server.

#### Install Appium

Install Appium and required drivers globally:

    npm install -g appium
    appium driver install uiautomator2
    appium driver install xcuitest

**Detailed Configuration Reference:**
- Android environment configuration: refer to [Appium Android Official Documentation](https://appium.io/docs/en/drivers/android-uiautomator2/)
- iOS environment configuration: refer to [Appium iOS Official Documentation](https://appium.io/docs/en/drivers/ios-xcuitest/)
- Appium installation guide: refer to [Appium Official Installation Documentation](https://appium.io/docs/en/about-appium/getting-started/)


#### Update Configuration

Edit `conf/appium_conf.json` for local server:

    # {
    #   "appiumServer": "http://localhost:4723",
    #   "platformName": "Android",
    #   "deviceName": "emulator-5554",
    #   "app": "/path/to/your/app.apk"
    # }

#### Start Appium Server

Start the local Appium server:

    appium

## Troubleshooting

### MCP Server Cannot Start

Check Python version and dependencies:

    python --version
    pip list

Ensure Python version is 3.10 or higher. Check the log file `logs/mcp_server.log` for detailed error information.

### BrowserStack Connection Failed

- Verify username and key are correct
- Check network connection
- Confirm BrowserStack account is active
- Check firewall settings

### AI Client Cannot Recognize MCP Tools

- Restart VS Code or Cursor
- Check if MCP configuration file path is correct
- Confirm MCP Server has started successfully
- Verify Python path configuration

### Generated Code Cannot Run

Run tests in verbose mode to see detailed logs:

    behave -v

Check Appium configuration file and device connection status.

## Example Use Cases

View examples in the `behave-demo/features/` directory:

- `demo.feature` - Contains complete test scenario examples

## Contributing

Contributions are welcome! Please check [CONTRIBUTING.md](../CONTRIBUTING.md) for details.

## Contact

For questions or suggestions, please contact: fsqgroup@microsoft.com

## License

Please check [LICENSE]

