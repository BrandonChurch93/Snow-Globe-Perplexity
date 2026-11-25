# Handover: bases and slabs of spring and summer (bases2)

Written for someone who has never seen this work. Work branch `agent/p4-bases2`, looks branch `agent/p4-bases2-looks` (this one). I took over from `spring_base` and `summer_base`; their handovers are still worth reading for the parts I did not touch: `git show origin/agent/p4-spring_base-looks:HANDOVER.md`, `git show origin/agent/p4-summer_base-looks:HANDOVER.md`. Targets: `references/approved/spring-rest.png`, `spring-shake.png`, `summer-rest.png`, `summer-shake.png`. Times below are UTC on 2026-11-25.

## Files (mine; nothing else touched)

- `assets-src/base-spring/layout.mjs`: every measured number of spring's base (profile, cobbles, moss `PATCHES`, the trickle, `ROOTS`, mushrooms, flowers). I added three moss patches left of the fall and took six long diagonal roots out of `ROOTS`.
- `assets-src/base-spring/build.mjs`: makes `base-spring.glb` (meshes `rock`, `growth`, `water`), the relief and cover maps, the tiling sheets. Roots are thicker, tapered, sunk into the rock, with bark ridges; the fall has several strands; `THIN` holds the triangle cuts.
- `assets-src/base-spring/thin.mjs` (new, mine): `thin(mesh, {share, error})` edge-collapse thinning and `lighter(file, levels)` for the medium and low lists. Summer's base build imports it too.
- `assets-src/base-spring/RECIPE.md`, `assets-src/slab-spring/RECIPE.md`, `assets-src/base-summer/RECIPE.md`: recipes; no new generated picture in my time.
- `assets-src/slab-spring/build.mjs`: the petal sheets of the slab (smaller, more varied petals).
- `assets-src/base-summer/build.mjs`, `maps.mjs`, `mesh.mjs`, `profile.mjs`: summer's base (stone, shells, sea glass, ledge sand) and its four maps; `THIN` in `build.mjs`.
- `src/seasons/spring/base.ts`: materials of rock, growth (moss, roots, mushrooms) and water.
- `src/seasons/spring/slab.ts`: the petals on the slab: soft window when out of focus (no rectangles), a contact shadow under each, sizes and tints varied.
- `src/seasons/summer/base.ts`: materials of stone, shells, sea glass and sand (`sandMaterial` is also used by the slab).
- `src/seasons/summer/slab.ts`: the sand on the table (`HEAP`, `SLAB`, `sandHeight`, `heapGeometry`).
- Not mine any more: both `arrival.ts` files (`change_builder`).

## Make targets, in this order

1. `npm run make -- base-spring` (about 73 s)
2. `npm run make -- slab-spring` (about 3 s)
3. `npm run make -- base-summer` (about 26 s)
4. `npm run texpack`, then `npm run build`

There is no `slab-summer` folder: summer's sand on the table is made in code. `main` tracks built files under `assets-full/` and `public/assets/`: before every merge of main run `git checkout -- assets-full public/assets`, merge, then the four steps above. Never commit anything under those two folders; commit by naming paths.

## What is still wrong, worst first

Summer (pictures `02-summer-base-pair.jpg`, `04-summer-hero.jpg`)

