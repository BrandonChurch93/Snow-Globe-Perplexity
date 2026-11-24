# Recipes: the winter frost

Everything here is grown by one script from numbers measured on the approved winter image. No picture was generated and no pixel of an approved image is used: the script reads `layout.json`, not the image. The same seed gives the same files, byte for byte.

## assets-full/winter/frost-glass.lin.w2048.png
Made by: `assets-src/frost-winter/build.mjs` (Node 20.20.2, sharp 0.35.5)
From: `assets-src/frost-winter/layout.json` (the `glass` block: the band's reach, density and film by rim angle, 8 plumes and 22 tufts placed by pixel of `references/approved/winter-rest.png` (fans of fine fronds low on both sides, a veil of small feathers on the upper right; the star list is empty), the 22 `crust` tufts of packed bristles down the left rim and of hair-fine fringe down the upper right rim, `rootFray` (how far a tuft's roots are frayed along its axis, so no fan ends on a straight line), `pace` and `barbWait` (how fast each plume's spine runs in and how long its barbs wait behind the tip), the seeded feathers, fans and needles, the widths of spine and barb in `barbWide`, `barbPower` and `spineWide`), `config/showcase.json` (globe size, the hero camera), `tools/lib/refcam.mjs` (turns a pixel of the approved image into a point on the glass)
Prompt or command: `npm run make -- frost-winter` (or `npm run make -- frost-winter --only glass`), then `npm run texpack`
Takes: none generated. The script was run again after each change of `layout.json` or of the growth rules; the committed file is the last run
Why this one: a polar map of the rim band of the sphere, 4096 px in the full set and 2048 px in the web set (the `.w2048.` in the name), linear. R is the height, G is when a texel appears as the frost grows in from the rim (0 first, 0.96 last, 1 never), B is how much it sparkles. Feathers are laid out as the hero camera sees them and stretched along the glass by at most `glass.maxStretch`, so the picture matches from the front and holds from 35 degrees to either side. In G a plume's spine runs ahead at its own pace and its barbs follow, so the frost grows in along its feathers, tips first
Date: 2026-11-24

## assets-full/winter/frost-slab.lin.w2048.png
Made by: `assets-src/frost-winter/build.mjs` (Node 20.20.2, sharp 0.35.5)
From: `assets-src/frost-winter/layout.json` (the `slab` block: 9 arms by the angle and distance of their tips as measured on the approved image, the fill arms and each arm's `bold`, the `fern` rules (a crisp spine, side branches and rows of needles, widths in mm as the hero camera sees them), the heaped `drift` against the foot, in `fern` the `speed`, `startAt`, `branchWait`, `branchSpeed` and `needleSpeed` that set when each part of an arm appears, the `thrown` grains, the film `under` the rim of the foot, the far patches, the grain and clump counts), `config/showcase.json` (the base diameter)
Prompt or command: `npm run make -- frost-winter` (or `--only slab`), then `npm run texpack`
Takes: none generated; the committed file is the last run
Why this one: a flat map of the slab under and round the foot, 4096 px over 264 mm in the full set and 2048 px in the web set, linear, with the same three channels. G is when a texel appears. Each arm starts at its own moment and its spine shoots out at its own speed; side branches wait behind the tip and needles behind the branch, so the arrival is a front of growing crystals, not a ring. The thin patches between the arms appear ahead of the arms and join them. Every arm is a fern drawn in the hero camera's own frame and stretched away from it by at most 1 over `slab.minSquash`, stroke widths included, so spine, branch and needle read at their drawn widths at that grazing angle. A thin broken film creeps in under the rim of the foot, so the lifted globe leaves no clean hole
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
Why this one: three meshes in one file. `glass` is the band of the sphere the frost is drawn on, `glass.liftMm` off the shell. `sheet` is a flat disc under and round the foot. `shapes` are the real small things near the camera: the heaped drift against the foot (lit tops, shaded sides), ridges along the arms and their branches (off while `slab.shapes.ridges` is false), and faceted lumps for the larger grains and clumps, each vertex carrying when it appears. The `thrown` grains are lumps too: each carries how far it skids, is thrown from the foot at the contact and slides to where it lies
Date: 2026-11-24
