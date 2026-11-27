#!/bin/sh
# sh out/work/p6s/walk910.sh <tag> [port=4180]: root's items 9 and 10 walked again: the hint after the controls, and where
# two presses begin. One after the other, alone.
P=/home/user/workspace/snow-globe/out/work/p6s
T=$1
U=http://localhost:${2:-4180}/
cd /home/user/workspace/sg-steps || exit 1
date -u +%H:%M:%S
echo "served: $(curl -s -m 3 ${U}build.json | head -c 80)"
node tools/visit.mjs --url $U --layout phone --only 1,11,2 --name hint-$T > $P/visit-hint-$T.log 2>&1; echo "hint exit $?"
date -u +%H:%M:%S
node tools/visit.mjs --url $U --layout 600x600 --only 2,3,6,8,9 --name press-a-$T > $P/visit-press-a-$T.log 2>&1; echo "press a exit $?"
date -u +%H:%M:%S
node tools/visit.mjs --url $U --layout 600x600 --only 12,10,14,15 --name press-b-$T > $P/visit-press-b-$T.log 2>&1; echo "press b exit $?"
date -u +%H:%M:%S
for l in phone tablet hd; do
  node tools/standstill.mjs --url $U --gap 50 --layout $l --seconds 20 --name hint-$l-$T > $P/stand-hint-$l-$T.log 2>&1; echo "standstill $l exit $?"
  date -u +%H:%M:%S
done
touch $P/walk910-$T.done
