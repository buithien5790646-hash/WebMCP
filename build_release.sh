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
DESKTOP_PLATFORM="" # Default to current platform

if [ $# -gt 0 ]; then
    BUILD_ALL=false
    for arg in "$@"; do
        case $arg in
            vscode) BUILD_VSCODE=true ;;
            browser) BUILD_BROWSER=true ;;
            desktop) BUILD_DESKTOP=true ;;
            win) BUILD_DESKTOP=true; DESKTOP_PLATFORM="--win" ;;
            mac) BUILD_DESKTOP=true; DESKTOP_PLATFORM="--mac" ;;
            linux) BUILD_DESKTOP=true; DESKTOP_PLATFORM="--linux" ;;
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

# 1. Get version from root package.json
ROOT_VERSION=$(node -p "require('./package.json').version")
echo -e "${GREEN}📦 Target Version: ${ROOT_VERSION}${NC}"

# 2. Sync versions to all packages
echo -e "${CYAN}🔄 Syncing versions to all packages...${NC}"
# Use a simple node script to update versions to avoid complex sed issues
node -e "
const fs = require('fs');
const version = '$ROOT_VERSION';
const packages = [
    './packages/shared/package.json',
    './packages/mcp-market-kit/package.json',
    './packages/mcp-gateway-vscode/package.json',
    './packages/mcp-gateway-desktop/package.json',
    './packages/mcp-bridge-browser/package.json'
];
packages.forEach(pkgPath => {
    if (fs.existsSync(pkgPath)) {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
        pkg.version = version;
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
        console.log('✅ Updated ' + pkgPath + ' to ' + version);
    }
});
"

# 3. Run Linting
echo -e "${CYAN}🔍 Running Linting...${NC}"
pnpm run lint
if [ $? -ne 0 ]; then
    echo -e "${RED}❌ Linting failed. Please fix errors before releasing.${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Linting passed!${NC}"

# 4. Install dependencies
echo -e "${CYAN}📦 Installing dependencies...${NC}"
pnpm install --no-frozen-lockfile

# 5. Create/Clean output directory
mkdir -p release
# We don't rm -rf release/* because we might only be building one component

# 4. Build Core Modules (Required for all)
echo -e "${CYAN}🛠️  Building Core Modules...${NC}"
pnpm --filter @webmcp/shared run build
pnpm --filter @mcp-kit/core run build

# ==========================================
# 5. Package VS Code Extension
# ==========================================
if [ "$BUILD_VSCODE" = true ]; then
    echo -e "${CYAN}📦 Packaging VS Code Extension...${NC}"
    cd packages/mcp-gateway-vscode
    VS_NAME="WebMCP-Gateway-VSCode-${ROOT_VERSION}.vsix"
    
    # We use pnpm build first to ensure assets are copied
    pnpm run build
    pnpm exec vsce package --out "../../release/${VS_NAME}" --no-dependencies
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ VS Code Extension built: release/${VS_NAME}${NC}"
    else
        echo -e "${RED}❌ VS Code Extension build failed${NC}"
        exit 1
    fi
    cd ../..
fi

# ==========================================
# 6. Package Browser Extension
# ==========================================
if [ "$BUILD_BROWSER" = true ]; then
    echo -e "${CYAN}📦 Packaging Browser Extension...${NC}"
    cd packages/mcp-bridge-browser
    BROWSER_NAME="WebMCP-Bridge-Browser-${ROOT_VERSION}.zip"
    
    pnpm run build
    if [ $? -ne 0 ]; then
        echo -e "${RED}❌ Browser Extension build failed${NC}"
        exit 1
    fi
    
    # Zip DIST folder content
    cd dist
    zip -r "../../../release/${BROWSER_NAME}" . > /dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ Browser Extension built: release/${BROWSER_NAME}${NC}"
    else
        echo -e "${RED}❌ Browser Extension zip failed${NC}"
        exit 1
    fi
    cd ../../..
fi

# ==========================================
# 7. Package Desktop App
# ==========================================
if [ "$BUILD_DESKTOP" = true ]; then
    echo -e "${CYAN}📦 Packaging Desktop App...${NC}"
    cd packages/mcp-gateway-desktop
    
    # This will run vite build and electron-builder
    if [ -z "$DESKTOP_PLATFORM" ]; then
        pnpm run package
    else
        pnpm run build && pnpm exec electron-builder $DESKTOP_PLATFORM
    fi
    
    if [ $? -eq 0 ]; then
        # Find the built installer and move to release
        # electron-builder output is in release/${ROOT_VERSION}
        mkdir -p ../release/desktop
        # Match dmg, exe, zip, AppImage files in the version-specific subfolder
        cp "release/${ROOT_VERSION}"/*.{dmg,exe,AppImage,zip} ../release/desktop/ 2>/dev/null || true
        echo -e "${GREEN}✅ Desktop App built: release/desktop/${NC}"
    else
        echo -e "${RED}❌ Desktop App build failed${NC}"
        exit 1
    fi
    cd ../..
fi

echo -e "${GREEN}🎉 Selected builds completed! Please check the 'release' folder.${NC}"
