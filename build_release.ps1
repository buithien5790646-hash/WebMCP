[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "[START] Starting WebMCP Release Build (Windows)..." -ForegroundColor Green

# 1. Create/Clean release directory
if (Test-Path "release") {
    Remove-Item "release" -Recurse -Force
}
New-Item -ItemType Directory -Force -Path "release" | Out-Null

# ==========================================
# 2. Package VS Code Extension (Server)
# ==========================================
Write-Host "[*] Building VS Code Extension..." -ForegroundColor Cyan
Set-Location "mcp-gateway-vscode"

# Get version
$json = Get-Content "package.json" -Raw | ConvertFrom-Json
$vsVersion = $json.version
$vsName = "WebMCP-Gateway-VSCode-$vsVersion.vsix"

# Install dependencies
cmd /c "npm install"

# Package (use npx to call vsce, compatible with Windows)
cmd /c "npx vsce package --out ../release/$vsName"

if ($LASTEXITCODE -eq 0) {
    Write-Host "[OK] VS Code Extension built successfully: release\$vsName" -ForegroundColor Green
} else {
    Write-Host "[ERROR] VS Code Extension build failed" -ForegroundColor Red
    exit 1
}

Set-Location ".."

# ==========================================
# 3. Package Browser Extension (Client)
# ==========================================
Write-Host "[*] Building Browser Extension..." -ForegroundColor Cyan

# Get version
$manifest = Get-Content "mcp-bridge-browser\manifest.json" -Raw | ConvertFrom-Json
$browserVersion = $manifest.version
$browserName = "WebMCP-Bridge-Browser-$browserVersion.zip"

# Windows PowerShell's Compress-Archive doesn't support complex exclusion rules
# So we copy to a temp folder, remove unwanted files, then compress

$tempDir = "temp_build_browser"
if (Test-Path $tempDir) { Remove-Item $tempDir -Recurse -Force }
New-Item -ItemType Directory -Force -Path $tempDir | Out-Null

# Copy files
Copy-Item -Path "mcp-bridge-browser\*" -Destination $tempDir -Recurse

# Remove unwanted files (exclusion list)
$exclude = @(".git", ".DS_Store", "*.map", "node_modules", "src", "test")
foreach ($item in $exclude) {
    if (Test-Path "$tempDir\$item") {
        Remove-Item "$tempDir\$item" -Recurse -Force -ErrorAction SilentlyContinue
    }
}

# Compress
Compress-Archive -Path "$tempDir\*" -DestinationPath "release\$browserName" -Force

# Clean up temp directory
Remove-Item $tempDir -Recurse -Force

Write-Host "[OK] Browser Extension built successfully: release\$browserName" -ForegroundColor Green

Write-Host "[DONE] All builds completed! Please check the 'release' folder." -ForegroundColor Green