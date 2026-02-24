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

**Features:**
- Windows desktop app automation
- Native Windows control support
- AI-assisted test script generation

**Get Started:**
- See [WINDOWS-README.md](pywinauto-mcp-server/WINDOWS-README.md) for detailed setup instructions

### 🍎 macOS Testing

**Features:**
- macOS desktop app automation
- Native macOS control support
- AI-assisted test script generation

**Get Started:**
- See [MAC-README.md](MAC-README.md) for detailed setup instructions

### 📱 Mobile Testing (iOS/Android)

**Features:**
- iOS and Android app automation
- BrowserStack cloud testing integration
- AI-assisted test script generation

**Get Started:**
- See [MOBILE-README.md](MOBILE-README.md) for detailed setup instructions

## Quick Links

- [Contributing Guidelines](CONTRIBUTING.md)
- [Windows Testing Setup](pywinauto-mcp-server/WINDOWS-README.md)
- [macOS Testing Setup](MAC-README.md)
- [Mobile Testing Setup](MOBILE-README.md)
- [License](LICENSE)

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

This project welcomes contributions and suggestions. Most contributions require you to agree to a Contributor License Agreement (CLA) declaring that you have the right to, and actually do, grant us the rights to use your contribution. For details, visit https://cla.opensource.microsoft.com.

When you submit a pull request, a CLA bot will automatically determine whether you need to provide a CLA and decorate the PR appropriately (e.g., status check, comment). Simply follow the instructions provided by the bot. You will only need to do this once across all repos using our CLA.

This project has adopted the [Microsoft Open Source Code of Conduct](https://opensource.microsoft.com/codeofconduct/). For more information see the [Code of Conduct FAQ](https://opensource.microsoft.com/codeofconduct/faq/) or contact [opencode@microsoft.com](mailto:opencode@microsoft.com) with any additional questions or comments.

See [CONTRIBUTING.md](CONTRIBUTING.md) for detailed contribution guidelines.

## Security

Microsoft takes the security of our software products and services seriously, which includes all source code repositories managed through our GitHub organizations, which include [Microsoft](https://github.com/Microsoft), [Azure](https://github.com/Azure), [DotNet](https://github.com/dotnet), [AspNet](https://github.com/aspnet), and [Xamarin](https://github.com/xamarin).

If you believe you have found a security vulnerability in any Microsoft-owned repository that meets [Microsoft's definition of a security vulnerability](https://aka.ms/security.md/definition), please report it to us as described below.

### Reporting Security Issues

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report them to the Microsoft Security Response Center (MSRC) at [https://msrc.microsoft.com/create-report](https://msrc.microsoft.com/create-report).

If you prefer to submit without logging in, send email to [secure@microsoft.com](mailto:secure@microsoft.com). If possible, encrypt your message with our PGP key; please download it from the [Microsoft Security Response Center PGP Key page](https://aka.ms/security.md/msrc/pgp).

You should receive a response within 24 hours. If for some reason you do not, please follow up via email to ensure we received your original message. Additional information can be found at [microsoft.com/msrc](https://www.microsoft.com/msrc).

Please include the requested information listed below (as much as you can provide) to help us better understand the nature and scope of the possible issue:

- Type of issue (e.g. buffer overflow, SQL injection, cross-site scripting, etc.)
- Full paths of source file(s) related to the manifestation of the issue
- The location of the affected source code (tag/branch/commit or direct URL)
- Any special configuration required to reproduce the issue
- Step-by-step instructions to reproduce the issue
- Proof-of-concept or exploit code (if possible)
- Impact of the issue, including how an attacker might exploit the issue

This information will help us triage your report more quickly.

## Trademarks

This project may contain trademarks or logos for projects, products, or services. Authorized use of Microsoft trademarks or logos is subject to and must follow [Microsoft's Trademark & Brand Guidelines](https://www.microsoft.com/en-us/legal/intellectualproperty/trademarks/usage/general). Use of Microsoft trademarks or logos in modified versions of this project must not cause confusion or imply Microsoft sponsorship. Any use of third-party trademarks or logos are subject to those third-party's policies.

## License

See [LICENSE](LICENSE) for license information.
