# Flakes

The shapes of winter's flakes. The picture of a flake is never stored: the table holds where the lobes of each variant sit and how big they are, and the shader draws them lit.

## assets-full/shared/flake-lobes.lin.png
Made by: `assets-src/flakes/build.mjs` (Node, with `pngjs` 7.0.0 from the repo root install)
From: nothing but the script; its seed is the constant `SEED` at its top
Prompt or command: `npm run make -- flakes` (add `--sheet` to also write a contact sheet of the 64 variants under `out/work/`)
Takes: 1 made, 1 kept
Why this one: 64 variants of 5 lobes in four families (clump, rod, branched, pair), each centred on its weight and scaled to reach 1, so a flake reads as an irregular cluster from every side and never as a disc
Date: 2026-11-24

Layout: 8 columns by 64 rows, RGBA, linear. One row is one variant. Columns 0 to 4 are its lobes: R, G, B hold the lobe's centre from -1 to 1 as 0 to 255, A holds its radius from 0 to 1. Columns 5 to 7 are unused. `src/particles/draw/shader.ts` reads it with `texelFetch`, so it is never filtered and never packed lossy.

## Fitting tools

Two small measures used to fit the look against the approved images. They need Python 3 with Pillow, numpy and scipy, write nothing, and ship nowhere.

- `python3 assets-src/flakes/count.py [approved.png] [still.png] [x0,y0,x1,y1]` counts the flakes at rest in a box of the approved image and in the same box of a still: blobs, cover and diameters at three steps over the background, and the brightest 0.3 percent. Without arguments it compares `references/approved/winter-rest.png` with the fit still at rest.
- `python3 assets-src/flakes/storm.py [approved.png] [still.png]` prints mean colour and spread in three boxes of the storm (upper dome, bank, centre). Without arguments it compares `references/approved/winter-shake.png` with the fit still at `landed`.
- The fit stills come from `npm run fit -- --tier draft --format hd --box 858,99,1964,1205 --name p3-globe --force` (add `--state landed` for the storm).

