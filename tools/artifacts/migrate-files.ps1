param([Parameter(Mandatory=$true)][string]$FullPlan,[Parameter(Mandatory=$true)][string]$DirectoryPlan,[switch]$Apply,[ValidatePattern('^[a-z-]+$')][string]$BatchName='file')
$ErrorActionPreference='Stop'
$all=Get-Content -LiteralPath $FullPlan -Raw | ConvertFrom-Json
$dirs=Get-Content -LiteralPath $DirectoryPlan -Raw | ConvertFrom-Json
$repo=[IO.Path]::GetFullPath($all.repository).TrimEnd('\','/')
$dest=[IO.Path]::GetFullPath($all.destination).TrimEnd('\','/')
if($dest -eq $repo -or $dest.StartsWith($repo+'\',[StringComparison]::OrdinalIgnoreCase) -or $repo.StartsWith($dest+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Storage overlaps checkout'}
function Checked-Child([string]$base,[string]$relative){
 if([IO.Path]::IsPathRooted($relative) -or ($relative -split '[/\\]') -contains '..'){throw 'Unsafe path'}
 $target=[IO.Path]::GetFullPath((Join-Path $base $relative))
 if(-not $target.StartsWith($base+'\',[StringComparison]::OrdinalIgnoreCase)){throw 'Path escapes checked root'}
 return $target
}
$entries=@();$completed=@();$deferred=@();$active=@()
foreach($file in $all.files){
 if(@($dirs.directories | Where-Object {$file.path.StartsWith($_+'/')}).Count){continue}
 $source=Checked-Child $repo $file.path;$target=Checked-Child $dest ('legacy/'+$file.path)
 if(Test-Path -LiteralPath $target){
  $link=Get-Item -LiteralPath $source -Force -ErrorAction SilentlyContinue
  if($null -ne $link -and ($link.Attributes -band [IO.FileAttributes]::ReparsePoint) -and [IO.Path]::GetFullPath($link.Target) -eq $target){$completed+=[pscustomobject]@{Path=$file.path;Target=$target};continue}
  throw "Destination collision: $target"
 }
 $item=Get-Item -LiteralPath $source -Force
 if($item.Attributes -band [IO.FileAttributes]::ReparsePoint){throw "Refuse preexisting source link: $source"}
 if($item.Length -ne $file.bytes){$deferred+=$file.path;continue}
 $entries+=[pscustomobject]@{Path=$file.path;Source=$source;Target=$target;Bytes=$item.Length}
}
if(-not $Apply){[pscustomobject]@{Mode='dry-run';RemainingFiles=$entries.Count;CompletedFiles=$completed.Count;ChangedSinceInventory=$deferred.Count}|ConvertTo-Json -Compress;return}
$ledgerDirectory=Join-Path $dest 'migration';New-Item -ItemType Directory -Path $ledgerDirectory -Force|Out-Null
$prior=@(Get-ChildItem -LiteralPath $ledgerDirectory -Filter ($BatchName+'-move-*.jsonl') -File)
$records=@{}
foreach($f in $prior){foreach($line in [IO.File]::ReadLines($f.FullName)){if($line.Trim()){$record=$line|ConvertFrom-Json;if($records.ContainsKey($record.Path)){throw 'Duplicate prior receipt'};$records[$record.Path]=$record}}}
$count=0;$bytes=0L
foreach($done in $completed){
 $record=$records[$done.Path];if($null -eq $record){throw 'Missing prior integrity receipt'}
 if((Get-FileHash -LiteralPath $done.Target -Algorithm SHA256).Hash -ne $record.SHA256){throw 'Completed target changed since prior verification'}
 $count++;$bytes+=$record.Bytes
}
if($records.Count -ne $completed.Count){throw 'Prior receipts do not match completed source links'}
$ledger=Join-Path $ledgerDirectory ($BatchName+'-move-'+(Get-Date -Format 'yyyyMMdd-HHmmss')+'.jsonl')
$writer=[IO.StreamWriter]::new($ledger,$false,[Text.UTF8Encoding]::new($false))
try{
 foreach($entry in $entries){
  try{$before=(Get-FileHash -LiteralPath $entry.Source -Algorithm SHA256).Hash}
  catch{$active+=[pscustomobject]@{Path=$entry.Path;Reason=$_.Exception.Message};continue}
  New-Item -ItemType Directory -Path ([IO.Path]::GetDirectoryName($entry.Target)) -Force|Out-Null
  try{Move-Item -LiteralPath $entry.Source -Destination $entry.Target}
  catch{if((Test-Path -LiteralPath $entry.Source) -and -not (Test-Path -LiteralPath $entry.Target)){$active+=[pscustomobject]@{Path=$entry.Path;Reason=$_.Exception.Message};continue};throw}
  try{New-Item -ItemType SymbolicLink -Path $entry.Source -Target $entry.Target -ErrorAction Stop|Out-Null}
  catch{if(-not (Test-Path -LiteralPath $entry.Source)){Move-Item -LiteralPath $entry.Target -Destination $entry.Source};throw}
  $after=(Get-FileHash -LiteralPath $entry.Target -Algorithm SHA256).Hash
  if($before -ne $after -or (Get-Item -LiteralPath $entry.Target).Length -ne $entry.Bytes){throw "Integrity changed: $($entry.Path)"}
  $writer.WriteLine(([pscustomobject]@{Path=$entry.Path;SHA256=$after;Bytes=$entry.Bytes}|ConvertTo-Json -Compress))
  $count++;$bytes+=$entry.Bytes
  if($count % 100 -eq 0){$writer.Flush();Write-Output "Verified $count loose artifact files"}
 }
}finally{$writer.Dispose()}
$summary=[pscustomobject]@{Status='hash-verified';Files=$count;Bytes=$bytes;Ledger=@($prior.FullName)+@($ledger);DeferredChangedFiles=$deferred;DeferredActiveFiles=$active;CompatibilityFileLinks=$true}
$summary|ConvertTo-Json -Depth 4|Set-Content -LiteralPath (Join-Path $ledgerDirectory ($BatchName+'-move-summary.json')) -Encoding utf8
$summary|ConvertTo-Json -Depth 4 -Compress
