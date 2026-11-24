# Recipes: base-winter

Winter's base with its icicles. Everything that ships is made by `npm run make -- base-winter` from the scripts and inputs in this folder. Counts: wood sheet 2 takes of 6, carving heights 2 takes of 6.

## assets-src/base-winter/ref/approved-base-crop.png, assets-src/base-winter/ref/approved-carving-crop.png
Made by: Python 3.14 with Pillow 13.0.0, by hand in the shell
From: references/approved/winter-rest.png
Prompt or command: python3 -c "from PIL import Image; im = Image.open('references/approved/winter-rest.png').convert('RGB'); im.crop((850, 1040, 1970, 1470)).save('assets-src/base-winter/ref/approved-base-crop.png'); im.crop((960, 1150, 1560, 1400)).resize((1800, 750), Image.LANCZOS).save('assets-src/base-winter/ref/approved-carving-crop.png')"
Takes: 1 each
Why this one: the image tool needs the approved base in front of it; no pixel of these crops is drawn in a frame
Date: 2026-11-24

## assets-src/base-winter/gen/wood-take1.png
Made by: the image tool of this product. Take 1 with nano_banana_pro, take 2 with gpt_image_2_6_flare
From: assets-src/base-winter/ref/approved-base-crop.png as the reference picture; the prompt in assets-src/base-winter/prompts/wood-sheet.txt
Prompt or command: Image 1 is a photograph of the carved wooden base of a snow globe. Make a flat material sheet of that same wood and nothing else: dark oiled walnut, very dark chocolate brown with warm reddish brown lighter streaks, fine straight grain lines running horizontally across the whole sheet, tiny open pores, a few gently wavy grain bands, slight hand rubbed variation in tone. It is photographed perfectly flat and head on like a scanned veneer, evenly lit, with no shadows, no highlights, no glare, no vignette, no carving, no objects, no border and no text. Keep the wood's colour and character the same as in image 1. The sheet tiles seamlessly: the left edge continues into the right edge and the top into the bottom. Square picture filled edge to edge with wood.
Takes: 2 made, take 1 kept. Take 2 is in out/work/base-winter/takes/ and is not committed
Why this one: fine straight grain and an even tone at 2048 px; take 2 came at 1254 px with coarse, high contrast wavy streaks that would show as a repeat around the ring
Date: 2026-11-24

## assets-src/base-winter/gen/carving-take1.png, assets-src/base-winter/gen/carving-take2.png
Made by: the image tool of this product. Take 1 with nano_banana_pro, take 2 with gpt_image_2_6_sunburst
From: assets-src/base-winter/ref/approved-carving-crop.png as the reference picture; the prompt in assets-src/base-winter/prompts/carving-height.txt
Prompt or command: Image 1 is a photograph of the carved wooden base of a snow globe; look at the carved leaf sprays on it. Make a sculptor's height map sheet of eight separate carved ornaments in that same style, arranged in 2 rows of 4, each centred in its own cell with clear empty space around it, on a pure black background. Seven of them are different leaf sprays: a gently curved stem running left to right with deeply serrated oak and acanthus like leaves on both sides, the leaf tips curling, each leaf with a raised midrib and side veins. One of them is a fan of long pointed leaves spreading from a small cluster of three round berries. The picture is a greyscale height map for displacement, not a photograph: brightness means height above the ground, pure black is the flat ground, the stems, midribs and rolled leaf edges are the brightest, leaf surfaces are smooth mid grey with soft gradients down to their edges. No lighting, no shadows, no outlines, no colour, no texture, no text, no frames. Keep the leaf shapes and proportions the same as the carving in image 1. Wide 16:9 picture.
Takes: 2 made, both kept and both used. Take 1 came back as six long sprays and one fan with berries, not the eight cells asked for; take 2 followed the layout
Why this one: take 1 gives the long sprays and the berries, take 2 the short twigs and the fan; together they let no two neighbours on the ring be the same spray
Date: 2026-11-24

## assets-full/winter/base-wood.srgb.tile.w1024.png, assets-full/winter/base-wood-detail.lin.tile.w1024.png
Made by: assets-src/base-winter/maps.mjs (woodMaps) through assets-src/base-winter/build.mjs, Node 20.20.2, sharp 0.35.5
From: assets-src/base-winter/gen/wood-take1.png, assets-src/base-winter/lib.mjs
Prompt or command: npm run make -- base-winter (or: node assets-src/base-winter/build.mjs maps)
Takes: built, not generated
Why this one: the sheet with its slow light taken out and its mean set, 2048 px over a 28.8 mm tile; the detail map carries the grain as a normal in red and green and the roughness in blue, pores rougher
Date: 2026-11-24

## assets-full/winter/base-carve.lin.w2048.png
Made by: assets-src/base-winter/carve.mjs (buildField) and assets-src/base-winter/maps.mjs (carveMap) through build.mjs
From: assets-src/base-winter/gen/carving-take1.png, assets-src/base-winter/gen/carving-take2.png, assets-src/base-winter/profile.mjs, config/showcase.json
Prompt or command: npm run make -- base-winter
Takes: built, not generated
Why this one: the same height field that moves the mesh, as a normal in red and green with cavity below and wear above the middle of blue, laid in strips so the front of the ring has the most texels
Date: 2026-11-24

## assets-full/winter/base-brass.srgb.tile.w512.png, assets-full/winter/base-brass-detail.lin.tile.w512.png, assets-full/winter/base-snow.srgb.tile.w256.png, assets-full/winter/base-snow.lin.tile.w256.png
Made by: assets-src/base-winter/maps.mjs (brassMaps, snowMaps) through build.mjs
From: assets-src/base-winter/lib.mjs (seeded noise only, no picture)
Prompt or command: npm run make -- base-winter
Takes: built, not generated
Why this one: brushed and pitted brass with its tarnish in the blue of the detail map; snow grains as a normal with roughness in blue
Date: 2026-11-24

## assets-full/winter/base-winter.glb
Made by: assets-src/base-winter/mesh.mjs, carve.mjs, profile.mjs and lib.mjs through build.mjs, written by tools/lib/glb.mjs
From: assets-src/base-winter/profile.mjs (the profile measured from references/approved/winter-rest.png with assets-src/base-winter/measure.mjs and tools/lib/refcam.mjs), the two carving pictures above, config/showcase.json
Prompt or command: npm run make -- base-winter (or: node assets-src/base-winter/build.mjs mesh)
Takes: built, not generated
Why this one: four meshes named wood, brass, snow and ice, 115308 triangles (4.10 MB, as make prints): the lathe with a convex body, the carving as displacement and two cones of scales; a flared foot, a fine rope twist, ledge lip, a low collar ring and cup; the ledge's snow as thin heaps (HEAPS in mesh.mjs) that bank against the glass and hang over the lip in rounded lobes (scallop in mesh.mjs) with a tongue down to each icicle; 39 icicles, no two alike: the 18 in front are measured one by one from the approved image (MEASURED in mesh.mjs: place, top and tip, five widths down its length, how far its root spreads along the lip, lean, bow, bulb and drop; pairs stand close enough to fuse), the 21 behind take random forms and uneven gaps; each is rooted on the lip's face (ICE_RISE) and the ice shader in src/seasons/winter/base.ts fades its top in, so that it grows out of the lip or of the snow
Date: 2026-11-24
