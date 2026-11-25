# Handover: the season's change outside the glass

Branch `agent/p5-swap`, tip d91a949. Written 17:30 UTC on 2026-11-25 for the agent that takes these files next. Nothing below marked "not tried" has been run.

## Where things are

- The cut: `src/shake/change.ts:22` `CHANGE_CUT` (frame 26 of the window, middle of the shutter; film frame 674.25, plus 720 per shake). The base steps there: `src/scene/stage.ts:262` and the base handles in `src/core/materials.ts`.
- The order of the table's dressing: `src/shake/change.ts:29` `DRESSING_CHANGE`, used in `src/core/materials.ts`.
- The glare: numbers in `src/scene/lighting.ts:45` `CHANGE_BLOOM` (`glare`, `glareReach`), colour set at `src/scene/lighting.ts:244`, place set at `src/scene/stage.ts:347` to `349`, drawn in `src/post/post.ts` (uniforms filled at 311), state in `src/post/grade.ts:53` to `56`.
- The span of the slab's heaps: `src/shake/change.ts:38` `ON_THE_CUT`, line 47.

## Items not mended

### 154, the cut frame reads as both seasons when stopped on it

- Cause: `src/shake/change.ts:22`. The cut sits in the middle of the shutter of frame 674, so that frame's samples are half old base and half new. At final it is a blurred blend, at draft a plain double exposure.
- Next change: `at: frames(26)` (the cut between frames 673 and 674, no blended frame), or `frames(26 + config.film.shutterDegrees / 360)` for the end of the shutter of 674. `ON_THE_CUT` follows by itself. `tests/shake-change.test.ts` holds the cut at the middle of the shutter of frame 26: that is a rule this change moves, so restate it in its own commit and say so.
- Proof: `npm run seq -- --first 673 --last 675 --tier final --look no` on both versions, flip the three frames at native size. Then the shas of all eight keys.

### 154, the glare lifts the backdrop and washes the new base

- Cause: `src/scene/lighting.ts:45`, `glare: 0.22, glareReach: 1.5`, and the falloff `pow(1 + d2, -2.5)` in `src/post/post.ts`. At the base's distance about 0.4 of the middle value is still added.
- Next change: `glareReach: 1.1` first, then `glare: 0.18` if the backdrop still reads brown grey at 673. Not tried at these values.
- Proof: frames 673 to 675 at final, and `python3 patch.py` style numbers: the clipped share stays 0.00 percent, the table medians left and right keep one rise and one fall.

### 155, heaps and discs of the slab cross inside the cut frame

- Cause, not in this job's files: `src/scene/surface.ts:525`, `su.uLumps.value = lumpsA + (lumpsB - lumpsA) * partChange('surface-dressing', f.change)`. One number for both seasons, so the old cannot sink before the cut while the new rises after it.
- Exact change: `su.uLumps.value = lumpsA * (1 - leave) + lumpsB * come`, where `leave` is the clamped ramp of `f.change` from `DRESSING_CHANGE.leaveFrom` to `leaveTo` and `come` from `comeFrom` to `comeTo`, and both are 0 and 1 by `f.mix.base` when `f.from.season === f.to.season` so a shake of one season is untouched. Not tried.
- Proof: twelve frames round each cut at draft (669 to 680, 1389 to 1400, 2109 to 2120, 2829 to 2840): no heap in a frame with the new base in shake 1, no heap before 2835 in shake 4. Then the eight keys.

### 155, frost stays on the glass over the new base, 675 to 677

- Cause: `src/shake/change.ts:46`, `'glass-dressing': OUTSIDE` (0.69 to 0.85, film frames 672.8 to 678.6).
- Exact change: `'glass-dressing': { from: OUTSIDE.from, to: CHANGE_CUT.at, lag: 0 }`. Two readers feed shakes of one season and must keep the old numbers or the keys move: `src/seasons/winter/arrival.ts:91` `kept('glass-dressing', through)` becomes `kept('base', through)` (in this job's files); `src/seasons/summer/glass.ts:476` `partChange('glass-dressing', through)` becomes `partChange('base', through)` (not in this job's files). Not tried.
- Proof: frames 673 to 678 of shake 1 and 2833 to 2838 of shake 4 at draft, then winter-shake and summer-shake first of the eight keys, since those are the two at risk.

