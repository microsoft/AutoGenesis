import { motion } from 'framer-motion';
import { useState } from 'react';

type Platform = 'windows' | 'macos' | 'mobile';

// Code block component for consistent styling
const CodeBlock = ({ children, className = '' }: { children: string; className?: string }) => (
  <pre className={`bg-slate-900 text-slate-100 p-4 rounded-lg overflow-x-auto text-sm ${className}`}>
    <code>{children}</code>
  </pre>
);

// Step component for consistent section styling
const Step = ({
  number,
  title,
  children,
}: {
  number: number;
  title: string;
  children: React.ReactNode;
}) => (
  <div className="mb-8">
    <h3 className="text-2xl font-semibold text-purple-primary mb-4">
      {number}. {title}
    </h3>
    {children}
  </div>
);

// Info box component
const InfoBox = ({
  children,
  variant = 'info',
}: {
  children: React.ReactNode;
  variant?: 'info' | 'success' | 'warning';
}) => {
  const styles = {
    info: 'bg-blue-50 border-purple-primary',
    success: 'bg-green-50 border-green-500',
    warning: 'bg-amber-50 border-amber-500',
  };

  return (
    <div className={`border-l-4 p-4 rounded ${styles[variant]}`}>
      <div className="text-slate-700">{children}</div>
    </div>
  );
};