1. The base is a plain drum with shallow bed creases that read as seams or folded cloth; the approved base has a deep wind-carved collar, a bulging belly and a pale sunlit upper band. This is the "clay, sculpted look" of R2 and R3-1 #9. It is the profile and carve map (`profile.mjs`, `maps.mjs`), not the shader; I only retuned grain and light.
2. The dune on the right is even and matt. Since `change_builder`'s d09daec (in main from 05:10) no loose grains are drawn at rest, so the sparkle that the stills up to `su-w` showed on the dune is gone in the judged build; the dune now rests on `sandMaterial` alone: median 159,134,96 against the approved 217,180,145 on its flank and 114,90,60 against 227,191,155 on its crest (measured on `su-x`, 05:29). Raise `SAND.glint` and the side light in `SAND_AFTER`; not done, no time to see it.
3. The sand's edge on the table is a hard outline (dark rim against the wet table at the front right), R3-1 #10. The solid threshold in `sandMaterial` is lower than I computed: two tries at a thicker left sheet (`HEAP.sheet.mm` 0.22, a plateau of 0.225) turned it into a hard-edged island and were reverted.
4. Too little sand left of the base: the approved has a broad thin band of fine grains there; the build has a thin field (`HEAP.sheet` mm 0.19).
5. Right flank of the base still under the approved after the rig moved (142 to 148 against 161 to 182 in red, grid column 7); lower right 107 against 160. Left limb too bright (150 to 164 against 105 to 115, column 0).
6. Shells darker and browner than approved on the right and centre (scallop 70,61,51 against 82,78,79; cowrie 75,63,54 against 89,85,76); inlays smaller than the approved's; sea glass is cloudy and pitted now but not see-through with coloured light behind it.
7. Glass seat (R3-2 #3, #5): only an ambient-occlusion band; there is no inset lip in the mesh. The dark wedge on the upper band is a real cast shadow under the lip; I left it.
8. R4 #5 (rigid cast with a notch when the base lifts): the heap now runs on under the foot at an angle of repose (`SLAB.repose`, `under()` in `heapGeometry`). NOT SEEN with the base lifted: `npm run still` has no shake state. It is static geometry: nothing slumps over time.

Spring (pictures `01-spring-base-pair.jpg`, `03-spring-hero.jpg`)

1. Moss levels against the approved (fit `sp-o`, 04:59): middle band too bright (30,30,11 against 12,18,12), crest too dim (30,30,12 against 58,58,37), right flank too dim (71,66,34 against 118,87,56), left of the fall too dark (9,11,6 against 29,27,15). The cushion folds read as cloth.
2. Roots: thicker, tapered and with bark now, six fewer, but they still lie on the rock more than grow out of it; the junction at the right is a tangle.
3. Waterfall: strands with white edges, but still reads as plastic; no spray at the foot.
4. Mushrooms: flat caps without gills.
5. No caustic or seat where the glass meets the moss (R3-2 #5): only a contact darkening in `ROCK_PAINT`.
6. Cyan-white dots on the water (R3-2 #14) are not in my files: in the `ids` view they carry the shared `surface` part's colour (hd pixels 528,512; 1824,616; 1512,792), told to `/root` at 04:30.
7. The green band inside the glass above the collar is the miniature's ground (`spring_mini2`).

## Numbers that worked

- Spring moss (`src/seasons/spring/base.ts`): body `mix(vec3(0.12,0.2,0.08), vec3(0.36,0.56,0.12), …)`, tip `vec3(0.6,0.68,0.2)`, `liveTuft = smoothstep(0.55,0.85,…)`, tip factor `(1.6 + 18.0*liveTuft + 2.0*liveFuzz)`, tip gate `smoothstep(0.02,0.4, liveRimM + 0.6*liveUpM*liveHigh)`, `liveHigh = smoothstep(24,33,y)`, `liveShade` floor 0.17, left kick `2.6*(1+2.5*baseMoss)*liveKick²*baseAo`. Spring's key comes from the front right above, so shade on the front must come from the shader.
- Summer stone (`STONE`): sun 0.6, kick 0.15, flare 1.3, side 1.9 on `pow(stoneWarm, 18)` (the sun's side light on the right flank; at power 4 it flooded the whole front), direct diffuse times 0.6, indirect `0.19*vec3(0.8,0.96,1.14)`. Summer's key is behind and to the right (`[250,230,-400]`), so the front gets no direct key.
- Summer shells: direct diffuse `mix(1, ao, 0.5) * 0.95 * vec3(0.9,0.98,1.1)`, side `baseSunC*0.5*pow(shellWarm,14)`.
- Summer sand: side light `baseSunC*14*sandWarm³` (times 0.35 on the ledge above 24 mm).
- Summer slab: `HEAP` dune {67,2,15,19,12.5}, skirt {71,30,10,20,2.2}, shoulder {47,58,21,14,2.4}, fan {50,98,23,44,1.5}, sheet {-96,-18,36,24,0.19}, stray {56,66,26,52,0.2}, ring {r 61.5, w 4.5, mm 0.55}; `SLAB { liftMm 0.5, footMm 54, repose 0.62, stepMm 1.3 }`.
- Thinning: spring `THIN = { rock {0.74, 0.06}, growth {0.74, 0.06}, medium error 0.18, low 0.3 }`; summer `THIN = { stone {0.68,0.06}, shells {0.72,0.05}, sand {0.66,0.08}, medium 0.09, low 0.22 }`.

## How I measured (do the same; the eye misjudges brightness here)

- `npm run fit -- --season <s> --tier draft --format hd --box <box> --name <n> --wide <w> --force`: spring box `700,900,2400,1584` wide 1180; summer box `300,900,2400,1584` wide 1200. Writes `out/work/fit/<n>-pair.jpg` (approved above, build below) and the still `out/work/stills/<s>-rest-hero-hd-draft-rig.png`.
- Medians of boxes in approved pixels (2816 x 1584, about 9.17 px per mm, axis x 1408). Spring boxes: mossTop 1050,1050,1850,1110; mossMid 1250,1120,1700,1170; stones 1150,1270,1750,1400; mossR 1800,1060,1930,1250; left 900,1100,1010,1300. Summer: an 8 by 6 grid over 880,1040,1960,1420, and scallopR 1640,1215,1720,1290; cowrie 1420,1270,1480,1315; greenG 1205,1215,1265,1270; duneR 1950,1330,2200,1420; duneTop 1930,1280,2050,1330.
- Box medians mislead on hue when petals or highlights lie in the box: check a zoomed crop too.

## Tried and did not help

- Summer: a thicker left sand sheet (twice): hard-edged island. Editing `baseSunC` in the `STAGE_LIGHT_DONE` branch of `KEY`: that branch is not active at draft, no effect. The side light at power 4 on the stone: the whole front went to 165 to 200 against 50 to 66.
- Spring: lifting the moss by raising its indirect light: flat felt; the tips only read when gated by the light from behind.

## What I could not see

- Any shake state (no still state for it): the summer heap under the lifted base, the petals' jump.
- Final tier; every look was draft hd.
- The surface, base, macro and interior cameras after 04:00, except through `npm run measure`.
