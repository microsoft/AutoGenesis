# Mac Desktop Testing Examples

This directory contains example tests for macOS desktop applications using Appium Mac2 driver.

## Structure

```
desktop_mac/
├── features/
│   ├── textedit.feature     # TextEdit automation example
│   ├── finder.feature       # Finder automation example
│   ├── environment.py       # Behave environment setup
│   └── steps/               # Step definitions
│       └── __init__.py
└── config/
    └── mac_config.json      # Mac testing configuration
```

## Prerequisites

1. **macOS** (Ventura or later recommended)
2. **Appium** installed and running
3. **Mac2 driver** installed: `appium driver install mac2`
4. **Accessibility permissions** granted to terminal/IDE

### Enable Accessibility

1. Open System Settings > Privacy & Security > Accessibility
2. Add Terminal (or your IDE) to the list
3. Restart Appium server

## Running Tests

### With AutoGenesis CLI

```bash
# Start Appium server
appium

# In another terminal, start the MCP server
autogenesis server --platform mac --config config/mac_config.json

# Run tests
autogenesis run features/textedit.feature
```

### With Behave directly

```bash
cd examples/desktop_mac
behave features/textedit.feature
```

## Configuration

Edit `config/mac_config.json` to match your setup:

- `bundleId`: Application bundle identifier
- `server_url`: Appium server URL
- `automationName`: Must be "Mac2"

## Tips

- Use `bundleId` to identify applications
- Keyboard shortcuts use special format: `XCUIKeyboardKeyCommand+N`
- Use `get_page_source_tree` with `filter_menu=True` for cleaner UI trees
- Drag and drop is supported with `drag_element_to_element`

## Common Bundle IDs

| Application | Bundle ID |
|-------------|-----------|
| TextEdit | com.apple.TextEdit |
| Finder | com.apple.finder |
| Safari | com.apple.Safari |
| Notes | com.apple.Notes |
| Terminal | com.apple.Terminal |
| VS Code | com.microsoft.VSCode |
| Edge | com.microsoft.edgemac |
