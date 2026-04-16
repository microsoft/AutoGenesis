#!/bin/bash

# macOS Appium Server Startup Script
# Utility tool for BDD AI Toolkit
# Includes comprehensive environment checks and server startup

echo "=== macOS Appium Environment Checker & Server Launcher ==="
echo

# Color definitions
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Track errors
ERRORS=0

# 1. Check Accessibility Permission
echo "📋 1. Checking Accessibility Permission..."
if osascript -e 'tell application "System Events" to get name of first process whose frontmost is true' 2>/dev/null; then
    echo -e "   ✅ ${GREEN}Accessibility: Granted${NC}"
else
    echo -e "   ❌ ${RED}Accessibility: Not granted${NC}"
    echo -e "   ${YELLOW}   Solution: System Settings > Privacy & Security > Accessibility${NC}"
    echo -e "   ${YELLOW}   Add: Terminal, VS Code, etc.${NC}"
    ((ERRORS++))
fi

# 2. Check Xcode Environment
echo -e "\n📋 2. Checking Xcode Environment..."
if xcode-select -p &>/dev/null; then
    echo -e "   ✅ ${GREEN}Xcode Command Line Tools: Installed${NC}"
else
    echo -e "   ❌ ${RED}Xcode Command Line Tools: Not installed${NC}"
    echo -e "   ${YELLOW}   Solution: xcode-select --install${NC}"
    ((ERRORS++))
fi

if xcodebuild -license check &>/dev/null; then
    echo -e "   ✅ ${GREEN}Xcode License: Accepted${NC}"
else
    echo -e "   ⚠️  ${YELLOW}Xcode License: Not accepted${NC}"
    echo -e "   ${YELLOW}   Solution: sudo xcodebuild -license accept${NC}"
fi

# 3. Check Node.js and Appium
echo -e "\n📋 3. Checking Node.js and Appium..."
if command -v node &>/dev/null; then
    NODE_VERSION=$(node --version)
    echo -e "   ✅ ${GREEN}Node.js: $NODE_VERSION${NC}"
else
    echo -e "   ❌ ${RED}Node.js: Not installed${NC}"
    echo -e "   ${YELLOW}   Solution: brew install node${NC}"
    ((ERRORS++))
fi

if ! command -v appium &> /dev/null; then
    echo -e "   ❌ ${RED}Appium: Not installed${NC}"
    echo -e "   ${YELLOW}   Solution: npm install -g appium${NC}"
    ((ERRORS++))
else
    echo -e "   ✅ ${GREEN}Appium: $(appium --version)${NC}"
fi

# 4. Check Mac2 driver
echo -e "\n📋 4. Checking Mac2 Driver..."
if command -v appium &>/dev/null; then
    MAC2_OUTPUT=$(appium driver list 2>&1)
    if echo "$MAC2_OUTPUT" | grep -q "mac2.*installed"; then
        MAC2_INFO=$(appium driver list 2>&1 | grep "mac2" | head -1 | sed 's/^.*- //')
        echo -e "   ✅ ${GREEN}Mac2 Driver: Installed${NC}"
        echo -e "   📍 Version: $MAC2_INFO"
    else
        echo -e "   ❌ ${RED}Mac2 Driver: Not installed${NC}"
        echo -e "   ${YELLOW}Installing Mac2 driver...${NC}"
        appium driver install mac2
        if [ $? -eq 0 ]; then
            echo -e "   ✅ ${GREEN}Mac2 driver installed successfully${NC}"
        else
            echo -e "   ❌ ${RED}Mac2 driver installation failed${NC}"
            ((ERRORS++))
        fi
    fi
fi

# 5. Check Python Environment (Optional)
echo -e "\n📋 5. Checking Python Environment (Optional)..."
if command -v python3 &>/dev/null; then
    PYTHON_VERSION=$(python3 --version)
    echo -e "   ✅ ${GREEN}Python: $PYTHON_VERSION${NC}"
    
    # Check Appium-Python-Client
    if python3 -c "import appium" 2>/dev/null; then
        echo -e "   ✅ ${GREEN}Appium-Python-Client: Installed${NC}"
    else
        echo -e "   ⚠️  ${YELLOW}Appium-Python-Client: Not installed (optional)${NC}"
        echo -e "   ${YELLOW}   Install: uv add appium-python-client${NC}"
    fi
else
    echo -e "   ⚠️  ${YELLOW}Python3: Not installed (optional for Python tests)${NC}"
fi

# Check Screen Recording Permission (Optional)
echo -e "\n📋 6. Checking Screen Recording Permission (Optional)..."
if screencapture -x -t png /tmp/test_screenshot.png 2>/dev/null && [ -f /tmp/test_screenshot.png ]; then
    echo -e "   ✅ ${GREEN}Screen Recording: Granted${NC}"
    rm -f /tmp/test_screenshot.png 2>/dev/null
else
    echo -e "   ⚠️  ${YELLOW}Screen Recording: Not granted (optional for screenshots)${NC}"
    echo -e "   ${YELLOW}   Enable in: System Settings > Privacy & Security${NC}"
fi

# Summary
echo -e "\n=========================================="
if [[ $ERRORS -gt 0 ]]; then
    echo -e "⚠️  ${YELLOW}Found $ERRORS critical issue(s).${NC}"
    echo -e "${YELLOW}Please fix the issues above before starting Appium.${NC}"
    echo -e "\n${BLUE}Common Solutions:${NC}"
    echo -e "${YELLOW}For WebDriverAgentMac issues:${NC}"
    echo "  sudo xcodebuild -runFirstLaunch"
    echo -e "\n${YELLOW}For permissions:${NC}"
    echo "  System Settings > Privacy & Security > Accessibility"
    exit 1
