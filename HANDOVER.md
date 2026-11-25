# Summer base, surface dressing, arrival: handover

Written by `summer_base` for whoever takes these files next. Read `REPORT.md` first (30 lines), then this.

## Where things are

- Branch `agent/p4-summer_base` (work), `agent/p4-summer_base-looks` (pictures, this file, `REPORT.md`).
- Parts in the register: `base-summer`, `surface-dressing-summer`, `arrival-summer`.
- My files, and nothing else:
  - `assets-src/base-summer/` : `lib.mjs` (noise, vectors, glb writer), `profile.mjs` (the turned shape and the beds), `measure.mjs` + `set.json` (the 34 shells and glass pieces picked from the approved image, as positions only), `field.mjs` (height field of the wall), `mesh.mjs` (stone, shells, sea glass, ledge sand), `maps.mjs` (tone, carve, grain and sand pictures), `build.mjs` (entry), `RECIPE.md`.
  - `src/seasons/summer/base.ts` : loads the glb, the four materials (stone, shell, sea glass, sand), exports `SAND`, `SAND_COLOUR`, `SHADE` and the sand shader pieces that `slab.ts` reuses.
  - `src/seasons/summer/slab.ts` : the sand on the slab (a mesh on a 0.8 mm grid where sand lies), `sandHeight(x, z)`, `sandSpread(x, z)`, `dressing()`; draws `summer_air`'s pool through the hook `glassPart.surfacePool`.
  - `src/seasons/summer/arrival.ts` : the grains (30,000 quads in one draw call): 14,000 that jump on the landing and lie on the slab, 16,000 that pour off the ledge at azimuth 82 degrees in a loop.
- There is no `assets-src/slab-summer/` folder: the slab's sand is made in code.

## Make targets, in order

1. `npm run make -- base-summer` (about 26 s; writes `assets-full/summer/base-*`)
2. `npm run texpack`
3. `npm run build`

Never commit `assets-full/` or `public/assets/`. Before merging `origin/main`: `git checkout -- assets-full public/assets`, merge, then the three steps above.

## Coordinates and constants a successor should know

- Millimetres. Azimuth 0 is +z (toward the hero camera), x is right. Globe radius 60, centre at height 79. Base height 33 (`baseHeightMm`), collar as winter's.
- Approved image: about 9.17 px per mm at z = 0, globe axis at x 1408. Key light comes from about (0.50, 0.32, -0.80): from behind and right, so shadows fall front left and the front wall is lit by fill only.
- `base.ts` `STONE {grain 0.16, carve 2.1, dust 0.75, glint 3.0, wrap 0.9, card 1.0, sun 3.4, bounce 0.5, sheen 0.18, top 1.6}`. `stoneOpen` (in `STONE_AFTER`) is the fill by how much a face looks up; cavity darkening is `1 - 0.45 * baseCavity` and a colour pull of 0.5.
- `base.ts` `SAND {tileMm 9.6, cover 0.62, glint 5.0, slope 1.5, wrap 40, thru 5, ledge 1, stage 0.35, drape 0.55, crest 2.4}`; `SAND_COLOUR {pale [0.9,0.8,0.63], deep [0.72,0.58,0.4], dark [0.4,0.3,0.2], white [0.97,0.94,0.88]}`; `SHADE {r 56, soft 3.5, top 40, globeH 79, globeR 60, globe 0.5, front 0.35, frontMm [16, 52]}` (the globe's and base's shadow on the sand, and a dimming of the sand in front).
- `slab.ts` `HEAP`: dune {66,6,19,24,9.5}, skirt {72,36,11,24,2.8}, shoulder {44,60,27,20,4.2}, fan {54,118,23,58,2.0}, sheet {-80,-50,15,28,0.7}, stray {56,80,28,70,0.25} as {x, z, half width x, half width z, height mm}; ring {r 61.5, w 4.5, 0.55} thinned to 0.06 of itself for azimuth -150..-8. `SLAB {liftMm 0.5, footMm 54, stepMm 0.8, x [-150,142], z [-232,216]}`.
- `arrival.ts` `LOOK`: gravity 3400 mm/s2; ledge {r [46.5,52], h 40.3}; jump {count 14000, reachMm 26, ringShare 0.3, ...}; pour {count 16000, az 82, spread 4.5, r 52.4, h 38.8, reachMm [4.6,11], rate [1.3,2.3]}; flow {rest 0.46, surge 0.5, seconds 1.3}; streak 2.1.
- Promise to `summer_air`, keep it: their pool of light lies flat at 0.3 mm, renderOrder 1; my sand sheet at 0.5 mm, renderOrder 3; grains renderOrder 4; I draw no pool light; the slab front left of the foot (approved x 480..1500, y 1380..1584) stays clear of sand except single grains.
- Grains use premultiplied blending with soft edges and `depthWrite false`. Do not go back to opaque or alpha-hashed grains: the lens fringe in `src/post/post.ts` shifts red and blue, and one-pixel opaque grains come out pink and blue.

