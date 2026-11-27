# Fall's air, handover

Branch `agent/p6-fall-air` at 7a5fd873 (36f3fcc8, the fourth list, with main a7f9032b merged). The proof ran on 36f3fcc8, which holds main b4bc96c0; a7f9032b moves no still.

## What the fourth list put in
- `src/seasons/fall/glass.ts`: the lip mesh goes out from 8.0 mm (beside the scene) to 8.8 mm (at the front) above the collar's line, over 1 mm, and 0.08 of it stays below (`lipFootMm`, `lipFootFadeMm`, `lipFootLeft`, `lipFootFront`). That part of the lip showed as a bright green band under the ground's edge, where the approved's base stands over the glass.
- `src/particles/draw/cards.ts`: a bat is not drawn along its path through the shutter (`batStreak`) and keeps `batEdge` of a pixel's softness; a spark's halo at rest is faint on most sparks and full on a few (`restHaloFaint`, by the same number that sets the halo's radius). Only the bat and the spark branches changed.
- `src/particles/draw/looks.ts`: spark `restGain` 9, `restCore` 0.08, `restHalo` 0.3, `restHaloVary` [0.6, 2.6, 4], `restHaloShare` 0.12, `restHaloFaint` 0.3, `restHot` [1, 0.8, 0.5], `restHotWide` 1.2, `restOutField` 0.05, `restOutScene` 0.95; `batStreak` 0, `batEdge` 0.35, `batRestTilt` 0.45, `batRim` 0.6; `leafRestMm` [1.35, 2.75, 4.5], `leafMost` 0.43.
- `src/particles/engine/kinds.ts`: bat `sizeMm` [4.6, 6.1], `cruiseMmS` 5.7, `reachMm` 13.5.
- `src/seasons/fall/veil.ts`: the leaf colour's blue 0.075.

## How a bat's place is set
A bat circles the globe's axis (engine `wanderAt`, not this branch's file): ring = `reachMm` times a share of its own, angle = `cruiseMmS` over the ring times the time plus a phase of its own, height of its own. Only `cruiseMmS` and `reachMm` are in the kinds line. With the angle each bat has at the rest still's time (about 14.4 s) as u = 14.4 times cruise over reach, the upper bat turns 1.28 for each 1 of u and the lower 1; the two bats' angles cannot be set apart. Read off the samples: at reach 32 the upper bat's place was not smooth in cruise (two places, about (1085,181) and (878,225), changing between cruise 26.33, 26.36, 26.38 and 26.40). At reach 13.5 it is smooth. The fit over cruise and reach finds no pair that puts both within 20 px; the best it finds is about 30 px each, within its own error of 15 px.

