# Scene

The two tiles of the slab. Neither holds a picture of the slab: they hold heights turned into slopes, where the dust lies, where the stone is veined and clouded and where it has been wiped. `src/scene/surface.ts` lights them every frame with the room, the rig and the mirror image. The backdrop, the room and the lens have no files; they are drawn from numbers in `src/scene/` and `src/post/`.

## assets-full/shared/scene-slab-detail.lin.tile.png, public/assets/shared/scene-slab-detail.lin.tile*
Made by: `assets-src/scene/build.mjs` (Node 20, with `sharp` 0.35.5 from the repo root install)
From: nothing but the script and `config/showcase.json` (its `seed`, crossed with the constant `0x51ab` in `detail()`)
Prompt or command: `npm run make -- scene`
Takes: 0 generated pictures. The script was run 3 times while its numbers were set; the last run is kept
Why this one: polish haze, a slow swell, 330 fine scratches that share one wiping direction and curl, and sparse crumbs of dust with real height, so the mirror image wavers a little and the dust catches the key on one side
Date: 2026-11-24

Layout: 2048 by 2048, RGB, linear, tiles in both directions, one tile is 163 mm (`SLAB.fineMm`). R and G hold the slope across and along the tile, coded as `128 + 127 * sign(s) * sqrt(|s| / slopeFull)` so small slopes keep their precision; B holds how much dust lies there, 0 to 1. The same tile is read a second time, turned by `SLAB.crumbTurnDeg` and at `SLAB.crumbMm`, so no repeat lines up.

## assets-full/shared/scene-slab-stone.lin.tile.png, public/assets/shared/scene-slab-stone.lin.tile*
Made by: `assets-src/scene/build.mjs` (Node 20, with `sharp` 0.35.5 from the repo root install)
From: nothing but the script and `config/showcase.json` (its `seed`, crossed with the constant `0x77e1` in `stone()`)
Prompt or command: `npm run make -- scene`
Takes: 0 generated pictures. The script was run 3 times while its numbers were set; the last run is kept
Why this one: warped ridges give a few long veins and many thin ones, never parallel; the cloud channel breaks the black into deeper and paler stone; the marks channel lays broad wiped smears in one direction, patchy, as a cloth leaves them
Date: 2026-11-24

Layout: 1024 by 1024, RGB, linear, tiles in both directions, one tile is 613 mm (`SLAB.broadMm`), turned by `SLAB.broadTurnDeg`. R is the veins, G the cloud, B the wiped film.

### After a change

1. Change the numbers at the top of `assets-src/scene/build.mjs` (`DETAIL`, `STONE`) or inside `detail()` and `stone()`.
2. `npm run make -- scene`
3. `npm run texpack`
4. `npm run build`
5. `npm run still -- --season winter --state rest --camera surface --tier draft --format hd` and look at the slab at full size.

### The files under public/assets

`npm run texpack` writes the two tiles into `public/assets/shared/` as near-lossless webp, each with a small `.first.webp` for the first picture. They are never edited by hand and never committed.

### The numbers with no files, for another season

The slab's sheen, the wall and the lights behind the globe are numbers in `src/scene/surface.ts` (`SLAB`), `src/scene/backdrop.ts` (`WALL`, `DISCS`, `PLACED`) and `src/scene/room.ts`. They are fit to the approved picture of the season with the scripts in `assets-src/scene/fit/`. Every script reads the approved picture from `REF` (default `references/approved/winter-rest.png`) and takes boxes in the pixels of that picture, 2816 wide.

1. `REF=references/approved/<season>-rest.png node assets-src/scene/fit/discs.mjs` lists every light in the approved picture: centre, radius, colour. The lights the hero sees go into `PLACED.discs` as `[x, y, radius, tone, shown, soft, edge]`; the tones are the season's `backdrop.colors` in `src/seasons/<season>/backdrop.ts`.
2. `npm run texpack && npm run build`, then `npm run fit -- --tier draft --box 0,0,2816,1584 --name whole --force` draws the hero and prints the mean difference per channel against the approved picture.
3. `node assets-src/scene/fit/fitdiscs.mjs out/work/stills/<season>-rest-hero-hd-draft-rig.png` prints, for every placed light, the brightness in the approved picture and in the render and the `shown` that would close the gap.
4. `node assets-src/scene/fit/grid.mjs <still>` prints the wall in 11 by 6 cells, approved over render; `WALL` and the season's wall tints are moved until the cells agree within a few levels.
5. `node assets-src/scene/fit/med.mjs <still> name=x0,y0,x1,y1 ...` prints medians and percentiles of any box, approved and render; the slab is fit with boxes on the near, middle and far slab on both sides and on the mirror image in front of the foot. One number of `SLAB` is moved at a time.
6. `node assets-src/scene/fit/crop.mjs <still> <name> x0,y0,x1,y1 [width]` writes the approved crop beside the render to `out/work/fit/<name>.jpg` for the look.
7. `node assets-src/scene/fit/sharp.mjs <still> name=x0,y0,x1,y1 ...` prints the width of the steepest edge in a box, to hold the lens of a camera against the approved picture.

