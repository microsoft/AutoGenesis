# macOS Appium Setup Guide

## Prerequisites

- **macOS**: 10.15+ (macOS 12+ recommended)
- **Xcode Command Line Tools**: Required
- **Node.js**: 16+ 
- **Python**: 3.10+

## Setup Steps

### 1. Install Xcode Command Line Tools

```bash
# Install
xcode-select --install

# Verify
xcode-select -p
```

### 2. Initialize Xcode (Important!)

```bash
# First launch initialization
sudo xcodebuild -runFirstLaunch

# Accept license
sudo xcodebuild -license accept
```

> **Note**: This step initializes CoreSimulator framework and prevents WebDriverAgentMac startup issues.

### 3. Install Appium & Mac2 Driver

```bash
# Install Appium
npm install -g appium

# Install Mac2 driver
appium driver install mac2
```

### 4. Build WebDriverAgentMac (Optional)

```bash
# Find WebDriverAgentMac location
cd ~/.appium/node_modules/appium-mac2-driver/WebDriverAgentMac

# Build project
xcodebuild -project WebDriverAgentMac.xcodeproj \
           -scheme WebDriverAgentRunner \
           -destination 'platform=macOS' \
           build
```

### 5. Configure System Permissions

#### Accessibility Permission

1. Open **System Settings** → **Privacy & Security** → **Accessibility**
2. Click **+** and add:
   - Terminal
   - VS Code (or your IDE)

#### Screen Recording Permission (Optional)

1. **Privacy & Security** → **Screen & System Audio Recording**
2. Add the same applications

### 6. Start Appium Server

```bash
# Use the provided script (includes environment checks)
./start_appium_on_mac.sh

# Or manually
appium server --port 4723
```

## Utility Script

**`start_appium_on_mac.sh`** - All-in-one tool that:
- Checks environment prerequisites
- Validates system permissions
- Installs missing drivers automatically
- Starts Appium server with optimal settings

## Troubleshooting

**WebDriverAgentMac SIGABRT Error:**
```bash
sudo xcodebuild -runFirstLaunch
```

**Permission Issues:**
- Check Accessibility permissions in System Settings
- Restart Terminal after granting permissions

For detailed documentation, see [Appium Mac2 Driver](https://github.com/appium/appium-mac2-driver).