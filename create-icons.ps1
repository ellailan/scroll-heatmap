# Create placeholder icons for the Chrome extension

$bytes16 = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAAJElEQVR42mNgGAWjYBSMAgYGBgYGLIBfIFsHAvEHAvEHAvEHAwB3FQc7j3b6jQAAAABJRU5ErkJggg==')
[IO.File]::WriteAllBytes("$PSScriptRoot\images\icon16.png", $bytes16)

$bytes48 = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAADAAAAAwCAYAAABXAvmHAAAANklEQVRoQ+3QQREAAAgDINc/NG0QmAJW4FZbZpYFAAAAAAAAAAAAAAAAAAA+24AHQAB2ixJAAAAAAElFTkSuQmCC')
[IO.File]::WriteAllBytes("$PSScriptRoot\images\icon48.png", $bytes48)

$bytes128 = [Convert]::FromBase64String('iVBORw0KGgoAAAANSUhEUgAAAIAAAACACAYAAADDPmHLAAAANklEQVR4Ae3BAQ0AAADCIPuntsYOYAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAPgbWAAAdhb0CQAAAABJRU5ErkJggg==')
[IO.File]::WriteAllBytes("$PSScriptRoot\images\icon128.png", $bytes128)

Write-Host "Icons created successfully!"