## What is still wrong, worst first

Pictures are on this branch. `12`, `13`, `14` show the last commit; `15` and `11` were rendered a little earlier (noted below).

1. The stone reads as folded cloth, not carved sandstone (`12-base-pair.jpg`, `14-base-camera.jpg`). The beds are soft rolls with thin crease lines like seams, and the foot looks like a hem; the approved stone has sharp chiselled ledges, sweeping relief of several millimetres, warm sunlit patches on the upper right and deep warm shade under the bulges. The cause is the shape (`profile.mjs`, `field.mjs`) and the carve picture (`maps.mjs`), not the light: bed edges should be steps with a hard lip, and the foot one stout swelling.
2. Sea glass reads as glazed ceramic (`12-base-pair.jpg`, `14-base-camera.jpg`): opaque, too saturated, with a small mark at the middle of every piece (the pole of its mesh, `seaGlass()` in `mesh.mjs`). The approved pieces are frosted, let light through and are lighter at the rim.
3. Shells are pale grey and matte, without the peach and rose tints and the gloss of the approved ones; their ribs are even fans (`12-base-pair.jpg`).
4. The stone is lit evenly: no warm sun patch at the upper right, no orange in the shade, greyer than the approved peach (`12-base-pair.jpg`).
5. Small dark gaps at the base's upper right silhouette where the ledge sand meets the stone, near the pour (`12-base-pair.jpg`, right edge; `14-base-camera.jpg`, upper right).
6. The pour off the ledge is a pale haze at rest and from the base camera a soft block; the approved one is a bright backlit curtain that breaks into single grains (`13-wide-rest.jpg`, `14-base-camera.jpg`).
7. The dune right of the base is darker and more speckled than the approved cream heap with a white crest, reaches further right, and from the base camera its tile shows as a diagonal weave with a pink cast (`13-wide-rest.jpg`, `14-base-camera.jpg`).
8. The thin lit strip of sand left of the foot in the approved image is missing; there are only single grains there (`13-wide-rest.jpg`).
9. From the surface camera the thin sand in front lets the slab's reflection through and reads as a film, and it shows faint diagonal streaks (seen at 02:23, picture not on the branch: `npm run still -- --season summer --state rest --camera surface --tier draft --format hd --force`).
10. The landing: the jump reads mostly on the right of the ledge; little hops on the left and front (`11-landing-frames.jpg`, rendered at 4da5501, before the last two commits; the landing was not rendered again after them).
11. The change: the old base gives way to mine in about two frames, 23.20..23.27 s, with a coarse grain dissolve; it is inside the bloom but abrupt (`15-change-frames.jpg`, rendered at 02:06, before the last stone and glass changes).
12. Unseen: the `low` camera was never rendered, and I have no record of looking at stills of the states `landed` and `settled`; the landing was seen only as the motion sheet.

## What I tried that did not work

