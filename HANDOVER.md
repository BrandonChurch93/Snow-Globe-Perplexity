# Handover: the liquid and the storm it carries

Branch `agent/p5-liquid`, tip `739c168`; my code ends at `ff71d2e`; kept commit before my work `8e5798b`. Line numbers are those of `739c168`. Everything below was seen at the draft tier unless it says otherwise. Nothing was seen in motion.

## What exists now

- `src/globe/liquid.ts:24` `LIQUID_LOAD = 19`: slots 19, 20, 21 of the liquid state hold how far the load is thrown, in mm, in the frame of the glass. Fed at lines 406 to 412 from the slosh (`CARRY` 2 at line 64, `LOAD_MAX_MM` 30, `LOAD_SECONDS` 0.5).
- `src/particles/engine/kinds.ts` `heft` per kind and `src/particles/engine/engine.ts:1525` (in `sweep`, line 1286): each particle is carried by `CARRY * slosh * heft`.
- `src/core/chunks/veil.ts:533` `loadLean` and `:543` `leanGlsl`: the veil's density is multiplied by an exponential across the glass along the load. Used at `veil.ts:393` to `395`, `src/seasons/fall/glass.ts:349` to `356` and `:409`, `src/seasons/spring/veil.ts:394` and `:634`.
- `src/globe/liquid.ts:82` `ROLL_TILT = 1.15`; `:222` `LIQUID_CURL`, `:230` `liquidBend`.
- `src/core/chunks/veil.ts:512` to `513`: the haze keeps its arcs while the liquid rolls.

## Items not mended

### 157, 106: no slam on the far wall

- Cause: `src/particles/engine/engine.ts:1525`. The carry is a velocity added to every particle alike; nothing stops them at the wall except the sphere clamp, so they slide round it and no pile forms. The veil does not pile either: `leanGlsl` (`veil.ts:544`) is a smooth exponential across the whole glass.
- Next change: in `sweep`, where a particle within about 6 mm of the wall has carry pointing outward, remove the outward part of its velocity and keep 0.3 of the tangential part for `LOAD_SECONDS`, so they stack against the wall. In `leanGlsl` add a term that rises steeply in the last fifth of the radius on the thrown side.
- Proof: extend `tests/engine-lag.test.ts` with the share of flakes within 6 mm of the trailing wall two frames after a reversal (I expect under 0.1 now; aim at 0.3). Picture: `npm run seq -- --first 2816 --last 2827 --tier draft --look no` in both trees. Reversals of shake-4 are at film frames 2803/2804, 2820, 2831, 2839/2840.
- Also wrong on the opened side: the tree and lamp are bleached pale by the light flood. That is the light inside at the swap (`tests/light-flood.test.ts`, `src/seasons/fall/glass.ts:729` to `736`), not the liquid. Not mine and not changed.

### 156: an even disc at the middle of the swap window

- Cause: `src/core/chunks/veil.ts:538`. The lean is taken from the load's present value, and the load crosses zero at frame 2824, two frames before the middle of the window (2826, load +5.3 mm). The quadratic knee (`leanKneeMm` 14, line 111) then gives next to no lean. The flood is also saturated: the winter bank is over 100 optical depths, so a few times thinner still reads opaque.
- Next change: in `liquid.ts` keep a second, slower load (decay about 0.25 s after `LOAD_SECONDS`) in three new slots and feed `loadLean` from the larger of the two, so the veil is still thrown when the load passes zero. Raise `LIQUID_LENGTH` (22 now) by three and check the checkpoint tests.
- Proof: `tests/veil-lean.test.ts`, a case that the lean at film frame 2826 of shake-4 is at least half of `leanMost`. Then M4, which has little room: shake-2 is 0.8704 against 0.85. `node tools/measure.mjs --unit change --tier draft --only M4,M5,M6` (about 7 minutes).
- The green rim of the glass at the swap is the shell's own through-glass milk (`src/globe/shell.ts`, THROUGH pass, and `uBloom` near line 520). Not mine. It keeps the outline a disc whatever the veil does.

### 164, 128: after landing the storm churns at one density

- Cause: `src/globe/liquid.ts:40` `TURB_SECONDS = spinDownSeconds * 0.4`, and `src/particles/engine/engine.ts:812`: the spread of sink speeds (`sinkSigma`, `hangSigma`) is narrow, so a kind thins all at once. Fall's embers (`kinds.ts:98`, mode `cycle`) never land by design, 6000 of them.
- Next change: widen the sink spread by heft at `engine.ts:812` (multiply `spread` by `1 + 0.6 * heft`), and scale ember count afloat by the roll so they thin as the whirl dies. `TURB_SECONDS` at 0.3 of `spinDownSeconds` broke tests in `tests/liquid.test.ts`; I reverted it. If the rule must change, it is a test change in its own commit.
- Proof: afloat share per kind by second after landing. Now: winter 0.96 at 1.6 s, 0.64 at 3.6, 0.21 at 7.6, 0.12 at 11.6; spring 0.54 at 3.6, 0.07 from 7.6; summer 0.40 at 3.6, 0.02 from 6.6; fall leaves 0.50 at 2.6, 0.08 from 6.6. Picture: `npm run seq -- --first 2160 --last 2340 --step 15 --tier draft --look no`. M5 must stay over 0.6.

