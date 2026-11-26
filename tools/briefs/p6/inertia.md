# What floats in the glass lags the glass (name `inertia_builder`, branch `agent/p6-inertia`)

From /root, 19:40 UTC Nov 26. Read `tools/briefs/p6/COMMON.md` to the end first, then this file, then in the
repo `AGENTS.md`, `tools/README.md`, `kit/02-SUBJECT.md` (the shake and the storm), and in `kit/PROGRESS.md`
open item 195 and the items it names.

## What the motion critic said (Round 21, R4, score 3; `scorecards/round-021/R4.json`)

It saw film B's second shake, spring into summer, frames 1296 to 1438, at 60 frames a second.

Issue 4, severe: "Petals are already suspended to the top of the dome at 1296 before lift, and when the
globe lunges right between 1308 and 1322 (+17 px), the petal constellation translates rigidly with the glass
as if glued to it instead of lagging in world space and slamming the inner wall, after which an opaque
milky-pink blur simply washes over the sphere (1334-1386)." Its fix: "Give the fluid and particles real
inertia relative to world space so they lag the accelerating sphere, slam against the trailing glass wall,
and fold into a coherent turbulent storm rather than moving with the glass and fading to flat pink fog."

Issue 7, major, the half that is yours: "Nearly 10 seconds after touchdown (1962-2014, 32.70s-33.57s), ~20%
of the upper dome right up to the top glass rim remains continuously crowded with suspended particles that
never die away or come to rest on interior surfaces". Its fix: "Allow the slow post-shake whirl to decay so
almost all particles settle onto the tree, roof, and ground with only sparse, gentle multi-depth drift at
rest".

What the change's builder measured in the code: the liquid's slosh runs at 20 to 90 mm/s while the hand
strokes (`src/globe/liquid.ts`, the note near line 727) and the hand's peak is about 435 mm/s. So what
floats is carried almost whole with the glass. And the hand's last builder saw: "From +2 of the lift the
falling snow inside is gone and the inside turns pale in one frame (the liquid's answer to the quicker
start): the eye takes that before the lift at a third size."

## What is asked

1. In the first strokes what floats stays behind in the room while the glass moves: seen against the glass
   it is thrown to the trailing wall, piles there, and folds over into the storm in the next stroke. The lag
   must be seen on consecutive frames at a third of the frame's size: on 1308 to 1322 the petals' place in
   the picture moves clearly less than the glass's.
2. The storm that follows is a turning, folding body with thicker and thinner parts that move, not an even
   fog laid over the ball. The approved shake pictures (`references/approved/*-shake.png`) show what the
   storm looks like at its landing for each season: streaks that swirl, the miniature read through them.
   The landing's look stays theirs.
3. No step: the inside may not turn pale or lose its falling flakes in one frame at the lift's start.
4. The settle: by the end of each season's shot most of what floats has come to rest or thinned out. Say
   for each season how many are afloat at the shot's last frame against the shot's first and against the
   season's settled line in `kit/02-SUBJECT.md` (summer keeps fireflies, seeds and motes in the air by a
   settled line; do not empty it).

## What stands and may not move

- `rest` stills of all four seasons: byte for byte as on main (sha256). Say so for all four.
- `landed` stills of all four seasons will move with the storm. Show each as a pair beside its approved
  shake picture at 400 px and at one to one, before and after. None may read further from its approved
  picture than it does now.
- The hand's path (`src/shake/table.ts`) is `/root/hand_closer`'s, who starts with you. The change's light
  (`src/shake/change.ts`) is `/root/change_finisher`'s. The looks of what floats (`src/particles/draw/`,
  the seasons' own air files) are the seasons' owners'; `/root/summer_air_p6` is at work there now on the
  depth of summer's storm at the landing. You own the motion: `src/globe/liquid.ts`, the particle step that
  reads it (find it under `src/particles/engine/` and `src/particles/driver.ts`, list the files in your
  first push) and their tests (`tests/liquid.test.ts`, `tests/engine-storm.test.ts`).
- The frozen caches of the storm (`npm run simcache`) are made again by /root after your merge; say if your
  change needs it.
- The live app draws the same step: its cost per frame may not rise by more than a tenth (say what you
  measured, on which path).

## Proof

- Numbers first: for frames 1296 to 1440 the glass's speed and the mean speed of what floats in the room's
  frame, before and after, and the share of what floats in the trailing half of the ball on each frame.
- Consecutive frames: `npm run sheet -- --motion lift --shot shake-2`, `--motion strokes --shot shake-2`,
  the same for `shake-4` (fall into winter), at draft while you tune, at review for what you
  show; and the app's own path with `--app shake`.
- `npx tsc --noEmit`, `npx vitest run`, `npm run determinism`, G11, G12, `node tools/measure.mjs --unit
  change --tier draft`, the strict run if a shader moved.
- First push inside 45 minutes. A report to /root at 21:30 UTC whatever the state, and the final one at your
  limit: each of the four points as mended, bettered or not done, with the frames that show it; the stills
  that moved; what you have not seen with your own eyes.
