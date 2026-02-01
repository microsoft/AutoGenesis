# AutoGenesis Setup Guide / 安装配置指南

[English](#english) | [中文](#中文)

---

<a name="english"></a>
# English

## Prerequisites

Before installing AutoGenesis, ensure you have the following:

| Requirement | Version | Notes |
|-------------|---------|-------|
| Python | 3.9+ | Required |
| Node.js | 16+ | For Appium installation |
| Appium | 2.0+ | For mobile/Mac testing |
| Git | Any | For script self-healing |

### Platform-Specific Requirements

**Mobile Testing (iOS)**:
- macOS with Xcode installed
- iOS Simulator or physical device
- Apple Developer account (for physical devices)

**Mobile Testing (Android)**:
- Android SDK installed
- Android Emulator or physical device
- USB debugging enabled (for physical devices)

**Mac Desktop Testing**:
- macOS 10.15+
- Accessibility permissions granted

**Windows Desktop Testing**:
- Windows 10/11
- pywinauto compatible application

---

## Installation

### Step 1: Clone the Repository

```bash
git clone https://github.com/anthropics/autogenesis.git
cd autogenesis
```

### Step 2: Create Virtual Environment (Recommended)

```bash
python -m venv venv

# On macOS/Linux
source venv/bin/activate

# On Windows
.\venv\Scripts\activate
```

### Step 3: Install Python Dependencies

```bash
pip install -r requirements.txt
```

### Step 4: Install Appium (for Mobile/Mac Testing)

```bash
# Install Appium globally
npm install -g appium

# Install platform drivers
appium driver install xcuitest    # iOS
appium driver install uiautomator2  # Android
appium driver install mac2        # macOS
```

### Step 5: Verify Installation

```bash
# Check Appium installation
appium --version

# Check drivers
appium driver list --installed

# Test the unified server
python servers/unified_mcp_server.py --help
```

---

## Configuration

### Step 1: Copy Configuration Template

```bash
cp conf/autogenesis_conf.json conf/my_config.json
```

### Step 2: Edit Configuration

Edit `conf/my_config.json` based on your testing needs:

#### Mobile Configuration (iOS)

```json
{
  "mobile": {
    "ios": {
      "platformName": "iOS",
      "deviceName": "iPhone 15 Pro",
      "platformVersion": "17.0",
      "automationName": "XCUITest",
      "server_url": "http://127.0.0.1:4723",
      "appium:app": "/path/to/your/app.ipa"
    }
  }
}
```

#### Mobile Configuration (Android)

```json
{
  "mobile": {
    "android": {
      "platformName": "Android",
      "deviceName": "Pixel 8",
      "platformVersion": "14.0",
      "automationName": "UiAutomator2",
      "server_url": "http://127.0.0.1:4723",
      "appium:app": "/path/to/your/app.apk"
    }
  }
}
```

#### Mac Desktop Configuration

```json
{
  "mac": {
    "platformName": "Mac",
    "automationName": "Mac2",
    "bundleId": "com.example.yourapp",
    "server_url": "http://127.0.0.1:4723"
  }
}
```

#### Windows Desktop Configuration

```json
{
  "windows": {
    "app_name": "YourApp",
    "exe": "C:\\Program Files\\YourApp\\app.exe",
    "window_title_re": "YourApp.*"
  }
}
```

---

## Running AutoGenesis

### Option A: With Claude Code (Recommended)

1. Add to your Claude Code settings (`~/.claude/settings.json`):

```json
{
  "mcpServers": {
    "autogenesis": {
      "command": "python",
      "args": [
        "/path/to/AutoGenesis/servers/unified_mcp_server.py",
        "--transport", "stdio",
        "--config", "/path/to/AutoGenesis/conf/my_config.json"
      ],
      "env": {
        "PYTHONPATH": "/path/to/AutoGenesis"
      }
    }
  }
}
```

2. Restart Claude Code

3. Start testing with natural language:
   ```
   You: Launch the iOS app and tap the login button
   ```

### Option B: Standalone MCP Server

```bash
# Start Appium first (for mobile/Mac)
appium &

# Start the unified MCP server
python servers/unified_mcp_server.py --transport sse --config conf/my_config.json

# Or specify platforms
python servers/unified_mcp_server.py --platform mobile --platform mac --transport sse
```

### Option C: Run Recorded Tests with Behave

```bash
# Run all tests
behave features/

# Run specific feature
behave features/login.feature

# Run specific scenario
behave features/login.feature --name "Login with valid credentials"
```

---

## Platform-Specific Setup

### iOS Setup

1. **Install Xcode**:
   ```bash
   xcode-select --install
   ```

2. **Start iOS Simulator**:
   ```bash
   open -a Simulator
   ```

3. **Or connect physical device**:
   - Enable Developer Mode on device
   - Trust the computer when prompted

4. **Start Appium**:
   ```bash
   appium
   ```

### Android Setup

1. **Set ANDROID_HOME**:
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
   ```

2. **Start Android Emulator**:
   ```bash
   emulator -avd Your_AVD_Name
   ```

3. **Or connect physical device**:
   ```bash
   adb devices  # Verify device is connected
   ```

4. **Start Appium**:
   ```bash
   appium
   ```

### Mac Desktop Setup

1. **Grant Accessibility Permissions**:
   - System Preferences → Security & Privacy → Privacy → Accessibility
   - Add Terminal (or your IDE)

2. **Install Mac2 Driver**:
   ```bash
   appium driver install mac2
   ```

3. **Start Appium**:
   ```bash
   appium
   ```

4. **Configure bundleId**:
   ```bash
   # Find your app's bundle ID
   osascript -e 'id of app "YourAppName"'
   ```

### Windows Desktop Setup

1. **Install pywinauto** (included in requirements.txt):
   ```bash
   pip install pywinauto
   ```

2. **Find Window Title**:
   - Use Spy++ or Inspect.exe to find window properties
   - Or use Python:
     ```python
     from pywinauto import Desktop
     windows = Desktop(backend="uia").windows()
     for w in windows:
         print(w.window_text())
     ```

---

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| Appium server not starting | Check if port 4723 is available: `lsof -i :4723` |
| Device not found | Verify device is connected: `adb devices` or check Simulator |
| Element not found | Use `get_page_source_tree` to see available elements |
| Permission denied (Mac) | Grant Accessibility permissions in System Preferences |
| Import errors | Ensure PYTHONPATH includes AutoGenesis root |

### Debug Mode

Run with verbose logging:

```bash
# Set log level
export LOG_LEVEL=DEBUG

# Run server
python servers/unified_mcp_server.py --transport stdio
```

### Verify MCP Connection

```bash
# Test server starts correctly
python -c "
import sys
sys.path.insert(0, '.')
from servers.unified_mcp_server import mcp
print('MCP server loaded successfully')
"
```

---

## Next Steps

1. Read the [Claude Code Integration Guide](../ide_integrations/claude_code/README.md)
2. Try the [Example Tests](../examples/)
3. Learn about [BDD Test Recording](./BDD-GUIDE.md)
4. Explore [Failure Analysis & Self-Healing](./HEALING-GUIDE.md)

---

<a name="中文"></a>
# 中文

## 环境要求

在安装 AutoGenesis 之前，请确保您具备以下条件：

| 要求 | 版本 | 说明 |
|------|------|------|
| Python | 3.9+ | 必需 |
| Node.js | 16+ | 用于安装 Appium |
| Appium | 2.0+ | 用于移动端/Mac 测试 |
| Git | 任意版本 | 用于脚本自愈功能 |

### 平台特定要求

**移动端测试 (iOS)**：
- 已安装 Xcode 的 macOS 系统
- iOS 模拟器或真机
- Apple 开发者账号（真机测试需要）

**移动端测试 (Android)**：
- 已安装 Android SDK
- Android 模拟器或真机
- 已启用 USB 调试（真机测试需要）

**Mac 桌面测试**：
- macOS 10.15+
- 已授予辅助功能权限

**Windows 桌面测试**：
- Windows 10/11
- pywinauto 兼容的应用程序

---

## 安装步骤

### 第 1 步：克隆仓库

```bash
git clone https://github.com/anthropics/autogenesis.git
cd autogenesis
```

### 第 2 步：创建虚拟环境（推荐）

```bash
python -m venv venv

# macOS/Linux
source venv/bin/activate

# Windows
.\venv\Scripts\activate
```

### 第 3 步：安装 Python 依赖

```bash
pip install -r requirements.txt
```

### 第 4 步：安装 Appium（移动端/Mac 测试需要）

```bash
# 全局安装 Appium
npm install -g appium

# 安装平台驱动
appium driver install xcuitest      # iOS
appium driver install uiautomator2  # Android
appium driver install mac2          # macOS
```

### 第 5 步：验证安装

```bash
# 检查 Appium 安装
appium --version

# 检查驱动
appium driver list --installed

# 测试统一服务器
python servers/unified_mcp_server.py --help
```

---

## 配置

### 第 1 步：复制配置模板

```bash
cp conf/autogenesis_conf.json conf/my_config.json
```

### 第 2 步：编辑配置

根据您的测试需求编辑 `conf/my_config.json`：

#### 移动端配置 (iOS)

```json
{
  "mobile": {
    "ios": {
      "platformName": "iOS",
      "deviceName": "iPhone 15 Pro",
      "platformVersion": "17.0",
      "automationName": "XCUITest",
      "server_url": "http://127.0.0.1:4723",
      "appium:app": "/path/to/your/app.ipa"
    }
  }
}
```

#### 移动端配置 (Android)

```json
{
  "mobile": {
    "android": {
      "platformName": "Android",
      "deviceName": "Pixel 8",
      "platformVersion": "14.0",
      "automationName": "UiAutomator2",
      "server_url": "http://127.0.0.1:4723",
      "appium:app": "/path/to/your/app.apk"
    }
  }
}
```

#### Mac 桌面配置

```json
{
  "mac": {
    "platformName": "Mac",
    "automationName": "Mac2",
    "bundleId": "com.example.yourapp",
    "server_url": "http://127.0.0.1:4723"
  }
}
```

#### Windows 桌面配置

```json
{
  "windows": {
    "app_name": "YourApp",
    "exe": "C:\\Program Files\\YourApp\\app.exe",
    "window_title_re": "YourApp.*"
  }
}
```

---

## 运行 AutoGenesis

### 方式 A：通过 Claude Code 使用（推荐）

1. 在 Claude Code 设置中添加 (`~/.claude/settings.json`)：

```json
{
  "mcpServers": {
    "autogenesis": {
      "command": "python",
      "args": [
        "/path/to/AutoGenesis/servers/unified_mcp_server.py",
        "--transport", "stdio",
        "--config", "/path/to/AutoGenesis/conf/my_config.json"
      ],
      "env": {
        "PYTHONPATH": "/path/to/AutoGenesis"
      }
    }
  }
}
```

2. 重启 Claude Code

3. 用自然语言开始测试：
   ```
   用户：启动 iOS 应用并点击登录按钮
   ```

### 方式 B：独立运行 MCP 服务器

```bash
# 首先启动 Appium（移动端/Mac 测试需要）
appium &

# 启动统一 MCP 服务器
python servers/unified_mcp_server.py --transport sse --config conf/my_config.json

# 或指定平台
python servers/unified_mcp_server.py --platform mobile --platform mac --transport sse
```

### 方式 C：用 Behave 运行已录制的测试

```bash
# 运行所有测试
behave features/

# 运行特定功能
behave features/login.feature

# 运行特定场景
behave features/login.feature --name "使用有效凭据登录"
```

---

## 平台特定设置

### iOS 设置

1. **安装 Xcode**：
   ```bash
   xcode-select --install
   ```

2. **启动 iOS 模拟器**：
   ```bash
   open -a Simulator
   ```

3. **或连接真机**：
   - 在设备上启用开发者模式
   - 提示时信任此电脑

4. **启动 Appium**：
   ```bash
   appium
   ```

### Android 设置

1. **设置 ANDROID_HOME**：
   ```bash
   export ANDROID_HOME=$HOME/Library/Android/sdk
   export PATH=$PATH:$ANDROID_HOME/tools:$ANDROID_HOME/platform-tools
   ```

2. **启动 Android 模拟器**：
   ```bash
   emulator -avd Your_AVD_Name
   ```

3. **或连接真机**：
   ```bash
   adb devices  # 验证设备已连接
   ```

4. **启动 Appium**：
   ```bash
   appium
   ```

### Mac 桌面设置

1. **授予辅助功能权限**：
   - 系统偏好设置 → 安全性与隐私 → 隐私 → 辅助功能
   - 添加终端（或您的 IDE）

2. **安装 Mac2 驱动**：
   ```bash
   appium driver install mac2
   ```

3. **启动 Appium**：
   ```bash
   appium
   ```

4. **配置 bundleId**：
   ```bash
   # 查找应用的 bundle ID
   osascript -e 'id of app "应用名称"'
   ```

### Windows 桌面设置

1. **安装 pywinauto**（已包含在 requirements.txt 中）：
   ```bash
   pip install pywinauto
   ```

2. **查找窗口标题**：
   - 使用 Spy++ 或 Inspect.exe 查找窗口属性
   - 或使用 Python：
     ```python
     from pywinauto import Desktop
     windows = Desktop(backend="uia").windows()
     for w in windows:
         print(w.window_text())
     ```

---

## 故障排除

### 常见问题

| 问题 | 解决方案 |
|------|----------|
| Appium 服务器无法启动 | 检查端口 4723 是否可用：`lsof -i :4723` |
| 找不到设备 | 验证设备已连接：`adb devices` 或检查模拟器 |
| 找不到元素 | 使用 `get_page_source_tree` 查看可用元素 |
| 权限被拒绝（Mac） | 在系统偏好设置中授予辅助功能权限 |
| 导入错误 | 确保 PYTHONPATH 包含 AutoGenesis 根目录 |

### 调试模式

使用详细日志运行：

```bash
# 设置日志级别
export LOG_LEVEL=DEBUG

# 运行服务器
python servers/unified_mcp_server.py --transport stdio
```

### 验证 MCP 连接

```bash
# 测试服务器是否正常启动
python -c "
import sys
sys.path.insert(0, '.')
from servers.unified_mcp_server import mcp
print('MCP 服务器加载成功')
"
```

---

## 后续步骤

1. 阅读 [Claude Code 集成指南](../ide_integrations/claude_code/README.md)
2. 尝试 [示例测试](../examples/)
3. 了解 [BDD 测试录制](./BDD-GUIDE.md)
4. 探索 [失败分析与自愈功能](./HEALING-GUIDE.md)

---

## 快速参考

### 常用命令

```bash
# 启动 Appium
appium

# 启动 MCP 服务器（所有平台）
python servers/unified_mcp_server.py --transport stdio

# 启动 MCP 服务器（特定平台）
python servers/unified_mcp_server.py --platform mac --transport stdio

# 运行 BDD 测试
behave features/

# 查看设备
adb devices          # Android
xcrun simctl list    # iOS 模拟器
```

### 配置文件位置

| 文件 | 用途 |
|------|------|
| `conf/autogenesis_conf.json` | 主配置文件 |
| `~/.claude/settings.json` | Claude Code MCP 配置 |
| `features/*.feature` | BDD 测试场景 |
| `features/steps/*.py` | 步骤定义代码 |
