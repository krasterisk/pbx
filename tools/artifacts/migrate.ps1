param(
    [Parameter(Mandatory=$true)][string]$Plan,
    [switch]$Apply,
    [ValidatePattern("^[a-z-]+$")][string]$BatchName = "directory"
)
$ErrorActionPreference = 'Stop'
$data = Get-Content -LiteralPath $Plan -Raw | ConvertFrom-Json
$repo = [IO.Path]::GetFullPath($data.repository).TrimEnd('\','/')
$destination = [IO.Path]::GetFullPath($data.destination).TrimEnd('\','/')
if ($destination -eq $repo -or $destination.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase) -or $repo.StartsWith($destination+'\',[StringComparison]::OrdinalIgnoreCase)) { throw 'Destination must be separate from repository' }
$legacy = Join-Path $destination 'legacy'
function Assert-Child([string]$Base,[string]$Target) {
    $resolved = [IO.Path]::GetFullPath($Target)
    if (-not $resolved.StartsWith($Base.TrimEnd('\','/')+'\',[StringComparison]::OrdinalIgnoreCase)) { throw "Path escapes intended root: $resolved" }
    return $resolved
}
$entries = @()
$completed = @()
foreach ($relative in $data.directories) {
    if ([IO.Path]::IsPathRooted($relative) -or ($relative -split '[/\\]') -contains '..') { throw 'Unsafe plan entry' }
    $source = Assert-Child $repo (Join-Path $repo $relative)
    $target = Assert-Child $destination (Join-Path $legacy $relative)
    if (Test-Path -LiteralPath $target) {
        $existing = Get-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
        if ($null -ne $existing -and ($existing.Attributes -band [IO.FileAttributes]::ReparsePoint) -and [IO.Path]::GetFullPath($existing.Target) -eq $target) { $completed += $relative; continue }
        throw "Refuse destination collision: $target"
    }
    $item = Get-Item -LiteralPath $source -Force
    if ($item.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Refuse moving a reparse point: $source" }
    $nestedLinks = @(Get-ChildItem -LiteralPath $source -Recurse -Force -Attributes ReparsePoint)
    if ($nestedLinks.Count) { throw "Nested reparse points require review: $source" }
    $entries += [pscustomobject]@{Relative=$relative;Source=$source;Target=$target}
}
if (-not $Apply) {
    [pscustomobject]@{Mode='dry-run';Directories=$entries.Count;Files=$data.files.Count;Bytes=$data.bytes;Destination=$destination} | ConvertTo-Json -Compress
    return
}
$alias = Join-Path $repo '.artifacts'
if (Test-Path -LiteralPath $alias) { $existingAlias=Get-Item -LiteralPath $alias -Force; if (-not ($existingAlias.Attributes -band [IO.FileAttributes]::ReparsePoint) -or [IO.Path]::GetFullPath($existingAlias.Target) -ne $destination) { throw 'Existing artifact alias differs from destination' } }
New-Item -ItemType Directory -Path $destination -Force | Out-Null
$ledgerDirectory = Join-Path $destination 'migration'
New-Item -ItemType Directory -Path $ledgerDirectory -Force | Out-Null
$ledger = Join-Path $ledgerDirectory ($BatchName+'-move-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.jsonl')
$priorLedgers = @(Get-ChildItem -LiteralPath $ledgerDirectory -Filter ($BatchName+'-move-*.jsonl') -File)
$verified=0; $moved=$completed.Count; $bytes=0L
foreach ($priorLedger in $priorLedgers) {
    foreach ($line in [IO.File]::ReadLines($priorLedger.FullName)) {
        if (-not $line.Trim()) { continue }
        $record=$line | ConvertFrom-Json
        if (@($completed | Where-Object { $record.Path.StartsWith($_+'/') }).Count -eq 0) { throw 'Prior ledger contains an incomplete directory; inspect before resuming' }
        $verified++; $bytes+=$record.Bytes
    }
}
$writer=[IO.StreamWriter]::new($ledger,$false,[Text.UTF8Encoding]::new($false))
try {
foreach ($entry in $entries) {
    $hashes = @{}
    $files = @(Get-ChildItem -LiteralPath $entry.Source -Recurse -File -Force)
    foreach ($file in $files) {
        $rel = [IO.Path]::GetRelativePath($entry.Source,$file.FullName)
        $hashes[$rel] = [pscustomobject]@{Hash=(Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash;Bytes=$file.Length}
    }
    New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($entry.Target)) -Force | Out-Null
    # Both final absolute roots and every entry were checked above; use native PowerShell end-to-end.
    Move-Item -LiteralPath $entry.Source -Destination $entry.Target
    $after = @(Get-ChildItem -LiteralPath $entry.Target -Recurse -File -Force)
    if ($after.Count -ne $files.Count) { throw "File count mismatch after moving $($entry.Relative)" }
    foreach ($file in $after) {
        $rel = [IO.Path]::GetRelativePath($entry.Target,$file.FullName)
        $original = $hashes[$rel]
        $hash = (Get-FileHash -LiteralPath $file.FullName -Algorithm SHA256).Hash
        if ($null -eq $original -or $hash -ne $original.Hash -or $file.Length -ne $original.Bytes) { throw "Integrity mismatch: $($file.FullName)" }
        $writer.WriteLine(([pscustomobject]@{Path=($entry.Relative+'/'+$rel.Replace('\','/'));SHA256=$hash;Bytes=$file.Length} | ConvertTo-Json -Compress))
        $verified++;$bytes+=$file.Length
    }
    $writer.Flush()
    New-Item -ItemType Junction -Path $entry.Source -Target $entry.Target | Out-Null
    $moved++
    if ($moved % 5 -eq 0) { Write-Output "Verified $verified files in $moved directories" }
}
} finally { $writer.Dispose() }
if (-not (Test-Path -LiteralPath $alias)) { New-Item -ItemType Junction -Path $alias -Target $destination | Out-Null }
$modulesAlias=Join-Path $legacy 'node_modules'
if (-not (Test-Path -LiteralPath $modulesAlias)) { New-Item -ItemType Junction -Path $modulesAlias -Target (Join-Path $repo 'node_modules') | Out-Null }
$summary=[pscustomobject]@{Status='hash-verified';Directories=$moved;Files=$verified;Bytes=$bytes;Destination=$destination;Ledger=@($priorLedgers.FullName)+@($ledger);CompatibilityAliases=$true;DocumentsDeleted=0}
$summary | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $ledgerDirectory ($BatchName+'-move-summary.json')) -Encoding utf8
$summary | ConvertTo-Json -Compress
