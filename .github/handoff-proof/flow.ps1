# The lines of RENDER-ON-YOUR-PC.md in their order, in Windows PowerShell.
# What it is given: PROOF_BRANCH, PROOF_MODE (small, uhd, installs), PROOF_SWITCHES (the switches of the tool's own
# tests), PROOF_REFUSAL (yes when the machine draws in software and the doctor must refuse by itself first).
$Help = $PSScriptRoot
. (Join-Path $Help 'proof.ps1')
$Root = $env:PROOF_ROOT
if (-not $Root) { $Root = Join-Path $env:RUNNER_TEMP 'render proof' }
New-Item -ItemType Directory -Force -Path $Root | Out-Null
Set-Location -LiteralPath $Root
$Url = 'https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git'
$Branch = $env:PROOF_BRANCH
Note "shell: Windows PowerShell $($PSVersionTable.PSVersion)"
Note "folder: $Root"
Note ("git core.autocrlf here: " + ((git config --show-origin --get-all core.autocrlf) -join ' '))

$script:ProofGuide = Join-Path $Help '../../RENDER-ON-YOUR-PC.md'
$script:ProofGuideSource = 'bootstrap'
if ($env:PROOF_MODE -eq 'installs') {
  # the winget lines of the file, as written, on a machine that has most of the programs already
  Line 'winget-git' 'any' 'winget-git'
  Line 'winget-node' 'any' 'winget-node'
  Line 'winget-ffmpeg' 'any' 'winget-ffmpeg'
  Line 'winget-chrome' 'any' 'winget-chrome'
  Line 'winget-gh' 'any' 'winget-gh'
}

Line 'git-version' '0' 'git-version'
Line 'node-version' '0' 'node-version'
Line 'status-before-clone' '1' 'status' 'Cannot find module' -Once
if (-not $script:LastOk) { exit 1 }
Line 'clone' '0' 'clone'
if (-not $script:LastOk) { exit 1 }
Line 'cd' '0' 'cd'
if (-not $script:LastOk) { exit 1 }
[System.IO.File]::WriteAllText((Join-Path $env:PROOF_OUT 'clone-path.txt'), (Get-Location).Path)
$script:ProofGuide = Join-Path (Get-Location).Path 'RENDER-ON-YOUR-PC.md'
$script:ProofGuideSource = 'clone'
Line 'status-after-clone' '0' 'status' '(?m)^PASS: this is the clone of the film' -Once
if (-not $script:LastOk) { exit 1 }
$CloneHead = git rev-parse HEAD
Note "MEASURED clone head: $CloneHead, STATED pushed head: $env:GITHUB_SHA"
if ($env:GITHUB_SHA -and $CloneHead -ne $env:GITHUB_SHA) {
  Note 'PROBLEM: the clone is not the head of this job'
  exit 1
}
$StampHash = (Get-Content -Raw 'render/STAMP.json' | ConvertFrom-Json).engineHash
Note "engine hash of this clone, before anything is installed: $(node (Join-Path $Help 'engine-hash.mjs') .), the stamp's: $StampHash"

# the same clone under the setting that changes line endings on Windows: the .gitattributes of the repo must win
Note 'proof only: a separate clone checks line endings, and a held file checks rename behavior'
$Crlf = Join-Path $Root 'crlf check'
git -c core.autocrlf=true clone --quiet --filter=blob:none --single-branch --branch $Branch $Url $Crlf
$CrlfHash = node (Join-Path $Help 'engine-hash.mjs') $Crlf
Note "engine hash of a clone made with core.autocrlf=true: $CrlfHash"
if ($CrlfHash -ne $StampHash) { Note "PROBLEM: a clone under core.autocrlf=true has engine hash $CrlfHash, not the stamp's $StampHash" }
Remove-Item -LiteralPath $Crlf -Recurse -Force -ErrorAction SilentlyContinue

# a file that another program holds: the tool's rename must wait for it
Note (node (Join-Path $Help 'held-file.mjs') .)

Line 'setup' '0' 'setup'
Note ("git status after setup: " + ((git status --short) -join '|'))

# the doctor by itself: it names what is missing, each with its install line
Line 'doctor-first' 'any' 'doctor' -Once
$First = $script:LastOut -join "`n"
if ($First -match 'winget install --id Gyan\.FFmpeg') {
  Line 'install-ffmpeg' 'any' 'winget-ffmpeg'
  Line 'doctor-after-install' 'any' 'doctor' -Once
  if (($script:LastOut -join "`n") -match 'winget install --id Gyan\.FFmpeg') {
    Note 'PROBLEM: the winget line did not bring ffmpeg to this machine. It is brought by choco so that the rest can be proven'
    choco install ffmpeg -y --no-progress
  }
}
if ($First -match 'winget install --id Google\.Chrome') {
  Line 'install-chrome' 'any' 'winget-chrome'
}
if ($env:PROOF_REFUSAL -eq 'yes') {
  Line 'doctor-refuses-software' '1' 'doctor' 'draws in software'
} else {
  Line 'doctor-by-itself' 'any' 'doctor'
}