else
    echo -e "🎉 ${GREEN}All critical checks passed!${NC}"
fi

# Check port availability
PORT=4723
echo -e "\n📋 7. Checking Port Availability..."
if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
    echo -e "   ${YELLOW}⚠️  Port $PORT is in use${NC}"
    
    read -p "Kill existing Appium process? (y/n): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        echo -e "   ${YELLOW}Stopping existing process...${NC}"
        pkill -f appium
        sleep 3
        
        if lsof -Pi :$PORT -sTCP:LISTEN -t >/dev/null ; then
            echo -e "   ${RED}❌ Cannot stop existing process${NC}"
            exit 1
        else
            echo -e "   ${GREEN}✅ Process stopped${NC}"
        fi
    else
        echo -e "   ${RED}❌ Port $PORT is occupied${NC}"
        echo -e "   ${YELLOW}Please stop the existing process manually:${NC}"
        echo -e "   ${BLUE}1. Find process: lsof -i :$PORT${NC}"
        echo -e "   ${BLUE}2. Kill process: kill -9 <PID>${NC}"
        echo -e "   ${BLUE}Or use: pkill -f appium${NC}"
        exit 1
    fi
else
    echo -e "   ✅ ${GREEN}Port $PORT available${NC}"
fi

# Create log directory
LOG_DIR="./logs"
if [ ! -d "$LOG_DIR" ]; then
    mkdir -p "$LOG_DIR"
    echo -e "${GREEN}✅ Created log directory: $LOG_DIR${NC}"
fi

# Generate log filename
LOG_FILE="$LOG_DIR/appium_$(date +%Y%m%d_%H%M%S).log"

echo -e "\n${BLUE}🚀 Starting Appium server...${NC}"
echo -e "${BLUE}Port: $PORT${NC}"
echo -e "${BLUE}Log file: $LOG_FILE${NC}"
echo -e "${BLUE}Stop: Ctrl+C${NC}"
echo

# Startup arguments
APPIUM_ARGS=(
    "server"
    "--port" "$PORT"
    "--log-level" "info"
    "--log-timestamp"
    "--local-timezone"
    "--log" "$LOG_FILE"
    "--relaxed-security"
    "--allow-insecure" "chromedriver_autodownload"
    "--session-override"
)

# 8. Check WebDriverAgentMac build status
echo -e "\n📋 8. Checking WebDriverAgentMac Build..."
WDA_PATH=$(find ~/.appium -name "WebDriverAgentMac" -type d 2>/dev/null | head -1)
if [[ -n "$WDA_PATH" ]]; then
    echo -e "   ✅ ${GREEN}WebDriverAgentMac: Found${NC}"
    echo -e "   📍 Path: $WDA_PATH"
    
    # Check if built
    WDA_BUILT=false
    DERIVED_DATA_PATHS=$(find ~/Library/Developer/Xcode/DerivedData -name "*WebDriverAgentMac*" -type d 2>/dev/null)
    for DERIVED_DATA_PATH in $DERIVED_DATA_PATHS; do
        if [[ -d "$DERIVED_DATA_PATH/Build/Products/Debug" ]]; then
            RUNNER_APPS=$(find "$DERIVED_DATA_PATH/Build/Products/Debug" -name "*Runner*.app" -type d 2>/dev/null)
            if [[ -n "$RUNNER_APPS" ]]; then
                WDA_BUILT=true
                break
            fi
        fi
    done
    
    if [[ "$WDA_BUILT" == "true" ]]; then
        echo -e "   ✅ ${GREEN}Build status: Built${NC}"
    else
        echo -e "   ⚠️  ${YELLOW}Build status: Not built${NC}"
        echo -e "   ${BLUE}Build: cd '$WDA_PATH' && xcodebuild -project WebDriverAgentMac.xcodeproj -scheme WebDriverAgentRunner -destination 'platform=macOS' build${NC}"
        
        read -p "Build now? (y/n): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            echo -e "   ${YELLOW}Building WebDriverAgentMac...${NC}"
            cd "$WDA_PATH"
            xcodebuild -project WebDriverAgentMac.xcodeproj -scheme WebDriverAgentRunner -destination 'platform=macOS' build
            if [ $? -eq 0 ]; then
                echo -e "   ${GREEN}✅ Build successful${NC}"
            else
                echo -e "   ${RED}❌ Build failed${NC}"
                echo -e "   ${YELLOW}Try: sudo xcodebuild -runFirstLaunch${NC}"
            fi
            cd - > /dev/null
        fi
    fi
else
    echo -e "   ⚠️  ${YELLOW}WebDriverAgentMac: Not found${NC}"
fi

# Trap exit signal
trap 'echo -e "\n${YELLOW}Stopping Appium server...${NC}"; exit 0' INT TERM

echo -e "\n=========================================="
echo -e "${GREEN}🚀 Starting Appium Server...${NC}"
echo -e "${BLUE}   URL: http://localhost:$PORT${NC}"
echo -e "${BLUE}   Log: $LOG_FILE${NC}"
echo -e "${BLUE}   Press Ctrl+C to stop${NC}"
echo -e "${BLUE}   Keep this terminal open, run tests in another window${NC}"
echo -e "==========================================\n"

# Start Appium server
appium "${APPIUM_ARGS[@]}"