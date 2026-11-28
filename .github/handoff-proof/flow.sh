# The lines of RENDER-ON-YOUR-PC.md in their order, in bash: Git Bash on Windows, Terminal on macOS.
# What it is given: PROOF_BRANCH, PROOF_MODE (small, uhd), PROOF_SWITCHES (the switches of the tool's own tests),
# PROOF_REFUSAL (yes when the machine draws in software and the doctor must refuse by itself first).
HELP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HELP/proof.sh"
WIN=no
case "$(uname -s)" in MINGW* | MSYS* | CYGWIN*) WIN=yes ;; esac
ROOT="${PROOF_ROOT:-$RUNNER_TEMP_HERE/render proof}"
mkdir -p "$ROOT"
cd "$ROOT" || exit 0
note "shell: bash $BASH_VERSION on $(uname -s)"
note "folder: $ROOT"
note "git core.autocrlf here: $(git config --show-origin --get-all core.autocrlf | tr '\n' ' ')"

line git-version 0 'git --version'
line node-version 0 'node --version'
line clone 0 "git clone --filter=blob:none --single-branch --branch $PROOF_BRANCH https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git Snow-Globe-Perplexity"
line cd 0 'cd Snow-Globe-Perplexity'
if [ "$WIN" = yes ]; then pwd -W > "$PROOF_OUT/clone-path.txt"; else pwd > "$PROOF_OUT/clone-path.txt"; fi
note "clone head: $(git rev-parse HEAD), pushed: ${GITHUB_SHA:-}"
STAMP_HASH="$(node -p "require('./render/STAMP.json').engineHash")"
note "engine hash of this clone, before anything is installed: $(node "$HELP/engine-hash.mjs" .), the stamp's: $STAMP_HASH"

# the same clone under the setting that changes line endings on Windows: the .gitattributes of the repo must win
( cd "$ROOT" && git -c core.autocrlf=true clone --quiet --filter=blob:none --single-branch --branch "$PROOF_BRANCH" https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git "crlf check" )
CRLF_HASH="$(node "$HELP/engine-hash.mjs" "$ROOT/crlf check")"
note "engine hash of a clone made with core.autocrlf=true: $CRLF_HASH"
[ "$CRLF_HASH" = "$STAMP_HASH" ] || note "PROBLEM: a clone under core.autocrlf=true has engine hash $CRLF_HASH, not the stamp's $STAMP_HASH"
rm -rf "$ROOT/crlf check"

line setup 0 'node tools/handoff.mjs setup'
note "git status after setup: $(git status --short | tr '\n' '|')"

# the doctor by itself: it names what is missing, each with its install line
ONCE=1 line doctor-first any 'node tools/handoff.mjs doctor'
FIRST="$PROOF_OUT/doctor-first.out.txt"
if [ "$WIN" = yes ]; then
  if grep -q 'winget install --id Gyan.FFmpeg' "$FIRST"; then
    line install-ffmpeg any 'winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements'
    ONCE=1 line doctor-after-install any 'node tools/handoff.mjs doctor'
    if grep -q 'winget install --id Gyan.FFmpeg' "$PROOF_OUT/doctor-after-install.out.txt"; then
      note "PROBLEM: the winget line did not bring ffmpeg to this machine. It is brought by choco so that the rest can be proven"
      choco install ffmpeg -y --no-progress
    fi
  fi
  grep -q 'winget install --id Google.Chrome' "$FIRST" && line install-chrome any 'winget install --id Google.Chrome -e --source winget --accept-package-agreements --accept-source-agreements'
else
  grep -q 'brew install ffmpeg' "$FIRST" && line install-ffmpeg 0 'brew install ffmpeg'
  grep -q 'brew install --cask google-chrome' "$FIRST" && line install-chrome 0 'brew install --cask google-chrome'
fi
if [ "${PROOF_REFUSAL:-no}" = yes ]; then
  line doctor-refuses-software 1 'node tools/handoff.mjs doctor' 'draws in software'
else
  line doctor-by-itself any 'node tools/handoff.mjs doctor'
fi

# from here on the switches of the tool's own tests are set
export HANDOFF_TEST="$PROOF_SWITCHES"
note "the switches of the tool's own tests from here on: $PROOF_SWITCHES"
line doctor 0 'node tools/handoff.mjs doctor'

if [ "$PROOF_MODE" = small ]; then
  line test 0 'node tools/handoff.mjs test'
  ONCE=1 line render-first-call 3 'node tools/handoff.mjs render'
  # wait for the first finished chunk, then end the process that renders, and it alone
  for i in $(seq 1 600); do
    ls out/master/test/film-b/*.mp4 > /dev/null 2>&1 && break
    sleep 3
  done
  CHUNK="$(ls out/master/test/film-b/*.mp4 2> /dev/null | head -1)"
  SHA1="$(node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1])).digest('hex'))" "$CHUNK")"
  PID="$(node -p "require('./out/work/handoff/job.json').pid")"
  note "the render is at work as process $PID; first finished chunk: $CHUNK"
  if [ "$WIN" = yes ]; then
    note "powercfg /requests while the render is at work: $(MSYS_NO_PATHCONV=1 powercfg /requests | tr -d '\r' | tr '\n' '|')"
    MSYS_NO_PATHCONV=1 taskkill /PID "$PID" /F
  else
    note "pmset -g assertions while the render is at work: $(pmset -g assertions | grep -i caffeinate | tr '\n' '|')"
    kill -9 "$PID"
  fi
  note "the process that renders was ended by force, and only it: what it had started is left behind"
  sleep 3
  line render-carries-on 0 'node tools/handoff.mjs render' 'carrying on'
  SHA2="$(node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1])).digest('hex'))" "$CHUNK")"
  note "the chunk finished before the stop: sha256 $SHA1; after the render carried on: $SHA2"
  [ "$SHA1" = "$SHA2" ] || note "PROBLEM: a chunk that was finished before the stop was drawn again"
  line render-again 0 'node tools/handoff.mjs render' 'already'
  line check 0 'node tools/handoff.mjs check'
  line deliver 0 'node tools/handoff.mjs deliver'
  node "$HELP/after.mjs" "$PROOF_OUT"
  line clean 0 'node tools/handoff.mjs clean'
else
  line test 0 'node tools/handoff.mjs test'
  line render-refuses-unreleased 1 'node tools/handoff.mjs render' 'not released for its final render yet'
  node "$HELP/after.mjs" "$PROOF_OUT"
fi
note "the flow ran to its end"
exit 0
