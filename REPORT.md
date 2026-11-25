# summer_mini2: report (Phase 4, summer miniature, second set)

Times are UTC, 25 Nov 2026, read from `date -u`.

## Branch
- `agent/p4-summer_mini2`, last commit `c19be78` (merge of main `194209a` over `2dc802e`), pushed 05:12.
- Looks: `agent/p4-summer_mini2-looks` (orphan), this report and `HANDOVER.md` live there.
- My commits, oldest first: `125ef00`, `6b12ad1`, `e2dc3ca`, `d8a8029`, `31350a0`, `fb76e68`, `2b9098f`, `5563d46`, `d3d1ea1`, `8dd8d2c`, `9d0e8ba`, `2dc802e`.

## Make targets, in order
1. `npm run make -- tree-summer` (about 11 s)
2. `npm run make -- village-summer` (about 2 s)
3. `npm run texpack`
4. `npm run build`

For a true triangle count of the season, `npm run make -- base-summer` (bases2's target, 26 s) has to run too after `git checkout -- assets-full public/assets`; my clone did not do that until 05:13, and my season figures of 04:58 were wrong for that reason (see below).

Make prints at the tip:
- `tree-summer: leaves 49404 triangles (7649 tufts, 32576 triangles at medium, 27988 at low), lanterns 11744 (10 lanterns); 138 lumps on 10 pads`
- `village-summer: ground 31920, water 2160, grass 63000 (21000 tufts, 32487 at medium, 21345 at low), decor 29061 (141 roses, 7400 leaves, 5 sunflowers, 249 blooms)`
- Web files: `public/assets/summer/tree-summer.glb` 1,504,772 bytes, `village-summer.glb` 4,622,040 bytes.

## Stand-ins and fallbacks
None in my files. No pixel of an approved image is in the app.

## Round 9 issues, what was done
| Issue | State | Commit |
| --- | --- | --- |
| Pond a flat opaque cream cutout (R1 #9, R3-1, R3-2, R2) | Dark water; bank, post, trunk and lanterns mirrored and broken on ripples; sky patch; dark wet bank. Seen on the hero still. Not done: mossy stones on the far shore, a shallow submerged edge. | `125ef00`, `e2dc3ca` |
| No sand rim, no stepping stones (R1 #9) | Sand rim and stones are there. The woven tile in the sand is gone (grain from a noise in globe millimetres), tone drawn towards white. Still cream-grey and flat beside the approved fluffy white sand. | `125ef00`, `fb76e68`, `5563d46` |
| Lanterns pale and chalky (R1 #13) | Vertical gores, saturated paper, core lowered so the orange holds. Still a little paler than the approved ones. | `e2dc3ca`, `9d0e8ba` |
| Lamp head an opaque white block (R1 #13) | Amber glass. Still a glowing block: the approved lamp is a black lantern with warm panes. Shape is shared. | `d8a8029` |
| Trunk a smooth cone (R1 #14, R3-2) | Fluted bark relief, rim light on the forks. | `125ef00` |
| Crown a dense opaque mass, repeated clumps (R1 #14, R2, R3-2) | Sprays vary in scale and tone, crown fuller and darker teal, gold on the rims. Still lighter and more speckled than the approved crown. | `d8a8029`, `2b9098f`, `5563d46`, `9d0e8ba` |
| Cottage: roof, chimney, windows, ivy, sunflowers, fence (R1 #12, R2) | Found the cause of the pale gable: the roof's solid fills the gable, so the wall above the eaves was painted as slate. Now warm stone gable, brown plank door, blue slate, grey chimney, ivy and roses on the side wall, wooden pickets, larger sunflower leaves. Not done: chimney height, roof thickness and fence shape are shared shapes. | `d3d1ea1`, `8dd8d2c` |
| G15 triangles | My files 187,289 / 124,273 / 78,386 (high / medium / low) = 0.719 / 0.607 / 0.456 of `fe1072c` (260,547 / 204,775 / 171,933); limits 0.73 / 0.70 / 0.78. | `d8a8029`, `31350a0`, `2dc802e` |

Nothing the approved pair asks for was undone. The critic's wish for snow caps was ignored as told.

## Still wrong, worst first
1. Crown: lighter, more olive and more speckled than the approved dark teal mass with a gold rim.
2. Sand rim inside the glass: cream-grey and flat; the approved one is fluffy white with sunlit highlights and shadow.
3. Lamp head: a glowing amber block, not a black lantern with warm panes (shared shape; a dark frame could be added as decor in `assets-src/village-summer/build.mjs`).
4. Cottage: stone courses read as bricks, roof thin, chimney too tall, fence is a picket fence (the last three are shared shapes).
5. Pond: bright patch peach rather than cream-white and smaller than in the approved picture; no mossy stones on the far shore; bank reads as one dark line.
6. Lanterns a little paler than the approved ones.
7. Sunflowers not looked at closely after the last change (larger leaves); they were named "overly simple" in R2.
8. M3 has only been run at draft tier here (0.8834, pass). An earlier observation in this session was that draft reads about 0.16 higher than final for this measure; I did not run it at final tier, so a pass at final is not shown.
9. Outside my files, but in front of my part: on main since about 04:50 the dandelion seeds are large and many and lie heaped on the grass and the pond in the hero still at rest (looks picture 01).

## Triangles (G15)
- Baseline at `fe1072c`, measured in a temporary worktree: tree 74,304 / 64,014 / 57,585, village 186,243 / 140,761 / 114,348.
- Now, per mesh (high / medium / low): leaves 49,404 / 32,576 / 27,988; lanterns 11,744 / 11,744 / 3,709; ground 31,920 / 18,322 / 5,923; water 2,160 / 83 / 38; grass 63,000 / 32,487 / 21,345; decor 29,061 / 29,061 / 19,383.
- Season, `node out/work/bin/tris.mjs summer` on `c19be78` with base-summer remade, 05:14: drawn 1,659,436 of 1,800,000 (high), 915,548 of 1,100,000 (medium), 438,010 of 600,000 (low).
- Passes found: view, shadow (casters), planar mirror of the slab at high and medium (whole stage drawn again with the world's height scale at -1). In my files: grass gives the mirror nothing, the ground casts no shadow, the cottage mesh gives the mirror only its shared walls (decor left out). The hero still at rest was identical pixel for pixel before and after the last of these.
- Corrections: the message of `31350a0` gives wrong figures for my files (122,383 / 85,603); the right ones at that commit were 188,879 / 126,383 / 81,400. My season figures sent at 04:58 (1,983,482 / 1,205,844 / 536,568) counted the committed, uncut `base-summer.glb`, because my clone had not remade it.

## Tests
- `npx tsc --noEmit`: clean before every push.
- `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)` before every push, last at 05:11.
- `npm run determinism`: run 05:15 to 05:21 on `c19be78`; last line `determinism: pass · 3 pictures, 4 page loads, preview, draft, 352 s`.
- `npm run measure -- --unit summer --only M2,M3,M6 --tier draft`: run 05:21 to 05:25 on `c19be78`; `measure summer: not complete · 13 of 19 lines, 0 red · draft · 258 s`. `pass M3 summer-rest: 0.8835 (threshold 0.75, detail.minSharpnessRatio)`, miniature 0.884 over 120,438 pixels, base 2.145; `pass M2` at 0 for rest, shake, interior, base, surface and settled; M6 passed in the run at 05:02 on `9d0e8ba` (0 of 102,000 particles inside a solid at rest, 9 of 102,000 in the shake) and was among the 13 lines without red in the last run.

## Looks
About 38 of 40 viewed (the count before 04:22 is from my notes and is approximate), all hero or interior stills at `--tier draft --format hd` beside the approved crop, or crops of them. Two more renders were made and not viewed: one at 04:41 after an edit script had failed (identical to the one before), one at 05:11 compared by pixel only.

## Mistakes of mine
- At 03:52 I once used `git add -A .` inside the looks worktree (only pictures and captions were in it). Every other commit names its paths.
- Between 04:22 and 04:53 I rendered with summer_air2's `rig.ts`, `veil.ts` and `glass.ts` copied over my working tree (never committed) to see my part under their light. After main took their later commit the copies were stale; the still viewed at 04:51 was made with them and is not a true picture of any commit. From 04:53 on every still is of the committed tree.
- The caption of looks picture 04 in `e3fba4a` says the lantern string is not drawn. It is drawn; it shows in the later stills.

## Constants at the tip
`src/seasons/summer/mini/village.ts`
- `NEAR_WALL = { lamp: { power: 1.3, reachMm: 8, ends: 3 }, pane: { power: 1.6, reachMm: 4.5, ends: 3 }, paper: { power: 3, reachMm: 4.6, ends: 3 } }`, `WALL_FILL = 2.3`
- `SAND = { white: [0.86, 0.9, 0.98], whiten: 0.8, clumpPerMm: 1.1, grainPerMm: 4.2, heapPerMm: 0.16, heapLow: 0.6, heap: 0.6, body: 3.6, floor: 0.8, wrap: 1.5, foot: 0.85, bump: 0.6, grainLow: 0.62, grain: 0.5, spark: 1.5, topFrom: 0.22, topTo: 0.62 }`
- `GRASS_LOOK = { fill: 0.1, wrap: 1.0, through: 0.36, near: 2.1, sun: 30, sunRoot: 0.35, shade: 0.6 }`
- `ROOF = { slate: [0.33, 0.41, 0.56], chimney: [0.4, 0.37, 0.35], stone: [1.12, 0.84, 0.66], stoneMid: 0.34, stoneFlat: 0.45, stoneHue: 0.5, plank: [0.5, 0.26, 0.15], plankMm: 2.2, plankTall: 3.8, pitch: 0.2, stoneMm: 1.4, picket: [0.5, 0.27, 0.14], picketMm: 1.6, pale: 0.25, railTop: [1.5, 1.2, 0.85], door: [0.27, 0.125, 0.08], doorMm: 2.4, reachMm: 0.4 }`
- `WATER = { spark: 1.1, mass: 0.975, houseMm: 9.5, houseTall: 17, flat: 0.14, wobble: 0.9, rough: 0.035, ripple: 0.0045, fine: 0.0012, shoreFrom: 0.9, shoreTo: 1.0, sky: 2.6, skyFrom: -0.75, skyTo: 0.35, skyAt: 1.5, skyWide: 9.5, skyLow: 0.1, bankMm: 1.6, bankVary: 2.2, bankEdge: 0.16, bankDark: 0.975, env: 0.1, glint: 0.5, squash: 0.14, paperGlint: 2.4, paperMm: 1.5, paperTall: 0.5, post: 0.93, postMm: 0.75, postTall: 11.5, trunk: 0.975, trunkMm: 5.2, trunkTall: 26, body: 0.4 }`
- `LAMP_GLASS = [1.7, 0.82, 0.22]`; `palette.ts`: `waterSky [1, 0.95, 0.84]`, `waterDeep [0.016, 0.03, 0.03]`

`src/seasons/summer/mini/tree.ts`
- `WOOD = { relief: 0.95, ridges: 5, warp: 2.6, fine: 0.4, low: 0.42, high: 1.3, from: 0.15, to: 0.85, depthMm: 1.5, rim: 5.5, rimTight: 2.2, side: 0.9, wrap: 0.95, mossTo: 7.5, moss: 0.8 }`, `BARK [0.62, 0.35, 0.19]`
- `LEAF_TINT = [0.24, 0.55, 0.45]`, `LEAF_VARY = { big: 0.36, mid: 1.15, scaleLow: 0.78, scale: 0.5, cool: [0.5, 0.74, 0.95], warm: [1.15, 1.16, 0.86] }`
- `LEAF = { rim: 9, rimTight: 3.2, through: 0.7, tight: 3.0, fill: 0.5, wrap: 0.8, bump: 1.0, clumpDark: 0.5, clumpBright: 1.3, top: 5, card: 1.0, topEdge: 1.6, topFrom: 0.06, topTo: 0.2 }`; the gold faces up from `smoothstep(0.2, 0.8, normal.y)`
- `LANTERN = { rib: 0.6, gores: 12, ring: 0.18, ribs: 26, gain: 0.72, body: 0.6, core: 1.8, tight: 3.0, paper: 0.06, dim: 0.1, ... }`, `HALO = { radius: 2.9, strength: 0.11, hot: 0 }`

`src/seasons/summer/mini/crown.ts`: `FULL = { swell: -0.55, perMm2: 0.5, radius: [0.95, 2.5], dome: 0.8, reach: 1.3, blend: 0.16, knob: 0.3, knobMm: 1.15, wave: 0.45, waveMm: 4.3 }` (this field is also the distance field of the crown at run time).

`assets-src/tree-summer/build.mjs`: `LEAF_CELL = 0.65`, `LEVEL_SPRIGS = { medium: 0.45, low: 0.3 }`, `SPRIGS = { share: 0.8, size: [1.5, 2.6], rise: 0.35, out: 0.34 }`, `TONE = { deep: [0.3, 0.54, 0.3], mid: [0.56, 0.86, 0.44], tip: [0.95, 1.3, 0.62] }`, `PAPER = { orange: [1, 0.19, 0.045], peach: [1, 0.27, 0.07], cream: [1, 0.52, 0.11] }`.

`assets-src/village-summer/build.mjs`: `IVY = { leaves: 760, roses: 14, low: 4.5, size: 0.62 }`, `TURF = { lumpMm: 0.35, fineMm: 0.12, sandMm: 0.7, sandReach: 6.5, sandSides: 0.35 }`, `GRASS = { tufts: 21000, blades: 3, ... }`, `LEVEL = { seed: 4107, medium: { back: 0.4, front: 0.72 }, low: { back: 0.25, front: 0.5 }, zFrom: -12, zTo: 6 }`, `STONE.buried = 0.25`; sunflower leaf size `tall * 0.36`.

## ASSETS.md rows
The rows come from the `RECIPE.md` of each folder; both were brought up to date in `2dc802e`:
- `assets-full/summer/tree-summer.glb`: made by `assets-src/tree-summer/build.mjs`, `npm run make -- tree-summer`; mesh `leaves` is the field of the crown walked with marching cubes at 0.65 mm with sprig cards on it, and names its own medium and low lists; mesh `lanterns` unchanged in kind.
- `assets-full/summer/village-summer.glb`: made by `assets-src/village-summer/build.mjs`, `npm run make -- village-summer`; meshes `ground`, `water`, `grass` (own medium and low lists), `decor` (now also ivy and roses on the side wall).
- `assets-full/summer/village-turf.lin.tile.png`, `tree-leaves.srgb.tile.w1024.png`, `tree-sprigs.srgb.w512.png`: unchanged by me.
