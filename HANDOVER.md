# Handover: spring's base (phase 6, seventh list)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Cobbles: cells of about 9.2 by 7 mm, each a rounded stone (`rock` in `build.mjs`: a plateau with a dome over it), moss in every joint (`seam`). In the shader the stone is shaded by how high it stands and has almost no sheen. The stone is set 2.9 mm in (`- 2.9` in `rock`) so the cobbles stay inside the third list's outline.
- Where the stone is bare: only the front, azimuth about -60 to 20 degrees (`bare` and `shelf` in `build.mjs`); the left flank is mossed to the table and takes the light from the left.
- Outline: `swell` is the third list's again. The cushions over the rim are gone. `dip` wears the moss roll down by an uneven depth (1.0 mm at the front under the glass since the sixth list, 2.2 before, up to 2.6 mm more in patches); it only lowers points above 35 mm and moves nothing outward.
- Rim tone: `liveTip` in `base.ts`. Its colour runs from moss green at the left to straw at the right and its strength from `0.33 + 0.75 * exp(-x * x / 400)` to 2.4 with `liveEast` (the sun is behind and to the right; the glass shades the left of the collar). `liveLip` starts at 37.5 mm so the dipped roll still has a lit top; `liveCrown` weighs 0.6 at the left and 0.08 at the right.
- Roots at the lit right: the sixteen thin ones are out. The stout root there (1.7 mm) forks twice and a thick one (1.45 mm) stands beside it; 41 roots in all. The low sun on the roots is narrowed to the faces that look at it (`smoothstep(0.4, 0.9, liveGraze)`), so they are pale on the lit tops and bark brown elsewhere.
- Water: the sun glint, the room's glints and the travelling glints are cut by about a quarter (`1.65`, `0.68`, `0.68`, and `mix(0.6, 1.1, ...) * fine`).
- The dew's lines are byte for byte as on main.
- Sixth list, the cap: the moss over the upper third is a cap written into the height (`cap`, `capEdge`, `CAP_TONGUES`, `capOn` in `build.mjs`), 2.8 mm thick at its lower edge and 4.6 mm near the seat, with twelve tongues at the front and sixteen in all. `swell` sets the upper body in by 1.6 mm so the cap overhangs without a wider outline. The cap falls to nothing over the last 3.2 mm before the seat; at the two ends of the rim (`flank`, azimuth beyond about 48 degrees) it thins from 10 mm before the seat, so the ends are lumps and not horns. The tufts of the older moss (`thick`) are half as high inside the cap.
- The trickle's strip and its foot are laid on `wideBare`, the height without the cap, so the water is where it was. Roots are laid on `rootBed`, the stone plus 0.85 of the blurred cap, so they lie on the cap.
- The cap's light in `base.ts`: `liveTop` (how far the mesh's own normal looks up) gates `liveCrown` and `liveLip`, so the light over the glass falls on crowns and the cap's face stays in the shade. The fill on the moss rises to 4.4 above 38 mm and turns warm there (`vec3(1.08, 0.96, 0.84)`). The low sun reaches further round on high moss (`liveReach` from 0.0, the third power of `liveGrazeM` eased toward the second). Stone in the deepest cavity keeps 0.12 of its light (`0.12 + 0.88 * smoothstep(...)` in `baseAo`), because the cavity under the cap's edge would be black otherwise.
- The moss line above the glass's lowest point, approved against sixth list: middle 106 against 113 px, left 148 against 163, right 154 against 146 (`/tmp/line.py` on the ids view; the approved by eye on the picture).