// Windows Platform Content
const WindowsContent = () => (
  <div className="space-y-12">
    {/* Prerequisites */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Prerequisites</h3>
      <div className="bg-slate-50 rounded-lg p-6">
        <ul className="list-disc list-inside space-y-2 text-slate-700">
          <li>Python 3.10 or higher</li>
          <li>Windows operating system</li>
          <li>uv package manager (recommended)</li>
          <li>VS Code or Cursor</li>
        </ul>
      </div>
    </section>

    {/* Installation */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Installation</h3>
      <Step number={1} title="Clone the Repository">
        <CodeBlock>{`git clone https://github.com/ai-microsoft/AutoGenesis.git
cd AutoGenesis`}</CodeBlock>
      </Step>

      <Step number={2} title="Install Dependencies">
        <CodeBlock>{`pip install -r requirements.txt`}</CodeBlock>
      </Step>
    </section>

    {/* Configuration */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Configuration</h3>
      <Step number={1} title="Configure PyWinauto">
        <div className="space-y-4">
          <p className="text-slate-700">
            Windows automation uses <strong>PyWinauto</strong> - no Appium installation required.
          </p>
          <div className="bg-slate-50 rounded-lg p-6">
            <p className="font-semibold text-slate-900 mb-3">Configure your application:</p>
            <p className="text-slate-700 mb-3">
              Edit <code className="bg-slate-200 px-2 py-1 rounded">conf/pywinauto_conf.json</code>:
            </p>
            <CodeBlock>
              {`{
  "PYWINAUTO_CONFIG": {
    "app_name": "Your Application Name",
    "exe": "C:\\\\Path\\\\To\\\\Your\\\\App.exe",
    "window_title_re": "window name",
    "launch_args": ["--arg1", "--arg2"]
  }
}`}
            </CodeBlock>
            <ul className="list-disc list-inside space-y-1 text-slate-600 mt-4 text-sm">
              <li><strong>exe</strong>: Full path to the application executable</li>
              <li><strong>window_title_re</strong>: Regex pattern to match the window title</li>
              <li><strong>launch_args</strong>: (Optional) Command-line arguments</li>
            </ul>
          </div>
        </div>
      </Step>

      <Step number={2} title="Start MCP Server">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 mb-3">Start the MCP server:</p>
          <CodeBlock>{`python simple_server.py --transport sse`}</CodeBlock>
          <p className="text-slate-600 mt-3 text-sm">
            This starts the PyWinauto MCP server on port 8000.
          </p>
        </div>
      </Step>

      <Step number={3} title="Configure VS Code">
        <div className="space-y-4">
          <p className="text-slate-700">
            Add the following to your <code className="bg-slate-200 px-2 py-1 rounded">.vscode/settings.json</code>:
          </p>
          <CodeBlock>
            {`{
  "github.copilot.chat.mcp.servers": {
    "pywinauto": {
      "command": "python",
      "args": [
        "C:\\\\Users\\\\<username>\\\\projects\\\\AutoGenesis\\\\pywinauto-mcp-server\\\\simple_server.py",
        "--transport",
        "stdio"
      ]
    }
  }
}`}
          </CodeBlock>
          <p className="text-slate-600 text-sm">
            Replace the path with your actual project location. For Cursor, add to{' '}
            <code className="bg-slate-200 px-2 py-1 rounded">mcpServers</code> in Cursor settings.
          </p>
        </div>
      </Step>
    </section>

    {/* Usage */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Usage</h3>
      <Step number={1} title="Write Test Cases">
        <p className="text-slate-700 mb-4">
          Write BDD test cases in Gherkin format. The project includes sample test cases in{' '}
          <code className="bg-slate-200 px-2 py-1 rounded">behave-demo/features/</code> directory.
        </p>
      </Step>

      <Step number={2} title="Generate Test Code with AI">
        <p className="text-slate-700 mb-4">
          Switch to Agent mode in Copilot Chat and send a prompt with your test scenario:
        </p>
        <div className="bg-slate-50 rounded-lg p-6">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap">
            {`Scenario: Download PDF file
Given Edge is launched
When I navigate to "https://getsamplefiles.com/download/pdf/sample-1.pdf"
Then the Downloads pane should appear
When I navigate to "edge://downloads"
Then "sample-1.pdf" should appear in download list

Please use win-auto-mcp to execute the following instructions:
Requirements:
1. Before executing the first step, call before_gen_code, and after all steps are completed, sequentially call preview_code_changes and confirm_code_change.
2. Execute each step exactly as written, in order.
3. Do not modify, merge, skip, or add any step.
4. Use only win-auto-mcp API calls.`}
          </pre>
        </div>
        <p className="text-slate-600 mt-4 text-sm">
          AI will call MCP tools to automatically generate step definition code.
        </p>
      </Step>

      <Step number={3} title="Run Tests">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 mb-3">Run a specific test scenario:</p>
          <CodeBlock>{`behave --name "Scenario Name"`}</CodeBlock>

          <p className="text-slate-700 mt-6 mb-3">More options:</p>
          <CodeBlock>
            {`# Generate JSON report
behave --format json -o reports/results.json

# Filter using tags
behave --tags=@smoke

# Verbose output
behave -v`}
          </CodeBlock>
        </div>
      </Step>
    </section>

    {/* Troubleshooting */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Troubleshooting</h3>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">MCP Server Cannot Start</h4>
          <p className="text-slate-700">
            Check Python version is 3.10+ with <code>python --version</code>. Review logs in{' '}
            <code>logs/mcp_server.log</code>.
          </p>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">Cannot Find Element</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Ensure the target application is open and active</li>
            <li>Some applications may require administrator privileges</li>
            <li>Verify element's title and control_type are correct</li>
          </ul>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">AI Client Cannot Recognize MCP Tools</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Restart VS Code or Cursor</li>
            <li>Verify MCP configuration path is correct</li>
            <li>Confirm MCP Server has started successfully</li>
          </ul>
        </div>
      </div>
    </section>
  </div>
);

// macOS Platform Content
const MacOSContent = () => (
  <div className="space-y-12">
    {/* Prerequisites */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Prerequisites</h3>
      <div className="bg-slate-50 rounded-lg p-6">
        <ul className="list-disc list-inside space-y-2 text-slate-700">
          <li>macOS 10.15+ (macOS 12+ recommended)</li>
          <li>Python 3.10 or higher</li>
          <li>Node.js 16+</li>
          <li>Xcode Command Line Tools</li>
          <li>VS Code or Cursor</li>
        </ul>
      </div>
    </section>

    {/* Installation */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Installation</h3>
      <Step number={1} title="Clone the Repository">
        <CodeBlock>{`git clone https://github.com/ai-microsoft/AutoGenesis.git
cd AutoGenesis`}</CodeBlock>
      </Step>

      <Step number={2} title="Install Dependencies">
        <CodeBlock>{`pip install -r requirements.txt`}</CodeBlock>
      </Step>

      <Step number={3} title="Install Appium and Mac2 Driver">
        <CodeBlock>{`npm install -g appium
appium driver install mac2`}</CodeBlock>
      </Step>
    </section>

    {/* Configuration */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Configuration</h3>
      <Step number={1} title="Configure System Permissions">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="font-semibold text-slate-900 mb-3">Grant Accessibility Permission:</p>
          <ol className="list-decimal list-inside space-y-2 text-slate-700">
            <li>Open <strong>System Settings</strong> → <strong>Privacy & Security</strong> → <strong>Accessibility</strong></li>
            <li>Click <strong>+</strong> and add Terminal and VS Code</li>
            <li>(Optional) Enable <strong>Screen Recording</strong> permission for the same apps</li>
          </ol>
        </div>
      </Step>

      <Step number={2} title="Configure Appium">
        <div className="space-y-4">
          <p className="text-slate-700 mb-3">
            Edit <code className="bg-slate-200 px-2 py-1 rounded">conf/appium_conf.json</code> (mac section):
          </p>
          <CodeBlock>
            {`{
  "APPIUM_DRIVER_CONFIGS": {
    "mac": {
      "platformName": "Mac",
      "automationName": "Mac2",
      "bundleId": "com.example.yourapp",
      "server_url": "http://127.0.0.1:4723"
    }
  }
}`}
          </CodeBlock>
          <p className="text-slate-600 mt-3 text-sm">
            <strong>bundleId</strong>: The bundle identifier of your macOS application (e.g., com.apple.calculator)
          </p>
        </div>
      </Step>

      <Step number={3} title="Start Appium Server">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 mb-3">Start the Appium server (keep this terminal open):</p>
          <CodeBlock>{`appium server --port 4723`}</CodeBlock>
        </div>
      </Step>

      <Step number={4} title="Start MCP Server">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 mb-3">In a new terminal, start the MCP server:</p>
          <CodeBlock>
            {`cd appium-mcp-server
python simple_server.py --platform mac`}
          </CodeBlock>
        </div>
      </Step>

      <Step number={5} title="Configure VS Code">
        <div className="space-y-4">
          <p className="text-slate-700">
            Add the following to your <code className="bg-slate-200 px-2 py-1 rounded">.vscode/settings.json</code>:
          </p>
          <CodeBlock>
            {`{
  "github.copilot.chat.mcp.servers": {
    "appium-mcp-mac": {
      "command": "python",
      "args": [
        "/Users/<username>/projects/AutoGenesis/appium-mcp-server/simple_server.py",
        "--platform",
        "mac"
      ]
    }
  }
}`}
          </CodeBlock>
          <p className="text-slate-600 text-sm">
            Replace the path with your actual project location. For Cursor, add to{' '}
            <code className="bg-slate-200 px-2 py-1 rounded">mcpServers</code> in Cursor settings.
          </p>
        </div>
      </Step>
    </section>

    {/* Usage */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Usage</h3>
      <Step number={1} title="Write Test Cases">
        <p className="text-slate-700 mb-4">
          Write BDD test cases in Gherkin format. The project includes sample test cases in{' '}
          <code className="bg-slate-200 px-2 py-1 rounded">behave-demo/features/</code> directory.
        </p>
      </Step>

      <Step number={2} title="Generate Test Code with AI">
        <p className="text-slate-700 mb-4">
          Switch to Agent mode in Copilot Chat and send a prompt with your test scenario:
        </p>
        <div className="bg-slate-50 rounded-lg p-6">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap">
            {`Scenario: Test macOS Calculator app
Given I have launched Calculator app
When I click button "5"
And I click button "+"
And I click button "3"
And I click button "="
Then The result should be "8"

Please use appium-mcp-server to execute the following instructions:
Requirements:
1. Before executing the first step, call clear_cache, and after all steps are completed, sequentially call preview_code_changes and confirm_code_change.
2. Execute each step exactly as written, in order.
3. Do not modify, merge, skip, or add any step.
4. Use only appium-mcp-server API calls.`}
          </pre>
        </div>
        <p className="text-slate-600 mt-4 text-sm">
          AI will call MCP tools to automatically generate step definition code.
        </p>
      </Step>

      <Step number={3} title="Run Tests">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 mb-3">Run a specific test scenario:</p>
          <CodeBlock>{`behave --name "Scenario Name"`}</CodeBlock>

          <p className="text-slate-700 mt-6 mb-3">More options:</p>
          <CodeBlock>
            {`# Generate JSON report
behave --format json -o reports/results.json

# Filter using tags
behave --tags=@smoke

# Verbose output
behave -v`}
          </CodeBlock>
        </div>
      </Step>
    </section>

    {/* Troubleshooting */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Troubleshooting</h3>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">Appium Server Cannot Start</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Run <code>sudo xcodebuild -runFirstLaunch</code> for WebDriverAgentMac errors</li>
            <li>Check Accessibility permissions in System Settings</li>
            <li>Verify Mac2 driver is installed with <code>appium driver install mac2</code></li>
          </ul>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">Application Not Found</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Verify the bundleId in configuration matches your application</li>
            <li>Check that the application is installed on your Mac</li>
            <li>Try launching the application manually first</li>
          </ul>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">MCP Server Issues</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Restart VS Code or Cursor</li>
            <li>Verify MCP configuration path is correct</li>
            <li>Check logs in <code>logs/mcp_server.log</code></li>
          </ul>
        </div>
      </div>
    </section>
  </div>
);

// Mobile Platform Content
const MobileContent = () => (
  <div className="space-y-12">
    {/* Prerequisites */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Prerequisites</h3>
      <div className="bg-slate-50 rounded-lg p-6">
        <ul className="list-disc list-inside space-y-2 text-slate-700">
          <li>Python 3.10 or higher</li>
          <li>VS Code or Cursor</li>
          <li>BrowserStack account (free trial available)</li>
        </ul>
      </div>
    </section>

    {/* Installation */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Installation</h3>
      <Step number={1} title="Clone the Repository">
        <CodeBlock>{`git clone https://github.com/ai-microsoft/AutoGenesis.git
cd AutoGenesis`}</CodeBlock>
      </Step>

      <Step number={2} title="Install Dependencies">
        <CodeBlock>{`pip install -r requirements.txt`}</CodeBlock>
      </Step>
    </section>

    {/* Configuration */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Configuration</h3>
      <Step number={1} title="Register for BrowserStack">
        <div className="bg-slate-50 rounded-lg p-6">
          <ol className="list-decimal list-inside space-y-2 text-slate-700">
            <li>
              Visit{' '}
              <a
                href="https://www.browserstack.com/app-automate"
                target="_blank"
                rel="noopener noreferrer"
                className="text-purple-primary hover:underline"
              >
                BrowserStack App Automate
              </a>
            </li>
            <li>Click "Start Free Trial" to register an account</li>
            <li>Find your <strong>username</strong> and <strong>access key</strong> in the Access Key page</li>
          </ol>
        </div>
      </Step>

      <Step number={2} title="Upload Your App">
        <div className="space-y-4">
          <p className="text-slate-700 mb-3">Upload via BrowserStack console or command line:</p>
          <CodeBlock>
            {`# Android APK
curl -u "username:access_key" -X POST \\
  "https://api-cloud.browserstack.com/app-automate/upload" \\
  -F "file=@/path/to/your/app.apk"

# iOS IPA
curl -u "username:access_key" -X POST \\
  "https://api-cloud.browserstack.com/app-automate/upload" \\
  -F "file=@/path/to/your/app.ipa"`}
          </CodeBlock>
          <p className="text-slate-600 mt-3 text-sm">
            After upload, you'll receive a URL like <code>bs://xxxxxx</code> - save this for configuration.
          </p>
        </div>
      </Step>

      <Step number={3} title="Configure BrowserStack Connection">
        <div className="space-y-4">
          <p className="text-slate-700 mb-3">
            Edit <code className="bg-slate-200 px-2 py-1 rounded">conf/appium_conf.json</code>:
          </p>
          <CodeBlock>
            {`{
  "android": {
    "platformName": "Android",
    "deviceName": "Google Pixel 8",
    "platformVersion": "14.0",
    "automationName": "UiAutomator2",
    "server_url": "http://hub.browserstack.com/wd/hub",
    "bstack:options": {
      "userName": "your_browserstack_username",
      "accessKey": "your_browserstack_access_key"
    },
    "appium:app": "bs://your_app_id"
  }
}`}
          </CodeBlock>
        </div>
      </Step>

      <Step number={4} title="Start MCP Server">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 mb-3">Start the MCP server:</p>
          <CodeBlock>
            {`cd appium-mcp-server
python simple_server.py --platform android`}
          </CodeBlock>
          <p className="text-slate-600 mt-3 text-sm">
            For iOS testing, use <code>--platform ios</code> instead.
          </p>
          <InfoBox variant="info">
            <p>
              <strong>Note:</strong> No local Appium server needed - BrowserStack handles the device connection in the cloud.
            </p>
          </InfoBox>
        </div>
      </Step>

      <Step number={5} title="Configure VS Code">
        <div className="space-y-4">
          <p className="text-slate-700">
            Add the following to your <code className="bg-slate-200 px-2 py-1 rounded">.vscode/settings.json</code>:
          </p>
          <CodeBlock>
            {`{
  "github.copilot.chat.mcp.servers": {
    "appium-mcp": {
      "command": "python",
      "args": [
        "/path/to/AutoGenesis/appium-mcp-server/simple_server.py",
        "--platform",
        "android"
      ]
    }
  }
}`}
          </CodeBlock>
          <p className="text-slate-600 text-sm">
            Replace the path with your actual project location. For Cursor, add to{' '}
            <code className="bg-slate-200 px-2 py-1 rounded">mcpServers</code> in Cursor settings.
          </p>
        </div>
      </Step>
    </section>

    {/* Usage */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Usage</h3>
      <Step number={1} title="Write Test Cases">
        <p className="text-slate-700 mb-4">
          Write BDD test cases in Gherkin format. The project includes sample test cases in{' '}
          <code className="bg-slate-200 px-2 py-1 rounded">behave-demo/features/</code> directory.
        </p>
      </Step>

      <Step number={2} title="Generate Test Code with AI">
        <p className="text-slate-700 mb-4">
          Switch to Agent mode in Copilot Chat and send a prompt with your test scenario:
        </p>
        <div className="bg-slate-50 rounded-lg p-6">
          <pre className="text-sm text-slate-700 whitespace-pre-wrap">
            {`Scenario: Test msn.com website on Edge
Given I have launched Edge browser
When I click the search box in NTP page
And I input "msn.com" in the search box
And I press enter to navigate to the page
And I wait for the page to load completely
Then I should see the tab with the title "msn.com"

Please use appium-mcp-server to execute the following instructions:
Requirements:
1. Before executing the first step, call clear_cache, and after all steps are completed, sequentially call preview_code_changes and confirm_code_change.
2. Execute each step exactly as written, in order.
3. Do not modify, merge, skip, or add any step.
4. Use only appium-mcp-server API calls.`}
          </pre>
        </div>
        <p className="text-slate-600 mt-4 text-sm">
          AI will call MCP tools to automatically generate step definition code.
        </p>
      </Step>

      <Step number={3} title="Run Tests">
        <div className="bg-slate-50 rounded-lg p-6">
          <p className="text-slate-700 mb-3">Run a specific test scenario:</p>
          <CodeBlock>{`behave --name "Scenario Name"`}</CodeBlock>

          <p className="text-slate-700 mt-6 mb-3">More options:</p>
          <CodeBlock>
            {`# Generate JSON report
behave --format json -o reports/results.json

# Filter using tags
behave --tags=@smoke

# Verbose output
behave -v`}
          </CodeBlock>
        </div>
      </Step>
    </section>

    {/* Troubleshooting */}
    <section>
      <h3 className="text-2xl font-bold text-slate-900 mb-4">Troubleshooting</h3>
      <div className="space-y-4">
        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">BrowserStack Connection Failed</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Verify username and access key are correct</li>
            <li>Check network connection</li>
            <li>Confirm BrowserStack account is active</li>
          </ul>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">App Upload Failed</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Ensure the app file path is correct</li>
            <li>Check if the app meets BrowserStack requirements</li>
            <li>Try uploading through the web console</li>
          </ul>
        </div>

        <div className="bg-slate-50 rounded-lg p-6">
          <h4 className="font-semibold text-slate-900 mb-2">MCP Server Issues</h4>
          <ul className="list-disc list-inside space-y-1 text-slate-700">
            <li>Restart VS Code or Cursor</li>
            <li>Verify MCP configuration path is correct</li>
            <li>Check logs in <code>logs/mcp_server.log</code></li>
          </ul>
        </div>
      </div>
    </section>
  </div>
);

export const GetStarted = () => {
  const [activePlatform, setActivePlatform] = useState<Platform>('windows');

  const platforms = [
    { 
      id: 'windows' as Platform, 
      name: 'Windows',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M0 3.449L9.75 2.1v9.451H0m10.949-9.602L24 0v11.4H10.949M0 12.6h9.75v9.451L0 20.699M10.949 12.6H24V24l-12.9-1.801" />
        </svg>
      )
    },
    { 
      id: 'macos' as Platform, 
      name: 'macOS',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.48-3.24 0-1.44.62-2.2.44-3.06-.4C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
        </svg>
      )
    },
    { 
      id: 'mobile' as Platform, 
      name: 'Mobile',
      icon: (
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
          <path d="M17 1H7c-1.1 0-2 .9-2 2v18c0 1.1.9 2 2 2h10c1.1 0 2-.9 2-2V3c0-1.1-.9-2-2-2zm0 18H7V5h10v14zm-5-1c.55 0 1-.45 1-1s-.45-1-1-1-1 .45-1 1 .45 1 1 1z"/>
        </svg>
      )
    },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-bg via-white to-primary-bg py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-16">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-2xl shadow-xl p-8 md:p-12"
        >
          <h1 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4 text-center">
            Get Started with FSQ
          </h1>
          <p className="text-slate-600 text-center mb-12 text-lg">
            AI-powered automation testing for Windows, macOS, and Mobile platforms
          </p>

          {/* Platform Tabs */}
          <div className="flex justify-center mb-8">
            <div className="inline-flex rounded-lg border border-slate-200 p-1 bg-slate-50">
              {platforms.map((platform) => (
                <button
                  key={platform.id}
                  onClick={() => setActivePlatform(platform.id)}
                  className={`px-6 py-3 rounded-md font-medium transition-all flex items-center gap-2 ${
                    activePlatform === platform.id
                      ? 'bg-purple-primary text-white shadow-sm'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {platform.icon}
                  {platform.name}
                </button>
              ))}
            </div>
          </div>

          {/* Platform Content */}
          <motion.div
            key={activePlatform}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.3 }}
          >
            {activePlatform === 'windows' && <WindowsContent />}
            {activePlatform === 'macos' && <MacOSContent />}
            {activePlatform === 'mobile' && <MobileContent />}
          </motion.div>

          {/* Success message */}
          <div className="mt-12">
            <InfoBox variant="success">
              <p>
                <strong>Congratulations!</strong> You're ready to start generating automated test
                scripts with AI. Check out the sample test cases in the project to learn more.
              </p>
            </InfoBox>
          </div>
        </motion.div>
      </div>
    </div>
  );
};
