# Report: unit `change` (change_builder), Phase 4

Times UTC. Branch `agent/p4-change`, last commit `c568e8a` (pushed 04:50, in the freeze of 05:20). Looks `agent/p4-change-looks`. `HANDOVER.md` beside this file holds the state of each change and arrival, what is wrong on the newest sheet, and the next three things to do.

## Stand-ins and fallbacks

None. `BUILT_CHANGES` in `src/shake/change.ts` holds all four pairs, so `stage.ts` flags no `change-*` part. Neither named fallback (the plain dissolve of every part; an arrival faded in evenly) was used.

## What was built, by commit

| Commit | What |
| --- | --- |
| da3d387 | first bloom of the new season's inner light across the outside span; summer's grains no longer hair-like streaks |
| c9c08b2 | the particles collide with the union of both seasons' solids while the window is open (M6 at shake-2's swap from 206 to 35 of 102000) |
| 6a5643c | the flood capped (200, lens 0.6) so the orb keeps its glass and the base its shape; the table dressing changes from the foot outward (`DRESSING_FRONT`) |
| 419d22c, fc047e8 | the stand-in flag down for the four changes, each after its sheet was judged |
| 405aaee | the flood falls over about 3 frames once the base is whole (`fall: 0.6`): no bright patch left on the table after the change |
| d09daec | summer's grains drawn only from the landing to 8 s after it, never in the mirror, 0.6 and 0.3 of them at medium and low (G15) |
| b95a98c, e8b5177 | merges of `origin/main` |
| c568e8a | winter check after the merge of main at 832eb32 |

## Measures

Thresholds M4 at least 0.85, M5 at least 0.6, M6 at most 0.002 and none outside the sphere. M6 is swap / landing. A cycle is one change to the build and one measure at final tier; the build of cycle 1 is c568e8a.

| Change | Cycle | What changed | Tier | M4 | M5 | M6 swap | M6 landing |
| --- | --- | --- | --- | --- | --- | --- | --- |
| winter-spring | before | first bloom only (d58fa20) | draft | 0.9449 | 0.9598 | 0.001559 | 0.000265 |
| spring-summer | before | same | draft | 0.9932 | 1 | 0.00202 RED (206 of 102000) | 0.000029 |
| summer-fall | before | same | draft | 0.9622 | 0.9472 | 0.000137 | 0.000029 |
| fall-winter | before | same | draft | 0.9934 | 0.9997 | 0.000078 | 0.000029 |
| winter-spring | work | union collider, capped bloom, dressing front (fc047e8) | draft | 0.9451 | 0.9622 | 0.000324 | 0.000363 |
| spring-summer | work | same | draft | 0.9931 | 1 | 0.000343 | 0.00002 |
| summer-fall | work | same | draft | 0.9633 | 0.9382 | 0.000118 | 0.000049 |
| fall-winter | work | same | draft | 0.9937 | 0.9998 | 0.000069 | 0.000029 |
| winter-spring | 1 | flood falls sooner, grains only while they fly, main at 832eb32 merged (c568e8a) | final | 0.9444 | 0.9864 | 0.000284 | 0.000265 |
| spring-summer | 1 | same | final | 0.9797 | 1 | 0.000353 | 0.000029 |
| summer-fall | 1 | same | final | 0.9198 | 0.9728 | 0.000088 | 0.000039 |
| fall-winter | 1 | same | final | 0.9603 | 0.9996 | 0.000088 | 0.000039 |

Cycles used at final tier: 1 of 5 on each change. Nothing is red. No threshold and no input of a measure was touched.

How to run it: `npm run measure -- --unit change --only M4,M5 --tier final` took 225 s for the 8 lines; `--only M6` after it keeps them. With `--only` a rerun measures the asked lines again from the first; without `--only` the run carries on where `sandbox.chunkBudgetMinutes` stopped it and also measures M1 on the eight judged stills (not run by me at final).

## Tests and checks, as printed

