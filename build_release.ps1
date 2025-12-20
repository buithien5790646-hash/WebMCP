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
$packages = @("mcp-gateway-vscode", "mcp-bridge-browser", "mcp-gateway-desktop")
foreach ($pkgDir in $packages) {
    $pkgJsonPath = Join-Path $pkgDir "package.json"
    if (Test-Path $pkgJsonPath) {
        $pkgJson = Get-Content $pkgJsonPath -Raw | ConvertFrom-Json
        $pkgJson.version = $rootVersion
        $pkgJson | ConvertTo-Json -Depth 10 | Set-Content $pkgJsonPath
        Write-Host "✅ Updated $pkgDir to $rootVersion"
    }
}

# 3. Create/Clean output directory
if (!(Test-Path "release")) {
    New-Item -ItemType Directory -Path "release" | Out-Null
}

# 4. Build Shared Module
Write-Host "🛠️ Building Shared Module..." -ForegroundColor Cyan
cmd /c "pnpm --filter @webmcp/shared run build"

# ==========================================
# 5. Package VS Code Extension
# ==========================================
if ($buildVscode) {
    Write-Host "📦 Packaging VS Code Extension..." -ForegroundColor Cyan
    Set-Location "mcp-gateway-vscode"
    $vsName = "WebMCP-Gateway-VSCode-$rootVersion.vsix"
    
    cmd /c "pnpm run build"
    cmd /c "pnpm exec vsce package --out ../release/$vsName --no-dependencies"
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ VS Code Extension built: release\$vsName" -ForegroundColor Green
    } else {
        Write-Host "❌ VS Code Extension build failed" -ForegroundColor Red
        exit 1
    }
    Set-Location ".."
}

# ==========================================
# 6. Package Browser Extension
# ==========================================
if ($buildBrowser) {
    Write-Host "📦 Packaging Browser Extension..." -ForegroundColor Cyan
    Set-Location "mcp-bridge-browser"
    $browserName = "WebMCP-Bridge-Browser-$rootVersion.zip"
    
    cmd /c "pnpm run build"
    
    $distPath = Join-Path (Get-Location) "dist"
    $releasePath = Join-Path (Get-Location) "..\release\$browserName"
    
    if (Test-Path $releasePath) { Remove-Item $releasePath }
    
    Add-Type -AssemblyName System.IO.Compression.FileSystem
    [System.IO.Compression.ZipFile]::CreateFromDirectory($distPath, $releasePath)
    
    if (Test-Path $releasePath) {
        Write-Host "✅ Browser Extension built: release\$browserName" -ForegroundColor Green
    } else {
        Write-Host "❌ Browser Extension zip failed" -ForegroundColor Red
        exit 1
    }
    Set-Location ".."
}

# ==========================================
# 7. Package Desktop App
# ==========================================
if ($buildDesktop) {
    Write-Host "📦 Packaging Desktop App..." -ForegroundColor Cyan
    Set-Location "mcp-gateway-desktop"
    
    cmd /c "pnpm run package"
    
    if ($LASTEXITCODE -eq 0) {
        $desktopReleaseDir = Join-Path (Get-Location) "..\release\desktop"
        if (!(Test-Path $desktopReleaseDir)) { New-Item -ItemType Directory -Path $desktopReleaseDir | Out-Null }
        
        # electron-builder output is in release\$rootVersion
        $sourcePath = Join-Path "release" $rootVersion
        Get-ChildItem (Join-Path $sourcePath "*.dmg"), (Join-Path $sourcePath "*.exe"), (Join-Path $sourcePath "*.AppImage"), (Join-Path $sourcePath "*.zip") | Copy-Item -Destination $desktopReleaseDir -ErrorAction SilentlyContinue
        Write-Host "✅ Desktop App built: release\desktop\" -ForegroundColor Green
    } else {
        Write-Host "❌ Desktop App build failed" -ForegroundColor Red
        exit 1
    }
    Set-Location ".."
}

Write-Host "🎉 Selected builds completed! Please check the 'release' folder." -ForegroundColor Green
