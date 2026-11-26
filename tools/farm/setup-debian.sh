#!/usr/bin/env bash
# Sets up one render-farm machine and proves it draws the standard picture.
#
#   COMMIT=<commit> bash setup-debian.sh <wanted calibration line>
#   COMMIT=e8b3d2cf bash setup-debian.sh ba63d3b2ceb11deb5db2ee01024ba807d9354f4447e9d849af15add72629607d
#
# The wanted line is the sha256 that `npm run master -- --calibrate` prints on the standard machines at that
# commit (with or without the word `calibration` before it). It changes with the build, so it is an argument.
# The script ends with exit 1 and a loud message when this machine prints another line: such a machine must
# not draw a frame of a master.
#
# Assumes: Debian 13 x86_64 (glibc 2.38 or newer), passwordless sudo, and network to deb.debian.org, nodejs.org,
# archive.ubuntu.com (or mirrors.kernel.org), github.com and cdn.playwright.dev.
# Safe to run again: every step looks at what is already there. About 1 GB of downloads the first time.
#
# The driver is the one the sandbox machines have: Ubuntu 26.04's Mesa 26.0.8 (lavapipe) with LLVM 21.1.8,
# unpacked into a folder, not installed. Debian's own Mesa 25.0.7 fails WebGL2 under this browser, and the
# Debian backport 26.1.6 draws other bytes (another calibration line).
#
# Every later render on the machine needs the variables of $MESA/u2608/env.sh: `. /tmp/mesa/u2608/env.sh`.
# THREADS=<n> sets LP_NUM_THREADS by hand; NODE_VERSION=<x.y.z> another Node.
set -euo pipefail

