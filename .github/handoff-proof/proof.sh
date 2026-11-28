# Helpers of the proof workflow, for bash (Git Bash on Windows, Terminal on macOS). Sourced by flow.sh.
# line NAME WANT SELECTOR [what its output must say]
#   runs the selected guide command while it answers RUNNING, and records the command and its source.
#   The shader job has no guide source and passes its own commands instead.
#   WANT is the exit code that is wanted, or the word any. ONCE=1 before it runs the line one time only.
#   ALSO_OK='words' before it takes exit code 1 as wanted too when the output says those words.
set +e
# on Windows the folder comes as D:\a\_temp; bash wants /d/a/_temp
RUNNER_TEMP_HERE="$(cygpath -u "$RUNNER_TEMP" 2> /dev/null || echo "$RUNNER_TEMP")"
PROOF_OUT="${PROOF_OUT:-$RUNNER_TEMP_HERE/proof-out}"
mkdir -p "$PROOF_OUT"

note() {
  echo "$1"
  printf '%s\n' "$1" >> "$PROOF_OUT/notes.txt"
}

line() {
  local name="$1" want="$2" cmd="$3" must="${4:-}" n=0 code=0 ok=yes last said selected evidence=''
  if [ -n "${PROOF_GUIDE:-}" ]; then
    if ! selected="$(node "$HELP/guide-lines.mjs" select "$PROOF_GUIDE" "$cmd" "$PROOF_GUIDE_SOURCE")"; then
      note "PROBLEM: cannot select the guide command for $name"
      exit 1
    fi
    cmd="${selected%%$'\n'*}"
    evidence="${selected#*$'\n'}"
  fi
  local file="$PROOF_OUT/$name.out.txt"
  : > "$file"
  while :; do
    n=$((n + 1))
    echo "::group::$name, MEASURED call $n: $cmd"
    if [[ "$cmd" == cd\ * ]]; then
      eval "$cmd" >> "$file" 2>&1
      code=$?
      [ ! -s "$file" ] || cat "$file"
    else
      eval "$cmd" 2>&1 | tee -a "$file"
      code=${PIPESTATUS[0]}
    fi
    echo "::endgroup::"
    echo "   MEASURED exit code $code"
    if [ "$code" = 3 ] && [ -z "${ONCE:-}" ] && [ "$n" -lt 400 ]; then continue; fi
    break
  done
  said="$(grep -v '^[[:space:]]*$' "$file" | tail -1 | tr -d '\r' | tr '\t' ' ' | cut -c1-600)"
  last="$said"
  if [ "$want" != any ] && [ "$code" != "$want" ]; then ok=no; fi
  if [ -n "$must" ] && ! grep -Eqi -- "$must" "$file"; then
    ok=no
    last="(the output does not say: $must) $last"
  fi
  # a render line that a real update of the browser stopped is no failure of the proof: the file has a row for it,
  # and the flow follows that row next (see render_line in flow.sh)
  if [ -n "${ALSO_OK:-}" ] && [ "$code" = 1 ] && grep -- "$ALSO_OK" "$file" | grep -qv 'made up'; then
    ok=yes
    last="(${ALSO_NOTE:-stopped by a real update of the browser; the update row in the guide is followed next}) $said"
  fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "${cmd//$'\t'/ }" "$code" "$want" "$ok" "$n" "$last" "$evidence" >> "$PROOF_OUT/results.tsv"
  LAST_CODE=$code
  LAST_OK=$ok
}
