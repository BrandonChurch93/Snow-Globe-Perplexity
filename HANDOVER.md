# HANDOVER: bases3 (spring and summer bases and slabs)

Branch `agent/p4-bases3`, looks on `agent/p4-bases3-looks`. Files: `assets-src/base-spring/**`, `assets-src/slab-spring/**`, `src/seasons/spring/{base,slab}.ts`, `assets-src/base-summer/**`, `assets-src/slab-summer/**`, `src/seasons/summer/{base,slab}.ts`.

## Build order
1. `git checkout -- assets-full public/assets` before merging `origin/main`.
2. `npm run make -- base-spring` (about 73 s), `npm run make -- slab-spring` (3 s), `npm run make -- base-summer` (26 s).
3. `npm run texpack`, then `npm run build`.
4. `node out/work/bin/tris.mjs <season>` (the script is not in the repo: copy `tris.mjs` from the task attachments to `out/work/bin/`).

## Where things are
### Summer
- `assets-src/base-summer/profile.mjs`: `RISE` (3.2 mm, how far the collar and ledge stand above bases2's), `BODY` (radius, height; the foot is tucked: 53.2 mm at the table, widest 60.3 mm at 11 mm), `strataCoord` and `relief` (beds, grooves, pits, sockets under each set piece: `deep`).
- `assets-src/base-summer/mesh.mjs`: `surf()` (patch builder; rows that are one point take the patch's own side normal: this was the centre dot on the glass and pebbles), `scallop` (ears when `opt.ears`), `seaGlass`, `buildStone` (the bottom disc ends 0.25 mm inside the foot), `SPILL` and the ledge sand.
- `assets-src/base-summer/build.mjs`: `THIN` (how much of each list stays; the errors of the medium and low lists, 0.1 and 0.25 mm, set to hold the counts).
- `src/seasons/summer/base.ts`: `STONE` constants and `STONE_AFTER` (all of the stone's light; heights in mm, so they move with `RISE`), `SHELL_*`, `GLASS_*`, `SAND` and `SAND_PAINT`/`SAND_AFTER` (grains by alpha cut-out; `sandDim` dims thin far specks; the last line shades the slab's sand under the foot's overhang by the vertex colour's green).
- `src/seasons/summer/slab.ts`: `HEAP` (every heap by position and size; `streak` is the sheet on the left), `SLAB.stepMm` (1.65: sets the slab's triangle count, about 24,950), `SLAB.footMm` (52.4, where the sand under the foot starts to slump), vertex colour green = shade near the foot.
### Spring
- `assets-src/base-spring/layout.mjs`: `PROFILE` (rim at 42.6 mm, radius 48.6), `ROOTS`, `DRIPS`, `PATCHES`, `TRICKLE`.
- `assets-src/base-spring/build.mjs`: moss thickness, root tubes (sides, gnarl, lift), row steps.
- `src/seasons/spring/base.ts`: `ROCK`, the warm graze, `liveCrown` (light on the collar top), the water shader (`waterBody`, `head`, `foam`, `rimline`), `FLOW` (start 0.12 s, run 2.1 s) and `flowFront`.
- `src/seasons/spring/slab.ts`: petals (`clumpMm`, shape ranges), `JUMP`, `POOL`.

## Traps
- A GLSL error does not stop the build: the material goes wrong silently. Look at a still after every shader edit.
- The decimated lists (medium, low) grow when the relief gets rougher: read the `quality levels` line of each make and compare all three levels, not only the total.
- The slab's triangle count grows with the area any heap or apron covers (`node out/work/bin/sandcount.mjs`, a copy of the height function; not in the repo).
- `npm run still -- --help` renders a winter still; it is not a help text.
- The base turns and lifts with the globe (`stage.ts`), so collar clearance is the same in every frame.