MESA=${MESA:-/tmp/mesa}; REPO=${REPO:-/tmp/sg/m1}; COMMIT=${COMMIT:-main}
WANT=${*:-}; WANT=${WANT#calibration }
if ! [[ $WANT =~ ^[0-9a-f]{64}$ ]]; then
  echo "usage: COMMIT=<commit> bash setup-debian.sh <wanted calibration line: 64 hex digits>" >&2
  exit 2
fi

export DEBIAN_FRONTEND=noninteractive
sudo -n apt-get update -qq
# The first line is for the tools, the second for lavapipe, the rest for the browser.
sudo -n DEBIAN_FRONTEND=noninteractive apt-get install -y -qq git curl unzip xz-utils ffmpeg ca-certificates \
  libvulkan1 libdrm2 libxcb1 libxcb-randr0 libxcb-dri3-0 libxcb-present0 libxcb-xfixes0 libxcb-sync1 libxcb-shm0 libxshmfence1 libx11-xcb1 libexpat1 libedit2 libzstd1 libz3-4 \
  libasound2t64 libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libdbus-1-3 libgbm1 libglib2.0-0t64 libnspr4 libnss3 libudev1 libx11-6 libxcomposite1 libxdamage1 libxext6 libxfixes3 libxi6 libxkbcommon0 libxrandr2 libxrender1

# 1. Node. The standard for every tool, test and render of this build is Node 20.20.2 (the sandbox machines'
# version; a machine's own Node may be another, and one test of the build fails on Node 26). It is unpacked
# beside the driver, outside the repo, and put first in PATH here and in env.sh.
NODE_VERSION=${NODE_VERSION:-20.20.2}
NODE_SHA_20_20_2=df770b2a6f130ed8627c9782c988fda9669fa23898329a61a871e32f965e007d
NTAR=node-v$NODE_VERSION-linux-x64.tar.xz; NDIR=$MESA/node/node-v$NODE_VERSION-linux-x64
mkdir -p "$MESA/node" && cd "$MESA/node"
if [ "$("$NDIR/bin/node" -v 2>/dev/null || true)" != "v$NODE_VERSION" ]; then
  curl -fsSL -o SHASUMS256.txt "https://nodejs.org/dist/v$NODE_VERSION/SHASUMS256.txt"
  NSUM=$(awk -v f="$NTAR" '$2 == f { print $1 }' SHASUMS256.txt)
  if [ "$NODE_VERSION" = 20.20.2 ] && [ "$NSUM" != "$NODE_SHA_20_20_2" ]; then echo "SHASUMS256.txt names another sha256 for $NTAR than the one this script holds" >&2; exit 1; fi
  [ -f "$NTAR" ] && [ "$(sha256sum "$NTAR" | cut -d' ' -f1)" = "$NSUM" ] || curl -fsSL -o "$NTAR" "https://nodejs.org/dist/v$NODE_VERSION/$NTAR"
  if [ -z "$NSUM" ] || [ "$(sha256sum "$NTAR" | cut -d' ' -f1)" != "$NSUM" ]; then echo "$NTAR does not have the sha256 of SHASUMS256.txt ($NSUM)" >&2; exit 1; fi
  rm -rf "$NDIR" && tar -xJf "$NTAR"
fi
export PATH="$NDIR/bin:$PATH"
if [ "$(node -v)" != "v$NODE_VERSION" ]; then echo "node -v says $(node -v), not v$NODE_VERSION" >&2; exit 1; fi
echo "node -v: $(node -v) ($(command -v node)), npm $(npm -v)"

# 2. The driver. Each deb is held to its sha256, so the mirror is as good as the archive (which is slow on some days).
U=$MESA/u2608; L=$U/root/usr/lib/x86_64-linux-gnu
mkdir -p "$U/dl" && cd "$U/dl"
DEBS="
27db5fa34d50d208b58cc94317b573065329740bb98d0e12b7947b06a9d02a4e m/mesa/mesa-vulkan-drivers_26.0.8-1ubuntu0.3_amd64.deb
9e758998dcb4aa27abbe64f2dee7bc490d9eb0721afa334a82a2b1bf6c7648f9 l/llvm-toolchain-21/libllvm21_21.1.8-6ubuntu1_amd64.deb
91ab4717cc8cf4c6c591970e1ad165aace9c91f6283c8b5a2652ceebf571ccea libd/libdisplay-info/libdisplay-info3_0.3.0-1_amd64.deb
e82ce35fd61483c1febf83232e76e54a296a6a78391983a24a904ff640b75c09 libx/libxml2/libxml2-16_2.15.2+dfsg-0.1ubuntu0.3_amd64.deb
094db0e190b53872e4d5310cd5fa09ca28ee3936386cd09e5f7d13e645aa12ab w/wayland/libwayland-client0_1.24.0-2_amd64.deb
"
right() { [ -f "$2" ] && [ "$(sha256sum "$2" | cut -d' ' -f1)" = "$1" ]; }
while read -r sum path; do
  [ -n "$sum" ] || continue
  f=$(basename "$path")
  for base in http://archive.ubuntu.com/ubuntu/pool/main https://mirrors.kernel.org/ubuntu/pool/main; do
    right "$sum" "$f" && break
    # Under 200 kB/s for 15 s counts as a stall: the next source is tried.
    curl -fsSL --speed-limit 200000 --speed-time 15 --max-time 600 -o "$f" "$base/$path" || true
  done
  right "$sum" "$f" || { echo "$f could not be fetched with sha256 $sum" >&2; exit 1; }
done <<<"$DEBS"
rm -rf "$U/root" && mkdir -p "$U/root"
for d in *.deb; do dpkg-deb -x "$d" "$U/root"; done
sed "s|\"library_path\": *\"[^\"]*\"|\"library_path\": \"$L/libvulkan_lvp.so\"|" "$U/root/usr/share/vulkan/icd.d/lvp_icd.json" > "$U/lvp.json"
# A driver that cannot load is not an error for Chrome: it falls back to SwiftShader without a word and draws
# other bytes. So the driver's own libraries and symbols are checked here, and the line at the end.
if LD_LIBRARY_PATH="$L" ldd -r "$L/libvulkan_lvp.so" 2>&1 | grep -E "not found|undefined symbol"; then
  echo "the driver $L/libvulkan_lvp.so misses the libraries or symbols above" >&2
  exit 1
fi

# 3. The repo at the commit, and its build.
[ -d "$REPO/.git" ] || git clone --single-branch --branch main https://github.com/BrandonChurch93/Snow-Globe-Perplexity "$REPO"
cd "$REPO"; git fetch -q origin && git checkout -q --detach "$COMMIT"
git config user.name >/dev/null || git config user.name render-farm
git config user.email >/dev/null || git config user.email render-farm@localhost
npm ci

# 4. The browser. `npx playwright-core install chromium-headless-shell` downloads the zip and then hangs while
# unpacking it (seen on three machines, Node 26), so the same zip is fetched and unpacked here without it.
# tools/browser.json pins the version and the build; the zip is the one Playwright names for linux x64.
BVER=$(node -p "JSON.parse(require('fs').readFileSync('tools/browser.json','utf8')).version")
BNUM=$(node -p "JSON.parse(require('fs').readFileSync('tools/browser.json','utf8')).build.replace('chromium-','')")
BDIR="$HOME/.cache/ms-playwright/chromium_headless_shell-$BNUM"
BBIN="$BDIR/chrome-headless-shell-linux64/chrome-headless-shell"
if [ ! -x "$BBIN" ] || [ ! -f "$BDIR/INSTALLATION_COMPLETE" ]; then
  ZIP="$MESA/chrome-headless-shell-linux64-$BVER.zip"
  [ -f "$ZIP" ] || { curl -fsSL -o "$ZIP.part" "https://cdn.playwright.dev/builds/cft/$BVER/linux64/chrome-headless-shell-linux64.zip" && mv "$ZIP.part" "$ZIP"; }
  rm -rf "$BDIR" && mkdir -p "$BDIR" && unzip -q "$ZIP" -d "$BDIR" && touch "$BDIR/INSTALLATION_COMPLETE"
fi
# tools/browser.json looks for chrome-linux/headless_shell (the older layout); the zip holds
# chrome-headless-shell-linux64/chrome-headless-shell. Two links make the pinned path true without touching the repo.
ln -sfn chrome-headless-shell-linux64 "$BDIR/chrome-linux"
ln -sfn chrome-headless-shell "$BDIR/chrome-headless-shell-linux64/headless_shell"
if LD_LIBRARY_PATH="$L" ldd "$BBIN" | grep "not found"; then echo "the browser misses the libraries above" >&2; exit 1; fi
"$BDIR/chrome-linux/headless_shell" --version
npm run build

# 5. What the machine really has, and the driver's threads. In a container `nproc` and `free` show the node, not
# the share this machine may use: the limits are in its cgroup, and --procs has to be chosen from them (one 4K
# render holds about 4 GB). Lavapipe starts a raster thread for every CPU it sees (up to 32), and on a machine
# held to fewer CPUs that costs time. Measured on 8 CPUs of a 64 CPU node, a 4K frame of a change, one process:
# 87 s unset, 71 s with LP_NUM_THREADS=8, 75 s with 16; with two processes 8 each was faster than 4 each. So it
# is set to the CPUs the machine may use, whatever --procs is. The setting does not change a byte of a picture
# (frames 600 to 603 and 630 to 633 of film B, same sha256), and the line at the end proves it again.
CG=/sys/fs/cgroup$(cut -d: -f3 /proc/self/cgroup 2>/dev/null | head -1)
CPUS=$(nproc)
if [ -r "$CG/cpu.max" ]; then
  read -r quota period < "$CG/cpu.max"
  [ "$quota" = max ] || CPUS=$(( (quota + period - 1) / period ))
  echo "cgroup cpu.max: $quota $period, so $CPUS CPUs for this machine (nproc says $(nproc))"
fi
if [ -r "$CG/memory.max" ]; then echo "cgroup memory.max: $(cat "$CG/memory.max") bytes (max = no limit; free shows the node)"; fi
THREADS=${THREADS:-$CPUS}
[ "$THREADS" -le 32 ] || THREADS=32
cat > "$U/env.sh" <<EOF
export PATH="$NDIR/bin:\$PATH"
export SHOWCASE_RENDERER=lavapipe
export SHOWCASE_LVP_ICD=$U/lvp.json
export LD_LIBRARY_PATH=$L
export LP_NUM_THREADS=$THREADS
EOF
echo "$U/env.sh written: LP_NUM_THREADS=$THREADS"

# 6. The proof: one picture, and its line must be the wanted one.
. "$U/env.sh"
LOG=$(mktemp)
npm run master -- --calibrate 2>&1 | tee "$LOG" || true
GOT=$(grep -m1 -oE '^calibration [0-9a-f]{64}' "$LOG" | cut -d' ' -f2 || true)
rm -f "$LOG"
if [ "$GOT" != "$WANT" ]; then
  {
    echo
    echo "################################################################################"
    echo "THIS MACHINE MUST NOT RENDER: its calibration line is not the wanted one."
    echo "  wanted: calibration $WANT"
    echo "  got:    calibration ${GOT:-(no line was printed)}"
    echo "Same commit as the standard machines? ($COMMIT, $(git rev-parse --short HEAD))"
    echo "Did the driver load? A browser that fell back to SwiftShader still prints a line."
    echo "################################################################################"
  } >&2
  exit 1
fi
echo "calibration is the wanted line. Before every render on this machine: . $U/env.sh"
