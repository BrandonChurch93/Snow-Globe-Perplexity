# Handover: summer_air (summer's glass dressing, veil, light and storm)

Written for someone who has never seen this work. Branch `agent/p4-summer_air`; pictures on `agent/p4-summer_air-looks`.

## Handover: my files

- `assets-src/refrig/summer.json`: lays the build over the approved image for `npm run fit -- --season summer`.
- `src/seasons/summer/glass.ts`: parts `glass-dressing-summer`: the sun flare, the glow on the far wall of the glass, the pool of light on the slab.
- `src/seasons/summer/rig.ts`: part `light-summer`: key, rim, sky, ground, fill, card.
- `src/seasons/summer/backdrop.ts`: the discs' colours, the room, the floor.
- `src/seasons/summer/veil.ts`: part `veil-summer` and the colours of `firefly`, `seed`, `mote`.
- `src/particles/engine/kinds.ts`: only the rows `seed` and `firefly` (the row `mote` is `spring_air`'s; I never changed it).
- No `assets-src/dressing-summer/` folder exists: nothing of mine is a built asset.

## Make targets

None. Everything of mine is drawn in the shader. `ASSETS.md` rows: none. My parts ship 0 MiB. They add 3 quads (flare, wall glow, pool): 3 draw calls, 6 triangles.
`main` now carries the built assets of every season, so after merging `origin/main` only `npm run build` is needed before a render.

## What is still wrong, worst first (picture that shows it)

1. Storm at the landing is dimmer than approved and its lower left is a flat pale bank (`02-landed-pair.jpg`, `04-landing-sheet.jpg`). Glass centre, approved | build: 179,147,107 | 113,94,58. The bank is the shared veil's (`src/core/chunks/veil.ts`, `uVeilBank`), its amount follows my `density`. The streaks are `kinds_builder`'s drawing; they got much better with its push fc18a80 (60 % of seeds as long fine streaks).
2. The top of the glass lacks the approved bright warm reflections (`01-rest-globe.jpg`; box "glass upper-mid" 183,154,122 | 119,118,101). A broad sheen there (`look.wall.top` 0.5) read as fog, so it stays at 0.15.
3. The discs upper right are dimmer than approved (box "disc cluster UR" median 178,143,108 | 34,29,22). I own only their colours (lifted per level in `backdrop.ts`); where they stand is the shared `src/scene/backdrop.ts`.
4. Fireflies sit low: the shared engine's `nest()` puts their homes within 45 mm of the ground; the approved image has points up to the crown of the glass.
5. Whole seeds at rest are whiter and sharper than the approved soft tufts (drawing: `kinds_builder`).
6. The pool lies partly on the mirror image of the base in the slab, which is paler than the approved dark slab there (`03-pool.jpg`); its veins are fewer and smoother than the approved fine branching ones (a chosen middle between the approved image and the brief's "broad bands, not thin veins").
7. The pool's swing after the landing is small (`look.pool.swing` 1, 1.7 Hz, decays in 1.1 s); not tuned further.
8. The flare's spikes are longer and thinner than approved's compact star (`look.flare.rays` 2.6, `spikes` 9).

## Constants a successor should know

- Refrig: approved glass circle centre (1408.1, 656.3) px, radius 550.1 px (winter: (1411.5, 653.4), 553.9); `summer.json` = distanceMm 618.7, aimHeightMm 64.27. hd px = 0.682 x approved px; about 9.2 approved px per mm.
- Rig: key [1,0.8,0.56] x 1.05 from [250,230,-400] (target [0,70,0]); rim [1,0.82,0.6] x 0.8 from [-330,250,-280]; sky [0.2,0.17,0.13]; ground [0.07,0.055,0.04]; fill 0.7; card [1,0.8,0.58] x 0.55 from [500,140,60], wrap 0.2, specular 0.4, inside 0.3.
- Backdrop: ember, amber, gold, pale, cream with lifts 0.9, 1.1, 1.5, 2, 2.4 (a colour times its lift; the colour multiplies the disc's energy, so values above 1 brighten it); room [0.003,0.0048,0.0052]; floor [0.0036,0.0056,0.0072].
- Veil: tint [1,0.77,0.5], density 0.2, rest -0.0011. Why negative: the shared veil keeps `density x 0.04 x 0.2` of haze while most of the pool is afloat (`slowHaze`, `veilSettle` in `src/core/chunks/veil.ts`), and summer's 40000 motes never land, so the haze never clears. `rest` is added to it, so a negative `rest` of 0.75 of that share takes it back. If you change `density`, set `rest = -0.0054 x density`. Tint above 1 also brightens the haze at rest; it does little for the storm.
- Particle colours: firefly [0.95,1,0.3] glow 4; seed [1.15,1.08,0.94] glow 0 (glow does nothing for a seed; its brightness is its colour times the scene's light); mote [0.78,0.55,0.26] glow 0.25 (the motes hardly show at these values; brighter ones wash the rest picture).
- Rows: seed `floats: 0.006` (whole seeds afloat at rest: about 54, plus the drawing's own 1.2 %), `sizeMm: [0.69, 1.39]` (the drawing multiplies by 3.6: 2.5 to 5 mm), `liftMmS: [18, 60]`; firefly `sizeMm: [0.25, 0.58]` (set against `kinds_builder`'s newest drawing, `agent/p4-kinds` 93f789c, laid over my tree for one look and not committed by me; on `main` before that merge the fireflies are smaller and dimmer), `reachMm: 9` (16 fails `tests/sim.test.ts` "starts the whole pool inside the glass").
- Counts stay firefly 700, seed 9000, mote 40000 (told `/root` at stage 1).
- Flare: a billboard of 30 mm half size at the key's mirror point on the sphere, additive, no depth test, renderOrder 14. Kindle is `uFlareSun.w`: 0 while the globe is held after the swap, rises in 0.22 s from the landing with an overshoot of 0.55 that decays in 0.3 s.
- Wall glow: billboard over the globe's disc, renderOrder 13, `look.wall` gain 0.42, crescent from 0.8 to 0.94 of the radius on the limb away from the sun.
- Pool: flat additive mesh 900 x 900 mm at y 0.3 mm, renderOrder 1 (`summer_base` keeps its sand above it: sheet 0.5 mm renderOrder 3, grains 4; its `slab.ts` adds my `surfacePool()` to the floor group). Centre = the globe + 76 mm down the light's way + 2.7 mm across. It moves with the globe's x, z, lift (2.2 mm per mm) and tilt. `look.pool`: core 3 (2.4 mm), glow 0.7 (5 mm), bands 2.2 (13 folds, `poolFold`), rays 0.9 (reach 7 mm), soft 22 mm x 0.14, stretch 2.2 toward the front.
- All three shaders `discard` when `uDiag != 0`: added light would corrupt the diagnostic views.

## Measured (draft tier; boxes at d989c27, before the fireflies' last change)

- Boxes at rest, median RGB, approved | build: glass open upper-left 96,83,64 | 108,98,74; glass centre 107,78,37 | 93,81,47; glass upper-mid 183,154,122 | 119,118,101; glass left limb 200,167,132 | 196,188,161; flare 226,195,160 | 235,200,155; pool core 166,115,59 | 190,163,118; disc cluster UR 178,143,108 | 34,29,22 (p90 235,215,195 | 149,129,87); disc left p90 230,199,159 | 108,77,42.
- Boxes at landed: glass open upper-left 186,156,117 | 136,120,89; glass centre 179,147,107 | 114,94,58; glass upper-mid 197,165,131 | 144,137,114; glass left limb 199,160,123 | 208,186,153.
- Fit, mean difference per channel: rest 45.8, 37.7, 29.1; landed 45.9, 38.2, 30.3 (the whole picture, every builder's parts).
- Measures at 2ec5d25 (`npm run measure -- --unit change --only M4,M5 --tier draft --force`): M4 shake-2 0.993 (threshold 0.85), M5 shake-2 1 (0.6), M4 shake-3 0.9774, M5 shake-3 0.9029, M4 shake-1 0.9449, M5 shake-1 0.9595, M4 shake-4 0.9951, M5 shake-4 0.9998; 0 red. The two commits after it changed only the fireflies' and motes' colours.
- `npm run determinism` at e3c0e9f: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 331 s`; after it only the fireflies' size and glow changed. Stand-ins still at e3c0e9f: largest pixel value 0.
- Not measured by me: M3 and M6 of unit `summer`; the hold `summer` as a motion sheet; the pool's swing in motion beyond the landing sheet.
- Looks used (one look = one rendered picture I looked at): glass dressing about 26, light about 13, veil and storm about 18; limit 40 a part.

## Tools I left in `out/work/v/` (not committed)

- `go.sh <n>`: build, fit at rest and at landed, the boxes, crops `c<n>.jpg` (approved rest, build rest, approved shake, build landed) and `p<n>.jpg` (pool, approved above).
- `box.py [--shake]`: median and 90th percentile RGB of fixed boxes in approved pixels, approved beside build.

## Tried and dropped

- Veil density 0.22 with `rest` 0: washed the picture at rest (glass upper left 126 against 96).
- Mote colour [0.85,0.66,0.36] glow 0.3: washed the picture at rest.
- Veil tint x 1.4: brightened the haze at rest, not the storm.
- Seed glow 0.2 to 0.5: no change (unused by the seed's drawing).
- Wall glow wide (from 0.6, gain 0.55): read as milk on the left of the glass; narrowed to the limb.
- Top sheen 0.5: read as fog.
- Card x 0.9: right for the first dark base, too flat on the cream base now on `main`; cut to 0.55.
- Pool as wide concentric rings (first version): unlike the approved knot with veins.
- Seed `liftMmS[0]` 10: moved winter through the engine's shared lowest lift; `kinds_builder` has since made that number per season (fc18a80).
