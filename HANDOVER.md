# Handover: summer at feed size (`summer_finisher`, branch `agent/p6-summer`)

Start 04:04:51 UTC, limit 07:04:51 UTC. Everything below was seen with my own eyes unless it says otherwise.

## The three faults

1. Summer read as snow at the size of a phone feed. MENDED at rest, BETTERED in the shake.
   - Rest: fine green-gold points lead the eye, the seeds are faint warm tufts. Seen at `final` in `hd`, full size and at 400 px (`1-rest-final.jpg`, `2-rest-feed-approved-before-after.jpg`).
   - Shake: a swirl of fine gold streaks and green-gold flecks in a warm haze, with pale cream dabs among them; golden tan at 400 px, no white stars. Tanner and dimmer than the approved image's luminous white-gold swirl, and still the season nearest to snow when shaken. Seen at `final` in `hd`, full size and at 400 px (`3-shake-final.jpg`, `4-shake-feed-approved-before-after.jpg`).
2. The caustic was a thin bright scribble. MENDED toward the brief's words (a soft pool, brightest at a knot by the foot, the slow net of light through water inside it). It is not the approved image's caustic, which is itself thin gold veins from one point; `config/showcase.json` (`keys`, `settled`) already rules that ours is "a soft pool of refracted light with a few broad curved bands", and the pool now answers that sentence.
3. The app showed more and bolder seeds than the film. MENDED at rest (see below for the cause): film, app `high` and app `low` are the same garden (`5-rest-film-app-high-app-low.jpg`). BETTERED in the shake: the same gold storm, but the app draws each streak once, so its streaks stand apart more than the film's, which the shutter runs together (`6-shake-film-app-high-app-low.jpg`).

## What changed, by file

- `src/particles/draw/looks.ts`: `seed` size 3.6 to 3.2, `firefly` size 1 to 0.65. `CARD.glow` (read only by the shape `light`; the spark keeps its own numbers, and `sparkPale` holds the spark's old 0.65): tighter core, far less wide glow (`wideShare` 0.01 to 0.004), `pale` 0.36 so a firefly keeps its green-gold to the middle, `soft` 0.4, `blinkSkew`, `nearShare` 0.07 to 0.03 (fewer big bokeh discs). `CARD.hair` (the seed): 44 finer hairs, each too faint to stand alone, added as a gauze (`1 - exp(-sum)`) instead of the brightest hair winning, so a tuft is soft and densest at its heart; `restShare` 0.6 of the floating seeds are drawn at rest (all of them in a storm), `restSize` 1.1.
- `src/particles/draw/cards.ts`: the seed's gauze; the light's `soft`, `blinkSkew`, `pale`; `uWhole` (see fault 3); two `atan` guards (the fleck's edge in `cardEdge`, the seed's fan in `cardStreak`).
- `src/particles/draw/points.ts`: `uWhole` is 1 on the app's path (`f.live`), 0 in the film.
- `src/seasons/summer/veil.ts`: colours. firefly `[0.93, 1, 0.27]` glow 8 (was `[0.95, 1, 0.3]` glow 4), seed `[1.5, 1.2, 0.72]` (was near white `[1.8, 1.66, 1.4]`), mote `[1.3, 1.08, 0.5]`.
- `config/showcase.json`, `particles.summer` only: firefly 700 to 1200.
- `src/seasons/summer/glass.ts`: the pool rebuilt. `poolWater` (three crossed sheets of cells, no `pow`, no `atan`), a soft pool `gain * exp(-len²/softMm²)` shaded by a wide sheet (`mottle`), the net (`lines`, falling off within `linesMm`), the knot (`core`, `glow`), the strip of sun past the globe as before. `uPoolFoot` became a `vec3`; z is a slow breath that closes over the loop (`breath`, `breathCycles`, from `moment.time / moment.period`). All numbers in `look.pool`.
- `src/seasons/summer/mini/tree.ts`, `base.ts`, `mini/village.ts`: strict mends only (below). No look changes.

## Fault 3, the cause

Film and app share `CARD_VERT`. The film draws every sample through another place of its lens (`uAperture.xy`, `src/particles/draw/shader.ts`), which spreads each seed and each firefly over its blur circle; at `draft` (2 samples) that shows as two half-strength copies, at `final` as a soft disc. The app draws each card once with only the analytic blur, so the same seeds were crisper and bolder and read as more. Mend: on the app's path the card's variance gets the lens's blur circle too (`s2C += uWhole * 0.25 * coc * coc * afloat`, seed and light shapes only, so no other season's kind reads it). Counts are untouched: the app still draws `live.quality.<level>.particleFraction` of them.

## The strict run: what failed and why (not a look change, but it blocked the first push for an hour)

`npm run strict -- --keys summer-rest,summer-shake` printed `4 FAILED` on my first run, on shaders the air does not touch. I did not check `main` without my edits, so I cannot say it failed there, but nothing I had changed by then was in those shaders.

