# The upload's own test on a hosted Windows machine, run from inside the plain clone. The step that calls this
# carries the token of the run in its environment, as GH_TOKEN, for gh alone; nothing here reads or prints it.
# The word it runs is a word of the tool's own tests and is, by design, no line of RENDER-ON-YOUR-PC.md.
$Help = $PSScriptRoot
. (Join-Path $Help 'proof.ps1')
$Clone = Split-Path (Split-Path $Help -Parent) -Parent
Set-Location -LiteralPath $Clone
[System.IO.File]::WriteAllText((Join-Path $env:PROOF_OUT 'clone-path.txt'), (Get-Location).Path)
Note "shell: Windows PowerShell $($PSVersionTable.PSVersion)"
Note "folder: $Clone"
Note "clone head: $(git rev-parse HEAD), pushed: $env:GITHUB_SHA"
Note ("gh on this machine: " + ((gh --version) | Select-Object -First 1))
Line 'upload-test' '0' 'node tools/handoff.mjs upload-test' "No release with the test's mark is left"
node (Join-Path $Help 'after.mjs') $env:PROOF_OUT
Note 'the flow ran to its end'
exit 0
