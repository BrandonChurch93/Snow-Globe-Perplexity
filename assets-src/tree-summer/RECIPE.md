# Summer crown of the tree and its lanterns: recipes

What summer hangs on the shared trunk: a full crown of leaf clusters grown over the pads of `src/miniature/trunk.ts`, and the paper lanterns with their string, cords, caps and peg. The places and sizes of the lanterns come from `src/seasons/summer/mini/lanterns.ts`, the shape of the crown from `src/seasons/summer/mini/crown.ts`.

## assets-src/tree-summer/gen/leaves-take1.png
Made by: the image tool of this product (`generate_image`), aspect 1:1, 1254 px
From: a crop of `references/approved/summer-rest.png`, left 1340, top 360, 460 by 340 px (the crown), passed as the reference picture; the crop itself is not committed and no pixel of it is in the app
Prompt or command: see `assets-src/tree-summer/gen/leaves-take1.prompt.txt`
Takes: 1 made, take 1 kept
Why this one: small rounded clumps at one even scale in the deep green of the approved crown, with no lantern, light or shadow painted in
Date: 2026-11-25

## assets-full/summer/tree-leaves.srgb.tile.w1024.png, assets-full/summer/tree-sprigs.srgb.w512.png
Made by: `assets-src/tree-summer/build.mjs` (sharp, in Node)
From: `assets-src/tree-summer/gen/leaves-take1.png`
Prompt or command: `npm run make -- tree-summer`. The leaf tile is the sheet with its edges cross-faded and its wide brightness flattened. The sprig sheet is four cut-outs of the same sheet, two by two, each with a lobed outline and holes where the foliage is dark, for the small cards that break up the outline of every cluster.
Takes: 1 picture in, rebuilt each time the script changed, the last build kept
Why this one: the cards and the bodies they stand on share one picture, so they read as one material
Date: 2026-11-25

## assets-full/summer/tree-summer.glb
Made by: `assets-src/tree-summer/build.mjs` (three in Node, marching cubes tables from `three/examples/jsm/objects/MarchingCubes.js`, `tools/lib/glb.mjs`)
From: `src/seasons/summer/mini/crown.ts` (the field of the crown), `src/seasons/summer/mini/lanterns.ts` (the lanterns and the string), `src/miniature/trunk.ts` (pads and limbs, read only)
Prompt or command: `npm run make -- tree-summer`. Mesh `leaves`: the field of the crown walked with marching cubes at 1.0 mm on a grid that lies at one fixed place, with sprig cards standing on it; each point of the surface draws its sprig from a stream named by its place on that grid, so that a reshaped clump changes the sprigs by that clump alone and every other sprig stays as it was (the lighter lists of the lower levels are picked by the same place); vertex colour is the shade of the cluster (deep inside and below, yellow green at open tips). Mesh `lanterns`: ribbed paper bodies, dark caps, loops, cords, the string between the roof and the trunk and the peg of the large lantern; colour alpha is the share that glows, `tangent` holds the point each piece swings about and its phase, `uv` the order in which it comes up and whether it is paper.
Takes: rebuilt each time the script changed, the last build kept
Why this one: one field gives both the picture and the distance field the seeds snag on
Date: 2026-11-25

### Fitting tools

One measure used to fit the crown against the approved image. It needs Python 3 with Pillow, numpy and scipy, writes nothing but the picture it is asked for, and ships nowhere.

- `python3 assets-src/tree-summer/crown-count.py approved [OUT.jpg [SHADE.jpg [FLANK.jpg]]]` counts the crown of `references/approved/summer-rest.png`. With `NOAIR.png IDS.png [OUT.jpg [SHADE.jpg [FLANK.jpg]]]` it counts our own rest still at hd in the same crop, at the same scale and through the same steps. With `doubt` it gives the span of every number of the approved when the hand marks and the rules of the mask are moved. It prints the crown's share of its hull, the bay and the notches, the lit band and its beads along the upper left outline, each pad's length, thickness and tilt, the shade inside the crown, and the specks down the right flank. OUT.jpg shows what was counted, laid over the picture: the crown's outline, its hull, the lit pixels and the notches by number.
- The shade is the level of the body (the crown's leaf by colour, without the lit rim), with the approved's air set aside by the same pixels on every picture: its hand marks, its seed heads and its fireflies with half a millimetre about each. The rows: for each of the five pads the mean level of its lower third over its upper third, and the same over the five together; the seams between two pads over the pads away from them; the top, the underside and the core by their depth from the outline; and of the inside its levels, the hue of its mean colour and of its darker and its lighter half, its vivid green and its light part. SHADE.jpg shows what those rows read, at twice the size: the upper thirds outlined in yellow, the lower thirds in blue, the core in white, the seams dotted in red, and in purple what is not read (the lit rim and the air set aside).
- The flank is the fine lights down the right flank of the two right domes: the outline of the right dome's and the low right pad's shares that is the crown's rightmost in its row, where the way out of the leaf points to the right and not up and to the left. The row gives its length and its specks, counted as the beads are (peaks of the light among the lit pixels within 0.6 mm of it), whole and per 10 mm. FLANK.jpg shows that outline in pale blue and every speck counted in a pink ring. The approved reads 68 specks on 22.3 mm of it.
- The flank's tone is read pixel by pixel from the crown within 0.6 mm of that outline: the specks' own light (warm, hue 15 to 50 degrees, greatest channel 200 up) and the gold about them (warm, 80 to 200), each with its share of the strip, its mean colour and the middle hue and saturation of its pixels; then the gold's share over the bright's, and the share of the counted specks whose heart stands at the top of the range (greatest channel 250 up). FLANK.jpg's second panel shows what was read: the bright pale, the gold orange, the rest of the strip green. The approved reads bright 15.3 percent at (232, 205, 158), hue 37, saturation 0.32; gold 46.0 percent at (129, 107, 70), hue 38, saturation 0.45; gold over bright 3.00; hearts at the top 62 percent.
- The turn is where the flank's string goes on round the bottom right of the low dome: the low right pad's outer outline right of its marked point and 2.5 mm or more under it (drawn orange in FLANK.jpg, its specks ringed green). The row gives its length, its specks within 0.6 mm of it, the specks to 10 mm and the lit pixels there. The approved: 17 specks on 8.9 mm, 19.1 to 10 mm, 205 lit pixels. Ours, round two item 2: 15 on 8.4 mm, 17.9 to 10 mm, 103 lit pixels (before it 12 on 8.4 mm, 14.3, 91). In `tree.ts` the flank has a second lobe for it (`FLANK.turn`, `turnFrom`, `turnTo`): the outline that faces down, right of `turnAt` (mm from the stem), takes the flank's specks as the outline that faces right does.
- `assets-src/tree-summer/crown-marks.json` holds the crop, the scale and the hand marks on the approved image: 13 seed heads whose light is never counted, 12 discs and 11 polygons where a seed head, a glow or the air lies over leaf (the 23 marks that add leaf), one point in each pad and the pairs of neighbours.
- NOAIR.png comes from `npm run still -- --season summer --state rest --camera hero --tier review --format hd --no-air`, IDS.png from `npm run measure -- --unit summer --only M3 --tier review` (`out/work/stills/summer-rest-hd-review-ids.png`). The still without the air is a measuring aid and never a judged picture.
