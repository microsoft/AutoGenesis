# BDD AI Toolkit

[![Version](https://img.shields.io/badge/version-1.2.43-blue.svg)](https://marketplace.visualstudio.com/)
[![VS Code](https://img.shields.io/badge/VS%20Code-1.95.0+-007ACC.svg)](https://code.visualstudio.com/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

AI-powered VS Code extension for BDD test automation. **Record** test scenarios with AI assistance and **Replay** them instantly - no manual coding required!

## ✨ Features

- 🎥 **AI-Powered Recording** - Write Gherkin scenarios, let AI generate automation code
- ▶️ **One-Click Replay** - Execute recorded scenarios directly from feature files
- 🔧 **Multi-Platform Support** - Windows (browser), Appium (macOS & Mobile)
- 🤖 **MCP Integration** - Seamless GitHub Copilot connection via Model Context Protocol
- 🎯 **Interactive CodeLens** - Record and replay buttons above each scenario
- 📝 **Natural Language Tasks** - Execute automation from plain English descriptions

> 👨‍💻 **For Developers**: See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup and contribution guidelines.

---

## 🚀 Setup Guide

### Step 1: Install Extension

Open VS Code Extensions (`Ctrl+Shift+X` / `Cmd+Shift+X`) → Search "BDD AI Toolkit" → Install

### Step 2: Setup Environment

1. **Open Setup Panel**
   
   Click the BDD AI Toolkit icon in the Activity Bar (left sidebar)

2. **Auto-Resolve Environment**
   
   The setup panel will automatically detect and resolve environment issues:
   - Python installation
   - Node.js installation
   - Required dependencies
   
   Click **"Auto-Resolve"** if any issues are detected

3. **Choose Platform & Click Setup**
   
   Select your target platform:
   - **Windows** - Browser automation
   - **Appium** - For macOS and mobile testing (iOS/Android)
   
   Click **"Setup"** button to configure the selected platform

   > **macOS users**: Before using Appium, you need to manually start the Appium server first. Run the provided script:
   > ```bash
   > cd appium-mcp-server/docs
   > ./start_appium_on_mac.sh
   > ```
   > For detailed setup instructions, see [macOS Appium Setup Guide](../appium-mcp-server/docs/macOS_Appium_Setup_Guide.md).

4. **Configure Automation Platform**
   
   Open `bdd_ai_conf.json` in the project root and update the configuration for your target platform, such as:
   - Account credentials (e.g. BrowserStack `userName`, `accessKey`)
   - App `bundleId` or `appPackage`/`appActivity`
   - Device name, platform version, etc.

5. **Open MCP Configuration File**
   
   Click **"Open"** button to view/edit the MCP configuration file
   
   The config file will be opened in the editor

6. **Start MCP Server**
   
   In the opened configuration file, click the **"Start"** button (CodeLens action)
   
   This launches the MCP server

7. **Verify Connection in GitHub Copilot**
   
   - Open GitHub Copilot Chat
   - Check MCP connections panel
   - Confirm "BDD AI Toolkit MCP" is connected

### Step 3: Record & Replay

Now you're ready to use AI-powered test automation!

**Recording** (AI generates code):
1. Create/open a `.feature` file
2. Write your scenario in Gherkin
3. Click **"Send to Copilot"** above the scenario
4. AI generates automation code automatically

> If `.github/skills/autoGenesis-run/SKILL.md` exists in the workspace, the extension sends `/autoGenesis-run <Scenario Name>` to Copilot instead of the default prompt.

**Replaying** (Execute tests):
1. Open a `.feature` file with recorded scenarios
2. Click **"Run"** above any scenario
3. Watch the automation execute!

---

## 🎯 Advanced Features

### Natural Language Tasks

Execute ad-hoc automation without writing scenarios:

**Command**: `BDD AI Toolkit: Execute Natural Language Task`

**Example**: 
```
"Open Chrome, go to google.com, search for 'AI testing', click first result"
```

AI converts your description to automation and executes immediately.

### Custom Copilot Prompt

Customize how AI generates code:

```json
{
  "bddAiToolkit.cucumber.copilotPrompt": "Generate step definitions for:\n\n${scenario_text}\n\nFile: ${feature_file_path}\n\nUse Behave framework and follow PEP 8 style."
}
```

**Available placeholders**:
- `${scenario_text}` - Full scenario content
- `${feature_file_path}` - Path to feature file

> **Note**: This prompt is used as fallback when the `autoGenesis-run` skill is not present in the workspace.

---



## 📚 Resources

- 🐛 [Report Issues](https://github.com/microsoft/vscode-extension-samples/issues)
- 💡 [Feature Requests](https://github.com/microsoft/vscode-extension-samples/discussions)
- 📖 [Gherkin Syntax Guide](https://cucumber.io/docs/gherkin/)
- 📖 [Behave Documentation](https://behave.readthedocs.io/)

---

## 📄 License

MIT License - See [LICENSE](LICENSE)

---

**Happy Testing! 🎉**
