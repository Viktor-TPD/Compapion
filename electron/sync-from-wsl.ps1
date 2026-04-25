$wsl = "\\wsl$\Ubuntu\home\paptop\dev\compapion\electron"
$wslRoot = "\\wsl$\Ubuntu\home\paptop\dev\compapion"
$here = $PSScriptRoot
$addon = "C:\Program Files (x86)\World of Warcraft\_anniversary_\Interface\AddOns\Compapion"

Copy-Item "$wsl\src\main.ts"             "$here\src\main.ts"          -Force
Copy-Item "$wsl\src\watcher.ts"          "$here\src\watcher.ts"       -Force
Copy-Item "$wsl\src\supabase-sync.ts"    "$here\src\supabase-sync.ts" -Force
Copy-Item "$wsl\src\lua-parser.ts"       "$here\src\lua-parser.ts"    -Force
Copy-Item "$wsl\src\preload.ts"          "$here\src\preload.ts"        -Force
Copy-Item "$wsl\src\chat-log-watcher.ts" "$here\src\chat-log-watcher.ts" -Force
Copy-Item "$wsl\ui\index.html"           "$here\ui\index.html"         -Force

if (-not (Test-Path "$here\addon")) { New-Item -ItemType Directory -Path "$here\addon" | Out-Null }
Copy-Item "$wslRoot\addon\Compapion.lua" "$here\addon\Compapion.lua"  -Force
Copy-Item "$wslRoot\addon\Compapion.toc" "$here\addon\Compapion.toc"  -Force

# Sync assets (skip favicons subfolder — source art only)
Get-ChildItem "$wsl\assets\" -File | ForEach-Object {
    Copy-Item $_.FullName "$here\assets\$($_.Name)" -Force
}

Write-Host "Synced electron from WSL." -ForegroundColor Green

if ($env:SYNC_ADDON -eq "1") {
    if (-not (Test-Path $addon)) { New-Item -ItemType Directory -Path $addon | Out-Null }
    Copy-Item "$wslRoot\addon\Compapion.lua" "$addon\Compapion.lua" -Force
    Copy-Item "$wslRoot\addon\Compapion.toc" "$addon\Compapion.toc" -Force
    Write-Host "Synced addon to WoW." -ForegroundColor Green
}
