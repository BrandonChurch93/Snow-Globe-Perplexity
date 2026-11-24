# Scene

The two tiles of the slab. Neither holds a picture of the slab: they hold heights turned into slopes, where the dust lies, where the stone is veined and clouded and where it has been wiped. `src/scene/surface.ts` lights them every frame with the room, the rig and the mirror image. The backdrop, the room and the lens have no files; they are drawn from numbers in `src/scene/` and `src/post/`.

## assets-full/shared/scene-slab-detail.lin.tile.png
Made by: `assets-src/scene/build.mjs` (Node 20, with `sharp` 0.35.5 from the repo root install)
From: nothing but the script and `config/showcase.json` (its `seed`, crossed with the constant `0x51ab` in `detail()`)
Prompt or command: `npm run make -- scene`
Takes: 0 generated pictures. The script was run 3 times while its numbers were set; the last run is kept
Why this one: polish haze, a slow swell, 330 fine scratches that share one wiping direction and curl, and sparse crumbs of dust with real height, so the mirror image wavers a little and the dust catches the key on one side
Date: 2026-11-24

Layout: 2048 by 2048, RGB, linear, tiles in both directions, one tile is 163 mm (`SLAB.fineMm`). R and G hold the slope across and along the tile, coded as `128 + 127 * sign(s) * sqrt(|s| / slopeFull)` so small slopes keep their precision; B holds how much dust lies there, 0 to 1. The same tile is read a second time, turned by `SLAB.crumbTurnDeg` and at `SLAB.crumbMm`, so no repeat lines up.

## assets-full/shared/scene-slab-stone.lin.tile.png
Made by: `assets-src/scene/build.mjs` (Node 20, with `sharp` 0.35.5 from the repo root install)
From: nothing but the script and `config/showcase.json` (its `seed`, crossed with the constant `0x77e1` in `stone()`)
Prompt or command: `npm run make -- scene`
Takes: 0 generated pictures. The script was run 3 times while its numbers were set; the last run is kept
Why this one: warped ridges give a few long veins and many thin ones, never parallel; the cloud channel breaks the black into deeper and paler stone; the marks channel lays broad wiped smears in one direction, patchy, as a cloth leaves them
Date: 2026-11-24

Layout: 1024 by 1024, RGB, linear, tiles in both directions, one tile is 613 mm (`SLAB.broadMm`), turned by `SLAB.broadTurnDeg`. R is the veins, G the cloud, B the wiped film.

## After a change

1. Change the numbers at the top of `assets-src/scene/build.mjs` (`DETAIL`, `STONE`) or inside `detail()` and `stone()`.
2. `npm run make -- scene`
3. `npm run texpack`
4. `npm run build`
5. `npm run still -- --season winter --state rest --camera surface --tier draft --format hd` and look at the slab at full size.
