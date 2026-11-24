# Recipes: the winter frost

Everything here is grown by one script from numbers measured on the approved winter image. No picture was generated and no pixel of an approved image is used: the script reads `layout.json`, not the image. The same seed gives the same files, byte for byte.

## assets-full/winter/frost-glass.lin.w1536.png
Made by: `assets-src/frost-winter/build.mjs` (Node 20.20.2, sharp 0.35.5)
From: `assets-src/frost-winter/layout.json` (the `glass` block: the band's reach, density and film by rim angle, 20 plumes and 3 stars placed by pixel of `references/approved/winter-rest.png`, the seeded feathers, fans and needles), `config/showcase.json` (globe size, the hero camera), `tools/lib/refcam.mjs` (turns a pixel of the approved image into a point on the glass)
Prompt or command: `npm run make -- frost-winter` (or `npm run make -- frost-winter --only glass`), then `npm run texpack`
Takes: none generated. The script was run again after each change of `layout.json` or of the growth rules; the committed file is the last run
Why this one: a polar map of the rim band of the sphere, 4096 px, linear. R is the height, G is when a texel appears as the frost grows in from the rim (0 first, 0.96 last, 1 never), B is how much it sparkles. Feathers are laid out as the hero camera sees them and stretched along the glass by at most `glass.maxStretch`, so the picture matches from the front and holds from 35 degrees to either side
Date: 2026-11-24

## assets-full/winter/frost-slab.lin.w1536.png
Made by: `assets-src/frost-winter/build.mjs` (Node 20.20.2, sharp 0.35.5)
From: `assets-src/frost-winter/layout.json` (the `slab` block: 9 arms by the angle and distance of their tips as measured on the approved image, the fill arms, the far patches, the grain and clump counts), `config/showcase.json` (the base diameter)
Prompt or command: `npm run make -- frost-winter` (or `--only slab`), then `npm run texpack`
Takes: none generated; the committed file is the last run
Why this one: a flat map of the slab round the foot, 4096 px over 264 mm, linear, with the same three channels. G runs outward from the foot, branch by branch, so the arrival's ring is uneven
Date: 2026-11-24

## assets-full/winter/frost-grain.lin.tile.png
Made by: `assets-src/frost-winter/build.mjs` (Node 20.20.2, sharp 0.35.5)
From: `assets-src/frost-winter/layout.json` (the `grain` block: size, cell counts, slope gain, tile size in millimetres)
Prompt or command: `npm run make -- frost-winter` (or `--only grain`), then `npm run texpack`
Takes: none generated; the committed file is the last run
Why this one: a tiling crystal grain, 512 px over 12 mm, two sizes of packed cells. R is the relief, G and B are its slope, so the frost body is broken and catches the light at the scale of single crystals
Date: 2026-11-24

## assets-full/winter/frost-shapes.glb
Made by: `assets-src/frost-winter/build.mjs` (Node 20.20.2, three as installed at the repo root, `tools/lib/glb.mjs`)
From: the same run that draws the slab map (the kept arm lines and grains), `assets-src/frost-winter/layout.json` (`slab.shapes`, `glass.meshFromPolarDeg`, `glass.meshRings`, `glass.meshSegments`)
Prompt or command: `npm run make -- frost-winter`, then `npm run texpack`
Takes: none generated; the committed file is the last run
Why this one: three meshes in one file. `glass` is the band of the sphere the frost is drawn on, `glass.liftMm` off the shell. `sheet` is a flat ring round the foot. `shapes` are the real small things near the camera: ridges along the arms and their branches, and faceted lumps for the larger grains and clumps, each vertex carrying when it appears
Date: 2026-11-24
