#!/bin/bash

# 设置颜色
GREEN='\033[0;32m'
NC='\033[0m' # No Color

echo -e "${GREEN}🚀 开始构建 WebMCP Release...${NC}"

# 1. 创建输出目录
mkdir -p release
rm -rf release/*

# ==========================================
# 2. 打包 VS Code 插件 (Server)
# ==========================================
echo -e "${GREEN}📦 正在构建 VS Code 插件...${NC}"
cd mcp-gateway-vscode

# 获取版本号
VS_VERSION=$(node -p "require('./package.json').version")
VS_NAME="WebMCP-Gateway-VSCode-${VS_VERSION}.vsix"

# 安装依赖并打包
npm install
# 确保安装 vsce: npm install -g @vscode/vsce 或者使用 npx
npx vsce package --out "../release/${VS_NAME}"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ VS Code 插件打包成功: release/${VS_NAME}${NC}"
else
    echo "❌ VS Code 插件打包失败"
    exit 1
fi

# 返回根目录
cd ..

# ==========================================
# 3. 打包浏览器插件 (Client)
# ==========================================
echo -e "${GREEN}📦 正在构建浏览器插件...${NC}"
cd mcp-bridge-browser

# 获取版本号 (从 manifest.json 读取)
BROWSER_VERSION=$(node -p "require('./manifest.json').version")
BROWSER_NAME="WebMCP-Bridge-Browser-${BROWSER_VERSION}.zip"

# 打包 zip
# -r: 递归
# -x: 排除文件 (排除 git, DS_Store, map文件, 原始素材等)
zip -r "../release/${BROWSER_NAME}" . \
    -x "*.git*" \
    -x "*.DS_Store" \
    -x "*.map" \
    -x "src/*" \
    -x "test/*" \
    -x "node_modules/*"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✅ 浏览器插件打包成功: release/${BROWSER_NAME}${NC}"
else
    echo "❌ 浏览器插件打包失败"
    exit 1
fi

# 返回根目录
cd ..

echo -e "${GREEN}🎉 所有构建完成！请查看 release 文件夹。${NC}"