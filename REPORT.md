# spring_mini2: report (Phase 4, spring miniature, second set)

Branch `agent/p4-spring_mini2`, last commit `823cffd`. Looks on `agent/p4-spring_mini2-looks`.
Files: `assets-src/village-spring/**`, `assets-src/tree-spring/**`, `src/seasons/spring/miniature.ts`, `src/seasons/spring/mini/**`. Nothing outside them was committed.

## Make targets, in order
1. `npm run make -- village-spring` (10 to 25 s)
2. `npm run make -- tree-spring` (1 s)
3. `npm run texpack` (about 1 min)
4. `npm run build` (2 to 4 s)

Both makes need the shared `village` and `trunk` makes to have run (they are in main's `assets-full`). The season's triangle gate also needs `npm run make -- base-spring` and `slab-spring` (bases2's): see G15 below.

## Stand-ins and fallbacks
None. `standIns: []`. No generated picture is used; every asset of mine is made by code from seeded streams.

## What I did to the Round 8 issues
| Issue | State | What changed |
|---|---|---|
| R3-1 #1, R3-2 #7, R1 #6, R2 "flat repeated clusters, blobby": crown | better, not done | The flat cards are gone. The crown is 4,103 cupped five petal flowers in 654 clusters on 165 curved sprays, gathered in 36 small boughs with sky between them; normals rounded bough by bough, underside of each bough shaded, an inner dark core in each cluster; taller dome near the approved silhouette; paler, brighter tones. Bark has its own lit, ridged material (no black tubes); twigs are brown wood. |
| R3-1 #2: tulips striped, pond grey putty, chimney pot black | fixed (tulips, pond, pot) | Tulip normals smoothed; pond is dark water with concentric rings, the lamp's glint and the far bank in its mirror; the pot is lit terracotta. |
| R3-1 #2, R3-2 #8, R1 #4: wall flat, roof one plane, chimney, fence shape | not mine to reshape | Wall, roof, chimney, fence and windows are shapes of the shared `village-model.glb` (read only for me). I changed only their cover: stone and slate tone, moss on ridge and eaves, fence tint `[0.96, 0.8, 0.62]`. Relief at the gable and shingle edges need the shared model. |
| R3-1 #7, R3-2 #6: green band with a grid under the lawn | grid fixed, band softer, still a band | The tiled turf on the bank is replaced by procedural moss cushions (no repeat, no grid). Lip lit, falloff to dark soil below, 110 rim mounds. In the rest hero it still reads as a green wedge where the approved shows lit moss mounds in mist. |
| R3-1 #14 (my half), R1 #4: panes flat, no glow or spill | partly | Panes brighter with room and curtain tone, small halo on lamp and panes. No visible pool of lamp light on the grass; a wide halo was tried by `spring_mini` and read as a blob. |
| R1 #5: pond rings, lamp reflection, stepping stones | fixed, stones partly | Rings and the lamp's reflection are there. Path stones carry a paler tint mask but are still plain lumps (shared shape). |
| R1 #8 (my half): lit pond edge at the rim | fixed | Bank lip lit, far bank dark in the pond's mirror. |
| G15 | fixed for my share | See below. |
| M1 spring-interior | passes | See measures below. |

## Still wrong, worst first
1. Crown: still fuller and more even than the approved's lace of blossom on bare branches; few bare twigs reach past the blossom; no warm light from behind inside it (the light is `spring_air2`'s rig).
2. Bank: a green wedge under the lawn in the rest hero and interior. The approved has pale, misted moss mounds there. Needs low mist at rest (`veil.ts`, `spring_air2`) more than more paint.
3. Storm (landed hero): the crown is a dim pink ghost where the approved is a pale glowing cloud; there is no storm term in the blossom material (`tree.update` is empty).
4. Trunk: thicker and shorter below the fork than the approved (shared `src/miniature/trunk.ts`).
5. Cottage: smaller and dimmer than the approved; wall and roof without relief (shared model, others' light).
6. Lamp: no pool of light on the grass, halo small.
7. Petals crowd the pond and roof and some stand on edge on the lawn (particle engine, `kinds2`; I sent the resting rules).
8. Fence and path stones are blocky (shared shapes).

## Where I did not follow a critic
- The critic asked for less blossom mass ("one cluster"). The approved pair shows a full pink crown, so the crown stays full; it is broken into boughs instead of thinned out.
- The pond stays dark with a warm lamp streak as in the approved rest image; it was not made blue or clear.

## G15 (triangles)
My files' index lists, high / medium / low: 277,099 / 120,986 / 83,506 = 0.783 / 0.384 / 0.390 of the gate build fe1072c (353,922 / 314,740 / 214,000; rule 0.80 / 0.58 / 0.71).

| mesh | high | medium | low |
|---|---|---|---|
| blossom | 74,625 | 33,595 | 23,340 |
| twigs | 11,550 | 11,550 | 5,680 |
| turf | 85,691 | 30,180 | 15,117 |
| growth | 102,833 | 45,590 | 39,330 |
| water | 2,400 | 71 | 39 |

Beyond the lists: the lawn (`turf`) casts no shadow (no visible change, 85,691 fewer in the shadow pass); `growth` is not drawn in the planar mirror (A/B hero still: 0 differing pixels); below `high` the blossom draws its shadow share in the mirror and the twigs are skipped in shadow and mirror.

Season drawn at rest, hero, draft (`node out/work/bin/tris.mjs spring`), on a3e46f9 (same triangle lists as the tip):
- with `base-spring.glb` as committed on main 832eb32: 1,617,387 / 1,164,429 / 485,953 (medium fails)
- after `npm run make -- base-spring` and `slab-spring`: 1,510,059 / 882,961 / 400,654 of 1,800,000 / 1,100,000 / 600,000 (all pass)

## Tests and measures
At d3983e2 (the last commit that changed what is drawn; 823cffd adds recipes and two merges of main):
- `npx tsc --noEmit`: clean (no output). `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`. Both run again at 823cffd with the same result.
- `npm run determinism`: last line `determinism: pass · 3 pictures, 4 page loads, preview, draft, 344 s`.
- `npm run measure -- --unit spring --only M1,M2,M3,M6 --tier draft`: `measure spring: complete · 19 of 19 lines, 4 red · draft · 432 s`.
  - pass M1 spring-interior: 0 invalid values; "the miniature, 550358 pixels in the ids view, stays clear of the edge of the frame". By hand before that: first miniature row 40 of 1080 with a slightly larger crown.
  - pass M3 spring-rest: 0.8128 against 0.75 (miniature 0.813, base 1.334). By my earlier runs the miniature was 0.557 when I started and 0.920 at 150bc12; I take the drop since then to come from the paler, finer crown and the haze now in front of it, but I did not isolate it.
  - pass M6 on all five stills (rest 0, shake 23 of 102,000 particles inside a solid = 0.000225 against 0.002).
  - pass M2 spring-interior (0), spring-base (0.006), spring-surface (0.0255).
  - FAIL M2 spring-rest 0.0503, spring-shake 0.0549, spring-settled 0.0503 against 0.03. Not the miniature: in the measure's own `spring-rest-hd-draft-texels.png` and `-ids.png` all 14,548 soft pixels carry the ids colour (96, 251, 121), lie in rows 921 to 1018 and span the whole width; by its place in the frame that is the surface the globe stands on. The miniature (249, 190, 16) has 84,704 pixels in the sharp zone and 0 soft ones.
  - FAIL M1 spring-base: 6 invalid values. Not the miniature: the count stayed 6 with my miniature group and my lights hidden (told `/root` at 03:31).
- Stand-ins check: none in my files (`standIn: false` on every material of the part).
- Not run by me: `npm run fit` (draws a different picture), the film renders, any tier above draft.

## Looks
40 of 40 used (38 pictures looked at and 2 `--diag ids` runs for M1; the tally before 04:15 UTC is my running count of about 29). All at `--tier draft --format hd` with the approved crop beside ours where a pair was made. One slip: looks commit 78fc049 was staged with `git add -A .` inside the looks worktree; it held only the 4 pictures and `captions.txt`.

## Size
`public/assets/spring/`: `tree-blossom.glb` 2.39 MB, `village-spring.glb` 4.65 MB, `village-turf.lin.tile.webp` 0.65 MB (+ `.first.webp` 0.25 MB), `village-water.lin.tile.webp` 0.12 MB: 8.06 MB (7.69 MiB) of 9.5 MiB.

## ASSETS.md rows (names unchanged; for `/root`)
| file | made by | command | seed |
|---|---|---|---|
| `spring/village-spring.glb` | `assets-src/village-spring/build.mjs` (+ `levels.mjs`, `meshoptimizer`) | `npm run make -- village-spring` | `rng(5171)`, mounds `rng(9133)` |
| `spring/village-turf.lin.tile.png` | same run | same | seeded noise |
| `spring/village-water.lin.tile.png` | same run | same | seeded noise |
| `spring/tree-blossom.glb` | `assets-src/tree-spring/build.mjs` (+ `../village-spring/levels.mjs`) | `npm run make -- tree-spring` | stream `tree-spring` |

## PARTS.json line (for `/root`)
`{ "name": "miniature-spring", "owner": "spring_mini2", "branch": "agent/p4-spring_mini2", "commit": "823cffd", "files": ["assets-src/village-spring/**", "assets-src/tree-spring/**", "src/seasons/spring/miniature.ts", "src/seasons/spring/mini/**"], "standIns": [] }`
