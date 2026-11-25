# Summer miniature: handover

Part `miniature-summer`, branch `agent/p4-summer_mini`, looks branch `agent/p4-summer_mini-looks`. Written for someone who has never seen this work. Times are UTC, 2026-11-25.

## What the part is

Summer's cover, growth, props, small lights and distance field on the shared cottage, trunk, lamp, fence, path, pond outline and island. Nothing shared was changed.

- Crown: a field of 138 lumps on the trunk's 10 pads (`crown.ts`), walked with marching cubes at 0.56 mm, with sprig cards on it. Deep green undersides, key-lit yellow-green tops.
- Ten paper lanterns (`lanterns.ts`): a string from the left rake of the front gable to the trunk fork, one at the eave, a large cream one on a peg in front of the trunk, three under the limbs. Ribbed paper, dark caps, loops, cords. They sway a little, kick after a landing and come up one by one from `moment.sinceLanding` (0.04 s apart, 0.18 s each, all lit 0.54 s after the landing).
- Village cover: turf with a sand skirt, 30000 grass tufts, roses on the shrubs and round the door, 5 sunflowers by the fence and right of the tree, small blooms, a still pond that mirrors the sky, the lamp, the trunk, the crown and the cottage.
- Small lights (`innerLights`): lamp, two windows, ten lanterns. They feed the light grid; near light on grass, turf, walls, wood and leaves is baked per vertex from the same list.
- Distance field (`collider`): trunk, crown field, shared solids (cottage, fence, lamp), shrubs, ground, sunflower stems.

## Files (all mine, nothing else touched)

- `src/seasons/summer/miniature.ts`: the exported names (`innerLights`, `prepare`, `miniature`, `lights`, `update`, `collider`, `standIns` empty).
- `src/seasons/summer/mini/palette.ts`: tones.
- `src/seasons/summer/mini/crown.ts`: the crown field (`FULL`), also used by the build script and the collider.
- `src/seasons/summer/mini/lanterns.ts`: places, sizes, tones and order of the lanterns, the string.
- `src/seasons/summer/mini/tree.ts`: leaf, lantern and halo materials, light on wood and leaves, sway and the rise after a landing.
- `src/seasons/summer/mini/village.ts`: turf, sand, grass, decor and water materials, lamp and window lights, halos, the collider of the village.
- `assets-src/tree-summer/{build.mjs,RECIPE.md,gen/leaves-take1.png,gen/leaves-take1.prompt.txt}`.
- `assets-src/village-summer/{build.mjs,RECIPE.md}`.

## Make targets, in order

1. `npm run make -- tree-summer` (about 11 s)
2. `npm run make -- village-summer` (about 2 s)

Shared `village` and `trunk` first if their files are missing. Then `npm run texpack`, then `npm run build`. `main` now tracks built files under `assets-full/` and `public/assets/`: before a merge run `git checkout -- assets-full public/assets`, merge, then make the two folders again. Never commit those two trees.

## Constants a successor should know

`tree.ts`
- `LEAF = { rim 6, rimTight 2.5, through 1.5, tight 3.0, fill 1.2, wrap 0.8, bump 1.0, clumpDark 0.16, clumpBright 3.4, top 23 }`. `top` is the key on upward faces of bright leaves, tinted `vec3(1.35, 1.0, 0.4)`; it is what gives the lit tops. Raise or lower it first when the rig's key changes.
- The key terms of the leaves must be added with `afterLight(...)` from `src/core/chunks/light`. Until 02:07 they were put right after `#include <lights_fragment_end>`, which runs before the stage sets `stageKeyC`, so they read a zero key and the crown took no key light at all.
- `BARK [0.4, 0.19, 0.1]`, `BARK_BUMP 3.4` (normal scale set on the material `buildTrunk` returns).
- `GLOW leaves {2.2, 2.3} wood {0.38, 2.2}`, `LAMP_ON_WOOD 0.5`, `LAMP_ON_LEAVES 3`, `FILL_ON_WOOD 0.22`, `FILL_ON_LEAVES 0.5`.
- `PAPER { power 0.26, reachMm 2.5 }`: a lantern's inner light is power x radius squared, reach x radius. The particles are lit by `innerLights` too, so more power or reach makes a fog ball of lit seeds around each lantern.
- `LANTERN = { rib 0.55, ribs 26, gain 0.68, body 0.8, core 1.35, tight 6.0, paper 0.06, dim 0.1, stepS 0.04, rampS 0.18, swayRad 0.045, sway2 0.6, kickRad 0.16, kickFade 1.2, kickHz 1.3, cycles 2 }`. Ribs are drawn in the shader from the latitude of the normal. `HALO { radius 2.6, strength 0.075, hot 0 }`.

`village.ts`
- `LAMP { power 3, reach 12 }` (as winter), `WINDOW { 0.9, 8 }`, `SIDE { 0.8, 7 }`.
- `NEAR lamp {1.8, 7} pane {0.9, 3} paper {0.5, 2.2}`, `NEAR_WALL lamp {1.3, 8} pane {1.2, 4.5} paper {1.5, 2.9}`, `WALL_FILL 2.0`.
- `GRASS_LOOK { fill 0.23, wrap 1.0, through 0.48, near 2.1 }`, `TURF_LOOK fill 0.45`, `SAND { body 5, floor 0.8, wrap 1.5, foot 0.85, bump 0.3, grainLow 0.55, grain 1.8 }`.
- `WATER { spark 1.4, mass 0.88, crownMm 11, crownTall 38, houseMm 8.5, houseTall 17, sky 0.62, trunk 0.55, ... }`: the reflections are cylinders tested in the shader (`villagePost`), not a mirror pass.

