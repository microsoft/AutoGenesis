# Mobile Testing Examples

This directory contains example tests for iOS and Android mobile applications.

## Structure

```
mobile/
├── features/
│   ├── login.feature        # Login scenario examples
│   ├── environment.py       # Behave environment setup
│   └── steps/               # Step definitions
│       └── __init__.py
└── config/
    └── mobile_config.json   # Mobile testing configuration
```

## Prerequisites

1. **Appium Server** running on `http://127.0.0.1:4723`
2. **iOS**: Xcode and iOS Simulator, or real device
3. **Android**: Android SDK and Emulator, or real device

## Running Tests

### With AutoGenesis CLI

```bash
# Start the MCP server
autogenesis server --platform mobile --config config/mobile_config.json

# Run tests
autogenesis run features/login.feature
```

### With Behave directly

```bash
cd examples/mobile
behave features/login.feature
```

### Generate Step Definitions with Claude Code

1. Start AutoGenesis MCP server
2. Open Claude Code
3. Ask Claude to execute the test steps and generate code:
   ```
   Execute the login test in features/login.feature and generate step definitions
   ```

## Configuration

Edit `config/mobile_config.json` to match your setup:

- `server_url`: Appium server URL
- `platformName`: iOS or Android
- `deviceName`: Device or simulator name
- `app`: Path to .ipa or .apk file

## Tips

- Use `accessibility_id` locators for cross-platform compatibility
- Run `get_page_source_tree` to explore available elements
- Use `verify_visual_task` for AI-powered visual verification
