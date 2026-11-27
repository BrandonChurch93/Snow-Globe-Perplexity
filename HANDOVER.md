# Handover: spring's base (phase 6, sixth list)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Cobbles: cells of about 9.2 by 7 mm, each a rounded stone (`rock` in `build.mjs`: a plateau with a dome over it), moss in every joint (`seam`). In the shader the stone is shaded by how high it stands and has almost no sheen. The stone is set 2.9 mm in (`- 2.9` in `rock`) so the cobbles stay inside the third list's outline.
- Where the stone is bare: only the front, azimuth about -60 to 20 degrees (`bare` and `shelf` in `build.mjs`); the left flank is mossed to the table and takes the light from the left.
- Outline: `swell` is the third list's again. The cushions over the rim are gone. `dip` wears the moss roll down by an uneven depth (1.0 mm at the front under the glass since the sixth list, 2.2 before, up to 2.6 mm more in patches); it only lowers points above 35 mm and moves nothing outward.
- Rim tone: `liveTip` in `base.ts`. Its colour runs from moss green at the left to straw at the right and its strength from `0.33 + 0.75 * exp(-x * x / 400)` to 2.4 with `liveEast` (the sun is behind and to the right; the glass shades the left of the collar). `liveLip` starts at 37.5 mm so the dipped roll still has a lit top; `liveCrown` weighs 0.6 at the left and 0.08 at the right.
- Roots at the lit right: the sixteen thin ones are out. The stout root there (1.7 mm) forks twice and a thick one (1.45 mm) stands beside it; 41 roots in all. The low sun on the roots is narrowed to the faces that look at it (`smoothstep(0.4, 0.9, liveGraze)`), so they are pale on the lit tops and bark brown elsewhere.
- Water: the sun glint, the room's glints and the travelling glints are cut by about a quarter (`1.65`, `0.68`, `0.68`, and `mix(0.6, 1.1, ...) * fine`).
- The dew's lines are byte for byte as on main.
- Sixth list, the cap: the moss over the upper third is a cap written into the height (`cap`, `capEdge`, `CAP_TONGUES`, `capOn` in `build.mjs`), 2.8 mm thick at its lower edge and 4.6 mm near the seat, with twelve tongues at the front and thirteen in all. `swell` sets the upper body in by 1.6 mm so the cap overhangs without a wider outline. The cap falls to nothing over the last 3.2 mm before the seat; at the two ends of the rim (`flank`, azimuth beyond about 48 degrees) it thins from 10 mm before the seat, so the ends are lumps and not horns. The tufts of the older moss (`thick`) are half as high inside the cap.
- The trickle's strip and its foot are laid on `wideBare`, the height without the cap, so the water is where it was. Roots are laid on `rootBed`, the stone plus 0.85 of the blurred cap, so they lie on the cap.
- The cap's light in `base.ts`: `liveTop` (how far the mesh's own normal looks up) gates `liveCrown` and `liveLip`, so the light over the glass falls on crowns and the cap's face stays in the shade. The fill on the moss rises to 4.4 above 38 mm and turns warm there (`vec3(1.08, 0.96, 0.84)`). The low sun reaches further round on high moss (`liveReach` from 0.0, the third power of `liveGrazeM` eased toward the second). Stone in the deepest cavity keeps 0.12 of its light (`0.12 + 0.88 * smoothstep(...)` in `baseAo`), because the cavity under the cap's edge would be black otherwise.
- The moss line above the glass's lowest point, approved against sixth list: middle 106 against 113 px, left 148 against 163, right 154 against 146 (`/tmp/line.py` on the ids view; the approved by eye on the picture).

## What is short of the approved picture
- At 3840 (picture 23) the lit rim and the lit right shoulder of the cap are a smooth pale skin with soft ripples. The leaf grain of the moss shows only where the fill lights it. The approved's lit moss is speckled: single bright tips with dark between. The tip light is added over the moss's colour and does not carry the sheet's grain strongly enough.
- The cap's top edge at the front is close to one clean pale band; the list asked for uneven tufts. The clumps in the height were taken down because at full height they read as a row of knobs.
- Lit crowns, brightest quarter of the box, approved against sixth: upper left (91,86,61) against (113,113,66); front right (167,146,97) against (67,76,31); right shoulder (234,206,166) against (242,228,168). The front right is far too dark: the approved has a lit crown there, the build's edge lies higher and the box falls on its face. Shade, darkest two fifths: (8,12,8), (6,11,8), (12,15,10) against (5,10,6), (6,11,6), (16,18,11).
- The right of the cap from the middle to the shoulder is lit in the approved over its whole face (middle fifth (99,86,49)); the build has (53,60,25) there.
- Between the cap's crest and the glass there is a dark crease at the front, and above it the miniature's own ground edge shows through the glass as an olive band. The approved's moss runs up to the glass without a crease.
- The base still stands taller than the approved's: moss line to table at the middle 290 px against 250 (0.385 against 0.334 of the glass's diameter). The wall stands near upright with its widest part at mid height (1.05 of the glass's diameter); the approved's leans out to the table (0.93 at the cap's lower edge, 0.97 at mid height, 1.00 just above the table).
- The trickle is still a dark glossy ribbon; the approved's is a pale clear film.
- M4 of shake 2 (spring into summer) at draft reads 0.8964 with the collar. The bare pixels are the miniature's ground at the front left under a thin storm, not the base.

## How to look
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (560,640,1380,1020) beside the approved picture scaled to 1920. The rim is measured 5 to 35 px under the base's top edge in thirds x 670 to 860, 860 to 1060, 1060 to 1250 (the base's edge from the ids view, the approved's from the hand trace in `outline.py`'s polygon). The detail line: `npm run measure -- --unit spring --only M3 --force --tier review` (0.8666 on the sixth list: base 0.909, miniature 0.867). It is the mean of the squared difference from a blur of 1.5 px over the base's pixels, so it is carried by the bright flanks.

## At 3840 in motion (film frames 1200 to 1203, final, sixth list)
Each box laid on its neighbour by whole pixels, luminance; mean change a frame, the 99th percentile of the change, the share of pixels that change by more than 24 levels. The camera moves about two pixels a frame in these frames, so the numbers are not to be set beside those of frames 1100 to 1103 on the earlier lists.
- cap, lit rim right of the middle: 5.4 to 6.6, p99 24 to 29, 0.8 to 2.1 percent. Lit rim at the middle: 4.9 to 5.0, p99 24 to 25, 1.0 to 1.1 percent
- cap face: 5.5 to 5.6, p99 41 to 42, 3.7 to 3.8 percent
- cap, lit right shoulder: 6.0 to 6.8, p99 37 to 41, 3.1 to 4.2 percent. Left lump: 3.4 to 4.1, p99 23 to 26, 0.9 to 1.2 percent
- wall under the cap: 2.6 to 2.7, p99 21 to 22. Water: 3.7 to 4.4, p99 50, 39, 36
Four frames are not the film: nobody has watched this at 60 a second.
