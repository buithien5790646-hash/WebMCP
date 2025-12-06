#!/bin/bash

# Set colors
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting WebMCP Release Build...${NC}"

# 1. Create output directory
mkdir -p release
rm -rf release/*

# ==========================================
# 2. Package VS Code Extension (Server)
# ==========================================
echo -e "${GREEN}📦 Building VS Code Extension...${NC}"
cd mcp-gateway-vscode

# Get version
VS_VERSION=$(node -p "require('./package.json').version")
VS_NAME="WebMCP-Gateway-VSCode-${VS_VERSION}.vsix"

# Install dependencies and package
npm install
# Ensure vsce is installed
npx vsce package --out "../release/${VS_NAME}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ VS Code Extension built successfully: release/${VS_NAME}${NC}"
else
    echo "❌ VS Code Extension build failed"
    exit 1
fi

# Return to root
cd ..

# ==========================================
# 3. Package Browser Extension (Client)
# ==========================================
echo -e "${GREEN}📦 Building Browser Extension...${NC}"
cd mcp-bridge-browser

# Get version
BROWSER_VERSION=$(node -p "require('./manifest.json').version")
BROWSER_NAME="WebMCP-Bridge-Browser-${BROWSER_VERSION}.zip"

# Zip files
# -r: recursive
# -x: exclude files
zip -r "../release/${BROWSER_NAME}" . \
    -x "*.git*" \
    -x "*.DS_Store" \
    -x "*.map" \
    -x "src/*" \
    -x "test/*" \
    -x "node_modules/*"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ Browser Extension built successfully: release/${BROWSER_NAME}${NC}"
else
    echo "❌ Browser Extension build failed"
    exit 1
fi

# Return to root
cd ..

echo -e "${GREEN}🎉 All builds completed! Please check the 'release' folder.${NC}"