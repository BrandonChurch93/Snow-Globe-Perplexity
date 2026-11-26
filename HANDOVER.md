# Handover: summer's sand outside the glass (`summer_sand`, branch `agent/p6-summer-sand`)

Start 09:54:55 UTC, limit 11:34:55 UTC, 26 Nov. Files: `src/seasons/summer/arrival.ts`, `src/seasons/summer/slab.ts`. `tests/summer-fall.test.ts` is untouched and passes.

All my stills were drawn with `summer_glass`'s new rig pasted into `src/seasons/summer/rig.ts` on my machine (their message to me); that file is not in my commits. With the rig on `main` the sand is lit by another key, and the numbers in `SAND_LIT` want a look.

## What the sand is now

- The fall (`LOOK.fall` in `arrival.ts`): 24000 grains of 0.02 to 0.07 mm, each drawn as the line it leaves while the shutter is open (at most 9 mm), never thinner than 0.7 px and as much fainter as the line is longer and wider than the grain. It leaves the lip at the right shoulder, falls close to the flank and ends on the crest of the heap. For 0.07 s after a grain lands it is a speck of dust thrown up and out (`puff`), which makes the small bright haze at the foot of the fall. The fall is drawn in the pale grains only, and a grain in the stone's shade is drawn at 8% (`shaded`): dark grains and shaded grains were dark dashes across the pale stone.
- The grains that lie loose (`LOOK.loose`, kind 2): 14000 single grains of 0.05 to 0.19 mm that lie on the heap, thick along its edges and thinning out over the bare table beyond, with a scatter flung to the right of the heap (`HEAP.loose` in `slab.ts`, `sandLoose`). Soft dots, lit as the heap is. They do not move. At rest nothing else is drawn but the fall.
- The heap (`HEAP` in `slab.ts`): a cone under the fall on a low dune, a skirt and a fan to the right front, a shoulder round the front of the foot, and at the left a dusting too thin to be a layer (`sheet`, 0.34 mm). There is no apron. Below a wandering height the layer falls away (`sandHeight`), and its last millimetre is diced into grains pixel by pixel (`slabCut`), so the heap ends on a ragged line and not on an outline.
- The light on it (`SAND_LIT`, `SLAB_LIGHT`): the stage's key, shadow, sky and card, with a shoulder from 0.6 to 1.15 so nothing burns to flat white. `sandShade` is a made shade: the stage's shadow map has the base's shadow falling to the front left, and the approved image has the slope of the heap that faces the camera in shade. It is a line from the top of the heap to its right front end, soft, wandering, darkest under the ridge and lifting toward the front.

## What I saw, and at which tier

The final still (hero, hd, final tier, 24 samples, commit 47cb80e4 with `summer_glass`'s rig pasted in) at full frame, at 400 px wide beside the approved image, and in crops at 2.4 and 4 times:

- The table is dark and there is no apron of sand in front of the base.
- The fall is a ribbon of pale cream lines close to the right flank that ends in a small pale haze on the crest of the heap. Nothing hangs in the air beside it.
- The heap has a pale lit top and far slope and a grey slope toward the camera, with grain. Its right edge thins into single soft grains on the dark table.
- At the left of the foot lies a faint dusting of single grains with a slightly thicker core and no outline.

Seen at draft only: the `landed` still at the hero camera, the base camera (before the last tune). The arrival sheet (`npm run sheet -- --motion arrival --shot shake-2 --tier draft`) stopped at the chunk budget: 77 of 90 frames, 1440 to 1582. I looked at sheets 1, 5 and 6 and at crops of frames 1444, 1448, 1454, 1466, 1500 and 1580: grains are thrown from the lip on the landing, the fall thickens, thins to the standing fall, and the thrown grains come to rest.

Not seen: frames 1584 to 1620 of the arrival, sheets 2 to 4, the surface camera after my changes, the picture of `summer-shake` (only the strict run drew it), the app in a browser, and any still with the rig that is on `main`.

## Not mended, worst first

1. The heap is steeper and narrower than the approved one. The approved heap is a broad low wedge, mostly lit, with a soft shade from the base. Ours is more than half in a grey shade that ends on a plain diagonal line, the lit part is small, and the crest stands about 4 mm higher. At 400 px it reads as a small pale wedge with a dark front, not as the soft white heap.
2. At the right front of the foot a ragged black gap shows between the foot and the sand, and the near edge of the shaded sand has dark holes. The approved sand lies up against the foot.
3. The fall is drawn partly over the edge of the stone (our base is wider there than the approved one), it is brighter and more solid than the fine amber fall of the approved image, its right edge shows short dashes, and a few small dark dots remain on the stone by the lip.
4. The mirror image of the base is as it was: `src/scene/surface.ts` is not mine. It is broad and soft at the foot with a bright spot, where the approved image has it tight and sharp. Lines sent to `/root`.
5. The red and blue fringe is the lens pass (`src/post/post.ts` 156 to 157, fed from `src/post/grade.ts` 40 to 41). Single lit pixels at the ragged end of the heap and the smallest loose grains still carry a red side at 5 times (seen at review).
6. The approved image has a band of lit sand at the left of the foot beside the gold lines. `/root` asked for a thin scatter with no outline, and that is what is there.
7. The lit top of the heap is about sRGB 205 to 225 where the approved one is about 242 (measured at review).

## Checks on commit 47cb80e4, and what they printed

The strict run, the determinism run, the measure run and every still had `summer_glass`'s rig pasted into the working tree. The tests ran with `rig.ts` as committed.

- `npx tsc --noEmit`: clean.
- `npx vitest run` (with `rig.ts` as committed): "Test Files 54 passed | 1 skipped (55)", "Tests 701 passed | 9 skipped (710)". `tests/summer-fall.test.ts`: 5 passed, file untouched.
- `npm run determinism`: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 194 s". It draws the default season, which is winter. I did not run it with `--season summer`.
- `npm run strict -- --keys summer-rest,summer-shake`, last line: "strict: pass, 2 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, and against its own --same picture where that one differs (engine 43eed711e80c51a0, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move"
- `npm run measure -- --unit summer --tier draft`: "measure summer: complete · 19 of 19 lines, 0 red · draft · 85 s". All 19 lines pass: M1, M2, M6 for summer-rest, summer-shake, summer-interior, summer-base, summer-surface, summer-settled, and M3 summer-rest 1.6726 against a threshold of 0.75. M6 summer-shake is 0.000088 (9 of 102000 particles inside a solid) against 0.002. Every other M1, M2 and M6 is 0.
- `--diag standins` (hero, draft): largest level 0, no pixel that is not black.
- `winter-rest`, `spring-rest`, `fall-rest` at draft on the branch and on `origin/main` (210a125a): the three file hashes are the same on both. Nothing moved.

## Scratch tools (on my VM only)

`/tmp/t/pair.py approved ours out x0 y0 x1 y1 scale` stacks a crop of the approved image over the same crop of ours. `/tmp/t/inv.py` turns a pixel of the hero frame into slab millimetres.