if ($env:PROOF_MODE -eq 'installs') {
  Note 'the flow ran to its end'
  exit 0
}

# from here on the switches of the tool's own tests are set
$env:HANDOFF_TEST = $env:PROOF_SWITCHES
Note "the switches of the tool's own tests from here on: $($env:PROOF_SWITCHES)"
Line 'doctor' '0' 'doctor'

# A browser that is not the handoff's own outlives the handoff's sweep (other-browser.mjs says how it is proven).
# The clone of this flow lies in a folder with a space in its path.
Note ((node (Join-Path $Help 'other-browser.mjs') . (Join-Path $env:PROOF_OUT 'other-browser.txt')) -join ' ')

function Read-GuideGuard([string]$Selector) {
  $found = node (Join-Path $Help 'guide-lines.mjs') has $script:ProofGuide $Selector
  if ($LASTEXITCODE -ne 0) {
    Note "PROBLEM: cannot select the guide command for $Selector"
    exit 1
  }
  return $found -eq 'yes'
}
$RenderGuard = Read-GuideGuard 'approve-render'
$UploadGuard = Read-GuideGuard 'approve-upload'
function Approve-Render([string]$Name) {
  if (-not $RenderGuard) { return }
  Line $Name '0' 'approve-render' 'the full render is approved on this machine' -AlsoOk 'is new since the test'
  if ($script:LastCode -eq 1 -and $script:LastOk) {
    Line "$Name-retry" '0' 'approve-render' 'the full render is approved on this machine'
  }
  if (-not $script:LastOk) { exit 1 }
}

