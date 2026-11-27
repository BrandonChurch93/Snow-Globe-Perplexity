# Fall's air, handover

Branch `agent/p6-fall-air`. Second list (leaves, discs, pale lines, mist, sparks, bats).

## What is in it
- `src/particles/draw/cards.ts`, `src/particles/draw/looks.ts`: leaves at rest take their own size (`leafRestMm`, 1.35 to 2.9 mm), linger with the face to the eye (`leafFace`), are fewer at the right (`leafRestRight`), before the cottage (`leafRestCottage`) and none at the limb (`leafRestRim`); more rust and dark ones (`leafRed`, `leafDark`, `leafShade`). Sparks at rest: fewer specks (`sparkRestSkew`, `sparkRestClear`; the storm keeps `sparkSkew` and `sparkClear` as before), fewer and softer discs of several sizes (`spark.nearShare`, `nearField`, `discEdge`, `discVary`), thinned at the rim. Bats 2.1.
- `src/seasons/fall/glass.ts`: the long pale lines were the crack; now `bright` 1.5 (was 3.6), `bowMm` 1.5, `spreadPx` 1.25, a neutral tint. A mist (`mist...`, shader `MIST`, mesh `makeMist`) on the inner wall at render order 4.5, before the particles, so bats, leaves and sparks stand before it; the mesh is a whole ring drawn back faces only, so only the far half shows whichever way the ball is turned; it fades with the storm (`uFog.y`). `tests/no-air.test.ts` line 113 names its render order among fall's air (by grant). `airRest` halves the orange dust at rest; `hazeWarm` takes the warm light out of the low haze. The crack's sphere went from 96 x 64 to 96 x 58 so fall's triangles are not more (high 1,790,853 against main's 1,791,317; 68 draw calls against 66).
- `config/showcase.json`: fall's bats 3.

## Read (head 71340c5b on main fe0f0202; before is main 99712bfc, one line of the glass's limb older; hd, review tier, the M3 comparison picture, inside the ball above the ground band)
- Orange blobs by area (1 to 3, 4 to 14, 15 to 39, 40 to 119, 120 and over): approved 206 112 59 43 14; before 443 205 86 30 15; after 334 123 46 39 18.
- The scene with one leaf and one ember already reads 191 49 3 0 1 (rim 79, roof 32, tree 61, open air 19 in the smallest class), so the smallest class cannot reach the approved's 206 through the air.
- By place after (rim, roof, tree box, open air): 42 7 3 1 3; 49 12 2 3 0; 108 53 19 14 7; 135 51 22 21 8. Approved: 33 9 2 3 1; 10 6 0 1 0; 61 43 18 17 3; 102 54 39 22 10.
- Upper third: approved mean 57 53 48, median luminance 51.5; before 63 54 47, 40.8; after 62 58 51, 49.8.
- Peaks (total, crown box, outside): approved 2372 888 1484; before 1704 705 999; scene alone (an older scene) 832 371 461; after 1388 621 767.

## Still short of the approved, worst first
1. Sparks: the approved's are crisp white hot cores with an orange halo and there are far more dim ones; ours are softer, paler gold and fewer. The blob count and the peak count pull against each other: halving the specks took the peaks from 1704 to 1388.
2. Leaves: flatter lit and paler (ochre) than the approved's vivid orange with highlights; the 15 to 39 px class is 46 against 59. The share of whole leaves at rest is capped by `CARD.chosen[1]`, a shared number not in this brief.
3. The mist is an even pale grey green over the upper air; the approved's upper air is darker teal with warm glows and mottled green patches. The 90th percentile of luminance in the upper third is 116 against 93.
4. A warm pale band along the upper left rim (the glass, not the air).
5. Specks before the roof (49 against 10) and at the rim (42 against 33) come from the scene.
6. M3 fails on the base part (0.700), which is the pedestal's region, not the air; the miniature part reads 0.824.

## Not done
- The change into fall at film frame 2116 went to the change's finisher.
- Not seen: the mist with the ball turned by hand (the live orbit goes to 35 degrees); the storm frame without the mist beside the one with it.
