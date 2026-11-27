# Fall's air, handover

Branch `agent/p6-fall-air` at de2c4dce (merge of main fe261991). Third list: leaves, sparks, bats, upper air, the storm at the landing.

## What the third list put in
- `src/particles/draw/cards.ts`: the leaf's edge line reads `CARD.leafEdge` (leaf only); the bat's wing chord is slimmed by `CARD.batSlim`; at rest the dim sparks go and the ones that stay take the core (`keepC` by the spark's own number to the fourth power); the halo's radius at rest differs spark by spark (`restHaloVary`); the hot core is not cut by the spark's life at rest. Only the spark, leaf and bat branches changed; winter's, spring's and summer's six stills are the same bytes as main's.
- `src/particles/draw/looks.ts`: `leafShade`, `leafEdge`, `leafSheen`, `leafMost`, `leafGold`; `sparkRestSkew`, `sparkRestClear`; the spark's `rest...` numbers; `batRestTilt`, `batSlim`, `batRaise`.
- `src/particles/engine/kinds.ts`: bat `sizeMm` [5, 6.6]. `config/showcase.json`: fall's bats 2. `src/seasons/fall/veil.ts`: the leaf colour.
- `src/seasons/fall/glass.ts`: the pooled fog's sheets draw at render order 4.6 (was 5.5), before the particles at 5 and after the mist at 4.5, so leaves, sparks and bats stand before the storm's fog; the fog is paler, nearer mint and brighter when lifted (`tintLifted`, `paleLifted`, `glowStorm`); the mist is darker, greener and patchy (`mistPatch`, `mistTop`, `mistAir`, `mistEven`).
- `tests/no-air.test.ts` line 113 (by grant): fall's air orders are [4.5, 4.6, 5.4]; the same three meshes.

## Read (hd, review tier, d75dd46b unless said; approved first)
- Orange blobs by area (1 to 3, 4 to 14, 15 to 39, 40 to 119, 120 and over): 206 112 59 43 14; before 334 123 46 39 18; after 411 115 46 38 24. The scene without the air alone reads 197 55 14 1 1.
- Peaks (all, crown box, outside): 2372 888 1484; before 1388 621 767; after 1893 962 931; the scene without the air 805 293 512.
- Leaf blob medians: 15 to 39 px 157 94 56 against 159 97 52; 40 to 119 px 160 94 55 against 175 102 48 (red 15 over, outside the 12).
- Upper third luminance 10/25/50/75/90: 13.5 32.9 51.5 66.4 92.8 against 15.0 39.7 49.6 76.0 127.3. Inside 0.85 of the radius: 41.2 47.7 57.4 74.0 103.0 against 40.6 44.2 51.4 70.4 107.0. The rim zone: 11.7 13.1 16.5 50.2 66.9 against 13.9 15.1 16.9 105.5 155.3 (the warm band).
- Bats at rest: approved two, span 63 px, middles near (935,187) and (898,262); here two, span 57 and 70 px, middles (1054,174) and (945,258).
- Storm, the glass of the landed still against the approved shake (de2c4dce): mean 130 120 82 against 119 104 66; luminance 10/50/90 74 116 175 against 59 106 148; share over 150: 0.21 against 0.09.
- Fall high 1,789,083 triangles (main's a55e7ee6 the same), 68 draw calls. With the mist hidden: 1,787,243 and 66; the two extra calls are the mist's one mesh drawn in two passes.
- M3 fall 0.7228 (base 0.723, miniature 1.405; with the mist hidden 1.395). M4 0.9694 0.9049 0.9546 0.9602, M5 0.993 1 0.9688 0.9997.

## Still short of the approved, worst first
1. Sparks: the smallest blob class rose (411 against 206) because each hot core now has a halo whose fragments count; the approved's sparks are finer and more of its brightest ones are orange. Peaks outside the crown box 931 against 1484.
2. The warm pale band along the upper left rim (157 121 72 where the approved has 68 61 47) is in the still without the air (152 110 63) and with the mist hidden (156 112 65): the shell or the room, not the air.
3. The bottom of the ball at the front: the pooled fog's bright band stands about 12 px lower than where the approved's vines begin (fall-lip-pair.jpg). It is the fog of `glass.ts`; one trial that faded the lip mesh above the collar at the front moved no pixel, so the band is drawn elsewhere (the fog's sheets, or the lens shows another part of the wall there). Not mended.
4. Bats: the upper one is about 110 px right of the approved's place and both are softer than the approved's crisp ones.
5. Leaves: the 40 to 119 px class is 15 levels too red; most leaves are larger than the approved's many small ones.
6. Storm: the share of pale streaks (0.09 against 0.21) and the brightness low in the ball.

## Not seen
- The mist with the ball turned was seen only on the drag sheet (12 frames of 383 px, yaw to 35 degrees), not at full size.
- Nothing was measured on main d13d29c6 (fall's base third list); the branch is not merged with it.
