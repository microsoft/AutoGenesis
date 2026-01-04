<!--=========================README TEMPLATE INSTRUCTIONS=============================
======================================================================================

- THIS README TEMPLATE LARGELY CONSISTS OF COMMENTED OUT TEXT. THIS UNRENDERED TEXT IS MEANT TO BE LEFT IN AS A GUIDE 
  THROUGHOUT THE REPOSITORY'S LIFE WHILE END USERS ONLY SEE THE RENDERED PAGE CONTENT. 
- Any italicized text rendered in the initial template is intended to be replaced IMMEDIATELY upon repository creation.

- This template is default but not mandatory. It was designed to compensate for typical gaps in Microsoft READMEs 
  that slow the pace of work. You may delete it if you have a fully populated README to replace it with.

- Most README sections below are commented out as they are not known early in a repository's life. Others are commented 
  out as they do not apply to every repository. If a section will be appropriate later but not known now, consider 
  leaving it in commented out and adding an issue as a reminder.
- There are additional optional README sections in the external instruction link below. These include; "citation",  
  "built with", "acknowledgments", "folder structure", etc.
- You can easily find the places to add content that will be rendered to the end user by searching 
within the file for "TODO".



- ADDITIONAL EXTERNAL TEMPLATE INSTRUCTIONS:
  -  https://aka.ms/StartRight/README-Template/Instructions

======================================================================================
====================================================================================-->


<!---------------------[  Description  ]------------------<recommended> section below------------------>

# AutoGenesis

AutoGenesis is an AI-powered automated testing framework based on Model Context Protocol (MCP), supporting multiple platforms including desktop applications (Windows/macOS) and mobile applications (iOS/Android).

## Platform-Specific Documentation

Please refer to the appropriate documentation based on your testing platform:

### 💻 Windows Testing
**Coming soon** - Windows desktop application testing documentation

Features:
- Windows desktop app automation
- Native Windows control support
- AI-assisted test script generation

### 🍎 macOS Testing
**Coming soon** - macOS desktop application testing documentation

Features:
- macOS desktop app automation
- Native macOS control support
- AI-assisted test script generation

### 📱 Mobile Testing (iOS/Android)
For mobile application testing using Appium, please see:
**[Mobile Testing Guide - MOBILE-README.md](MOBILE-README.md)**

Features:
- iOS and Android app automation
- BrowserStack cloud testing integration
- AI-assisted test script generation
- Natural language test case writing

## Quick Links

- [Contributing Guidelines](CONTRIBUTING.md)
- [Mobile Testing Setup](MOBILE-README.md)
- [License](LICENSE)

## Overview

AutoGenesis leverages the Model Context Protocol (MCP) to provide:

- **AI-Assisted Test Generation**: Generate test scripts through natural language descriptions
- **Multi-Platform Support**: Unified framework for Windows, macOS, and mobile testing
- **BDD Format**: Automatic generation of Behavior-Driven Development test cases
- **IDE Integration**: Works with VS Code, Cursor, and other AI-powered editors

## Getting Started

1. Choose your testing platform from the links above
2. Follow the platform-specific setup guide
3. Start writing test cases in natural language
4. Let AI generate the automation code

## Project Structure

    AutoGenesis/
    ├── appium-mcp-server/       # MCP server for mobile/mac automation
    │   ├── tools/               # Platform-specific driver tools
    │   ├── llm/                 # LLM integration
    │   └── utils/               # Utilities
    ├── pywinauto-mcp-server/    # MCP server for Windows automation
    │   ├── tools/               # Windows-specific automation tools
    │   ├── llm/                 # LLM integration
    │   └── utils/               # Utilities
    ├── bdd_ai_toolkit/          # VS Code extension
    │   ├── src/                 # Extension source code
    │   └── resources/           # UI resources
    └── behave-demo/             # Sample BDD tests
        └── features/            # Feature files and step definitions

## Feedback

For questions or feedback, please contact: fsqgroup@microsoft.com

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

See [LICENSE](LICENSE) for license information.
