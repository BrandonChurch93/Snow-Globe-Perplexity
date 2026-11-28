# Helpers of the proof workflow, for Windows PowerShell. Dot sourced by flow.ps1.
# Line NAME WANT 'the line' [what its output must say] [-Once]
#   runs the line exactly as written, again while it ends with exit code 3 (RUNNING), and notes what came of it.
#   WANT is the exit code that is wanted, or the word any.
$ErrorActionPreference = 'Continue'
if (-not $env:PROOF_OUT) { $env:PROOF_OUT = Join-Path $env:RUNNER_TEMP 'proof-out' }
New-Item -ItemType Directory -Force -Path $env:PROOF_OUT | Out-Null
$script:Utf8 = New-Object System.Text.UTF8Encoding($false)

function Add-Text([string]$file, [string]$text) {
  [System.IO.File]::AppendAllText((Join-Path $env:PROOF_OUT $file), $text + "`n", $script:Utf8)
}

function Note([string]$text) {
  Write-Host $text
  Add-Text 'notes.txt' $text
}

function Line {
  param([string]$Name, [string]$Want, [string]$Cmd, [string]$Must = '', [switch]$Once)
  $n = 0
  $code = 0
  $all = New-Object System.Collections.Generic.List[string]
  do {
    $n++
    Write-Host "::group::$Name, call ${n}: $Cmd"
    $global:LASTEXITCODE = 0
    try {
      Invoke-Expression $Cmd | ForEach-Object { Write-Host $_; $all.Add([string]$_) }
      $code = $global:LASTEXITCODE
    } catch {
      $code = 127
      $all.Add("PowerShell could not run the line: $($_.Exception.Message)")
      Write-Host "PowerShell could not run the line: $($_.Exception.Message)"
    }
    Write-Host '::endgroup::'
    Write-Host "   exit code $code"
  } while ($code -eq 3 -and -not $Once -and $n -lt 400)
  [System.IO.File]::WriteAllLines((Join-Path $env:PROOF_OUT "$Name.out.txt"), $all, $script:Utf8)
  $last = ''
  foreach ($l in $all) { if ($l.Trim()) { $last = $l } }
  $last = $last.Replace("`t", ' ')
  if ($last.Length -gt 600) { $last = $last.Substring(0, 600) }
  $ok = 'yes'
  if ($Want -ne 'any' -and "$code" -ne $Want) { $ok = 'no' }
  if ($Must -and -not (($all -join "`n") -match $Must)) {
    $ok = 'no'
    $last = "(the output does not say: $Must) $last"
  }
  Add-Text 'results.tsv' ("$Name`t$Cmd`t$code`t$Want`t$ok`t$n`t$last")
  $script:LastOut = $all
  $script:LastCode = $code
}