if ($env:PROOF_MODE -eq 'small') {
  # A short test that fails comes first, its failure made up by a switch of the tool's own tests: the row of step
  # 1.5 for a FAIL. One folder on the Desktop holds what the build thread needs, and the report names it.
  # The test that passes next takes that folder away.
  $env:HANDOFF_TEST = "$($env:PROOF_SWITCHES),floors-high"
  Line 'test-fails' '1' 'test' 'TO SEND'
  $env:HANDOFF_TEST = $env:PROOF_SWITCHES
  Note (node (Join-Path $Help 'failed-test.mjs') . there small)
  Line 'test' '0' 'test'
  Note (node (Join-Path $Help 'failed-test.mjs') . gone)
  # step 2 begins with these four lines
  Line 'pull' '0' 'pull' 'Already up to date'
  if (-not $script:LastOk) { exit 1 }
  Line 'setup-again' '0' 'setup'
  Line 'doctor-again' '0' 'doctor'
  Line 'test-again' '0' 'test'
  if (-not $script:LastOk) { exit 1 }
  if ($RenderGuard) {
    # The render reads the machine and opens the page before it can say whether a yes fits this build, so its
    # first answer may be RUNNING. The file says what to do then: run the same line again. So this row is
    # followed to its last word, and never asked for its refusal in one call.
    Line 'render-refuses-unapproved' '1' 'render' 'the full render is not approved on this machine'
    if (-not $script:LastOk) { exit 1 }
  }
  Approve-Render 'approve-render-before-first'
  Line 'render-first-call' '3' 'render' -Once
  # wait until at least two chunks are finished, then end the process that renders and everything it started
  $Chunk = $null
  $Chunks = @()
  $Tries = 0
  if ($script:LastCode -eq 3) { $Tries = 400 }
  for ($i = 0; $i -lt $Tries -and $Chunks.Count -lt 2; $i++) {
    $Chunks = @(Get-ChildItem -Path 'out/master/test/film-b' -Filter '*.mp4' -ErrorAction SilentlyContinue | Sort-Object Name)
    if ($Chunks.Count -lt 2) { Start-Sleep -Seconds 3 }
  }
  if ($Chunks.Count -ge 1) { $Chunk = $Chunks[0] }
  if (-not $Chunk) {
    Note 'PROBLEM: the render finished no chunk to stop it after; the flow ends here'
    node (Join-Path $Help 'after.mjs') $env:PROOF_OUT
    exit 0
  }
  $Sha1 = (Get-FileHash -LiteralPath $Chunk.FullName -Algorithm SHA256).Hash
  $Job = Get-Content -Raw 'out/work/handoff/job.json' | ConvertFrom-Json
  Note "the render is at work as process $($Job.pid); first finished chunk: $($Chunk.Name)"
  Note ("powercfg /requests while the render is at work: " + ((powercfg /requests) -join '|'))
  taskkill /PID $Job.pid /T /F
  Note 'the process that renders was ended by force with everything it had started'
  Start-Sleep -Seconds 3
  # The short test again in the middle of the render, with finished chunks on disk. The calibration picture is
  # drawn once for a build on the machine and kept: a test that drew a new one here would leave chunks that name
  # two pictures, and the films would not be joined.
  $Cal1 = (Get-Content -Raw 'out/work/master/calibration.json' | ConvertFrom-Json).sha256
  Note "finished chunks of film B on disk before the test in the middle of the render: $(@(Get-ChildItem -Path 'out/master/test/film-b' -Filter '*.mp4' -ErrorAction SilentlyContinue).Count)"
  Line 'test-in-mid-render' '0' 'test' 'is kept and not drawn again'
  if (-not $script:LastOk) { exit 1 }
  Approve-Render 'approve-render-after-mid-test'
  $Cal2 = (Get-Content -Raw 'out/work/master/calibration.json' | ConvertFrom-Json).sha256
  $Twice = (Get-Content -Raw 'out/work/handoff/test.json' | ConvertFrom-Json).calibration.twice.line
  Note "the kept calibration picture before the test in the middle of the render: $Cal1; after it: $Cal2. The second drawing of that test: $Twice"
  if ($Cal1 -ne $Cal2) { Note 'PROBLEM: the test in the middle of the render replaced the kept calibration picture' }
  Note "finished chunks of film B on disk after the test in the middle of the render: $(@(Get-ChildItem -Path 'out/master/test/film-b' -Filter '*.mp4' -ErrorAction SilentlyContinue).Count)"
  Line 'render-carries-on' '0' 'render' 'carrying on'
  $Sha2 = (Get-FileHash -LiteralPath $Chunk.FullName -Algorithm SHA256).Hash
  Note "the chunk finished before the stop: sha256 $Sha1; after the render carried on: $Sha2"
  if ($Sha1 -ne $Sha2) { Note 'PROBLEM: a chunk that was finished before the stop was drawn again' }
  Line 'render-again' '0' 'render' 'already'
  Line 'check' '0' 'check'
  if ($UploadGuard) {
    Line 'approve-upload-before-deliver' '1' 'approve-upload' 'are not delivered to the Desktop yet'
    if (-not $script:LastOk) { exit 1 }
  }
  Line 'deliver' '0' 'deliver'
  node (Join-Path $Help 'after.mjs') $env:PROOF_OUT
  if ($UploadGuard) {
    Line 'approve-upload-refuses' '1' 'approve-upload' 'is not signed in on this machine'
    if (-not $script:LastOk) { exit 1 }
    Line 'upload-refuses' '1' 'upload' 'the upload is not approved on this machine'
  } else {
    Line 'upload-refuses' '1' 'upload' 'is not signed in on this machine'
    Note ("made ready for the upload: " + ((Get-ChildItem -Path 'out/work/handoff/upload' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Name) $($_.Length) bytes" }) -join '|'))
  }
  Line 'clean' '0' 'clean'
  if ($UploadGuard) {
    Line 'upload-after-clean' '1' 'upload' 'the upload is not approved on this machine'
  } else {
    Line 'upload-after-clean' '1' 'upload' 'the work files are cleaned already'
  }
} else {
  if (",$($env:PROOF_SWITCHES)," -like '*,floors-high,*') {
    # the row of step 1.5 for a FAIL, with real pictures at 3840 x 2160: every frame fails against floors raised
    # out of reach, and the folder on the Desktop holds the sheet and what this machine drew
    Line 'test-fails' '1' 'test' 'TO SEND'
    Note (node (Join-Path $Help 'failed-test.mjs') . there uhd)
  } else {
    Line 'test' '0' 'test'
  }
  # with a stamp that is released the render line would start the real render here, so it is left out then
  if ((node (Join-Path $Help 'released.mjs') .) -eq 'yes') {
    Note 'the stamp of this clone is released: the render line is not run on a test machine'
  } else {
    Line 'render-refuses-unreleased' '1' 'node tools/handoff.mjs render' 'not released for its final render yet'
  }
  node (Join-Path $Help 'after.mjs') $env:PROOF_OUT
}
Note 'the flow ran to its end'
exit 0
