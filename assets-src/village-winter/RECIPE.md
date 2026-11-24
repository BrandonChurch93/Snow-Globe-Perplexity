# Recipes: winter's cover on the village

Winter's dress over the shared shapes: the snow on the roof, the caps, the ground and the shrubs, the pond's ice, the wreath and the shrubs' leaves, the eave bulbs and the fresh layer that rises after a landing. Made by code alone, except the chimney's plume, which is read from one generated picture (the last two entries). No pixel of an approved image is used.

## assets-full/winter/village-winter.glb
Made by: `assets-src/village-winter/build.mjs` (Node 20.20.2, three.js from the repo's `node_modules`), fixed seed
From: `assets-src/village/layout.mjs` and `assets-src/village/kit.mjs` (the same places and sizes as the shared model, so the cover sits on the shapes), and the hang points of `src/miniature/roof.ts` for the bulbs
Prompt or command: `npm run make -- village-winter`
Takes: no generated picture. 7 builds looked at while tuning the roof load, the pond rim and the bulbs
Why this one: the snow is one skin grown from distance fields (roof load with dents, a rounded lip that runs past the eave, scallops and a collar at the chimney; pillows on the steps and stones; drifts against the walls and the lamp foot; clumps over the shrubs; a bank with a crest at the pond rim; the chimney, the lamp's cap and the fence's posts and rails stay bare, as in the approved image), so it has thickness and soft edges everywhere and stays within half a millimetre of `solid()`. Meshes: `snow`, `ice`, `decor` (wreath, bow, shrub leaves), `bulbs` (25, with a tone and a flicker phase each), `fresh` (the arrival layer)
Date: 2026-11-24

## assets-full/winter/village-snow.lin.tile.png
Made by: `assets-src/village-winter/build.mjs`, the same run
From: seeded noise only
Prompt or command: `npm run make -- village-winter`
Takes: no generated picture. 2 versions looked at
Why this one: one seamless tile of 1024 px over 12 mm; red is the grain height, green places the sparkle, blue is the soft lumps. The shader reads it on three planes so no stretch shows on steep snow
Date: 2026-11-24

## assets-full/winter/village-ice.lin.tile.png
Made by: `assets-src/village-winter/build.mjs`, the same run
From: seeded noise only
Prompt or command: `npm run make -- village-winter`
Takes: no generated picture. 2 versions looked at
Why this one: one seamless tile; red is cracks, green is frost, blue is trapped bubbles. The shader turns it into height, roughness and the pale frost toward the rim, and the lamp, the panes and the bulbs are mirrored in it by `src/miniature/mirror.ts`
Date: 2026-11-24

## assets-src/village-winter/gen/plume-take4.png
Made by: the image tool of this product. Takes 1 and 2 with nano_banana_pro, takes 3 and 4 with gpt_image_2_6_flare (GPT Image 2.6 Flare)
From: the approved image as the reference, passed as image 1: `references/approved/winter-rest.png`, x 1075, y 465, 150 by 180 px (the chimney, its flue pipe and the plume), enlarged 6 times to 900 by 1080. What must stay the same: the plume's shape, density, softness and proportions
Prompt or command: take 4, in full: "Image 1 is the reference photograph: a macro view of the chimney of a miniature stone cottage inside a snow globe at night, with a small plume of white smoke rising from its black flue pipe, among out-of-focus snowflakes. Make a new photograph-like picture of ONLY that plume of white chimney smoke, isolated on a pure flat black background (#000000), like a stock smoke element for compositing. Keep the plume's shape, density, softness and proportions as in the reference. The plume is SHORT and STOUT, like a thick puff of steam: its total height is only about 1.8 times its greatest width. It starts as a thick, dense, almost opaque white stem, about one quarter as wide as the plume is tall, that rises straight up from the bottom centre of the frame for about half of the plume's height, with soft billowy cotton-like edges; then it kinks to the left and breaks into two or three big, soft, rounded, cotton-like lobes: one lobe pushed out to the left at the kink, and a larger, fainter, softer lobe above it that drifts up and a little to the right and thins away to nothing at the top. The smoke is soft white to pale cool grey, dense like cotton wool, lit gently from the upper left, with slightly darker grey shading on its right side and under the lobes, feathered edges, and the gentle blur of a macro photograph (shallow depth of field). The stem starts at the very bottom edge of the frame, centred horizontally; the whole plume fills about 90 percent of the frame height and about 55 percent of the frame width, and stays clear of the left, right and top edges. No chimney, no pipe, no roof, no snowflakes, no particles, no sparks, no stars, no thin wisps or filaments, no background detail, no colour cast, no glow, no text, no logo, no people, no hands. Square format, 1:1." Opaque background, 1:1, 1254 px. Takes 1 to 3 used the same reference and the same "keep" and "no" sentences in portrait 3:4, with a narrow stem ("about as wide as the pipe ... about one seventh of the frame width") in place of the short and stout one; take 1 opened "Make a new picture of ONLY that smoke plume as an isolated visual-effects element on a pure, flat black background (#000000).", take 2 "Edit the reference: remove the chimney, the pipe, the snowflakes and the night sky completely, and leave ONLY the smoke plume, repainted cleanly and in full where snowflakes covered it, on a pure flat black background (#000000).", take 3 as take 4 opens
Takes: 4 made of the 6 allowed, take 4 kept. Takes 1 to 3 are in `out/work/village-winter/takes/` and are not committed
Why this one: it is the approved plume: a thick dense stem (a fifth of the frame wide) that rises for half the height, a lobe pushed out to the left at the kink and a larger, fainter lobe above it, cotton-soft, on pure black (the black is exactly 0, so the brightness is the density). Takes 1 and 2 came as thin curling filaments of incense smoke, which is the "wisp of gas smoke" Round 5 named; take 3 was cotton-soft with the right lobes but half as stout as the approved plume
Date: 2026-11-24

## assets-full/winter/village-plume.lin.png
Made by: `assets-src/village-winter/build.mjs`, the same run
From: `assets-src/village-winter/gen/plume-take4.png` alone
Prompt or command: `npm run make -- village-winter`
Takes: 1 version
Why this one: the take's brightness (the mean of red, green and blue on black) brought down to 256 px by a box filter and written to all three channels, so the same input gives the same bytes. `src/miniature/wisp.ts` reads it as the smoke's density on a card that stands on the flue pipe (`WISP` and `WISP_LOOK` in `src/seasons/winter/mini/village.ts` hold its size, the foot of the stem and the curve from brightness to density)
Date: 2026-11-24
