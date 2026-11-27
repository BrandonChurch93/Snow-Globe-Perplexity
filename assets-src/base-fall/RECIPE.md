# Recipes: base-fall

Fall's base: the iron ring of thorns, the pumpkins and their carved faces, the wax and the cobweb. Everything that ships is made by `npm run make -- base-fall` from the scripts in this folder, in about 18 seconds. No picture was generated or fetched: 0 takes of 6 for every file. No pixel of an approved image is in any file; `layout.mjs` holds numbers read from `references/approved/fall-rest.png` by eye (pixel positions of the three faces in view, of the wax runs and of the thorns a viewer can count) and turns them into places on the ring through the reference camera of `assets-src/refrig/fall.json`.

## assets-full/fall/base-fall.glb
Made by: assets-src/base-fall/mesh.mjs (buildIron, buildPumpkins, buildWax, buildWeb) through assets-src/base-fall/build.mjs, Node 20.20.2
From: assets-src/base-fall/layout.mjs (the drum's profile, the seven faces, the wax runs, the hero thorns), assets-src/base-fall/lib.mjs, config/showcase.json (globe)
Prompt or command: npm run make -- base-fall
Takes: 1
Why this one: four meshes: `iron` (the lathed drum with winter's collar and cup, three vines heaped at the foot that swing 3 to 4 mm four to six times round the ring and so cross one another, two under the glass that do the same, 37 open vines that taper at both ends and cross one another (one in three short and steep, the rest on slants of 7 to 24 degrees, 2 to 4 mm thick; half of those that would cross the right flank go round the back, so the lit leather shows there) 9 wires and 18 thin steep twigs in the tangle at the left, all as tubes that pass round or behind every face, the thorns on them and the counted ones; a thorn that would cross a face on the ring or in the hero camera's view is refused), `pumpkin` (a ribbed gourd behind each face, face coordinates in the second set, paint = shade, face number, carving number), `wax` (a ring at the glass that stands proud only where a run leaves it, as that run's flared shoulder, the runs measured from the approved image at 0.72 of their measured width, each alone, each lying on the vines under it and ending in a bulb, and three runs at the foot at their measured width that start as a blob on the outermost vine above them, lie over the vines below and end in a pooled blob on the slab), `web` (three sheets strung from the thorns at the right; the big one lands close to the foot and sags 7.5 mm; its threads, their weights, breaks and dew are drawn by `src/seasons/fall/base.ts`). The faces and their sizes go in the pumpkin mesh's extras.
Date: 2026-11-25

## assets-full/fall/base-iron-detail.lin.tile.w1024.png
Made by: assets-src/base-fall/maps.mjs (ironDetail) through assets-src/base-fall/build.mjs, Node 20.20.2, sharp 0.35.5
From: nothing but the script
Prompt or command: npm run make -- base-fall
Takes: 1
Why this one: hammered iron as a tiling field of shallow dents: the slope in red and green, the roughness in blue
Date: 2026-11-25

## assets-full/fall/base-faces.lin.w1024.png
Made by: assets-src/base-fall/maps.mjs (faces) through assets-src/base-fall/build.mjs, Node 20.20.2, sharp 0.35.5
From: nothing but the script: four carvings of our own design (two triangle eyes, a triangle nose, a grin with teeth), each a list of polygons
Prompt or command: npm run make -- base-fall
Takes: 1
Why this one: a signed distance to the edge of the openings (0.5 at the edge) in a sheet of two by two, so the cut stays sharp at any size and the shader can read the rind's thickness from a second sample
Date: 2026-11-25
