# Contributing to BDD AI Toolkit

Thank you for your interest in contributing! This guide will help you set up the development environment and build the extension.

---

## 🚀 Development Setup

### Prerequisites

Ensure you have the following installed:

- **Node.js** 16+ (LTS recommended)
- **npm** 7+
- **VS Code** 1.95.0+
- **Git**
- **TypeScript** 5.8+ (installed via npm)

### Getting Started

```bash
# 1. Clone the repository
git clone <repository-url>
cd bdd_ai_toolkit

# 2. Install dependencies
npm install

# 3. Compile the extension
npm run compile

# 4. Open in VS Code
code .
```

### Debug & Test

1. Open the project in VS Code
2. Press **F5** (or Run → Start Debugging)
3. A new "Extension Development Host" window will open
4. Open any `.feature` file to test CodeLens, recording, and replay features

---

## 🔨 Build & Package

### Development Build

```bash
# One-time compilation
npm run compile

# Watch mode (auto-recompile on file changes)
npm run watch
```

**Build Process:**
- TypeScript files are compiled to JavaScript
- Output is written to `out/` directory
- Source maps are generated for debugging

### Create Extension Package

To create a `.vsix` package for distribution:

```bash
npm run package
```

This generates `bdd-ai-toolkit-<version>.vsix` that can be installed in VS Code.

---

## 🔧 Utilities

### macOS Appium Setup Script

A helper script for macOS users to quickly set up Appium for mobile automation testing.

**Script**: `appium-mcp-server/docs/start_appium_on_mac.sh`

**Documentation**: [appium-mcp-server/docs/macOS_Appium_Setup_Guide.md](../appium-mcp-server/docs/macOS_Appium_Setup_Guide.md)

> **Note**: This is a convenience tool for local development, not a core extension feature.

---