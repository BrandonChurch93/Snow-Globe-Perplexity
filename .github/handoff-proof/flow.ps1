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

if ($env:PROOF_MODE -eq 'installs') {
  # the winget lines of the file, as written, on a machine that has most of the programs already
  Line 'winget-git' 'any' 'winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements'
  Line 'winget-node' 'any' 'winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements'
  Line 'winget-ffmpeg' 'any' 'winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements'
  Line 'winget-chrome' 'any' 'winget install --id Google.Chrome -e --source winget --accept-package-agreements --accept-source-agreements'
  Line 'winget-gh' 'any' 'winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements'
}

Line 'git-version' '0' 'git --version'
Line 'node-version' '0' 'node --version'
Line 'clone' '0' "git clone --filter=blob:none --single-branch --branch $Branch $Url Snow-Globe-Perplexity"
Line 'cd' '0' 'cd Snow-Globe-Perplexity'
[System.IO.File]::WriteAllText((Join-Path $env:PROOF_OUT 'clone-path.txt'), (Get-Location).Path)
Note "clone head: $(git rev-parse HEAD), pushed: $env:GITHUB_SHA"
$StampHash = (Get-Content -Raw 'render/STAMP.json' | ConvertFrom-Json).engineHash
Note "engine hash of this clone, before anything is installed: $(node (Join-Path $Help 'engine-hash.mjs') .), the stamp's: $StampHash"

# the same clone under the setting that changes line endings on Windows: the .gitattributes of the repo must win
$Crlf = Join-Path $Root 'crlf check'
git -c core.autocrlf=true clone --quiet --filter=blob:none --single-branch --branch $Branch $Url $Crlf
$CrlfHash = node (Join-Path $Help 'engine-hash.mjs') $Crlf
Note "engine hash of a clone made with core.autocrlf=true: $CrlfHash"
if ($CrlfHash -ne $StampHash) { Note "PROBLEM: a clone under core.autocrlf=true has engine hash $CrlfHash, not the stamp's $StampHash" }
Remove-Item -LiteralPath $Crlf -Recurse -Force -ErrorAction SilentlyContinue

# a file that another program holds: the tool's rename must wait for it
Note (node (Join-Path $Help 'held-file.mjs') .)

Line 'setup' '0' 'node tools/handoff.mjs setup'
Note ("git status after setup: " + ((git status --short) -join '|'))

# the doctor by itself: it names what is missing, each with its install line
Line 'doctor-first' 'any' 'node tools/handoff.mjs doctor' -Once
$First = $script:LastOut -join "`n"
if ($First -match 'winget install --id Gyan\.FFmpeg') {
  Line 'install-ffmpeg' 'any' 'winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements'
  Line 'doctor-after-install' 'any' 'node tools/handoff.mjs doctor' -Once
  if (($script:LastOut -join "`n") -match 'winget install --id Gyan\.FFmpeg') {
    Note 'PROBLEM: the winget line did not bring ffmpeg to this machine. It is brought by choco so that the rest can be proven'
    choco install ffmpeg -y --no-progress
  }
}
if ($First -match 'winget install --id Google\.Chrome') {
  Line 'install-chrome' 'any' 'winget install --id Google.Chrome -e --source winget --accept-package-agreements --accept-source-agreements'
}
if ($env:PROOF_REFUSAL -eq 'yes') {
  Line 'doctor-refuses-software' '1' 'node tools/handoff.mjs doctor' 'draws in software'
} else {
  Line 'doctor-by-itself' 'any' 'node tools/handoff.mjs doctor'
}

if ($env:PROOF_MODE -eq 'installs') {
  Note 'the flow ran to its end'
  exit 0
}

# from here on the switches of the tool's own tests are set
$env:HANDOFF_TEST = $env:PROOF_SWITCHES
Note "the switches of the tool's own tests from here on: $($env:PROOF_SWITCHES)"
Line 'doctor' '0' 'node tools/handoff.mjs doctor'

if ($env:PROOF_MODE -eq 'small') {
  # A short test that fails comes first, its failure made up by a switch of the tool's own tests: the row of step
  # 1.5 for a FAIL. One folder on the Desktop holds what the build thread needs, and the report names it.
  # The test that passes next takes that folder away.
  $env:HANDOFF_TEST = "$($env:PROOF_SWITCHES),floors-high"
  Line 'test-fails' '1' 'node tools/handoff.mjs test' 'TO SEND'
  $env:HANDOFF_TEST = $env:PROOF_SWITCHES
  Note (node (Join-Path $Help 'failed-test.mjs') . there small)
  Line 'test' '0' 'node tools/handoff.mjs test'
  Note (node (Join-Path $Help 'failed-test.mjs') . gone)
  # step 2 begins with these four lines
  Line 'pull' '0' 'git pull --ff-only' 'Already up to date'
  Line 'setup-again' '0' 'node tools/handoff.mjs setup'
  Line 'doctor-again' '0' 'node tools/handoff.mjs doctor'
  Line 'test-again' '0' 'node tools/handoff.mjs test'
  Line 'render-first-call' '3' 'node tools/handoff.mjs render' -Once
  # wait for the first finished chunk, then end the process that renders and everything it started
  $Chunk = $null
  $Tries = 0
  if ($script:LastCode -eq 3) { $Tries = 400 }
  for ($i = 0; $i -lt $Tries -and -not $Chunk; $i++) {
    $Chunk = Get-ChildItem -Path 'out/master/test/film-b' -Filter '*.mp4' -ErrorAction SilentlyContinue | Select-Object -First 1
    if (-not $Chunk) { Start-Sleep -Seconds 3 }
  }
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
  Line 'render-carries-on' '0' 'node tools/handoff.mjs render' 'carrying on'
  $Sha2 = (Get-FileHash -LiteralPath $Chunk.FullName -Algorithm SHA256).Hash
  Note "the chunk finished before the stop: sha256 $Sha1; after the render carried on: $Sha2"
  if ($Sha1 -ne $Sha2) { Note 'PROBLEM: a chunk that was finished before the stop was drawn again' }
  Line 'render-again' '0' 'node tools/handoff.mjs render' 'already'
  Line 'check' '0' 'node tools/handoff.mjs check'
  Line 'deliver' '0' 'node tools/handoff.mjs deliver'
  node (Join-Path $Help 'after.mjs') $env:PROOF_OUT
  # the upload on a machine without a GitHub sign in: everything is made ready, then it refuses with the one line
  Line 'upload-refuses' '1' 'node tools/handoff.mjs upload' 'is not signed in on this machine'
  Note ("made ready for the upload: " + ((Get-ChildItem -Path 'out/work/handoff/upload' -ErrorAction SilentlyContinue | ForEach-Object { "$($_.Name) $($_.Length) bytes" }) -join '|'))
  Line 'clean' '0' 'node tools/handoff.mjs clean'
  # after the clean the upload still finds the delivered files and the records
  Line 'upload-after-clean' '1' 'node tools/handoff.mjs upload' 'the work files are cleaned already'
} else {
  if (",$($env:PROOF_SWITCHES)," -like '*,floors-high,*') {
    # the row of step 1.5 for a FAIL, with real pictures at 3840 x 2160: every frame fails against floors raised
    # out of reach, and the folder on the Desktop holds the sheet and what this machine drew
    Line 'test-fails' '1' 'node tools/handoff.mjs test' 'TO SEND'
    Note (node (Join-Path $Help 'failed-test.mjs') . there uhd)
  } else {
    Line 'test' '0' 'node tools/handoff.mjs test'
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
