# fix-encoded-attachments.ps1
# Finds ![[attachments/...%25...]] double-encoded URIs in all .md files,
# cleans the filename to just the hash suffix, and renames actual files if they exist.

$postsDir     = Join-Path $PSScriptRoot "..\src\content\posts"
$attachDir    = Join-Path $postsDir "attachments"
$pattern      = '!\[\[attachments/([^\]]*%25[^\]]*)\]\]'

$mdFiles      = Get-ChildItem -Path $postsDir -Filter "*.md" -Recurse
$totalFixed   = 0
$totalRenamed = 0

foreach ($file in $mdFiles) {
    $content = [System.IO.File]::ReadAllText($file.FullName)

    if ($content -notmatch $pattern) { continue }

    $newContent = [regex]::Replace($content, $pattern, {
        param($m)
        $oldName = $m.Groups[1].Value

        # Keep hash-extension suffix as the clean filename
        if ($oldName -match '-([a-f0-9]{10,})\.(png|jpg|jpeg|gif|webp|mp4)$') {
            $newName = "$($Matches[1]).$($Matches[2])"
        } else {
            # Fallback: strip %25-encoded sequences entirely, keep safe chars
            $newName = $oldName -replace '%25[A-Fa-f0-9]{0,2}', ''
            $newName = $newName -replace '[^a-zA-Z0-9_\-\.]', ''
        }

        # Rename actual file on disk if it exists
        $oldPath = Join-Path $attachDir $oldName
        $newPath = Join-Path $attachDir $newName

        if ((Test-Path $oldPath) -and $oldName -ne $newName) {
            Rename-Item -LiteralPath $oldPath -NewName $newName -ErrorAction SilentlyContinue
            Write-Host "  RENAMED: $oldName -> $newName"
            $script:totalRenamed++
        }

        return "![[attachments/$newName]]"
    })

    if ($newContent -ne $content) {
        [System.IO.File]::WriteAllText($file.FullName, $newContent)
        Write-Host "FIXED: $($file.Name)"
        $script:totalFixed++
    }
}

Write-Host ""
Write-Host "Done. Files updated: $totalFixed | Attachments renamed: $totalRenamed"
