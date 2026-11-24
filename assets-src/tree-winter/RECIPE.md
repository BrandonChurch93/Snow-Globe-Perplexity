# Winter crown of the tree: recipes

What winter hangs on the shared trunk: needle clusters, the snow lying on them, a string of small lights, the star, and the fresh snow that grows on the limbs after a landing. The places and sizes of the pads and their clusters come from `src/miniature/trunk.ts`.

## assets-src/tree-winter/needles-take1.png
Made by: Nano Banana Pro through the image tool of this product (model id `nano_banana_pro`), 2048 px, aspect 1:1
From: a crop of `references/approved/winter-rest.png`, left 1340, top 360, 440 by 340 px (the crown), passed as the reference picture
Prompt or command: A flat material sheet, seamless and tileable, of the green foliage of the miniature tree in the reference picture, with the snow and the lights taken away: dense dark green conifer foliage made of many tiny needle tufts and small clumps packed together, like fine clump foliage on a hand-made scale model, deep green with some olive and yellow-green tips. Photographed straight on like a texture scan, evenly lit with soft diffuse light from the front, no cast shadows, no glow, no snow, no lights, no branches, no trunk, no background, no vignette. The foliage fills the whole square frame edge to edge at one even scale. Keep the green of the foliage in the reference. No text, no logo, no people, no hands.
Takes: 1 made, take 1 kept
Why this one: tufts at one even scale in the green of the approved crown, with no snow, light or shadow painted in
Date: 2026-11-24

## assets-full/winter/tree-needles.srgb.tile.w1024.png, assets-full/winter/tree-sprigs.srgb.w512.png
Made by: `assets-src/tree-winter/build.mjs` with `assets-src/trunk/source.mjs` (sharp, in Node)
From: `assets-src/tree-winter/needles-take1.png`
Prompt or command: `npm run make -- tree-winter`. The needle tile is the sheet with its edges cross-faded and its wide brightness flattened. The sprig sheet is four cut-outs of the same sheet, two by two, each with a lobed outline and holes where the foliage is dark, for the small cards that break up the outline of every cluster.
Takes: 1 picture in, rebuilt each time the script changed, the last build kept
Why this one: the cards and the bodies they stand on share one picture, so they read as one material
Date: 2026-11-24

## assets-full/winter/tree-snow.srgb.tile.w1024.png
Made by: `assets-src/tree-winter/build.mjs`
From: nothing but the seeded stream `tree-winter` of `src/core/rng.ts`
Prompt or command: `npm run make -- tree-winter`. Three scales of blurred noise for grain, clumps and drifts, with a few bright crystals. It is used as colour and, through its green channel, as height for the bump.
Takes: rebuilt each time the script changed, the last build kept
Why this one: fine grain that holds from the macro camera without a repeat showing at 7 mm a tile
Date: 2026-11-24

## assets-full/winter/tree-crown.glb
Made by: `assets-src/tree-winter/build.mjs` (three 0.187 in Node, marching cubes tables from `three/examples/jsm/objects/MarchingCubes.js`, `tools/lib/glb.mjs`)
From: `src/miniature/trunk.ts` (`clusters`, `crownField`, `crownCap`, `limbs`, `localPads`), the seeded stream `tree-winter`
Prompt or command: `npm run make -- tree-winter`. Four meshes. `needles`: the surface of the cluster field, with the triangles under the snow dropped, cavity, sky and underside shade in the vertex colours, and two crossed sprig cards on about one vertex in four. `snow`: the surface of the cap field, which is the cluster field lifted along each pad's up direction, swollen into lumps and cut off below a lobed line; its vertex colours hold the shade with a blue cast on faces turned from the key, and its second uv holds how far the snow stands off the needles, which the page uses to break the thin rim into grains. `lights`: bulbs on a wire that winds up the trunk, along the limbs and round each pad, and the bevelled five-point star on its stem and collar; the bulb places ride in the node's extras, and the page draws a soft halo at each bulb and a glow round the star from them, so the file holds no shells. `arrival`: thin strips of fresh snow on the tops of the limbs and of the outer half of each root, that rise from inside the bark as the page's `uArrive` goes from 0 to 1. Six pads carry 340 clusters and 1362 sprig tufts; the string has 70 bulbs of 0.155 mm radius and the star is 4.4 mm across at 45.2 mm above the foot. The stream `tree-winter` is one stream for the needles, the string and the maps, so a change to the shape of the trunk or the pads changes the bulb and tuft counts and the two maps made from the stream; the same inputs always give the same files.
Takes: rebuilt at every change of the fields or the script, the last build kept
Why this one: every surface is cut from the same field that `solid()` answers with, so flakes land on what is drawn
Date: 2026-11-24
