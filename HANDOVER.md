# The hand, phase 6: handover

Branch `agent/p6-hand`, pushed head `f00f09d3` (merged with main `708c31cd`; the pictures and stills are on `22ed3be4`, merged with main `15d7017d`, or the commit named). My commits, oldest first (the rest are merges of main):

- `f7e2890c` Shake: the wrist turns the held globe about its upright axis (the twist channel, `src/shake/table.ts`, tests).
- `112007c1` Shake: each swoop dips as deep as the rim's air allows (`dipShare` 0.4 to 0.7, the arc test in `tests/shake-path.test.ts`).
- `8f315be2` Draw the wrist's turn: the four granted lines, `Euler(tiltX, twist ?? 0, tiltZ, 'XZY')` in `src/scene/stage.ts`, `src/globe/shell.ts`, `src/scene/lighting.ts`, `src/core/chunks/veil.ts`.
- `8ba80f77` The fifth granted line, `src/film/motion.ts:16` (the shutter's marks).
- `c007f687` The hand: a heavy start, the first two strokes slow and the last three quick (`strokeWeights`, `strokeReach`, held `leanDeg` 1.28 to 1.48, the new test `the hand: the heavy start`).

Every number below is for shake-2 (spring to summer, film frames 1296 to 1440) unless it says otherwise. The frame-by-frame pose, main against head, is in `pose-shake-2.txt` on this branch: sideways place, height, lean, twist and speed on every frame 1296 to 1440.

## Point 1: the jump at 1386 to 1412, explained, not mended by the hand

- The pose is continuous: no frame skips, the largest step is 8.3 mm a frame at 1398 to 1399, the fastest instant of the last stroke.
- The swap cover dims the base at 1388 and hides it from 1390 to 1398 (seen at draft on main and on the head, every second frame; on main since 1878461b the cover is a cream flood, before it the base went dark).
- The base goes under the cover moving left at x -10.7 mm (1388), and comes back faint at 1400 at x +25.4, 36 mm to the right, on the last turn (1400.1), clear at 1402 at x +20.4 moving back left at 3.1 mm a frame.
- The turn at 1391.3 and the whole last stroke (46 mm, up to 8.3 mm a frame) pass unseen under the cover, so the eye reads a jump.
- The cover's frames belong to `src/shake/change.ts` and M4; told /root, and the change's owner by number at 22:15. The near stop at 1374 to 1386 on main was the slow, narrow breath stroke at 2.1 mm a frame; it is now a sweep at 3.3 mm a frame (point 3).

## The five granted lines after the merges

`src/scene/stage.ts:529`, `src/globe/shell.ts:1049`, `src/scene/lighting.ts:266`, `src/film/motion.ts:16`, and in `src/core/chunks/veil.ts` the change owner's `bankWhite` lines (598 to 601, from main `1878461b`) are kept as written; my line follows at 604 and reads `turn.setFromEuler(tilt.set(f.globe.tiltX, f.globe.twist ?? 0, f.globe.tiltZ, 'XZY')).invert()`.

## Point 2: the twist and the arched path, mended

- The twist is the turn of the globe about its own upright axis, taken before the tilt: `Euler(tiltX, twist, tiltZ, 'XZY')`. With the twist absent or 0 the up axis is the same as before, so every picture at rest is byte for byte the same.
- How it moves (`src/shake/table.ts`): the kick is the hand's pull at each reversal (minus the second difference of the stroke), run through two followers (`twistEase` 3, then `twistTurns` 2.5 with `twistDamping` 0.55), scaled so its peak is `twistDeg` 10 for the held hand (0 for the first hand), and 0 from the touch on.
- It lags each turn by about 6 frames, whips through, and returns slowly. In shake-2 inside the swap window: -6.3 deg at 1373, +7.8 at 1385, -9.9 at 1397, +9.0 at 1406, 0.6 at 1412.
- Seen on the base: against main `a6b42369`, the shell band of summer's base on `90f78390` sits 20, 26, 17, 8 and 0 preview px aside at 1404, 1406, 1408, 1410 and 1412 while the twist is 6.3, 9.0, 7.0, 3.4 and 0.6 deg and the sideways place matches within 0.2 mm (draft, best match of the band rows 385 to 435 between the two frames). At a third of the size the turn is hard to see; the sideways travel and the place where the base comes back read clearly.
- The arched path: `dipShare` 0.7 (was 0.4). Each swoop dips 4.1 to 4.3 mm inside the 7.25 mm lift (was 2.9), the glass top rises and falls 24 to 26 HD px a swoop (was 16 to 17).

## Point 3: strokes that are not even, bettered

| shake-2 | gaps between turns, frames | speed, mm a frame |
|---|---|---|
| main | 11.3, 13.5, 16.2, 12.0, 8.7 | 4.0, 2.9, 2.1, 3.0, 5.2 |
| head | 14.5, 14.2, 12.0, 12.3, 8.9 | 2.8, 2.4, 3.3, 3.5, 5.2 |

- The held shakes set the weight and reach of each stroke one by one (`strokeWeights` 1.35, 1.76, 1.62, 1.45, 1.42, 1; `strokeReach` 1, 0.74, 0.74, 1, 0.95, 1.05). The curves' middle breath, which made the third stroke the slowest, is gone for them. The first hand keeps the curves (its arrays are empty), so its digest is unchanged.
- The first two strokes run at 0.64 of the speed of the last three in shake-1 (0.65), shake-2 (0.64) and shake-3 (0.64); main 0.99 in shake-2. The new test holds, for every held shake: the first two gaps are longer than the last three, and their mean speed is below 0.75 of the last three.
- Turns: on the turn frame the speed falls to 0.4 to 1.3 mm a frame (main 0.4 to 2.0).
- Unchanged: the three turns inside the swap window keep their frames within half a frame (1379.0, 1391.3, 1400.1), the fastest instant of the last stroke stays at 1398 to 1399, the swap window, the stroke count and the clock.
- Pins that stop more contrast, by test: at least three turns before `swapWindow.fromBeat` (`tests/shake-change.test.ts`), cover above 0.95 at the fastest instant, the room above the glass at beat 1.017 at least 0.045, the top leaning away from the lens and z below 0 while held (`tests/shake-clearance.test.ts`), the lean at a turn above 4 deg, the stroke reach above 0.65, the time ratio above 1.6 and the reach ratio above 1.3, the tilt jerk below 250k. A slower start than this needs one of them moved, which is not mine to do.

## Point 4: the shade and the mirror image under the foot, half seen

- The mirror image is a true mirrored render of the globe (`src/scene/passes.ts`, drawPasses, the camera's orient -1), so it follows the place, the height, the lean and the twist by construction.
- Seen at draft on consecutive frames: the lift 1296 to 1330 and the strokes 1340 to 1368 at `4c1ebe13`, the set down 1424 to 1438 on the head: the dark gap between foot and image closes as the height falls 6.5 to 0.9 mm, the image slopes with the lean, the dark area under the foot moves with it and thins at the dips.
- The shade: `src/scene/surface.ts:615` sets `uFoot` from the place and the height, `:617` sets `uLean` from the tilt. The up axis under XZY with a twist is the same, and the foot is round, so it needs no twist. That it follows is read in the code; at draft against the dark table I could not see the shade apart from the mirror image. Unseen.
- No lines for /root were needed.

## Pins that held

liftMm 7.25, tiltDeg 6, the camera, the 4.5 % room above the glass, the shake clock (lift end, strokes end, landing, swap windows, landings, 6 strokes), M5, the first hand (`HAND`, `keepsOldHand`), and the rest stills of the four seasons byte for byte as on main (hero, draft, sha256 below).

## Checks

All on the merged head unless it says otherwise. `e00d2898` is the head merged with main `1878461b`; `90f78390` adds main's `88d6cf86` (one guarded normalize in summer's arrival.ts) and the status files.

- `npx tsc --noEmit`: clean on `90f78390`, `22ed3be4` and `f00f09d3`; `npm run build` passes on `f00f09d3`.
- `npx vitest run` on `f00f09d3`: `Test Files  58 passed | 1 skipped (59)`, `Tests  795 passed | 8 skipped (803)`. The runs on `90f78390` and `22ed3be4` printed 61 files and 795 tests, but they counted three probe files of mine (`tests/zz-*`, one test each, never committed): without them `22ed3be4` holds 792 passing tests, and main's `708c31cd` adds three in `tests/shake-change.test.ts`.
- `npm run determinism` on `e00d2898`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 198 s`.
- `node tools/gate.mjs --phase 6 --only G11,G12` on `e00d2898`: `gate, phase 6: all 2 green`. G11: every seasonal part 0 or 1 on the 3456 frames outside the 4 swap windows (648 to 683, 1368 to 1403, 2088 to 2123, 2808 to 2843). G12: the height above zero on all 432 frames from each liftEnd to each landing (lowest 0.44 mm), the landings 720, 1440, 2160, 2880 on bar lines, the camera on each first frame equal to hero within 0.001.
- `node tools/measure.mjs --unit change --tier draft` on `e00d2898`: `measure change: complete · 24 of 24 lines, 1 red · draft · 209 s`. M4 cover at the swap: shake-1 0.958, shake-2 0.8611, shake-3 0.7507 (red, the air's, being mended there), shake-4 0.9504. M5 clearing: 0.9867, 1, 0.9706, 0.9998. M1 and M6 pass on all eight pictures.
- `node tools/measure.mjs --unit change --tier draft` on `f00f09d3` (main `708c31cd`, with the air's mend `d8b98f9a`): `measure change: complete · 24 of 24 lines, 0 red · draft · 185 s`. M4: shake-1 0.958, shake-2 0.8972, shake-3 0.9449, shake-4 0.9504 (threshold 0.85); M5: 0.9867, 1, 0.9706, 0.9998 (threshold 0.6).
- Stand-ins: `npm run still -- --state landed --camera hero --tier draft --diag standins`: all 2073600 pixels black (largest value 0).
- Rest stills, hero, draft, `22ed3be4` against main `15d7017d`: equal by sha256 for all four seasons (winter 7b2c7de7, spring e68cb4e3, summer d7732d37, fall aa672bf3); full hashes in `sha256-stills.txt`.
- Landed stills, hero, draft, `90f78390` against main `a6b42369`: equal by sha256 for all four seasons (winter 85a40497, spring acae5fd9, summer 528118f8, fall 746814a7). Nothing moved, so there is no pair to show.
- Set down sheets, shake-2, review, `npm run sheet -- --motion setdown --shot shake-2 --tier review`, main `15d7017d` against `22ed3be4`, frames 1404 to 1438 every second frame: at 1404, 1406, 1408, 1410, 1412 the shell band differs from main's by a mean of 72.6, 76.7, 68.9, 46.8, 7.5 (sum of RGB over the band) as the twist eases out, the mirror image below it by 7.2, 9.0, 6.8, 3.5, 1.5; from 1430 on the foot crop is main's (113, 44, 0 pixels differ by more than 6 at 1430, 1434, 1438) while the inside of the glass differs (the differing pixels lie in x 276 to 665, y 30 to 485, over 90 % of them above y 330, the top of the base). Picture f4.
- Strokes sheets, shake-1 (winter to spring), draft, `npm run sheet -- --motion strokes --shot shake-1 --tier draft`, on `22ed3be4`, frames 612 to 682 every second frame (seen): the turns fall at 618.8, 633.3, 647.0, 659.2, 671.3, 680.1 (gaps 14.5, 13.7 | 12.1, 12.1, 8.8 frames; 3.01, 2.63 | 3.43, 3.91, 5.70 mm a frame; the first two against the last three 0.65). The globe stands at its left end at 618 and 646 and at its right end at 632 to 634 and 658. The same jump as in shake-2 shows here: the cover takes the base at 668 to 670 on the left and gives it back at 680 to 682 on the right. I did not render main's shake-1 sheet, so the pair is not shown.
- Strict: not run. No shader source moved (the five lines set uniforms in JavaScript, and only while the twist is not 0), and the rest and landed stills the keys read are byte equal to main at hero, draft.

## Still wrong, worst first

1. The jump at 1386 to 1412: the base is under the cover while the last stroke carries it 36 mm, so it comes back somewhere else. The cover's frames are `src/shake/change.ts` (the change's owner) and M4; the hand cannot move the fastest instant or the turns inside the window without moving the cover's beats.
2. Not wrong now, to watch: M4 is green on all four shakes on `f00f09d3` (shake-3 0.9449 with the air's mend, 0.7507 on `e00d2898`); the closest is shake-2 at 0.8972 against 0.85, so a change to the cover or the last strokes should measure it again.
3. The twist is 10 deg at most: in the preview crops (960 x 540) it shows on the base, at a third of that size it is hard to see.
4. The heavy start could be heavier; the pins listed under point 3 hold it where it is.

## What I did not see

- The shade under the foot apart from the mirror image (point 4).
- Any frame at final or 3840; every frame I looked at was draft (preview 960 x 540) or review where it says so.
- Odd frames 1385 to 1413 on the head: the sheets render every second frame there; the pose table covers every frame.

## Notes for whoever takes the hand next

- The knobs are in `HAND` (the shared values) and `HELD` (the held hand's own) in `src/shake/table.ts`: `twistDeg`, `twistEase`, `twistTurns`, `twistDamping` for the turn; `dipShare` for the arch; `strokeWeights` and `strokeReach` for the strokes one by one; `leanDeg` for the held base lean. The first hand `HAND` has `twistDeg` 0 and empty stroke arrays, so `keepsOldHand` and the test shake are untouched.
- Tell the change's owner before any push that moves the swap window's beats or the fastest instant of the last stroke (1398 to 1399 in shake-2), and tell the inertia builder when the pose changes: the loop is a held shake too, and its liquid reads the pose.
- The fall loop bound in `tests/loop.test.ts:143` is green on this head by itself; the inertia builder found it green on its hand-only control `3992f3b6` (0 of 125803).
