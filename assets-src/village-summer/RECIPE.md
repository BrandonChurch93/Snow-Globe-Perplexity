# Summer cover of the village: recipes

What summer lays over the shared cottage, fence, lamp post, path and pond: turf and sand, the pond's water, blades of grass, climbing roses, sunflowers and small blooms. The shared shapes come from `assets-src/village` and `src/scene/layout.ts`, read only.

## assets-full/summer/village-turf.lin.tile.png
Made by: `assets-src/village-summer/build.mjs` (sharp, in Node)
From: nothing but the seeded stream of `assets-src/village/kit.mjs`
Prompt or command: `npm run make -- village-summer`. Three channels of tiling noise: fine grain, clumps, and wide patches. Used as height for the bump of the turf and the ripple of the water, and to break up their colour.
Takes: rebuilt each time the script changed, the last build kept
Why this one: grain that holds from the macro camera without a repeat showing
Date: 2026-11-25

## assets-full/summer/village-summer.glb
Made by: `assets-src/village-summer/build.mjs` (three in Node, `assets-src/village/kit.mjs`, `assets-src/village/layout.mjs`, `tools/lib/glb.mjs`)
From: the layout of the island in `src/scene/layout.ts` and the roof and shrubs of `src/miniature/roof.ts`, read only
Prompt or command: `npm run make -- village-summer`. Mesh `ground`: the island swept around the pond, grass, earth, mud and sand as vertex colour, with a sand skirt down to the collar. Mesh `water`: the pond's disc. Mesh `grass`: tufts of three blades, thinned on the path, the pond and the hard shapes. Tufts that neither the hero lens nor the macro lens sees are left out and the lawn behind the house is thinned by about a fifth, to hold the count of triangles. Mesh `decor`: roses on the shrubs, climbing leaves and roses around the door and the front wall, ivy and roses on the side wall, sunflowers behind the fence and right of the tree, small blooms in the grass; the sunflowers' feet and heights are also written as extras for the distance field. Third pass of 2026-11-26: four flat pale stones stand in the shallow water at the pond's left end, from a run of numbers of their own (`STEP`); the grass before the fence is cropped to four tenths of its height so that the lower rail is seen; the lawn's tufts are dyed darker and less green (`GRASS.dye`); behind the cottage one tuft in four is left out (`HIDE.farKeep`), which pays for the stones.
Takes: rebuilt each time the script changed, the last build kept
Why this one: everything the season adds is one model beside the shared one, so the shared shapes stay read only
Date: 2026-11-25