`crown.ts`: `FULL = { swell -0.9, perMm2 0.5, radius [0.8, 2.1], dome 0.75, reach 1.22, blend 0.16, knob 0.3, knobMm 1.15, wave 0.45, waveMm 4.3 }`.

`tree-summer/build.mjs`: `LEAF_CELL 0.56`, `TONE deep [0.3,0.54,0.26] mid [0.66,0.95,0.4] tip [2.3,2.3,0.55]`, `SUN [0.5,0.32,-0.8]`, `PAPER orange [1,0.27,0.06] peach [1,0.37,0.11] cream [1,0.55,0.19]`.

`village-summer/build.mjs`: 30000 tufts; snapping `SNAP { position 128, normal 32, color 128, uv 2048 }`, `GRASS_SNAP { position 64, normal 16, uv 512 }`, `TONE_BITS 6`. Do not flatten the grass uv per tuft: M2 then reads 0 texels and fails.

The rig is `summer_air`'s and moved three times tonight. Every key-driven term here (leaf `top`, `rim`, `fill`; grass `fill`, `through`; `SAND.body`; `WALL_FILL`) scales with the key, so look at a rest hero still after any rig change.

## Size and triangles

- Web files of the miniature after texpack: 8.91 MiB of the 9.5 MiB allowance (village-summer.glb 5.54, tree-summer.glb 1.41, leaf tile 1.15 + 0.32, sprigs 0.35, turf 0.14).
- Triangles: leaves 53920, lanterns 20384, ground 71400, water 2160, grass 90000, decor 22683; 260547 together. None added since `/root`'s 00:57 mail (5192 were taken out of the leaves). `/root` had not sent summer's G15 numbers when this was written.

## Measures and tests

- `npx tsc --noEmit`: clean. `npx vitest run`: 432 tests passed, 4 skipped (02:31, on `2347819`).
- `npm run determinism` on `2347819`: `determinism: pass`, 3 pictures, 4 page loads, 332 s (02:42).
- `npm run measure -- --unit summer --only M2,M3,M6 --tier draft` on `2347819` (02:36): 13 of 19 lines, 12 pass, 1 red. M2 passes on all six stills (0 soft pixels). M6 passes on all six (rest 0; shake 6 of 102000 inside a solid, 0.000059 against 0.002). M3 `summer-rest` fails: miniature 0.703 against 0.75 over 122007 pixels (base 3.101). The same measure gave 0.642 at 01:48 and 0.627 at 02:28; the rise to 0.703 is partly the clearer air `main` now holds.

## What is still wrong, worst first

1. The miniature is flatter than the approved image: M3 on `summer-rest` is under 0.75 (number above). Picture: `01-rest-hero-pair.jpg`. What moved it: key light on the crown (the biggest step), sand grain, lantern ribs. What would move it more: tile rows on the roof (shared material, lit only by a fill here), bark that reads at hero size, stones and flowers by the pond, darker shade under the crown.
2. Grass brighter and yellower than the approved darker green (`01`, `02`). `GRASS_LOOK.fill` and `through` were lowered twice as the key rose; the grass tones in `village-summer/build.mjs` could go darker instead.
3. No stones by the pond and along the path, which the approved image has (`01`). Not built: `/root` asked for no new triangles; about 800 would do it, and the grass tufts must be thinned where a stone lies.
4. Trunk bark faint at hero size (`02`). The trunk and its bark maps are shared; here only the tint and the normal scale are set.
5. Lanterns on the string paler than the approved saturated orange at rest (`02`), and smaller and less bright than the cream-yellow ones of the approved shake image (`04`).
6. Roof flat dark (`01`); the approved one shows slate rows under a rim light.
7. Pond paler and flatter than the approved dark water with a bright middle (`01`).
8. The landing in motion was seen once only, on a sheet at 01:25 with the older slow rise; the ripple is seen in the landed still (`04`), not on a motion sheet.

## Tried and dropped

- A slow rise of the lanterns over 2.5 s: at the landed still (0.5 s) only one was lit, unlike the approved shake image. Now a ripple of 0.54 s.
- Big smooth crown pads: read as green pillows. Now the pads are shrunk (`swell -0.9`) and the lumps carry the shape.
- Stronger lantern cores (gain 0.8, core 1.6, whiter hot mix): the paper clipped to cream.
- Brighter bark tint with weak relief: the trunk went tan and flat. Darker tint, normal scale 3.4 and less baked glow on the wood is what is in now.
- Flattening grass uv per tuft for size: broke M2. Snapping per vertex kept the size.
- Working looks before 01:53 were rendered with the particle kinds hidden by one local line in `src/particles/draw/points.ts`, because `main`'s seeds then covered the part. That line was never committed; every picture on this branch now is the real build unless its caption says otherwise.

## Generated pictures and `ASSETS.md` rows

One generated picture, one take of the six allowed. Rows for `ASSETS.md` (the file is `/root`'s):

| `assets-src/tree-summer/gen/leaves-take1.png` | The foliage sheet of summer's tree (leaf tile and sprig cut-outs) | The image tool of this product; the model name was not recorded | `references/approved/summer-rest.png`, x 1340, y 360, 460 by 340 px, as reference only | 1 made, take 1 kept | `assets-src/tree-summer/RECIPE.md` | 2026-11-25 |

Everything else is made by the two build scripts from seeded noise and the shared layout; see the two `RECIPE.md` files.

## Looks

Looks used: 37 of 40 for this part (stills, fits and sheets rendered and looked at; measure sheets not counted).
