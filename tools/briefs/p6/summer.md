# Job: `summer_finisher` · unit `summer` · branch `agent/p6-summer`

Read first: the summer parts of `kit/02-SUBJECT.md` and `kit/04-LOOK.md`, the approved images `references/approved/summer-rest.png` and `references/approved/summer-shake.png` at full size, and in `kit/PROGRESS.md` the open items 210 and 220 and the recipes for summer under "Look lock".

## The faults (must-fix 6 of the review, open item 220)
1. Summer reads as snow at the size of a phone feed. "The dandelion seeds are large white six-armed starbursts; small, they are snowflakes over a summer garden, and the app has more of them than the film." Picture: `out/stills/phase-5/final-pass/cmp_summer_rest.jpg` (the approved image, the film, the live app). The approved image has fine green-gold points of light in the air and no white stars.
2. "The approved summer image has ... a pool of caustic light on the table; the delivered caustic is a thin bright scribble."
3. The app's own path draws more seeds than the film. The two must be the same garden.

## What is asked
- Make the air of summer read as summer at 400 px wide: warm, with fireflies as the points the eye finds first. Seeds, if they stay, are small, few, warm in tone and cannot be read as flakes: a dandelion seed is a hair-thin stalk under a soft tuft, seen backlit, not a six-armed star. Look at the approved images before deciding how many are left at rest and how many fly in the shake. The shake must still fill the globe (the storm hides the change of season: measure M4 must stay green), so the storm of summer has to be made of something that reads as summer too: seeds in great number drawn fine and gold in the light, pollen, the swarm of fireflies.
- Rebuild the caustic on the table toward the approved image: a soft pool of light thrown through the globe, brightest near the foot, with the slow structure of light through water, not a line drawing.
- The film path and the app's path show the same seeds: same look, counts in the same proportion (the app draws `live.quality.<level>.particleFraction` of them).

## Yours
`src/seasons/summer/**` (but the lines in `base.ts`, `slab.ts`, `backdrop.ts`, `rig.ts` that read the change belong to `change_finisher`: tell it before you touch one); the looks of the kinds `seed`, `firefly` and summer's `mote` in `src/particles/draw/looks.ts`, `cards.ts`, `points.ts`, `shader.ts` and `src/particles/engine/kinds.ts`, changing nothing another season's kind reads; the caustic in `src/scene/surface.ts`; `assets-src/` scripts for summer's particles and caustic; the line `particles.summer` in `config/showcase.json` and no other line there; `tests/summer-fall.test.ts` and the summer cases of `tests/storm-draw.test.ts`.

## Done means
- `summer-rest` and `summer-shake` at the `final` tier in `hd`, each beside its approved image, at full size and at 400 px wide: a person shown the small one says summer, not snow. Say what you see in each, honestly.
- The same two through the app's own path at `high` and at `low`.
- A sheet of shake 2's storm and of the arrival into summer, and of shake 3 leaving summer (the film's shots `shake-2` and `shake-3`), at `draft` or better: the storm still covers (M4 for `summer`: `npm run measure -- --unit summer --tier draft`), nothing in it reads as snow.
- `npm run determinism`, the strict run on `summer-rest` and `summer-shake`, and the measures of `summer` pass.
- Winter, spring and fall are the same pictures as before (the four other rest keys by hash, at `draft`), or you say what moved.