### Step 6, the lights behind and the room

- Untouched: `src/scene/stage.ts:55` `LIGHT_LATE = 2.5`, used at line 254; the backdrop reads `f.mix.light` at `src/scene/backdrop.ts:473` and 484.
- I did not find the warm glow at the top of the glass at 1396 in the after drafts 1393 to 1396, and drew no before frames of shake 2. First step: `npm run seq -- --first 1389 --last 1400 --tier draft --look no` on `origin/main` and on this branch, side by side.

### Small white specks on the table

- In every frame of every shake, before and after. Cause not looked for.

## Commands that drew the pictures

- Before: a worktree of `origin/main` (`git worktree add --detach ../before origin/main`, `node_modules` linked, `npm run -s build`, `npm run -s simcache` until complete), then `npm run -s seq -- --first 669 --last 680 --tier draft --look no`. Frames land in `out/work/seq/film-preview-draft/film-000674.png`.
- After: a second worktree at the branch tip, same steps. Draft: `npm run -s seq -- --first 673 --last 675 --tier draft --look no`; shakes 2 to 4: `--first 1393 --last 1396`, `--first 2113 --last 2116`, `--first 2833 --last 2836`. Final: `npm run -s seq -- --first 673 --last 675 --tier final --look no`, frames in `out/work/seq/film-preview-final/`.
- Every command was run again until it exited 0.
- Pairs and crops were made from those PNG files with Pillow: two frames side by side scaled to 1400 px wide; the crop is x 150 to 750, y 240 to 540 of the before frame and x 230 to 830 of the after frame, each scaled twice.
- Table numbers: per frame, the median and mean of linear luminance in a patch of table left and right of the foot, and the share of pixels at 255. The script lived in `/tmp` of my machine and is not on any branch.
- Keys: `npm run -s still -- --key winter-rest --tier final --force --look no`, then `sha256sum out/work/stills/winter-rest-hd-final.png`; the six others with `--tier draft`.

## Traps

- `node tools/sheet.mjs --first A --last B` at the preview format takes film frames two apart. Use `npm run seq` for every frame.
- Any change under `src/` or `config/` changes the engine's hash and costs a 3.5 minute `simcache` before the next frame. Batch edits, then draw.
- A final frame at preview costs 5.3 minutes; winter-rest at final 5.3 minutes, fall-shake at final 12.6 minutes, a draft still 1.3 minutes, four draft frames 2.2 minutes (most of it start-up), `vitest` 55 to 85 seconds, determinism 6.2 minutes. Twelve frames at final is over an hour: plan for three.
- At draft (2 samples) a cut inside the shutter is always a plain double exposure. Judge the cut frame at final only.
- Changing the span of `surface-dressing` moved the winter-shake key through `kept()` in `src/seasons/winter/arrival.ts`. The call now reads `'base'`. Any span that a shake of one season reads has the same trap; search for `partChange(` and `kept(` before moving one.
- A glare taken from the picture's widest glow level also rose round the room lamps and the petals and made a band of light that travelled behind the glass (shake 2, 1394 to 1398). The analytic veil centred on the glass replaced it. Do not go back.
- New pieces arriving by the foot first flew through full light and went white for two frames (677, 678). The order is now far places first, the foot last.
- `node tools/measure.mjs --unit change --tier draft --only M4,M5` prints "not complete, 8 of 24 lines" on every run, because `--only` leaves 16 lines unasked. The eight lines are all there after the first run; do not loop on it.
- `main` moved about every ten minutes. Most merges were `kit/` and tools; two brought `src/` and forced a new `simcache` for the proofs. Check `git diff --stat HEAD...origin/main -- src config` before each merge.
- Editing sources under a running render breaks it: keep one tree to edit, one to draw, and copy sources across only when nothing is drawing.
- The local branch tracks `origin/main`. Push with the branch named: `git push origin agent/p5-swap`.
