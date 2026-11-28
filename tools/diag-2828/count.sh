#!/bin/bash
# Diagnosis of film frame 2828 (order diag-2828, decision 286). Branch agent/p6-diag-2828, never merged.
# The count: drawings of hd film frame 2828 at draft, one after another, each in a browser started anew, nothing beside.
# By turns one with the simulation run whole (the kept one is removed first) and one with the kept simulation.
# usage, from the root of the tree after npm run build: bash tools/diag-2828/count.sh <first number> <last number> <full|lite> <end, seconds since 1970> [letter of the machine]
# It stops after the last number, at the end time, or when two drawings are not the list's bytes, whichever comes first.
cd "$(dirname "$0")/../.." || exit 1
D=${DIAG_OUT:-/tmp/l9/d2828}
mkdir -p "$D"
[ -f "$D/ref.json" ] || cp tools/diag-2828/ref.json "$D/ref.json"
first=$1; last=$2; mode=${3:-full}; until=${4:-0}; who=${5:-m}
echo "start $(date -u +%H:%M:%S) head $(git rev-parse HEAD) engine $(cat dist/build.json) changed: $(git status --short | tr '\n' ' ') runs $first to $last mode $mode" >> "$D/status.txt"
odd=${ODD0:-0}
for i in $(seq "$first" "$last"); do
  if [ "$until" -gt 0 ] && [ "$(date +%s)" -ge "$until" ]; then echo "stopped by the clock before run $i at $(date -u +%H:%M:%S)" >> "$D/status.txt"; break; fi
  n=$(printf '%s%03d' "$who" "$i")
  if [ $((i % 2)) -eq 0 ]; then rm -rf out/work/simcache; sim=whole; else sim=kept; fi
  [ -d out/work/simcache ] || sim=whole
  t0=$(date +%s)
  line=$(node tools/diag-2828/run.mjs "$n" "$mode" 2>&1 | tail -1)
  t1=$(date +%s)
  echo "$(date -u +%H:%M:%S) $sim wall=$((t1 - t0))s $line" >> "$D/table.txt"
  case "$line" in *"F=dc7739f5d7122739"*) ;; *) odd=$((odd + 1)); echo "run $n is not the list's bytes, at $(date -u +%H:%M:%S)" >> "$D/status.txt";; esac
  if [ "$odd" -ge 2 ]; then echo "stopped: two drawings that are not the list's bytes, at $(date -u +%H:%M:%S)" >> "$D/status.txt"; break; fi
done
echo "done $(date -u +%H:%M:%S) head $(git rev-parse HEAD) engine $(cat dist/build.json) changed: $(git status --short | tr '\n' ' ')" >> "$D/status.txt"
date -u +%H:%M:%S > "$D/count-$first-$last.done"
