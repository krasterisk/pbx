function Get-ArtifactsRoot {
    # Share the Node resolver's symlink and containment checks.
    $node = Get-Command node -CommandType Application -ErrorAction Stop | Select-Object -First 1
    $result = & $node.Source (Join-Path $PSScriptRoot 'paths.cjs')
    if ($LASTEXITCODE -ne 0) { throw 'ARTIFACTS_ROOT validation failed' }
    return [string]$result
}
