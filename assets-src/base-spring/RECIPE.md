# Recipes: base-spring

Spring's base: rough stone under living moss, wrapped in roots, with mushrooms, a few small flowers and the trickle. Everything that ships is made by `npm run make -- base-spring` (about 70 s) from the scripts and inputs in this folder. Counts: moss sheet 1 take of 6, stone sheet 1 take of 6, bark sheet 1 take of 6.

## assets-src/base-spring/ref/approved-base-crop.png
Made by: Python 3 with Pillow, by hand in the shell
From: references/approved/spring-rest.png
Prompt or command: python3 -c "from PIL import Image; Image.open('references/approved/spring-rest.png').convert('RGB').crop((820, 960, 2000, 1480)).save('assets-src/base-spring/ref/approved-base-crop.png')"
Takes: 1
Why this one: the image tool needs the approved base in front of it; no pixel of this crop is drawn in a frame
Date: 2026-11-25

## assets-src/base-spring/gen/moss-take1.png
Made by: the image tool of this product, model nano_banana_pro
From: assets-src/base-spring/ref/approved-base-crop.png as the reference picture; the prompt in assets-src/base-spring/prompts/moss-sheet.txt
Prompt or command: Image 1 is a photograph of the mossy stone base of a snow globe. Make a flat material sheet of that same living moss and nothing else: dense cushion moss seen straight down from above in a macro photograph, deep saturated forest green with brighter yellow green tips, tiny star shaped tufts and fine fronds packed tightly, soft uneven mounds a few millimetres across, a few darker hollows between the mounds. It is photographed perfectly flat and head on like a scanned material swatch, evenly lit by soft overcast light, with no shadows of other things, no bright highlights, no glare, no vignette, no stones, no roots, no mushrooms, no flowers, no objects, no border and no text. Keep the moss's colour and character the same as in image 1. The sheet tiles seamlessly: the left edge continues into the right edge and the top into the bottom. Square picture filled edge to edge with moss.
Takes: 1 made of 6 allowed, take 1 kept
Why this one: dense even cushion moss at 2048 px with no object in it and no visible light direction, so it can tile around the ring
Date: 2026-11-25

## assets-src/base-spring/gen/stone-take1.png
Made by: the image tool of this product, model nano_banana_pro
From: assets-src/base-spring/ref/approved-base-crop.png as the reference picture; the prompt in assets-src/base-spring/prompts/stone-sheet.txt
Prompt or command: Image 1 is a photograph of the mossy stone base of a snow globe; look at the dark stones between the moss and the roots. Make a flat material sheet of that same stone and nothing else: rough dark river stone, cool blue grey slate and charcoal, slightly damp, with fine pits, small chips, faint paler mineral veins and a few flecks of lichen, the surface of one continuous slab of rock with no joints. It is photographed perfectly flat and head on like a scanned material swatch, evenly lit, with no shadows, no highlights, no glare, no vignette, no moss, no roots, no pebbles, no objects, no border and no text. Keep the stone's colour and character the same as in image 1. The sheet tiles seamlessly: the left edge continues into the right edge and the top into the bottom. Square picture filled edge to edge with stone.
Takes: 1 made of 6 allowed, take 1 kept
Why this one: one continuous rough slab with fine pits and no joints; the cobble joints are geometry, and the shader warms its colour toward the approved image
Date: 2026-11-25

## assets-src/base-spring/gen/bark-take1.png
Made by: the image tool of this product, model nano_banana_pro
From: assets-src/base-spring/ref/approved-base-crop.png as the reference picture; the prompt in assets-src/base-spring/prompts/bark-sheet.txt
Prompt or command: Image 1 is a photograph of the mossy stone base of a snow globe; look at the tree roots that wrap around it. Make a flat material sheet of the skin of those same roots and nothing else: old weathered root bark, warm grey brown with paler tan ridges and dark brown furrows, long fibres and fine cracks running horizontally from left to right across the whole sheet, a few small knots, a faint green tinge of algae in places. It is photographed perfectly flat and head on like a scanned material swatch, evenly lit, with no shadows, no highlights, no glare, no vignette, no moss clumps, no stones, no objects, no border and no text. Keep the bark's colour and character the same as in image 1. The sheet tiles seamlessly: the left edge continues into the right edge and the top into the bottom. Square picture filled edge to edge with bark.
Takes: 1 made of 6 allowed, take 1 kept
Why this one: long fibres running left to right, which is the way the root tubes are unwrapped
Date: 2026-11-25

## assets-full/spring/base-moss.srgb.tile.w512.png, base-stone.srgb.tile.w512.png, base-bark.srgb.tile.w512.png, base-moss-detail.lin.tile.w512.png, base-stone-detail.lin.tile.w512.png, base-bark-detail.lin.tile.w512.png
Made by: assets-src/base-spring/build.mjs (sheet), Node 20.20.2 with sharp, helpers from assets-src/base-winter/lib.mjs
From: assets-src/base-spring/gen/moss-take1.png, stone-take1.png, bark-take1.png
Prompt or command: npm run make -- base-spring
Takes: built, not generated
Why this one: each sheet with its slow light taken out, 2048 px in the file and 512 px in the pack (the name's `w512`); the detail map carries the slope of the sheet's own grain in red and green and its height in blue
Date: 2026-11-25

## assets-full/spring/base-relief.lin.w2048.png, assets-full/spring/base-cover.lin.w2048.png
Made by: assets-src/base-spring/build.mjs
From: assets-src/base-spring/layout.mjs (profile, moss drips and patches, the trickle's path and width, roots), config/showcase.json
Prompt or command: npm run make -- base-spring
Takes: built, not generated
Why this one: relief holds the fine normal of the unwrapped height field in red and green and the cavity in blue; cover holds moss in red, the wet band of the trickle in green and how far down the trickle each wet texel lies in blue, so the stone darkens as the water front passes
Date: 2026-11-25

## assets-full/spring/base-spring.glb
Made by: assets-src/base-spring/build.mjs
From: assets-src/base-spring/layout.mjs, assets-src/base-winter/lib.mjs, config/showcase.json
Prompt or command: npm run make -- base-spring
Takes: built, not generated
Why this one: three meshes. `rock` is the turned profile measured from the approved image, displaced by the height field (cobbles, moss cushions, the trickle's channel) and cupped to the glass at the same collar as winter's; `growth` is the roots as tubes that taper from the collar to the foot and swell at knots, laid on that height, the mushrooms, the flowers and the petals on the ledge; `water` is the strip of the trickle with its length and its foot in the extras
Date: 2026-11-25