## Still short of the approved, worst first
1. Sparks: points outside the crown box and the smallest class, see the report's counts. The approved's fine points are mostly pale specks that are not orange blobs; a brighter mote colour and more sparks in the open air were tried and did not raise the peaks outside without raising the smallest class.
2. Bats' places: upper 44 px, lower 32 px from the approved's.
3. Leaves: the small class is not larger than the large class in the blob count; the skew of `leafRestMm` did not move that count in five trials (the count follows the bright orange patches, and the sparks' halos when they are large).
4. The warm pale band along the upper left rim: the shell or the room, not the air; left to the glass's owner.

## Not seen
- The bats in motion: the film was not rendered with the slower, tighter ring. Their turn is about 0.42 to 0.54 radians a second now (was about 0.8 to 1.0).
- The lip with the ball turned, and at the storm other than the landed still.

## The spark trial after the fourth list (c13801a0, pushed as 1ba316ee)

What it does: at rest, sparks under the clear ones (own number from 0.22 on) keep 0.3 of their light (`sparkRestFine` in looks.ts, one line in the card's vertex stage) and are tinted pale gold (`spark.restFineHot`, `spark.restFineSeen`, one line in the spark's fragment stage). The storm is untouched.

Reads at hd, review tier, 7a5fd873 to c13801a0, approved in brackets: smallest orange class 326 to 318 (206); points outside the crown box 825 to 1042 (1484); miniature's M3 share 0.893 to 0.917 (main without my change 0.922).

Tried on the way: the same points left orange (smallest 375, outside 1007); dimmer and more of them (395, 1067); a whiter tint (290, 1075) which read as snow by eye and was dropped.

Open: the fine points are paler and cooler than the approved's. Bats stay 44 px and 32 px off, accepted by the root. Next list: the leaves' lengths in three boxes.

## Fifth list: the leaves' size and the open air (88d314f5)

Whose leaves: the air's. With the air's leaf count at 1 the tree is bare and the glass holds no leaf.

The measure (`/tmp/w/s4/leaflen.py`, not in the repo): orange blobs at hd with no hot core, a hard edge, 36 px or more and longer than wide by 1.3; length is four standard deviations along the long axis. It finds few leaves and it also takes soft spark discs and clusters of leaves for large ones, so read it as a pointer. Boxes in hd pixels: left of the crown x 700 to 930, y 130 to 330; over the roof x 660 to 900, y 330 to 440; over the fence x 640 to 830, y 560 to 700 (blobs that lie on the bare scene's orange ground are left out there).

The approved's lengths, median (count, largest): left 12.9 px (4, 14.1); roof 12.7 px (6, 29.4); fence 11.7 px (5, 24.0). Large is over 19.3, 19.1 and 17.5 px: the approved holds 0, 2 and 1.

Mine before to after: left 23.4 to 15.4 (1.82 to 1.20 of the approved's); roof 18.3 to 14.5 (1.44 to 1.13); fence 15.4 to 13.9 (1.32 to 1.19). Large: 6 to 6, 3 to 2, 0 to 0. The six in the left box are, by eye at three times, a cluster of four leaves, three soft discs and two pairs; not one single leaf over 19 px was seen there.

How: `leafRestMm` [0.9, 1.8, 6]; `leafRestPx` 11 caps a leaf's half length at rest (the ball's lens swelled the deep ones); `leafLieSize` 0.6 for a leaf that lies. One line in the card's vertex stage.

The open air (aligned pair, medians, approved then before then after): upper right 62 68 65, 41 52 48, 46 48 49; right of the tree 50 49 47, 38 60 47, 52 53 48; upper left 64 55 42, 57 68 51, 66 59 52; low right 101 123 90, 74 102 70, 86 99 72. It is the mist of `glass.ts` (mine by grant): `mistTop`, `mistLow`, `mistHigh`. `mistHigh` moved nothing that I could read.

Open: the approved holds more leaves; upper right and low right are still short of the approved's red; the smallest orange class rose 318 to 396 with this list.

## Sixth list: the band, the near discs, the small sparks, the low glow (10ea1ac5)

The band by the left rim (hd x 640 to 710, y 400 to 510) was found by taking each layer off in turn: the low mist 4 levels, the ground fog 2, the fog's back haze (`look.fog.haze` in `glass.ts`) 27; the ring cover, the rim tint, the wall tint, the arcs, the air's dust and the lights' dust none. Mended by the haze's height: `hazeMm` 12 to 4.8, `hazeLumpMm` 16 to 7, `haze` 0.016 to 0.036 so the low part keeps its light. Median 72 (70 73 60) to 55 (52 57 48); the approved 57 (55 57 54).

The low glow behind the cottage (x 986 to 1049, y 478 to 579): 96 100 76 to 115 125 96; the approved 127 143 104. It comes from the low standing part of the mist only: `mistStand` 2.4 multiplies the standing term of the density, `mistLow` is green, `mistLowFrom` keeps that colour to where the mist stands. `mistMm` at 22 lifted the open air and was taken back out.

The near discs. The approved's widest, by the radius where the level falls half way to the ground, at hd: 50 px at (905,155), 44 at (1222,298), 26 at (808,256), 26 at (691,308), 24 at (737,229); then 22, 18. Faces 125 83 46 to 209 121 58 over a ground near 55 54 45. Mine: 28, 28, 26, 24, 22, then 18, 18, 16; faces near 175 103 57. About ten in the upper half: six at the upper left, one at the top, three at the right, none over the cottage's face (`nearField`, `nearRightAt`, `nearCottage`). A disc's blur is `nearC` times `nearPx` mixed by a hash to the power `nearSkew`. Four trials of `nearPx` and `nearSkew` did not move the widths; by my reckoning, not proven by a trial, the four ranges all gave near 14 px at the middle of the hash. The approved's two widest (44 and 50) are not matched: the step I would try next is a long top to the range (`nearPx` [10, 40] with `nearSkew` 3).

The smallest orange class (1 to 3 px of the aligned pair, r over 120, r over 1.3 g, g over 1.3 b): 396 to 308; the approved 206. By region mine then the approved's: rim 45, 33; roof 32, 10; tree 102, 61; air 129, 102. With the whole air off the scene alone counted 151 (rim 27, roof 20, tree 67, air 37), read before the base's ninth push. Its colour: the approved 137 90 64, mine 135 95 65. Many of mine are the hot middles of larger sparks, where only a few pixels pass the orange test. The count moves with the ground behind the sparks: the same sparks read 295 on a lifted air and 346 on the lowered one.

The upper air with discs, leaves and sparks masked, aligned pair, medians r g b (luma), the approved then mine: upper left 42 52 44 (49), 56 55 52 (55); top middle 41 51 51 (48), 47 49 49 (48); upper right 45 59 63 (57), 47 49 50 (48). The mask takes 12 percent of the approved's upper left and 32 percent of mine and still leaves dim discs and halos in. Taking layers off at draft, upper left, top, upper right: all on 46, 48, 44; mist off 34, 36, 35; the fog's haze off 41, 46, 41; the air's dust off 46, 48, 43; the whole air off 28, 33, 33.

The leaves. The counter (`/tmp/w/s4/leafcount2.py`, not in the repo) reads the approved 9, 12, 6 in the three boxes; mine before 15, 19, 20, now 14, 12, 18. It takes the scene's own orange for leaves: with the air off it reads 2, 0, 8. By eye at three times the fence's box holds about five in the approved and about seven in mine. `leafRestShare` 0.95 to 0.8; `leafRestFence` thins the leaves low by the fence at rest.

Open: the two widest discs; the low glow is 12, 18, 8 short; the smallest class is 100 over, of which the scene's own share is the larger part; the upper left's red stands 14 over the approved's; the approved's air has green patches in the middle height that mine does not.

Not seen in this list: anything in motion. The storm was seen only as the landed still.
