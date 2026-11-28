# Draws one guard still of the film in the clone the shader list was made from, in the installed Chrome of this
# machine, and keeps the picture and its record as the tool wrote them, to be looked at far away.
# It is a step of its own, with its own time limit, so that a still that hangs cannot take the shader list with it.
# The line is the guard's own line of the build thread, with --local added: without it the tool asks for the pinned
# browser of the cloud machines, which a Windows machine does not have.
HELP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HELP/proof.sh"
CLONE="$(tr -d '\r' < "$PROOF_OUT/clone-path-shaders.txt" 2> /dev/null)"
if [ -z "$CLONE" ] || ! cd "$CLONE"; then
  note "PROBLEM: the still was not drawn: the clone the shader list was made from is not there"
  exit 0
fi
[ -n "${PROOF_LOCAL_ARGS:-}" ] && export SHOWCASE_LOCAL_ARGS="$PROOF_LOCAL_ARGS"
note "the still is drawn in: $(pwd), at commit $(git rev-parse HEAD), engine hash $(node "$HELP/engine-hash.mjs" .)"
ONCE=1 line still-fall-rest 0 'npm run -s still -- --season fall --state rest --camera hero --tier draft --format hd --force --local' '^rendered '
mkdir -p "$PROOF_OUT/looks"
for f in out/work/stills/fall-rest-hero-hd-draft.png out/work/stills/fall-rest-hero-hd-draft.png.json; do
  if [ -f "$f" ]; then
    cp "$f" "$PROOF_OUT/looks/"
    note "the still: $f, $(wc -c < "$f" | tr -d ' ') bytes, sha256 $(sha256sum "$f" | awk '{print $1}')"
  else
    note "the still: $f is not there"
  fi
done
note "git status of that clone after the still: $(git status --short | tr '\n' '|')"
exit 0