- Alpha-hash dither and one-pixel opaque streaks for grains: pink, red and blue pixels from the lens fringe. Cured by soft blended grains.
- The pour as 64,000 opaque streaks: a solid wall. Thinner streaks fringed. `flow.rest 0.5` with `streak 2.6` was a wall from the base camera.
- Grains accepted by lattice noise, and x and z drawn from one random stream: straight rows of grains from the surface camera. Now `sandSpread` and separate streams for x and z.
- Wrapped lambert on the sand: flat. The stage's own lights had to be scaled by `SAND.stage 0.35` and the sand lit by its own slope term.
- Stone grain tile at strength 0.3..0.55: reads as cloth weave. At 0.16 it is nearly invisible, and the stone is too smooth instead.
- Maps drawn upside down gave ring marks; `up()` in `maps.mjs` fixes the row order.
- Broad highlight lobes on the sea glass: milky white faces. Removed; now too saturated instead.
- Deeper beds through the profile's noise amplitudes (1.3 to 2.0 and 0.5 to 1.0): more folds, still cloth.

## Measured numbers (02:23..02:37 UTC, at 01edebf)

- `npx tsc --noEmit` clean; `npx vitest run` 32 files passed, 1 skipped; 432 tests passed, 4 skipped.
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 330 s` at 02:29; a second run after the last merge of main wrote `"pass": true` to `out/work/determinism/result.json` at 02:44 (I did not see its last line). Both ran without `--season`, so on winter: they do not prove summer. `npm run determinism -- --season summer` was not run for lack of time; run it first. My own check at 02:48: two `landed` hero stills of summer at hd draft were byte identical.
- `npm run measure -- --unit summer --only M2,M3 --tier draft`: M2 pass on rest, shake, interior, base, surface, settled (0 soft pixels each). M3 `summer-rest` FAIL 0.6909 against 0.75: the measure takes the lowest part; the base scores 2.683 over 170,641 pixels, the miniature 0.691.
- `npm run measure -- --unit summer --only M1,M6 --tier draft`: all pass (M6 shake: 8 of 102,000 particles inside a solid, 0.000078 against 0.002).
- `--diag standins` still (hero, rest, hd, draft): all black, 0 pixels lit.
- Colour, by `summer_air` at 01:56 (before my last changes), approved | build: base right 165,133,109 | 153,121,76; "base front" 55,55,46 | 85,68,36 (their labels). Not measured again.
- Size: `public/assets/summer/base-*` 5.23 MiB of the 6.5 MiB allowed (glb 3.57 MiB, carve 0.38, stone 0.48, grain tile 0.53, sand tile 0.26); the season folder 14.1 MiB of 18.
- Triangles: base glb 282,656; grains 30,000 quads (60,000 triangles, one draw call); the slab's sand mesh was not counted; G15 through the app's path was not measured by me.
- Looks used: 15 pictures over the three parts. Generated pictures: none.

## Rows for `ASSETS.md` (`/root` adds them; I may not edit that file)

Under "Generated images", as a line of prose like the one for the scene slab:

Made by script, with no generated picture in them (2026-11-25): `assets-full/summer/base-summer.glb`, `assets-full/summer/base-stone.srgb.w2048.png`, `assets-full/summer/base-carve.lin.w2048.png`, `assets-full/summer/base-grain.lin.tile.w512.png`, `assets-full/summer/base-sand.lin.tile.w512.png`, all by `assets-src/base-summer/build.mjs` through `npm run make -- base-summer`; recipe in `assets-src/base-summer/RECIPE.md`. The positions of the shells and glass pieces in `assets-src/base-summer/set.json` are numbers read off `references/approved/summer-rest.png`; no pixel of it is in any file.

## Where I would start

1. Shape first: in `profile.mjs` and `field.mjs` replace the rolling beds by three or four stepped ledges with a hard upper lip and an undercut, sweeping up to the right as in the approved image, and one swelling foot. Check with `--diag normals` from the base camera before touching any light.
2. Then the carve picture in `maps.mjs`: remove the thin crease lines, add pitted, wind-eaten hollows of 1 to 3 mm.
3. Then the sea glass: lower saturation, add a frosted pale rim and light through the body (`GLASS_AFTER` in `base.ts`), and close the pole of each piece in `seaGlass()`.
4. Then shells: vertex colours in `mesh.mjs` toward peach, rose and cream, gloss up.
5. Fit command: `npm run fit -- --season summer --tier draft --format hd --box 820,960,2000,1480 --name <n> --wide 1180 --force` writes `out/work/fit/<n>-pair.jpg` (approved above, ours below). One render process at a time.
