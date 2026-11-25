# Summer crown of the tree and its lanterns: recipes

What summer hangs on the shared trunk: a full crown of leaf clusters grown over the pads of `src/miniature/trunk.ts`, and the paper lanterns with their string, cords, caps and peg. The places and sizes of the lanterns come from `src/seasons/summer/mini/lanterns.ts`, the shape of the crown from `src/seasons/summer/mini/crown.ts`.

## assets-src/tree-summer/gen/leaves-take1.png
Made by: the image tool of this product (`generate_image`), aspect 1:1, 1254 px
From: a crop of `references/approved/summer-rest.png`, left 1340, top 360, 460 by 340 px (the crown), passed as the reference picture; the crop itself is not committed and no pixel of it is in the app
Prompt or command: see `assets-src/tree-summer/gen/leaves-take1.prompt.txt`
Takes: 1 made, take 1 kept
Why this one: small rounded clumps at one even scale in the deep green of the approved crown, with no lantern, light or shadow painted in
Date: 2026-11-25

## assets-full/summer/tree-leaves.srgb.tile.w1024.png, assets-full/summer/tree-sprigs.srgb.w512.png
Made by: `assets-src/tree-summer/build.mjs` (sharp, in Node)
From: `assets-src/tree-summer/gen/leaves-take1.png`
Prompt or command: `npm run make -- tree-summer`. The leaf tile is the sheet with its edges cross-faded and its wide brightness flattened. The sprig sheet is four cut-outs of the same sheet, two by two, each with a lobed outline and holes where the foliage is dark, for the small cards that break up the outline of every cluster.
Takes: 1 picture in, rebuilt each time the script changed, the last build kept
Why this one: the cards and the bodies they stand on share one picture, so they read as one material
Date: 2026-11-25

## assets-full/summer/tree-summer.glb
Made by: `assets-src/tree-summer/build.mjs` (three in Node, marching cubes tables from `three/examples/jsm/objects/MarchingCubes.js`, `tools/lib/glb.mjs`)
From: `src/seasons/summer/mini/crown.ts` (the field of the crown), `src/seasons/summer/mini/lanterns.ts` (the lanterns and the string), `src/miniature/trunk.ts` (pads and limbs, read only)
Prompt or command: `npm run make -- tree-summer`. Mesh `leaves`: the field of the crown walked with marching cubes at 0.65 mm, with sprig cards standing on it; vertex colour is the shade of the cluster (deep inside and below, yellow green at open tips). Mesh `lanterns`: ribbed paper bodies, dark caps, loops, cords, the string between the roof and the trunk and the peg of the large lantern; colour alpha is the share that glows, `tangent` holds the point each piece swings about and its phase, `uv` the order in which it comes up and whether it is paper.
Takes: rebuilt each time the script changed, the last build kept
Why this one: one field gives both the picture and the distance field the seeds snag on
Date: 2026-11-25
