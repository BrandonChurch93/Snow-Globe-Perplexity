# Recipes: slab-fall

The dry leaves of fall's slab. Everything that ships is made by `npm run make -- slab-fall` from the script in this folder, in about a second. No picture was generated or fetched: 0 takes of 6 for every file. No pixel of an approved image is in any file.

## assets-full/fall/slab-leaves.srgb.w1024.png
Made by: assets-src/slab-fall/build.mjs (leafSheet), Node 20.20.2, sharp 0.35.5
From: nothing but the script
Prompt or command: npm run make -- slab-fall
Takes: 1
Why this one: eight dry leaves (maple, oak, beech and birch outlines; orange, rust, brown and amber), each with veins, blotches, a browned rim and a cut-out in the fourth channel, four by two in one sheet
Date: 2026-11-25

## assets-full/fall/slab-fall.glb
Made by: assets-src/slab-fall/build.mjs (leaves), Node 20.20.2
From: assets-src/slab-fall/lib.mjs, config/showcase.json (globe.baseDiameterMm)
Prompt or command: npm run make -- slab-fall
Takes: 1
Why this one: one mesh `leaves`: 150 curled leaves round the foot (folded on the midrib, arched and cupped, 36 vertices each), 170 crumbs at the foot, 330 flatter leaves further off. Each vertex carries its leaf's centre on the slab (paint, red and green, over 1100 mm), its size (blue, over 32 mm), and in the second coordinates a number of its own and how far off it is, which is what slab.ts needs to move a leaf as one piece
Date: 2026-11-25