- Seventh list, the light: the low sun and the crest light no longer blow out. Both are a colour (`liveLowSun`, `liveCrest`) bounded toward `SUN_TOP` (2.4, 1.7, 0.7) by `x / pow(1 + abs(x / SUN_TOP)^3, 1/3)`, so a lit edge ends at a warm cream and the lens's fringe (`src/post/post.ts`, not this job's) has no pure white to split into a red and a blue line. On the growth the low sun's gain is 2.4 times the graze squared (7.0 times the cube before). In film frame 1030 the base's box held 1,409 deep blue and 1,081 pure white pixels at 3840 on the sixth list and holds 647 and 0 now; what is left is the fringe itself, one pixel wide.
- Seventh list, the lit moss: `liveBlade` (from the moss sheet's blue channel) scales the low sun and the crest light on moss, so each lit tuft has a lit tip and its own shade. The crest's ridges are still a smooth cream (picture 28).
- Seventh list, the body: `PROFILE` in `layout.mjs` leans in from the table all the way up (radius 60.4 mm at 1.6 mm, 50.6 at 32.5). Width over the glass's diameter, approved against build: under the cap 0.939, 0.932 against 0.912, 0.930; mid height 0.972 against 0.961; foot 0.996, 1.003 against 0.999, 0.997. The belly's swell is `6 * fbm - 2.2`.
- Seventh list, the crest: clumps of uneven height stand in the crest (`2.6 * dome^2 * id^2 + 0.9 * mound * id - 1.2` over the last 8 mm before the seat). The moss line over the glass's lowest point is 106 px, as the approved's.

## What is short of the approved picture
- The crest reads as a rolled rim with a cream top; the approved's top is one broad cushion that slopes up to the glass, with clumps in three or four sizes and bare dips between. The clumps are too even.
- The crest's ridges at 3840 are a smooth cream without grain (picture 28, the four rows).
- The front right crown is dark: brightest quarter (54,66,30) against the approved's (167,146,97).
- The cap's face is one green without the approved's pale speckle.
- The roots: 41 in the build, thin and spread over the whole front; the approved has about 8, two to three times as thick, most of them right of the middle. Not counted on the registered outline yet.
- The mushrooms: many small ones in bunches; the approved has fewer and larger, single or in twos.
- The moss's lower edge is close to one level band; the approved's runs down in tongues between the stones and thins out.
- The stones are more, smaller and rounder than the approved's, which are flat with a wet sheen.
- The trickle is a dark glossy rope; the approved's is a thin clear sheet with a pale lit edge and a small splash at the table.
- The crease where the cap meets the glass has no dark seam with tufts over the glass's foot.
- The left end lump stands 13 px high.
- The table to moss line is 0.375 of the glass's diameter against the approved's 0.334. It stays: `globe.baseHeightMm` is 33 for all four seasons (decision 40) and the table line lies 25 to 40 px lower than the approved's in every season.
- The mushrooms' stems in the shade at 3840 read blue black; the approved's are cream.
- The petals on the moss (`LEDGE_PETALS`, this job's) read as flat grey discs in the shade at 3840.
- M4 of shake 2 (spring into summer) at draft reads 0.8874 (0.8954 on the sixth list, threshold 0.85). The bare pixels are the miniature's ground at the front left under a thin storm.

## How to look
The seventh list's stills were drawn on 00216045 (main e5671c9c merged); the film frames 1030 and 1200 to 1203 on e767b105 (main 3170155e merged), before the three `pow` bases were wrapped in `max(..., 1.0)` for the shader test. The value is the same and the rest still at review on 00216045 equals the one on e767b105 byte for byte.
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (560,640,1380,1020) beside the approved picture scaled to 1920. The rim is measured 5 to 35 px under the base's top edge in thirds x 670 to 860, 860 to 1060, 1060 to 1250 (the base's edge from the ids view, the approved's from the hand trace in `outline.py`'s polygon). The detail line: `npm run measure -- --unit spring --only M3 --force --tier review` (0.8564 on the seventh list: base 0.899, miniature 0.856; 0.8666 on the sixth: base 0.909, miniature 0.867). It is the mean of the squared difference from a blur of 1.5 px over the base's pixels, so it is carried by the bright flanks.

## At 3840 in motion (film frames 1200 to 1203, final, seventh list, drawn on e767b105)
Each box laid on its neighbour by whole pixels, luminance; mean change a frame, the 99th percentile of the change, the share of pixels that change by more than 24 levels. The camera moves about two pixels a frame. In brackets the sixth list.
- cap, lit rim right of the middle: 5.7 to 6.6, p99 32 to 36, 2.6 to 3.3 percent (5.4 to 6.6, p99 24 to 29). Lit rim at the middle: 7.6 to 8.2, p99 38 to 46, 4.7 to 6.4 percent (4.9 to 5.0, p99 24 to 25)
- cap face: 6.0, p99 48, 4.7 to 4.8 percent (5.5 to 5.6, p99 41 to 42)
- cap, lit right shoulder: 5.6 to 6.4, p99 38 to 44, 3.5 to 4.9 percent (6.0 to 6.8, p99 37 to 41). Left lump: 4.5 to 4.9, p99 29 to 32
- wall under the cap: 2.5 to 2.6, p99 20. Water with the moss beside it: 4.5 to 5.2, p99 80, 69, 62 (3.7 to 4.4, p99 50, 39, 36)
The lit moss changes more from frame to frame than on the sixth list because it carries grain where it was a smooth skin; the box is laid on by whole pixels and the camera moves by parts of a pixel. At 4 times the leaves hold their shapes over the four frames. Four frames are not the film: nobody has watched this at 60 a second.
