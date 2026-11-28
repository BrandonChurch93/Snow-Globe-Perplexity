# Helpers of the proof workflow, for bash (Git Bash on Windows, Terminal on macOS). Sourced by flow.sh.
# line NAME WANT 'the line' [what its output must say]
#   runs the line exactly as written, again while it ends with exit code 3 (RUNNING), and notes what came of it.
#   WANT is the exit code that is wanted, or the word any. ONCE=1 before it runs the line one time only.
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
  local name="$1" want="$2" cmd="$3" must="${4:-}" n=0 code=0 ok=yes last
  local file="$PROOF_OUT/$name.out.txt"
  : > "$file"
  while :; do
    n=$((n + 1))
    echo "::group::$name, call $n: $cmd"
    if [[ "$cmd" == cd\ * ]]; then
      eval "$cmd"
      code=$?
    else
      eval "$cmd" 2>&1 | tee -a "$file"
      code=${PIPESTATUS[0]}
    fi
    echo "::endgroup::"
    echo "   exit code $code"
    if [ "$code" = 3 ] && [ -z "${ONCE:-}" ] && [ "$n" -lt 400 ]; then continue; fi
    break
  done
  last="$(grep -v '^[[:space:]]*$' "$file" | tail -1 | tr -d '\r' | tr '\t' ' ' | cut -c1-600)"
  if [ "$want" != any ] && [ "$code" != "$want" ]; then ok=no; fi
  if [ -n "$must" ] && ! grep -Eqi -- "$must" "$file"; then
    ok=no
    last="(the output does not say: $must) $last"
  fi
  printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$name" "$cmd" "$code" "$want" "$ok" "$n" "$last" >> "$PROOF_OUT/results.tsv"
  LAST_CODE=$code
}
