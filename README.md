# AutoGenesis

AutoGenesis is an AI-powered automated testing framework built on the Model Context Protocol (MCP). It provides a unified agent that can test any client application - desktop (Windows/macOS) and mobile (iOS/Android) - with intelligent failure analysis and self-healing capabilities.

## Key Features

- **Unified AI Agent**: Single interface to test across all platforms
- **Record-Playback Architecture**: AI records tests once, deterministic playback thereafter
- **BDD Integration**: Native Behave/Gherkin support with automatic step generation
- **Failure Analysis**: Intelligent classification of test failures
- **Script Self-Healing**: Automatic fix of broken locators with Git-based confirmation
- **Multiple Integration Options**: Claude Code, VS Code, or CLI

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Unified AI Agent                       │
│  ┌─────────────────────────────────────────────────┐   │
│  │           AgentCoordinator (Core)                │   │
│  │  • Task Routing • Context Management • Skills    │   │
│  └─────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   Agent Skills                          │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐   │
│  │ Mobile   │ │ Desktop  │ │ Desktop  │ │ Web      │   │
│  │ Skill    │ │ Windows  │ │ Mac      │ │ Skill    │   │
│  │(iOS/     │ │ Skill    │ │ Skill    │ │(Future)  │   │
│  │Android)  │ │          │ │          │ │          │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘   │
└─────────────────────────────────────────────────────────┘
                          │
┌─────────────────────────▼───────────────────────────────┐
│                   MCP Server                            │
│  unified_mcp_server.py                                  │
│  • stdio/SSE Transport • Claude Code • VS Code         │
└─────────────────────────────────────────────────────────┘
```

## Quick Start

### Installation

```bash
# Clone the repository
git clone https://github.com/anthropics/autogenesis.git
cd autogenesis

# Install dependencies
pip install -r requirements.txt
```

### Configuration

Copy and customize the configuration file:

```bash
cp conf/autogenesis_conf.json conf/my_config.json
# Edit my_config.json with your platform settings
```

### Running the MCP Server

```bash
# Run with all platforms
python servers/unified_mcp_server.py --transport stdio

# Run with specific platforms
python servers/unified_mcp_server.py --platform mobile --platform mac
```

### Claude Code Integration

Add to your Claude Code settings:

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

See [Claude Code Integration Guide](ide_integrations/claude_code/README.md) for detailed setup.

## Platform Support

### Mobile Testing (iOS/Android)

- Appium-based automation
- BrowserStack cloud testing integration
- Native app automation
- Visual verification with AI

See [Mobile Testing Setup](docs/MOBILE-README.md) for details.

### Desktop Windows Testing

- pywinauto-based automation
- Native Windows control support
- Screenshot capture
- Element interaction and verification

### Desktop Mac Testing

- Appium Mac2 driver
- Native macOS control support
- Keyboard shortcuts
- Drag and drop operations

## Core Workflow: Record-Playback

AutoGenesis separates test creation from execution:

### Phase 1: AI-Assisted Recording

```
1. Call before_gen_code(feature_file, step_file)
2. AI executes test steps via MCP tools
3. Each action is recorded to gen_code_cache
4. Call preview_code_changes() to review
5. Call confirm_code_changes() to save
```

### Phase 2: Deterministic Playback

```bash
# Run tests directly with Behave - no LLM needed
behave features/login.feature
```

Benefits:
- No LLM hallucination during playback
- Fast execution (no API calls)
- Repeatable, predictable results
- CI/CD pipeline ready

## Failure Analysis & Self-Healing

When tests fail, AutoGenesis provides intelligent analysis:

### Failure Classification

| Type | Description | Action |
|------|-------------|--------|
| `SCRIPT_ISSUE` | Locator/timing problems | Auto-healable |
| `PRODUCT_BUG` | Product defects | Report as bug |
| `ENVIRONMENT` | Infrastructure issues | Retry/fix env |
| `UNDETERMINED` | Unknown cause | Manual review |

### Script Self-Healing

1. Detects broken locators
2. Finds alternatives in current UI
3. Creates Git branch with fix
4. User reviews and merges

```bash
# Example heal branch
git merge autogenesis/heal/login_button_20240130
```

## Project Structure

```
AutoGenesis/
├── core/                           # Core shared functionality
│   ├── agent/                      # AI Agent coordinator
│   ├── llm/                        # LLM integration
│   ├── utils/                      # Shared utilities
│   ├── bdd/                        # BDD code generation
│   └── analysis/                   # Failure analysis & healing
│
├── skills/                         # Platform skills
│   ├── base_skill.py               # Abstract base class
│   ├── mobile_skill/               # iOS/Android testing
│   ├── desktop_windows_skill/      # Windows testing
│   └── desktop_mac_skill/          # Mac testing
│
├── servers/                        # MCP servers
│   └── unified_mcp_server.py       # Single entry point
│
├── ide_integrations/               # IDE support
│   ├── claude_code/                # Claude Code templates
│   └── vscode_extension/           # VS Code extension
│
├── conf/                           # Configuration
│   └── autogenesis_conf.json       # Unified config
│
└── examples/                       # Sample tests
    ├── mobile/
    ├── desktop_windows/
    └── desktop_mac/
```

## Available Tools

### BDD Code Generation

| Tool | Description |
|------|-------------|
| `before_gen_code` | Initialize recording session |
| `preview_code_changes` | Preview generated code |
| `confirm_code_changes` | Save step definitions |

### Mobile Tools

| Tool | Description |
|------|-------------|
| `app_launch` | Launch mobile app |
| `app_close` | Close mobile app |
| `click_element` | Tap element |
| `send_keys` | Enter text |
| `swipe` | Perform swipe |
| `verify_visual_task` | AI visual verification |

### Windows Tools

| Tool | Description |
|------|-------------|
| `app_launch` | Launch Windows app |
| `element_click` | Click element |
| `send_keystrokes` | Keyboard input |
| `enter_text` | Text entry |
| `app_screenshot` | Capture screenshot |

### Mac Tools

| Tool | Description |
|------|-------------|
| `app_launch` | Launch Mac app |
| `click_element` | Click element |
| `send_keys_on_macos` | Text entry |
| `press_key` | Keyboard shortcut |
| `drag_element_to_element` | Drag and drop |

## Documentation

- [Claude Code Integration](ide_integrations/claude_code/README.md)
- [Mobile Testing Setup](docs/MOBILE-README.md)
- [Mac Platform Guide](docs/MAC-README.md)
- [Contributing Guidelines](CONTRIBUTING.md)

## Requirements

- Python 3.9+
- Appium 2.0+ (for mobile/Mac)
- pywinauto (for Windows)
- Behave (for BDD)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidelines.

## License

See [LICENSE](LICENSE) for license information.

## Support

- GitHub Issues: https://github.com/anthropics/autogenesis/issues
