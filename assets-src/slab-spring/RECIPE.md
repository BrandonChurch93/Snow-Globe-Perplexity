# Recipes: slab-spring

The surface half of spring's dressing: fallen petals around the foot and the far picture of petals. Everything that ships is made by `npm run make -- slab-spring` (about 4 s) from the script and inputs in this folder. Counts: petal sheet 1 take of 6.

## assets-src/slab-spring/ref/approved-petals-crop.png
Made by: Python 3 with Pillow, by hand in the shell
From: references/approved/spring-rest.png
Prompt or command: python3 -c "from PIL import Image; Image.open('references/approved/spring-rest.png').convert('RGB').crop((1700, 1250, 2600, 1560)).resize((1800, 620), Image.LANCZOS).save('assets-src/slab-spring/ref/approved-petals-crop.png')"
Takes: 1
Why this one: the image tool needs the approved petals in front of it; no pixel of this crop is drawn in a frame
Date: 2026-11-25

## assets-src/slab-spring/gen/petals-take1.png
Made by: the image tool of this product, model nano_banana_pro
From: assets-src/slab-spring/ref/approved-petals-crop.png as the reference picture; the prompt in assets-src/slab-spring/prompts/petal-sheet.txt
Prompt or command: Image 1 is a photograph of fallen cherry blossom petals lying on a dark polished tabletop. Make a sprite sheet of twelve separate petals of that same kind, arranged in 3 rows of 4, each centred in its own cell with clear empty space around it, on a pure black background. Each petal is one single fallen cherry blossom petal seen straight down from above: pale pink, almost white toward its notched outer edge and a deeper rose pink at its narrow base, with fine veins running from base to edge, soft and slightly translucent. No two are alike: some are flat, some gently cupped, two are curled at one edge, one is folded, two are a little bruised, and three carry a few tiny clear water droplets. Soft even light from above, no cast shadows on the background, no stems, no whole flowers, no leaves, no surface, no reflections, no text, no frames. Keep the colour and character of the petals the same as in image 1. Wide 16:9 picture.
Takes: 1 made of 6 allowed, take 1 kept
Why this one: twelve separate petals on clean black in a 4 by 3 grid; cells 6, 9 and 11 carry droplets and are the wet ones, cells 4 and 8 are bruised
Date: 2026-11-25

## assets-full/spring/slab-petals.srgb.w1024.png
Made by: assets-src/slab-spring/build.mjs, Node 20.20.2 with sharp
From: assets-src/slab-spring/gen/petals-take1.png
Prompt or command: npm run make -- slab-spring
Takes: built, not generated
Why this one: the twelve petals cut from black into cells of 512 px with their own alpha, colour bled outward so no dark fringe shows when a petal is blurred
Date: 2026-11-25

## assets-full/spring/slab-far.srgb.w2048.png
Made by: assets-src/slab-spring/build.mjs
From: assets-src/slab-spring/gen/petals-take1.png
Prompt or command: npm run make -- slab-spring
Takes: built, not generated
Why this one: the picture further off: the same petals stamped flat over 1040 mm of surface from 232 mm out, where the real ones end
Date: 2026-11-25
