[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$ErrorActionPreference = "Stop"

Write-Host "🚀 Starting WebMCP Release Build..." -ForegroundColor Green

# 1. Parse arguments
$buildAll = $true
$buildVscode = $false
$buildBrowser = $false
$buildDesktop = $false

if ($args.Count -gt 0) {
    $buildAll = $false
    foreach ($arg in $args) {
        switch ($arg) {
            "vscode" { $buildVscode = $true }
            "browser" { $buildBrowser = $true }
            "desktop" { $buildDesktop = $true }
            "all" { $buildAll = $true }
            default { Write-Host "Unknown argument: $arg. Skipping..." -ForegroundColor Yellow }
        }
    }
}

if ($buildAll) {
    $buildVscode = $true
    $buildBrowser = $true
    $buildDesktop = $true
}

# 1. Get version from root package.json
$rootPkg = Get-Content "package.json" -Raw | ConvertFrom-Json
$rootVersion = $rootPkg.version
Write-Host "📦 Target Version: $rootVersion" -ForegroundColor Green

# 2. Sync versions to all packages
Write-Host "🔄 Syncing versions to all packages..." -ForegroundColor Cyan
$packages = @(
    "packages/shared/package.json",
    "packages/mcp-market-kit/package.json",
    "packages/mcp-gateway-vscode/package.json",
    "packages/mcp-gateway-desktop/package.json",
    "packages/mcp-bridge-browser/package.json"
)
foreach ($pkgPath in $packages) {
    if (Test-Path $pkgPath) {
        $pkgJson = Get-Content $pkgPath -Raw | ConvertFrom-Json
        $pkgJson.version = $rootVersion
        # Write back with formatting
        $pkgJson | ConvertTo-Json -Depth 10 | Set-Content $pkgPath
        Write-Host "✅ Updated $pkgPath to $rootVersion"
    }
}

# 3. Run Linting
Write-Host "🔍 Running Linting..." -ForegroundColor Cyan
cmd /c "pnpm run lint"
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Linting failed. Please fix errors before releasing." -ForegroundColor Red
    exit 1
}
Write-Host "✅ Linting passed!" -ForegroundColor Green

# 4. Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Cyan
cmd /c "pnpm install --no-frozen-lockfile"

# 5. Create/Clean output directory
if (!(Test-Path "release")) {
    New-Item -ItemType Directory -Path "release" | Out-Null
}

# 6. Build Core Modules
Write-Host "🛠️ Building Core Modules..." -ForegroundColor Cyan
cmd /c "pnpm --filter @webmcp/shared run build"
cmd /c "pnpm --filter @mcp-kit/core run build"

# ==========================================
# 7. Package VS Code Extension
# ==========================================
if ($buildVscode) {
    Write-Host "📦 Packaging VS Code Extension..." -ForegroundColor Cyan
    Set-Location "packages/mcp-gateway-vscode"
    $vsName = "WebMCP-Gateway-VSCode-$rootVersion.vsix"
    
    cmd /c "pnpm run build"
    cmd /c "pnpm exec vsce package --out ../../release/$vsName --no-dependencies"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ VS Code Extension built: release\$vsName" -ForegroundColor Green
    } else {
        Write-Host "❌ VS Code Extension build failed" -ForegroundColor Red
        exit 1
    }
    Set-Location "../.."
}

# ==========================================
# 8. Package Browser Extension
# ==========================================
if ($buildBrowser) {
    Write-Host "📦 Packaging Browser Extension..." -ForegroundColor Cyan
    Set-Location "packages/mcp-bridge-browser"
    $browserName = "WebMCP-Bridge-Browser-$rootVersion.zip"
    
    cmd /c "pnpm run build"
    
    $distPath = Join-Path (Get-Location) "dist"
    $releasePath = Join-Path (Get-Location) "..\..\release\$browserName"
    
    if (Test-Path $releasePath) { Remove-Item $releasePath }
    
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($distPath, $releasePath)
    
    if (Test-Path $releasePath) {
        Write-Host "✅ Browser Extension built: release\$browserName" -ForegroundColor Green
    } else {
        Write-Host "❌ Browser Extension zip failed" -ForegroundColor Red
        exit 1
    }
    Set-Location "../.."
}

# ==========================================
# 9. Package Desktop App
# ==========================================
if ($buildDesktop) {
    Write-Host "📦 Packaging Desktop App..." -ForegroundColor Cyan
    Set-Location "packages/mcp-gateway-desktop"
    
    cmd /c "pnpm run package"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ Desktop App built successfully" -ForegroundColor Green
    } else {
        Write-Host "❌ Desktop App build failed" -ForegroundColor Red
        exit 1
    }
    Set-Location "../.."
}

Write-Host "🎉 Selected builds completed! Please check the 'release' folder." -ForegroundColor Green
