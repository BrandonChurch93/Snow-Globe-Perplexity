# Recipes: the tree in blossom

Made by code alone on the shared trunk (`assets-src/trunk/`, `src/miniature/trunk.ts`). Nothing is a generated picture and no pixel of an approved image is used.

Order: `npm run make -- trunk` (shared), then `npm run make -- tree-spring`, then `npm run texpack && npm run build`.

## assets-full/spring/tree-blossom.glb
Made by: `assets-src/tree-spring/build.mjs` (Node 20, three.js from the repo's `node_modules`), which loads `src/miniature/trunk.ts` and `src/core/rng.ts` through `assets-src/trunk/source.mjs`; seeded stream `tree-spring`, no random source outside it
From: the shared trunk's limbs and twigs; the constants `CROWN`, `LOBES`, `BOUGH`, `TWIG`, `CLUSTER`, `TONES`, `LOBE_LOOK`, `SHADE`, `HEART`, `WOOD` at the top of `build.mjs`; `assets-src/village-spring/levels.mjs` writes the lighter index lists for `medium` and `low`
Prompt or command: `npm run make -- tree-spring`
Takes: no generated picture
Why this one: the crown is grown, not painted. 44 rounded tufts (`LOBES`) are placed apart in a dome around the shared limbs, each carried by its own bough of wood (`BOUGH`) that leaves the nearest limb and runs under it, and the target points are scattered inside the tufts no closer than `LOBES.gap`, so blossom gathers in small masses with sky and wood between them; each target gets a curved spray of dark wood from the nearest limb point, and later sprays may branch from earlier ones. Clusters start 42% of the way along a spray so the fine twig shows before the blossom. Along every spray sit small clusters: a dim rose heart with five to seven five petal flowers standing off it (3,155 flowers in 565 clusters on 138 sprays), each flower its own fan of triangles with a darker eye, tinted by how deep it sits in the crown and how much blossom lies outside it, so the crown has layers, gaps and shade; normals are rounded bough by bough and the underside of each bough is shaded (`LOBE_LOOK`). The record `out/work/tree/build-spring.json` and the make's last line give the counts, the crown's box and its farthest reach from the globe's centre (35.9 mm of 57). Meshes: `blossom` (with the coarse balls of the distance field in its extras) and `twigs`. All of it is above the fork, so it is placed by the same offset as the shared crown
Date: 2026-11-25
