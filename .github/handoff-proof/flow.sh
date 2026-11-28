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

# a file that another program holds: the tool's rename must wait for it
note "$(node "$HELP/held-file.mjs" .)"

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

# A real update of the browser in the middle. Hosted macOS machines update Chrome while a job runs (seen in runs
# 46097010961 and 46100206929), and the render then stops, as it must. The flow does what the row of step 2.2 says,
# as the agent would: the short test again, then the same render line again. Three times at most in one job.
# The update that the tool's own test makes up has a line of its own further down and is not meant here.
UPDATES=0
UPDATE_WORDS='the browser was updated'
real_update() { grep -- "$UPDATE_WORDS" "$1" 2> /dev/null | grep -qv 'made up'; }
# the words that excuse a stopped render line, while the row can still be followed
also_ok() { [ "$UPDATES" -lt 3 ] && echo "$UPDATE_WORDS"; }
follow_row() {
  UPDATES=$((UPDATES + 1))
  note "a real update of the browser stopped the render ($(grep -- "$UPDATE_WORDS" "$1" | grep -v 'made up' | tail -1 | sed 's/: the browser was updated.*//' | sed 's/^FAIL: //' | tr -d '\r' | cut -c1-160)). The flow does what the row of step 2.2 says: the short test again, then the render line again"
  line "test-after-real-update-$UPDATES" 0 'node tools/handoff.mjs test'
}
# render_line NAME WANT [what its output must say]: the render line, followed to its end
render_line() {
  local name="$1"
  while :; do
    ALSO_OK="$(also_ok)" line "$name" "$2" 'node tools/handoff.mjs render' "${3:-}"
    if [ "$LAST_CODE" = 1 ] && [ "$UPDATES" -lt 3 ] && real_update "$PROOF_OUT/$name.out.txt"; then
      follow_row "$PROOF_OUT/$name.out.txt"
      name="$1-after-update-$UPDATES"
      continue
    fi
    break
  done
}

# from here on the switches of the tool's own tests are set
export HANDOFF_TEST="$PROOF_SWITCHES"
note "the switches of the tool's own tests from here on: $PROOF_SWITCHES"
line doctor 0 'node tools/handoff.mjs doctor'

