# Helpers of the proof workflow, for Windows PowerShell. Dot sourced by flow.ps1.
# Line NAME WANT SELECTOR [what its output must say] [-Once]
#   runs the selected guide command while it answers RUNNING, and records the command and its source.
#   The upload's own test has no guide source and passes its own command instead.
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
  param([string]$Name, [string]$Want, [string]$Cmd, [string]$Must = '', [switch]$Once, [string]$AlsoOk = '')
  $evidence = ''
  if ($script:ProofGuide) {
    $selected = @(node (Join-Path $Help 'guide-lines.mjs') select $script:ProofGuide $Cmd $script:ProofGuideSource)
    if ($LASTEXITCODE -ne 0 -or $selected.Count -ne 2) {
      Note "PROBLEM: cannot select the guide command for $Name"
      exit 1
    }
    $Cmd = $selected[0]
    $evidence = $selected[1]
  }
  $n = 0
  $code = 0
  $all = New-Object System.Collections.Generic.List[string]
  do {
    $n++
    Write-Host "::group::$Name, MEASURED call ${n}: $Cmd"
    $global:LASTEXITCODE = 0
    try {
      if ($Cmd.StartsWith('cd ')) { $ErrorActionPreference = 'Stop' }
      & ([ScriptBlock]::Create($Cmd)) 2>&1 | ForEach-Object { Write-Host $_; $all.Add([string]$_) }
      $code = $global:LASTEXITCODE
    } catch {
      $code = 127
      $all.Add("PowerShell could not run the line: $($_.Exception.Message)")
      Write-Host "PowerShell could not run the line: $($_.Exception.Message)"
    }
    Write-Host '::endgroup::'
    Write-Host "   MEASURED exit code $code"
  } while ($code -eq 3 -and -not $Once -and $n -lt 400)
  [System.IO.File]::WriteAllLines((Join-Path $env:PROOF_OUT "$Name.out.txt"), $all, $script:Utf8)
  $last = ''
  foreach ($l in $all) { if ($l.Trim()) { $last = $l } }
  $last = $last -replace '[\r\n\t]', ' '
  if ($last.Length -gt 600) { $last = $last.Substring(0, 600) }
  $said = $last
  $ok = 'yes'
  if ($Want -ne 'any' -and "$code" -ne $Want) { $ok = 'no' }
  if ($Must -and -not (($all -join "`n") -match $Must)) {
    $ok = 'no'
    $last = "(the output does not say: $Must) $last"
  }
  if ($AlsoOk -and $code -eq 1 -and ($all -join "`n") -match $AlsoOk) {
    $ok = 'yes'
    $last = "(new information since the test; the hosted approval is retried once) $said"
  }
  $tsvCmd = $Cmd.Replace("`t", ' ')
  Add-Text 'results.tsv' ("$Name`t$tsvCmd`t$code`t$Want`t$ok`t$n`t$last`t$evidence")
  $script:LastOut = $all
  $script:LastCode = $code
  $script:LastOk = $ok -eq 'yes'
}