- `npx tsc --noEmit`: no output (clean), 05:13 on c568e8a.
- `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`, 05:14 on c568e8a.
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 330 s`, 05:15 to 05:20 on c568e8a.
- Winter, frozen: `npm run still -- --season winter --state rest|landed --camera hero --tier draft --format hd --force` byte-identical to the stills kept before my first change (sha256 rest `f6a5bfd6…81bf9`, landed `06ce7056…bf0cd`, full values in HANDOVER.md), and the nine frames of the winter into winter test shake identical, last checked 04:45 to 04:50 on the build of c568e8a.
- Triangles by G15's method on c568e8a (hd, web set, rest, hero, live level; high / medium / low): spring 1,515,704 / 885,486 / 402,146; summer 1,679,719 / 935,831 / 432,158; fall 1,601,891 / 932,848 / 415,102. Limits 1,800,000 / 1,100,000 / 600,000.

## Pushes

Branch: da3d387 (first, about 03:40), b95a98c 04:18, fc047e8 04:27, c568e8a 04:50. Nothing changed in the code after 04:50, so nothing was pushed to the branch after it. Looks: fb98d5f 03:20, d9ea952 03:47, 8584704 04:08, bbb91f6 04:27, c27d7d9 04:55, 13093cf 05:01, and the last one with this file. Each branch push after a merge of `origin/main`, tsc and vitest; never forced, never to main.

## Constants a successor should know

- `src/shake/change.ts`: `SPANS` inside 0.05 to 0.95 with lag 0.5; light, veil, particles 0 to 1; `OUTSIDE` 0.69 to 0.85; `BLOOM_RAMP` 0.12.
- `src/scene/lighting.ts`: `CHANGE_BLOOM = { flood: 200, lens: 0.6, pool: 8, swellFrom: 0.46, fall: 0.6 }`. Flood 800 is a white flash, 150 lets the dissolve show; lens 3.5 burns the orb flat white.
- `src/core/materials.ts`: `DRESSING_FRONT = { gain: 2, fromMm: 58, toMm: 230 }`.
- `src/particles/engine/engine.ts`: `SWAP_HALF` 0.22, `swapAt` 0.22 to 0.78 (unchanged); `both(a, b)` and `unions` are the union collider.
- `src/seasons/summer/arrival.ts`: `LOOK.gone [6.5, 8]`, `share { medium: 0.6, low: 0.3 }`, `stride 7919`, jump `liftMm [0.5, 4.5]`, 14,000 jump grains and 9,000 pour grains.
- Frames: windows 648 to 683, 1368 to 1403, 2088 to 2123, 2808 to 2843; landings 720, 1440, 2160, 2880; the outside span is the 5.6 frames from window start + 24.2.
- Times in this VM: a draft sheet frame 15 to 25 s (the first of a late range 100 s more), a final frame about 90 s, an hd still 75 s, vitest 76 s, the 11 parts + texpack + build 2.7 min.

## `npm run make` targets

None of mine (no asset added or changed). To build the tree after merging main I made, in this order: base-fall, base-spring, base-summer, slab-fall, slab-spring, tree-fall, tree-spring, tree-summer, village-fall, village-spring, village-summer; then `npm run texpack`, `npm run build`.

## `ASSETS.md` rows

None.

## Looks used (limit 40 a part)

Counted from my notes, sheets and stills I rendered and looked at: change-winter-spring 10; change-spring-summer 3; change-summer-fall 6 (one of them the final-tier frame 2116); change-fall-winter 4; arrival-spring 2; arrival-summer 3; arrival-fall 2. All under 40. Not looks of a part but checks: the winter into winter test shake 4 sheets, winter's two stills 8 times (2 kept before the first change, 6 to compare). On the looks branch now: `flood-shake-1.jpg` to `flood-shake-4.jpg`, `arrival-spring.jpg`, `arrival-summer.jpg`, `arrival-fall.jpg`, `summer-grains.jpg`, `final-2116.jpg`, with `captions.txt`.

## Handover

Files of this unit: `src/shake/change.ts`, `src/scene/stage.ts`, `src/scene/lighting.ts`, `src/scene/surface.ts`, `src/core/materials.ts`, in `src/particles/engine/engine.ts` the change of kind (`turn`, `follow`, `blend`, `both`, `unions`), `src/seasons/spring/arrival.ts`, `src/seasons/summer/arrival.ts`, `src/seasons/fall/arrival.ts`, tests of its own under `src/shake/` (none added; `tests/shake-change.test.ts` is `/root`'s and pins the spans).

Changed by me: `change.ts`, `lighting.ts`, `materials.ts`, `engine.ts`, `summer/arrival.ts`. Read only: `src/shake/table.ts` (the hand, open item 71), cameras, `config/showcase.json`, winter.

Work trees I used (gone with this VM): a render tree on the branch where every render ran one at a time from a queue file, an edit tree for tsc, vitest and commits, a looks tree. A tool of my own outside git, `out/work/bin/tris.mjs`, prints G15's triangle counts per season (it is G15's loop from `tools/lib/checks.mjs`).
