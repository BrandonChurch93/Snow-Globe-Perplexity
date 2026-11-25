# Handover: the hand (items 81, 159 with 71, 102, 127, and 160)

Written 17:30 UTC by hand_builder. Code branch `agent/p5-hand`, tip 3027074. Line numbers are of that tip.
Files of the job: `src/shake/table.ts` (only the `HELD` hand, lines 160 to 180, was changed), `tests/shake-path.test.ts`, `tests/shake-hand.test.ts`.
The first hand (`HAND`, lines 67 to 152, chosen at line 244; stills and preroll) is held by sha256 digests in `tests/shake-hand.test.ts`: do not move it.

## Item 159 (with 81, 71, 102, 127): the strokes. Not mended in the picture.

What the picture still shows (shake-4, frames 2829 to 2840): the lean passes through level once a stroke, about 2.5 frames before the turn (2829, between 2837 and 2838), and next to main the change is small.

Where the cause lies:
- `tests/shake-path.test.ts:17`, `const JERK_DEG_S3 = 2.5e5`. Under it a flip of the lean takes 9.2 frames; the hand makes 238,000 at most now.
- `src/shake/table.ts:168`, `heldFlip: 0.255` (the length of a flip, in beats), used at lines 533 to 545 where the lean of each stroke is joined to the next.
- `src/shake/table.ts:172`, `heldLead: 0.07` (how far past the turn a flip ends).

Next change, in this order:
1. Ask for a ruling on line 17. Not mine to raise alone. My estimate, not run: jerk grows with the cube of the flip's shortness, so a flip near 4.5 frames needs about 8 times the bound, near 2e6 deg/s3.
2. With the ruling: raise line 17 in its own commit (old rule, new rule, why), then lower `heldFlip` at line 168 toward 0.13 and move `heldLead` so the lean crosses level on the turn frame itself, where the globe is slowest.
3. Without the ruling, not tried: a larger `heldLead` with the same `heldFlip`, so the level crossing sits on the turn. It costs lean at the centre crossings (now 3.5 to 4.6 degrees), so measure both.

How to prove it: the stroke tests in `tests/shake-hand.test.ts`; frames 2829 to 2840 at review in a tree of main and a tree of the branch, set side by side; then all of 2808 to 2880 played at 60 frames a second at hd. I never saw it in motion and never at hd.

Tried and dropped: driving the second axis by position, not by rate. The standing "out of step" test fails (correlation 0.88, rule under 0.6). `rockGain` (line 164) stays on the rate.

## Item 160: the landing. Mended in the path, not proven at final.

What is missing: the ruling asked for consecutive final frames. I have draft frames and one final frame (2163).

Next change, in this order:
1. No change to code. Render shake-3 frames 2158 to 2183 and shake-4 frames 2878 to 2903 at final, one by one, and play them at 60 frames a second at the frame's own size. A final frame cost me about 5 minutes: about 2 hours a landing, one render at a time.
2. Only if the rock is not seen there: `src/shake/table.ts:175`, `overshootDeg: [1.74, 1.8]` to `[2.15, 2.2]`. That fails `tests/shake-path.test.ts:16`, `const JERK_MM_S3 = 2e6`: 2.18 degrees inside 0.4 s needs 2.26e6. So it needs a ruling for 2.3e6 on that line, or `shake.landSettleSeconds` near 0.47 at `config/showcase.json:158` (not this job's file). Then `tests/shake-path.test.ts:38`, `OVERSHOOT_HELD_DEG = 1.9` to 2.3, in its own commit (the ruling of 14:40 allows 2.5).
3. The rock's shape is lines 176 to 179 (`rockFirst`, `rockShrink`, `rockPower`, `rockFade`), built at lines 269 to 295. The "dies" rule is `tests/shake-path.test.ts:525` to 550.

For `src/render/surface.ts` (not this job's): read `rimGapMm(f.globe)` from `src/shake/table.ts:195`, with the tilt, not `g.y` alone. On frames 2160 to 2182 `g.y` is up to 1.8 mm while one edge is down and the far edge is 3.6 mm up.

## Commands that drew the pictures

Two extra trees, so a render never ran over files being edited:
```
git worktree add ../before 8e5798b
git worktree add --detach ../after <the commit to look at>
```
In each tree, once: `npm run -s build` then `npm run -s simcache`. Then, one render process at a time, each run again while it exits with code 3 ("run the same command again to carry on"):
```
node tools/seq.mjs --first 2829 --last 2840 --tier review --look no    # strokes, both trees
node tools/seq.mjs --first 2157 --last 2168 --tier draft --look no     # landing shake-3, before
node tools/seq.mjs --first 2158 --last 2181 --tier draft --look no     # landing shake-3, after
node tools/seq.mjs --first 2877 --last 2888 --tier draft --look no     # landing shake-4, before
node tools/seq.mjs --first 2878 --last 2901 --tier draft --look no     # landing shake-4, after
```
Frames land in `out/work/seq/film-preview-<tier>/`. The sheets are a small Pillow script of mine (not committed, the looks branch holds pictures and text only): strokes crop (180, 0, 780, 540) of the 960 by 540 frame, 4 to a row; landings a close crop of the left edge of the foot at the frame's own size, 9 to a row, main above and branch below; saved as JPEG, long edge at most 1400.
The numbers under each frame (lean, height, edge gap) came from a scratch vitest file that called `makeShake` and printed the pose of every frame. It is not committed. `tests/shake-hand.test.ts` reads the same values and is the place to start.

## Traps

- `seq` stops with exit code 3 and wants the same command again: 8 times in my render queues. Wrap it in a loop that repeats on 3 and stops on anything else.
- Final tier is slow: `winter-shake` took 865 s, `spring-shake` 650 s, a film frame about 5 minutes. Plan final frames first, not last. I left them to the end and ran out of time.
- `--step`: I ran `--first 2160 --last 2167 --step 7 --tier final` meaning to get two frames and got one, 2163. Read what `--step` means in `tools/seq.mjs` before using it at final.
- The proofs took 42 minutes (15:56 to 16:38) with the tip held still. Main moved under them, so determinism, the gate, the measures and the two kept sums were proven on c9a975f, not on the tip. Start proofs later, or merge main last and prove once.
- `node tools/measure.mjs --unit change --tier draft --only M4,M5` prints "not complete, 8 of 24 lines" on every run, because `--only` never counts the other 16 lines. The M4 and M5 lines themselves are complete; do not rerun it waiting for "complete".
- Main moved six times in the session; every merge needs tsc, vitest and build again before the push (about 3 minutes).
- Numbers ran ahead of pictures. The lean at the centre doubled in the numbers and is a small change on the sheet. Draw the sheet before tuning further.
- The landing does not read on the fall table: dark thorns over a dark table. Judge the rock on shake-4 (winter, pale table, gold ring), where the lift is about 3 px at preview size.
- The collar changes in one frame at 2834 and frost grows on the table through the landing of shake-4. Neither is this job's file; do not chase them in `table.ts`.
