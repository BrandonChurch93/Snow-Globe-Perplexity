# Lists what the shader compiler of this machine writes about every program of the film, on one head of the repo:
# the head named in other-head.txt beside this file, or this push's own head when that file names none.
# The head is cloned and built in a folder of this machine. Nothing is changed in it and nothing is pushed.
HELP="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
. "$HELP/proof.sh"
ROOT="${PROOF_ROOT:-$RUNNER_TEMP_HERE/render proof}"
mkdir -p "$ROOT"
cd "$ROOT" || exit 0
OTHER="$(grep -v '^#' "$HELP/other-head.txt" 2> /dev/null | tr -d '\r' | grep '[^[:space:]]' | head -1)"
BRANCH="$(echo "$OTHER" | awk '{print $1}')"
SHA="$(echo "$OTHER" | awk '{print $2}')"
if [ -z "$BRANCH" ] || [ -z "$SHA" ]; then
  BRANCH="$PROOF_BRANCH"
  SHA="$GITHUB_SHA"
  note "other-head.txt names no head: the shaders of this push are listed"
fi
note "the head whose shaders are listed: branch $BRANCH, commit $SHA"
line clone 0 "git clone --filter=blob:none --single-branch --branch $BRANCH https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git shaders"
line cd 0 'cd shaders'
pwd > "$PROOF_OUT/clone-path-shaders.txt"
line checkout 0 "git checkout --quiet --detach $SHA"
note "clone head: $(git rev-parse HEAD)"
note "engine hash of this head: $(node "$HELP/engine-hash.mjs" .)"
line install 0 'npm ci --no-audit --no-fund'
line build 0 'npm run build'
export SHADERS_BRANCH="$BRANCH"
[ -n "${PROOF_LOCAL_ARGS:-}" ] && export SHOWCASE_LOCAL_ARGS="$PROOF_LOCAL_ARGS"
line shader-list 0 "node \"$HELP/shader-warnings.mjs\" . \"$PROOF_OUT/shader-list\" \"$HELP/../../tools/lib\"" 'programs linked by the page'
note "git status of that clone after the list: $(git status --short | tr '\n' '|')"
note "the flow ran to its end"
exit 0