- 3982 px on the tree's leaf cards, 330 px on the spilled sand, 11 px of grass at the glass's outline: all one cause. A shader that `discard`s at its head and takes slopes afterwards (`dFdx`/`dFdy` in `src/core/chunks/light.ts` 379 to 383 and in the hooks) reads, in the pixel beside a cut one, numbers the cut pixel never worked out. The software renderer leaves that lane stale, and the two compiles of the strict run leave it differently stale. Mend in my files: keep a flag where the cut was, `discard` at the end of `main` (`leafHook` in `tree.ts`, `hookOf(..., { cut })` in `base.ts`, the grass hook in `village.ts`, which rewrites the stage head's `if (stageOutside()) discard;` for the grass alone).
- The lantern's `atan(lampOut.x, lampOut.z)` at the caps, and the fleck's and the seed fan's `atan` at a card's middle: real `atan(0, 0)`. Guarded. `/root` then sent the strict checker's exact forms for the lantern and the fleck; they are in their own commits (`06423f0d`, `b31fb9f5`).
- Not sent as lines, for whoever owns `src/core/materials.ts`: `FRAG_HEAD` (lines 268 to 272) cuts at the head (`if (stageGone(stageC)) discard;`, `if (stageOutside()) discard;`) before the lighting takes its slopes. If another season's key ever shows a few differing pixels along the glass's outline or a cut edge under `all+smooth`, this is the cause, and the mend is the same: a flag at the head, the `discard` after `FRAG_TAIL`. I did not run other seasons' keys under strict.
- Cost: a cut pixel is now shaded before it is thrown away (leaf cards, grass at the outline, sand). I did not measure the app's frame time before and after.

## Scratch tools that are not in the repo (they live in `out/work/` of my VM and die with it)

- `strictfn.mjs --key K --sets "fn@textInShader#lo-hi~textInCall"`: narrowed a strict failure to one call. `main` now has `npm run strict -- --only`, which does the same.

## What I saw

Every picture on this branch was drawn by SwiftShader (the first software renderer, the tools' default while I worked): each "after" from `8402dc21`, each "before" from `c86cdf75`, main as it was when this job began. Main's decision 139 moves all drawing to the second renderer; nothing here was drawn by it, and nothing here should be set beside its pictures.

- `summer-rest`, `final`, `hd` (24 samples, 311 s), `1-rest-final.jpg`. At 400 px the air reads as fireflies: green-gold points first, then gold dust. It is close to the approved image's feel, a little less dense and less hazy. At full size the seeds are faint warm tufts, gathered in the upper left of the globe (the simulation gathers them there; I did not touch it); a few seen end on are small warm bursts of hairs.
- `summer-shake` (state landed), `final`, `hd` (644 s), `3-shake-final.jpg`. A swirl of fine gold streaks, pale cream dabs and green-gold flecks in a warm haze. At 400 px it is golden tan, not white stars. The approved image is a luminous white-gold swirl; ours is tanner and dimmer.
- The app's own path, `hd`, at `live.quality` `high` and `low`, beside the film's still (`5-`, `6-`). At rest the three are one garden; `low` draws its smaller share. In the shake the app's streaks stand apart more than the film's.
- The pool, `final`, `hd` (`7-pool-approved-before-after.jpg`). A soft pool of warm light left of the foot, a knot by the foot, a broad soft net inside it. It is fainter than the approved image's bright veins, and the knot sits at the bottom edge of the hero frame, as it did before.
- Sheets, `preview` format, `draft` (`9-` to `12-`). Shake 2: spring's petals cover the glass, the cover of light is at frame 1400, summer's storm is pale at 1412 under the last of the flare and gold at 1426 and 1438. The arrival, 1440 to 1616: a gold swirl that thins to fireflies; from 25.6 to 26.4 s the settling air is pale gold specks, the frames of the arrival nearest to snow. Shake 3: at 2068 a cream haze and at 2080 a near white haze, where summer's veil crosses to fall's; no stars and no flakes in it.

## What is still wrong, worst first

1. The shake at feed size is bettered, not mended. It is golden, but the pale cream dabs in it are the nearest thing to snow that summer still has, and it has less glow than the approved image. I did not prove with a diagnostic what draws the dabs. The two candidates are the seeds' storm tufts (`CARD.run.seedTuft` in `src/particles/draw/looks.ts`) and the near motes (`CARD.near.stormShare`, which other seasons share).
2. Two places in the film are pale. The arrival from 25.6 to 26.4 s (pale gold specks while the air settles), and shake 3 at frames 2068 to 2080 (a near white haze). I did not change the veil's storm; its levers are `veil.tint` (`[1.24, 0.98, 0.76]`) and `STORM` in `src/seasons/summer/veil.ts`, and the crossing of the two seasons' veils is in `src/scene/stage.ts`, which is not mine.
3. M4 for `shake-2` (spring to summer) passes with little margin, 0.8897 against 0.85 at `draft`. My edits did not move it (main without them gives the same count to the pixel, see the checks), but whoever next thins spring's or summer's storm has 0.04 to spend.
4. The pool is fainter than the approved image's caustic, and its knot lies at the bottom edge of the hero frame. `look.pool` in `src/seasons/summer/glass.ts` holds every number (`gain`, `core`, `lines` are the three that set how loud it is).
5. At rest the seeds gather in the upper left of the globe instead of drifting through all of it. That is the simulation, not the look.
6. The cost of two things on a real graphics card is not measured: a cut pixel is now shaded before it is thrown away (leaf cards, sand, grass at the outline), and on the app's path the seeds and fireflies cover a larger blur circle.

## Checks, and what they printed

All of these ran in my VM, drawn by SwiftShader. The strict run, determinism, the measures, the stand-in still and every picture are of `8402dc21` (engine `d3c64f0b7e6b5c04`). The head of the branch, `bac4ee68`, adds one comment line in `src/seasons/summer/veil.ts` (no shader text) and three merges of main: tools, kit and status pictures, and `27e83641`, which changes `src/app/app.ts` and `src/capture/showcase.ts` so a phone's camera stands back in a shake. Nothing was drawn again at the head. `npx tsc --noEmit` and `npx vitest run` ran on the head itself.

- Strict, `npm run strict -- --keys summer-rest,summer-shake`, 05:41 to 05:48, last line: `strict: pass, 2 keys under pow, all+smooth, all+smooth+noguard (engine d3c64f0b7e6b5c04): no pixel moves by more than 1 level, at most 0.01% of pixels move`. At most 1 pixel differed, by 1 level.
- `npx tsc --noEmit` on `bac4ee68`: printed nothing, exit 0.
- `npx vitest run` on `bac4ee68`: `Test Files  49 passed | 1 skipped (50)`, `Tests  568 passed | 7 skipped (575)`.
- `npm run determinism -- --season summer`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 343 s` (landed, rest and settled, each identical over four page loads). The default run (season winter) was not run.
- One still with `--diag standins` (summer, rest, hero, `hd`, `draft`): black. 0 of 2073600 pixels are above 0. Its record says `standIns: 2`, a count from the register; the view shows no pixel of them.
- `npm run measure -- --unit summer --tier draft`: the first run stopped at `sandbox.chunkBudgetMinutes` with 13 of 19 lines; the second printed `measure summer: complete · 19 of 19 lines, 0 red, 13 lines kept from the last run of this build · draft · 120 s`. The unit holds M1, M2 and M6 for six stills (`summer-rest`, `summer-shake`, `summer-interior`, `summer-base`, `summer-surface`, `summer-settled`) and M3 for `summer-rest` (1.4044 against 0.75). It holds no M4 line; M4 lives in the unit `change`.
- M4, `npm run measure -- --unit change --tier draft --only M4`: `shake-1` 0.9875, `shake-2` 0.8897, `shake-3` 0.9658, `shake-4` 0.965, threshold 0.85 (`shake.minCoverAtSwap`), all pass. `shake-2`, the swap from spring to summer, has little margin. That margin is not of my making: main `d35fd0cf` without my edits, measured the same way in my VM, printed the same line to the pixel for `shake-2` (0.8897, 124945 of 140442 miniature pixels) and for `shake-1` (0.9875, 144883 of 146711); I stopped that run there, so `shake-3` and `shake-4` were not measured on main. The last scorecard in the repo, `scorecards/fix-pass/a6e09d6/change.md`, had 0.9647 for `shake-2` at `final`, so the cover fell somewhere between that commit and `d35fd0cf`, or `draft` reads lower than `final`; I did not find out which.
- Winter, spring and fall at rest (hero, `draft`): `8402dc21` against main `d35fd0cf`, which is the main it had merged, without my edits. Both were built and drawn in my VM. For each season the two stills are the same file, byte for byte (sha256 begins `3cb64e00e660` for winter, `3c3e55377d1b` for spring, `3b3e2f2f45ed` for fall; 0 of 518400 decoded pixels differ). They were drawn in the `preview` format (960 x 540) for time, not in `hd` as the keys are, and the brief's "four other rest keys" are three here: `winter-rest`, `spring-rest`, `fall-rest`. The other seasons' landed keys were not compared.

## Not seen with my own eyes

- The film in motion. I saw sheets of single frames only.
- The app on a real graphics card or a phone, and its frame time. The app's path was drawn by the software renderer through the tools.
- `node tools/visit.mjs`.
- Other seasons' keys under strict, and their landed keys in any way. `main` without my edits under strict.
- Strict with `--modes all+smooth --same`, the reading `/root` named as the honest one after the two `atan` mends. It was not run.
- The shake at the `review` tier (seen at `draft` and at `final`).
- Anything drawn by the second software renderer.

## Slips

- The first push came at 05:48, long after the 45 minute mark, because the strict run failed on shaders outside the look and had to be narrowed and mended first.
- The 05:48 push had main `d35fd0cf` merged, but main had moved to `bad03291` (tools only) seconds before it.
- `/root`'s two exact mends (the lantern's `atan` in `src/seasons/summer/mini/tree.ts`, the fleck's `atan` in `src/particles/draw/cards.ts`) are each in their own commit, `06423f0d` and `b31fb9f5`, as asked.