if [ "$PROOF_MODE" = small ]; then
  # A short test that fails comes first, its failure made up by a switch of the tool's own tests: the row of step
  # 1.5 for a FAIL. One folder on the Desktop holds what the build thread needs, and the report names it.
  # The test that passes next takes that folder away.
  HANDOFF_TEST="$PROOF_SWITCHES,floors-high" line test-fails 1 'node tools/handoff.mjs test' 'TO SEND'
  note "$(node "$HELP/failed-test.mjs" . there small)"
  line test 0 'node tools/handoff.mjs test'
  note "$(node "$HELP/failed-test.mjs" . gone)"
  # step 2 begins with these four lines
  line pull 0 'git pull --ff-only' 'Already up to date'
  line setup-again 0 'node tools/handoff.mjs setup'
  line doctor-again 0 'node tools/handoff.mjs doctor'
  # on Windows the test film of the first test is held open meanwhile, as a player holds a film somebody looks at
  HOLDER=''
  SAYS=''
  if [ "$WIN" = yes ]; then
    export HELD_FILM="$(node -p "require('./out/work/handoff/test.json').testFilm.file")"
    powershell.exe -NoProfile -Command '$f = [System.IO.File]::Open($env:HELD_FILM, "Open", "Read", "None"); Start-Sleep -Seconds 3600' &
    HOLDER=$!
    sleep 8
    note "held open with no sharing while the test runs again, by process $HOLDER: $HELD_FILM"
    SAYS='is held open by another program'
  fi
  line test-again 0 'node tools/handoff.mjs test' "$SAYS"
  if [ -n "$HOLDER" ]; then
    WINPID="$(cat "/proc/$HOLDER/winpid" 2> /dev/null)"
    kill "$HOLDER" 2> /dev/null
    [ -n "$WINPID" ] && MSYS_NO_PATHCONV=1 taskkill /PID "$WINPID" /F > /dev/null 2>&1
    note "the program that held the test film is ended"
  fi
  # the first call, which comes back while the render goes on in the background. Then wait until at least two
  # chunks are finished, and end the process that renders, and it alone. When a real update of the browser stops
  # the render before that, the row is followed and the first call is made again
  FIRST=render-first-call
  REPORT=out/work/handoff/report-render.txt
  ENDED=''
  while :; do
    touch "$PROOF_OUT/before-the-render"
    ENDED=''
    ALSO_OK="$(also_ok)" ONCE=1 line "$FIRST" 3 'node tools/handoff.mjs render'
    if [ "$LAST_CODE" = 3 ]; then
      for i in $(seq 1 400); do
        [ "$(ls out/master/test/film-b/*.mp4 2> /dev/null | wc -l)" -ge 2 ] && break
        if [ "$REPORT" -nt "$PROOF_OUT/before-the-render" ] && tail -2 "$REPORT" | grep -q '^FAIL: '; then
          ENDED="$REPORT"
          break
        fi
        sleep 3
      done
    elif [ "$LAST_CODE" = 1 ]; then
      ENDED="$PROOF_OUT/$FIRST.out.txt"
    fi
    if [ -n "$ENDED" ] && [ "$UPDATES" -lt 3 ] && real_update "$ENDED"; then
      follow_row "$ENDED"
      FIRST="render-first-call-after-update-$UPDATES"
      continue
    fi
    break
  done
  CHUNK="$(ls out/master/test/film-b/*.mp4 2> /dev/null | head -1)"
  if [ -z "$CHUNK" ]; then
    SAID=''
    [ -n "$ENDED" ] && SAID=". The render said: $(grep -v '^[[:space:]]*$' "$ENDED" | tail -1 | tr -d '\r' | cut -c1-300)"
    note "PROBLEM: the render finished no chunk to stop it after; the flow ends here$SAID"
    node "$HELP/after.mjs" "$PROOF_OUT"
    exit 0
  fi
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
  # The short test again in the middle of the render, with finished chunks on disk. The calibration picture is
  # drawn once for a build on the machine and kept: a test that drew a new one here would leave chunks that name
  # two pictures, and the films would not be joined (hosted macOS draws it differently every time).
  CAL1="$(node -p "require('./out/work/master/calibration.json').sha256")"
  note "finished chunks of film B on disk before the test in the middle of the render: $(ls out/master/test/film-b/*.mp4 2> /dev/null | wc -l | tr -d ' ')"
  line test-in-mid-render 0 'node tools/handoff.mjs test' 'is kept and not drawn again'
  CAL2="$(node -p "require('./out/work/master/calibration.json').sha256")"
  note "the kept calibration picture before the test in the middle of the render: $CAL1; after it: $CAL2. $(node -p "'The second drawing of that test: ' + (((require('./out/work/handoff/test.json').calibration || {}).twice || {}).line || 'no line')")"
  [ "$CAL1" = "$CAL2" ] || note "PROBLEM: the test in the middle of the render replaced the kept calibration picture"
  note "finished chunks of film B on disk after the test in the middle of the render: $(ls out/master/test/film-b/*.mp4 2> /dev/null | wc -l | tr -d ' ')"
  # A browser that updated itself in the middle of the render, with chunks on disk (made up by a switch of the
  # tool's own tests): the render stops, the test is run again as the file says, and the render then carries on
  case ",$PROOF_SWITCHES," in *,browser-moved,*)
    line render-stops-for-browser 1 'node tools/handoff.mjs render' 'the browser was updated'
    note "finished chunks of film B on disk when the made up update stopped the render: $(ls out/master/test/film-b/*.mp4 2> /dev/null | wc -l | tr -d ' ')"
    line test-after-update 0 'node tools/handoff.mjs test' 'is kept and not drawn again'
    CAL3="$(node -p "require('./out/work/master/calibration.json').sha256")"
    note "the kept calibration picture after the test that followed the made up update: $CAL3"
    [ "$CAL1" = "$CAL3" ] || note "PROBLEM: the test after the made up update replaced the kept calibration picture"
    ;;
  esac
  render_line render-carries-on 0 'carrying on'
  SHA2="$(node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync(process.argv[1])).digest('hex'))" "$CHUNK")"
  note "the chunk finished before the stop: sha256 $SHA1; after the render carried on: $SHA2"
  [ "$SHA1" = "$SHA2" ] || note "PROBLEM: a chunk that was finished before the stop was drawn again"
  render_line render-again 0 'already'
  line check 0 'node tools/handoff.mjs check'
  line deliver 0 'node tools/handoff.mjs deliver'
  node "$HELP/after.mjs" "$PROOF_OUT"
  # the upload on a machine without a GitHub sign in: everything is made ready, then it refuses with the one line
  line upload-refuses 1 'node tools/handoff.mjs upload' 'is not signed in on this machine'
  note "made ready for the upload: $(ls -l out/work/handoff/upload 2> /dev/null | awk 'NR>1 {printf "%s bytes: ", $5; for (i = 9; i <= NF; i++) printf "%s ", $i; printf "|"}')"
  line clean 0 'node tools/handoff.mjs clean'
  # after the clean the upload still finds the delivered files and the records
  line upload-after-clean 1 'node tools/handoff.mjs upload' 'the work files are cleaned already'
else
  case ",$PROOF_SWITCHES," in
    *,floors-high,*)
      # the row of step 1.5 for a FAIL, with real pictures at 3840 x 2160: every frame fails against floors raised
      # out of reach, and the folder on the Desktop holds the sheet and what this machine drew
      line test-fails 1 'node tools/handoff.mjs test' 'TO SEND'
      note "$(node "$HELP/failed-test.mjs" . there uhd)"
      ;;
    *) line test 0 'node tools/handoff.mjs test' ;;
  esac
  # with a stamp that is released the render line would start the real render here, so it is left out then
  if [ "$(node "$HELP/released.mjs" .)" = yes ]; then
    note "the stamp of this clone is released: the render line is not run on a test machine"
  else
    line render-refuses-unreleased 1 'node tools/handoff.mjs render' 'not released for its final render yet'
  fi
  node "$HELP/after.mjs" "$PROOF_OUT"
fi
note "the flow ran to its end"
exit 0
