#!/bin/bash

# Set colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 Starting WebMCP Release Build...${NC}"

# 1. Parse arguments
BUILD_ALL=true
BUILD_VSCODE=false
BUILD_BROWSER=false
BUILD_DESKTOP=false

if [ $# -gt 0 ]; then
    BUILD_ALL=false
    for arg in "$@"; do
        case $arg in
            vscode) BUILD_VSCODE=true ;;
            browser) BUILD_BROWSER=true ;;
            desktop) BUILD_DESKTOP=true ;;
            all) BUILD_ALL=true ;;
            *) echo -e "${YELLOW}Unknown argument: $arg. Skipping...${NC}" ;;
        esac
    done
fi

if [ "$BUILD_ALL" = true ]; then
    BUILD_VSCODE=true
    BUILD_BROWSER=true
    BUILD_DESKTOP=true
fi

# 2. Create/Clean output directory
mkdir -p release
# We don't rm -rf release/* because we might only be building one component

# 3. Build Shared Module (Required for all)
echo -e "${CYAN}🛠️  Building Shared Module...${NC}"
pnpm --filter @webmcp/shared run build

# ==========================================
# 4. Package VS Code Extension
# ==========================================
if [ "$BUILD_VSCODE" = true ]; then
    echo -e "${CYAN}📦 Packaging VS Code Extension...${NC}"
    cd mcp-gateway-vscode
    VS_VERSION=$(node -p "require('./package.json').version")
    VS_NAME="WebMCP-Gateway-VSCode-${VS_VERSION}.vsix"
    
    # We use pnpm build first to ensure assets are copied
    pnpm run build
    pnpm exec vsce package --out "../release/${VS_NAME}" --no-dependencies
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ VS Code Extension built: release/${VS_NAME}${NC}"
    else
        echo -e "${RED}❌ VS Code Extension build failed${NC}"
        exit 1
    fi
    cd ..
fi

# ==========================================
# 5. Package Browser Extension
# ==========================================
if [ "$BUILD_BROWSER" = true ]; then
    echo -e "${CYAN}📦 Packaging Browser Extension...${NC}"
    cd mcp-bridge-browser
    BROWSER_VERSION=$(node -p "require('./package.json').version")
    BROWSER_NAME="WebMCP-Bridge-Browser-${BROWSER_VERSION}.zip"
    
    pnpm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Browser Extension build failed${NC}"
        exit 1
    fi
    
    # Zip DIST folder content
    cd dist
    zip -r "../../release/${BROWSER_NAME}" . > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Browser Extension built: release/${BROWSER_NAME}${NC}"
    else
        echo -e "${RED}❌ Browser Extension zip failed${NC}"
        exit 1
    fi
    cd ../..
fi

# ==========================================
# 6. Package Desktop App
# ==========================================
if [ "$BUILD_DESKTOP" = true ]; then
    echo -e "${CYAN}📦 Packaging Desktop App...${NC}"
    cd mcp-gateway-desktop
    
    # This will run vite build and electron-builder
    pnpm run package
    
    if [ $? -eq 0 ]; then
        # Find the built installer and move to release
        # electron-builder output is in release/ (within mcp-gateway-desktop)
        # We look for .dmg or .exe
        mkdir -p ../release/desktop
        cp release/*.{dmg,exe,AppImage,zip} ../release/desktop/ 2>/dev/null || true
        echo -e "${GREEN}✅ Desktop App built: release/desktop/${NC}"
    else
        echo -e "${RED}❌ Desktop App build failed${NC}"
        exit 1
    fi
    cd ..
fi

echo -e "${GREEN}🎉 Selected builds completed! Please check the 'release' folder.${NC}"
