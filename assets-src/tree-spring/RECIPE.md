# Recipes: the tree in blossom

Made by code alone on the shared trunk (`assets-src/trunk/`, `src/miniature/trunk.ts`). Nothing is a generated picture and no pixel of an approved image is used.

Order: `npm run make -- trunk` (shared), then `npm run make -- tree-spring`, then `npm run texpack && npm run build`.

## assets-full/spring/tree-blossom.glb
Made by: `assets-src/tree-spring/build.mjs` (Node 20, three.js from the repo's `node_modules`), which loads `src/miniature/trunk.ts` and `src/core/rng.ts` through `assets-src/trunk/source.mjs`; seeded stream `tree-spring`, no random source outside it
From: the shared trunk's limbs and twigs; the constants `CROWN`, `TWIG`, `CLUSTER`, `TONES`, `SHADE`, `HEART`, `WOOD` at the top of `build.mjs`
Prompt or command: `npm run make -- tree-spring`
Takes: no generated picture
Why this one: the crown is grown, not painted. Target points are scattered in a flattened envelope around the shared limbs; each target gets a curved spray of dark wood from the nearest limb point, and later sprays may branch from earlier ones. Along every spray sit small clusters: a dim rose heart with eight to twelve five petal flowers standing off it, each flower its own fan of triangles with a darker eye, tinted by how deep it sits in the crown and how much blossom lies outside it, so the crown has layers, gaps and shade. Meshes: `blossom` (with the coarse balls of the distance field in its extras) and `twigs`. All of it is above the fork, so it is placed by the same offset as the shared crown
Date: 2026-11-25
