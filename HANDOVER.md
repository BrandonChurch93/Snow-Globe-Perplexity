# HANDOVER: fall base and slab (fall_base3), 08:47 UTC

Start from `origin/main` plus `agent/p4-fall_base3` at **e59fc18**. Looks branch `agent/p4-fall_base3-looks`.

## Files
- `assets-src/base-fall/`: `build.mjs`, `layout.mjs` (sizes, faces `SEEN`, `DRIPS`, `RUNS`, hero thorns), `maps.mjs` (carvings), `mesh.mjs` (drum, vines `addStrands`, thorns, pumpkins, wax, web), `lib.mjs`, `RECIPE.md`
- `assets-src/slab-fall/`: `build.mjs` (leaf pictures `inLeaf`, `leafSheet`; `leaves()`), `lib.mjs`, `RECIPE.md`
- `src/seasons/fall/base.ts` (paints of iron, vines, pumpkins, wax, web; candles `LIGHT`, `faceLevel`, `setCandles`)
- `src/seasons/fall/slab.ts` (leaves, crumbs, `candleInSlab`, `candleOnSlab`)
- `tests/fall-candles.test.ts` (mine, new: a lit face never falls back, no frame jumps, three front faces lit at 0.5 s)
- Not mine: `src/seasons/fall/arrival.ts` (change_builder2; it only passes the clock to `setCandles`).
- Make targets, in this order: `npm run make -- base-fall`, `npm run make -- slab-fall`, `npm run texpack`, `npm run build`.

## Open, worst first
1. **Vines fatter and smoother than the approved thorn tangle; facets show at silhouettes** (jury: "sharply faceted contours", "uniform procedural twigs"). Tubes have 5 to 8 sides (`mesh.mjs` line 309) and 1.5 mm steps. Rounding them costs triangles: my files are 7,176 under the takeover count (82,396 against 89,572), so 8 to 10 sides on the vines nearest the camera fits. Thinner radii (`rad` in `addStrands`: steep 1.0 to 1.45, one in four 1.6 to 2.05, else 1.15 to 1.7) and more long hero thorns (`layout.mjs`) are the next step toward the approved look.
2. **Leaves: no contact line, no reflection seam, curled and dry, larger and brighter than approved** (R3-2 #4, jury "rigid, flat-looking leaves"). Done: colour and age vary (`leafAge` in `slab.ts`), edges ragged (`inLeaf`), key glint tight. Not done: a dark contact where a leaf touches the slab. Idea not tried: a flat black copy of each near leaf at y 0.02 under it (192 triangles), which hides the mirror under the leaf.
3. **Faces light the vines round them less than approved.** `baseCandle = mix(baseCandle, 13.0, baseStrand)` in `base.ts`; higher turned the vines orange plastic at 20.
4. **M3 fall-rest**: base 0.752 at FINAL (threshold 0.75); draft readings are about 0.3 higher and say nothing. The detail the approved image has and the build lacked was on the lit flanks: `/tmp`-style map: split the `out/work/measure/m3-fall-rest-final-crops-2.png` crop pair, high pass sigma 1.5 px, compare 40 px cells. Left flank needs fibres in the warm light, right flank grain in the key's sheen. The line stays red on the miniature (0.277, fall_mini3's).
5. **Cobweb threads straighter and more even than the approved wisps** (R3-2 #3 answered in part: narrow fan, 7.5 mm sag, uneven weights, broken threads, sparse dew).
6. **"Taller" (R1 #7, #8) not done**: the ring is the approved pair's height; it stands larger and lower in frame than approved through the camera (`/root`'s).
7. Mirror streaks under the faces (`candleInSlab`, `MIRROR_DEPTH 0.5`) stand apart from the foot in the surface camera and are cut by the hero frame.
8. Collar wax: the seat of the glass is a wax rim, not a modelled channel (unchanged from fall_base2's item 4).

## Numbers that worked
- Candles (R4 set-B-01): `catchSeconds [0.16, 0.04, 0.09, 0.6, 1.9, 0.3, 1.0]`, `takeSeconds [0.36, 0.18, 0.27, 1.1, 2.5, 0.8, 1.6]`, `ember 0.42`, `floor 0.92`, `flare 0.7`, `flareSeconds 0.06`; rises are `ease(t, tau) = 1 - (1 + t/tau) e^(-t/tau)` (catch tau 0.03). Levels at 0.5 s: 0.72 / 0.85 / 0.82 times each face's own share `0.74 + 0.36 * k.c`.
- Vines: foot rings `h0 3.0 + 2.3 i`, `amp 3.0 + 0.4 i`, `k [5, 4, 6]`, `wander 1.9`; crown rings `amp 2.6 - 0.6 i`, `k 4 + 2 i`; open vines turn 7 to 24 degrees (steep 20 to 46); half of those crossing the right flank (mid 42 to 100 degrees) moved 180 degrees.
- Wax: run width `(d.w / 9.3) * 0.53`, neck `min(wide, 1.45)` to 0.66, bulb 0.32; the wide shoulder is in the collar ring (`thick` heavy term 0.9, `drop` 3.3); long runs (`h1 < 27`) have no companion.
- Web: big fan `b: onSlab(2128, 1446)`, sag 7.5; shader: 11 spokes, 6 rings, a third of the threads broken, beads `step(0.9, hash)`.
- Leather: stipple tilt 0.6 plus broad dimples `0.9 * (noise(pos * 0.42) - 0.5)`; key sheen `0.7 * pow(ironKh, 3)` from x 8 to 46 mm with grain.

## Pitfalls
- A GLSL error breaks the paint silently: look after every shader edit.
- `/tmp/mk.sh | head` kills the build; a stale `dist/` makes `measure` and `tris.mjs` refuse.
- A final-tier M3 takes 7 minutes; the film tool gives about 3 frames in 200 s after a 280 s first run.
- Dew beads need a pixel-size test (`fwidth`) or they read as strings of lamps.
- Leaves: a broad key glint (`pow 26 * 0.3`) washes a cupped leaf white; keep it tight (`pow 60 * 0.16`).
- Foot wax reads as pegs unless it drapes over a vine; thorns must never cross a face.

## What I could not see
- Nothing at tier high or at 4k; every look was `--tier draft --format hd`. Final tier only through M3's number.
- The landed state after 54ac639 (07:31) and the settled state at any commit of mine.
- The `surface` camera after c0ff90e (06:30); the `macro`, `interior`, `base` and `low` cameras at no commit of mine.
- The candles as a playing clip: seven film frames (35.97 to 36.17 s) and the landed still only.
- The season's triangle count after d553105: no mesh changed since (leaf pictures and shaders only), not recounted.
- The stills the draft measures rendered at the head (base, surface, settled, interior, shake): the measures passed on them, I did not open them.
