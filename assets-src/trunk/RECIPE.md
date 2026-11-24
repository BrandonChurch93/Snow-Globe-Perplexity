# Trunk: recipes

The trunk, the roots and the limbs are the same in every season. Their shape lives in `src/miniature/trunk.ts` and the build script reads it from there, so the page and the built files cannot drift apart.

## assets-src/trunk/bark-take1.png
Made by: Nano Banana Pro through the image tool of this product (model id `nano_banana_pro`), 2048 px, aspect 1:1
From: a crop of `references/approved/winter-rest.png`, left 1490, top 700, 170 by 190 px (the trunk), passed as the reference picture
Prompt or command: A flat material sheet, seamless and tileable, of the tree bark shown in the reference picture: the dark warm brown bark of a hand-sculpted miniature tree trunk, with deep fibrous ridges and grooves that run from the top edge to the bottom edge and sway and twist a little, some ridges splitting and joining. Photographed straight on like a texture scan, evenly lit with soft diffuse light from the front, no cast shadows, no bright highlights, no glow, no snow, no lights, no background, no vignette. The bark fills the whole square frame edge to edge at one even scale, about twelve to sixteen ridges across. Keep the colour and the ridge character of the trunk in the reference. No text, no logo, no people, no hands.
Takes: 1 made, take 1 kept
Why this one: the ridges run from top to bottom at one even scale, in the brown of the approved trunk, with no highlight or shadow painted in
Date: 2026-11-24

## assets-full/shared/trunk-bark.srgb.tile.png, assets-full/shared/trunk-bark-n.lin.tile.png
Made by: `assets-src/trunk/build.mjs` with `assets-src/trunk/source.mjs` (sharp, in Node)
From: `assets-src/trunk/bark-take1.png`
Prompt or command: `npm run make -- trunk`. The sheet is not truly seamless as it comes, so the script cross-fades a tenth of it over each edge, flattens the wide brightness so no patch repeats as a blotch, and takes the luminance over its own wide blur as height for the normal map.
Takes: 1 picture in, rebuilt each time the script changed, the last build kept
Why this one: it tiles without a seam at 6.5 mm a tile and gives the grooves a normal as well as a colour
Date: 2026-11-24

## assets-full/shared/trunk-wood.glb
Made by: `assets-src/trunk/build.mjs` (three 0.187 in Node, `tools/lib/glb.mjs`)
From: `src/miniature/trunk.ts` (the radius and axis tables, the ridges, the roots, the limbs and twigs that reach each pad), loaded through `assets-src/trunk/source.mjs`
Prompt or command: `npm run make -- trunk`. One fluted column of 64 sides for the stem and the root skirt, a tube for every root, limb and twig, vertex colours that darken the grooves and the crotches, uv in bark tiles. The mesh is in tree coordinates (x, height above the foot, z) and the page stands it on the ground with `placeGeometry`.
Takes: rebuilt at every change of the shape, the last build kept
Why this one: the waist, the root skirt and the fork heights are the ones measured on the approved image
Date: 2026-11-24
