# The globe in the hand (name `hand_closer`, branch `agent/p6-hand`)

From /root, 19:40 UTC Nov 26. Read `tools/briefs/p6/COMMON.md` to the end first, then this file, then in the
repo `AGENTS.md`, `tools/README.md`, `kit/02-SUBJECT.md` (the shake) and in `kit/PROGRESS.md` decisions 29,
35, 45, 59, 64 and 92 and open items 42, 72, 81, 126, 159, 160, 182 and 195 with what each says was tried.

## What the motion critic said (Round 21, R4, score 3; `scorecards/round-021/R4.json`)

It saw film B's second shake, spring into summer, frames 1296 to 1438, at 60 frames a second.

Issue 2, severe: "From 1296 to 1386 (1.5s) the globe barely lifts (~5 px), stays nearly dead-level with no
lagging tilt, slides in small even horizontal oscillations, and nearly stops above the table at 1374-1386; at
1400 it suddenly jumps ~28 px right and ~30 px higher into the air before whipping left with a sharp tilt at
1412, reading as two disconnected animations stitched together rather than one heavy object in a hand." Its
fix: "Drive the entire shake along one continuous, weighty physical curve: an effortful lift well clear of
the table, unequal strokes with sharp reversals and lagging rotational tilt through peak storm, and a
continuous descent into a damped landing settle."

Issue 3, severe, the half that is yours: "Couple contact shadows, mirror reflections, and caustics to the
globe's live 3D height and tilt". (The sand heaps under the lifted base are the sand's owner's,
`src/seasons/summer/arrival.ts`. The loose things on the table that do not stir are not in this job.)

The same has been said of every shake since Round 7 (items 42, 81, 159, 160, 182). Three builders worked on
it. The lift's first frames and the set down are mended; the strokes are not.

## What stands and may not move

- The lift is `shake.liftMm` 7.25 and the tilt's cap `shake.tiltDeg` 6 (decision 45). The camera is locked
  through a shake, the globe fills 0.800 of the frame, the lifted glass must stay inside the frame with 4.5
  percent of room above it, and the approved shake pictures (`references/approved/*-shake.png`) show the
  globe near the table. A lift "well clear of the table" cannot be had and is not asked of you.
- The clock of a shake: the lift's end, the strokes' end, the landing frame, the swap windows (G11), the
  landings (G12), the count of strokes, M4 and M5. The films' sound is cut to them.
- `rest` stills of all four seasons: byte for byte as on main (sha256). `landed` stills: equal too, or you
  say which moved, why, and show the pair.
- The first hand (`HAND`, kept for the first shake's old pins by `keepsOldHand`) as it is, unless you show
  it is not drawn anywhere.

## What to try, in this order

1. One curve. Find what the critic saw at 1386 to 1412: the height and the sideways place of the globe on
   every frame of 1296 to 1440 (print them from the pose, do not guess), and why the globe "nearly stops" at
   1374 to 1386 and then stands about 30 px higher and 28 px to the right at 1400. If the pose itself jumps
   or stalls there, mend the path so that speed and height run on without a stall or a step through the swap
   window. If the pose runs on and the picture jumps (the change's light hides the base on 1388 to 1398 and
   the eye loses the globe), say so with the numbers: then it is the change's builder's, not yours.
2. Weight that needs no room under the foot. The last builder proved that "under 7.25 mm of lift and 1 mm
   of rim air the lean cannot lag by frames and still clear the table". Nobody has tried a twist about the
   upright axis: a hand that shakes a globe turns its wrist, and a twist needs no room. Let the globe turn a
   few degrees about its upright axis with each stroke, behind the stroke by some frames, with a whip after
   each turn and a slow return, so that the miniature and the shells on the base are seen to swing. And an
   arched path inside the 7.25 mm: lowest in the middle of a stroke or at its ends, whichever reads as a
   hand, so the top of the glass does not ride a flat rail (the critic measured under 3 px of rise and fall).
3. Strokes that are not even: the lengths are 46.0, 38.5, 33.8, 36.6, 45.8 mm and the turns 12.3, 12.6,
   16.5, 11.5, 8.8 frames apart. More contrast between the first two strokes and the rest (`slowStroke`,
   `breath`), sharp turns, without leaving the pins.
4. The table's answer: the shade and the mirror image under the foot follow the height only (`uFoot`,
   `src/scene/surface.ts` near line 625). Let them follow the foot's gap with its tilt and its sideways
   place (the pose's own rim gap), so that the shade slides and opens under a tipped, moving foot and closes
   at the landing frame, not before.

## Files

`src/shake/table.ts` and its tests (`tests/shake-*.test.ts`, the shake's part of `tests/film.test.ts`);
`src/scene/surface.ts` for point 4 only. Where the pose is read by another file and a twist needs a line
there, send the exact lines to /root. `src/shake/change.ts` belongs to `/root/change_finisher`, who is at
work on the change's light in the same frames: tell it by message what you change in the pose inside the
swap window before you push.

## Proof

- Numbers on every frame of 1296 to 1440 before and after: height, sideways place, lean, twist, speed.
- Consecutive frames: `npm run sheet -- --motion strokes --shot shake-2` and `--motion swap --fit --shot
  shake-2`, `--motion setdown`, at draft while you tune, at review for what you show; the same for one
  other shake. Look at them at a third of their size too: the critic judges at that size.
- `npx tsc --noEmit`, `npx vitest run`, `npm run determinism`, the gate's G11 and G12, `node
  tools/measure.mjs --unit change --tier draft`, the strict run if a shader moved.
- First push inside 45 minutes. A report to /root at 21:30 UTC whatever the state, and the final one at your
  limit: each of the four points as mended, bettered or not done, with the frames that show it; the pins
  that held; what you have not seen with your own eyes.
