$ErrorActionPreference = "Stop"

Write-Host "🚀 开始构建 WebMCP Release (Windows)..." -ForegroundColor Green

# 1. 创建/清理 release 目录
if (Test-Path "release") {
    Remove-Item "release" -Recurse -Force
}
New-Item -ItemType Directory -Force -Path "release" | Out-Null

# ==========================================
# 2. 打包 VS Code 插件 (Server)
# ==========================================
Write-Host "📦 正在构建 VS Code 插件..." -ForegroundColor Cyan
Set-Location "mcp-gateway-vscode"

# 获取版本号
$json = Get-Content "package.json" -Raw | ConvertFrom-Json
$vsVersion = $json.version
$vsName = "WebMCP-Gateway-VSCode-$vsVersion.vsix"

# 安装依赖
cmd /c "npm install"

# 打包 (使用 npx 调用 vsce，兼容 Windows)
cmd /c "npx vsce package --out ../release/$vsName"

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ VS Code 插件打包成功: release\$vsName" -ForegroundColor Green
} else {
    Write-Host "❌ VS Code 插件打包失败" -ForegroundColor Red
    exit 1
}

Set-Location ".."

# ==========================================
# 3. 打包浏览器插件 (Client)
# ==========================================
Write-Host "📦 正在构建浏览器插件..." -ForegroundColor Cyan

# 获取版本号
$manifest = Get-Content "mcp-bridge-browser\manifest.json" -Raw | ConvertFrom-Json
$browserVersion = $manifest.version
$browserName = "WebMCP-Bridge-Browser-$browserVersion.zip"

# Windows PowerShell 的 Compress-Archive 不支持复杂的排除规则
# 所以我们先复制到一个临时文件夹，删除不需要的文件，再压缩

$tempDir = "temp_build_browser"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# 复制文件
Copy-Item -Path "mcp-bridge-browser\*" -Destination $tempDir -Recurse

# 删除不需要的文件 (排除列表)
$exclude = @(".git", ".DS_Store", "*.map", "node_modules", "src", "test")
foreach ($item in $exclude) {
    if (Test-Path "$tempDir\$item") {
        Remove-Item "$tempDir\$item" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# 压缩
Compress-Archive -Path "$tempDir\*" -DestinationPath "release\$browserName" -Force

# 清理临时目录
Remove-Item $tempDir -Recurse -Force

Write-Host "✅ 浏览器插件打包成功: release\$browserName" -ForegroundColor Green

Write-Host "🎉 所有构建完成！请查看 release 文件夹。" -ForegroundColor Green