### 57, 162: the haze is an even fog, no whirl

- Cause: `src/core/chunks/veil.ts:513`. I only let the arcs stay while `roll > 0`; the arcs themselves (`ring * arc * sheet`, line 394) are faint at haze densities and do not turn with the liquid.
- Next change: rotate the point `p` about `ROLL_AXIS` by the liquid's accumulated roll angle before `ring` and `arc` are read, so the bands wind. The roll is 13.7 at landing and 0 by 4.6 s.
- Proof: `--diag cover` on frames 2175 to 2265; three stills 15 frames apart must show the bands at different angles.

### 74, 130: tilted roll

- `src/globe/liquid.ts:82`. 1.15 is 24 degrees off upright. 1.25 fails two tests in `tests/liquid.test.ts`. Not seen in motion: view `node tools/sheet.mjs --motion landing --shot shake-3 --tier draft` if there is time (90 frames, slow).

### New fault of mine: rays in fall's haze

- `fall-shake` shows straight pale rays fanning from the upper right. Likely cause: `src/seasons/fall/glass.ts:351` and `:356`, `air` and `dust` times `thrown` (commit `e97b126`). First thing to try: revert `e97b126` and render `npm run still -- --key fall-shake --tier draft --force`.

### Rest keys moved

- `src/film/timeline.ts:40`: a rest still is a test shake and then the rest seconds, so any change to shake motion moves the flakes still in the air. Not my file. winter-rest `fc07cc16...`, fall-rest `3dc4244e...` on `ff71d2e` at final.

### spring-shake no better

- `src/seasons/spring/veil.ts:214` `storm.lean: 0.6` (cut from 1 to keep shake-2's M4). Not isolated from other agents' change to `src/seasons/spring/glass.ts`. Render `spring-shake` at `ff71d2e` against `8e5798b` to isolate.

## Commands that drew the pictures

- Trees: `git worktree add ../base 8e5798b` (kept), `git worktree add ../render <tip>` (mine); `npm run -s build` in each; node_modules symlinked.
- Shake-4 before and after: `npm run seq -- --first 2812 --last 2835 --tier draft --look no` in each tree; frames land in `out/work/seq/film-preview-draft/`.
- Winter reversal: `npm run seq -- --first 656 --last 667 --tier draft --look no`.
- After a landing: `npm run seq -- --first 2160 --last 2340 --step 15 --tier draft --look no`.
- Keys: `npm run -s simcache` once, then `npm run still -- --key winter-rest --tier final --force` (and `fall-rest`); `npm run still -- --key winter-shake --tier draft --force` and the other three, in each tree. `sha256sum out/work/stills/<key>-hd-<tier>.png`.
- Montages: a few lines of Python with Pillow; globe crop box (560, 70, 1360, 780) of the hd still, scaled to 700 wide, kept over mine.
- Numbers per film frame: an untracked vitest file that steps the film timeline and prints liquid state, load and centre of mass. Never committed.

## Traps

- Time: a draft film frame is about 30 s plus up to 60 s of simulation for late frames; a draft shake still 65 to 130 s; a final still 4.5 min (winter) to 8 min (fall); determinism 6 min; measure 7 min. Review and final sheets were never affordable. Plan pictures first.
- `tools/sheet.mjs` at preview takes frames two apart; use `npm run seq` for every frame.
- `measure` prints "not complete · 16 of 24 lines" with `--only M4,M5,M6`; 16 is all of them. It does not ask to be run again.
- A saturated flood hides any lean: my first after pictures showed nothing though the load reached the shader. Check optical depth before believing a uniform.
- Linear lean at `leanFlood` 4.5 dropped shake-2's M4 to 0.8162. The knee and spring's 0.6 brought it to 0.8704.
- After killing a render: `rm -f out/work/render.lock`. Never chain `cd ../render && ...` after a command that can fail; a render once started in the edit tree.
- Running vitest beside a render nearly doubles the render's time.
- Merging `origin/main` brings other agents' drawing changes into the "mine" side of a comparison. For a clean comparison render the code tip before the merge.
- Push after merging, not before: one push of mine went out three commits behind main.
