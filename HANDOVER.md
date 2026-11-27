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

## Seventh list: the upper air's hue, points against specks, the long top of the discs, the low glow, the left leaves (faf1f7d8, merged with main ade42c8f as a1f02de5)

All numbers below are from the review still of fall at rest drawn on a1f02de5; it is byte for byte the trial still drawn before the merge.

The upper air (discs, leaves and sparks masked; medians r g b and luma, the approved then mine): upper left 42 52 44 (49), 49 59 52 (56); top middle 41 51 51 (48), 40 53 51 (50); upper right 45 59 63 (57), 44 61 63 (57). Red stands under green and blue in all three. Done in the mist of `glass.ts` alone: `mistTop` and `mistHigh` are tinted, and `mistEast` with `mistEastMm` lifts blue over the right side. The haze is not the lever: raising `hazeMid` lifted the upper left by 7 levels. Root accepted these colours; leave them.

Sparks against specks. Bright points 40 over their ground: 550 at 183 149 119, the approved 572 at 192 141 108. The small orange class: 266, the approved 206; of mine 187 lie within 3 px of a point (the approved 171) and 79 stand alone (the approved 35). How: `sparkRestClear` [0.35, 0.39] shows most sparks at rest; `restCore` 0.13 and `restGain` 6.2 make them small and hard; the ember skirt goes by the spark's size, `restHaloVary` [1, 1.5, 8] with `restHaloFaint` 0, so only the largest keep one; `restHotWide` 3 and `restHot` [1, 0.77, 0.6] give the largest a paler middle. `sparkRestFine` now does nothing, since its start lies under the clear ramp; it is left in place and can be taken out.

The points' width over half rise as shares (aligned pair; 1 to 2, 3 to 4, 5 to 6, 7 px and over): the approved 18, 26, 16, 41 percent; mine 21, 31, 13, 35. At hd in the upper left (1 to 3, 4 to 8, 9 to 15, 16 to 30, 31 px and over): the approved 8, 25, 25, 24, 17 with middles 100 97 86, 140 113 92, 138 117 107, 136 118 99, 128 89 47; mine 15, 28, 22, 22, 13 with 102 89 76, 140 117 98, 155 133 113, 152 142 118, 104 51 39.

The specks that stand alone. With the sparks off they count 95, with the leaves off (`leafRestShare` 0) 56 against 80 with them on, so the leaves carry about 24. They are not the small leaves: a floor that faded every leaf under 4.5 px of half length took away one speck and was removed again. They are parts of whole leaves (a lit edge, a leaf seen edge on). The rest lie over the tree and the roof by region (with the sparks off: rim 36, roof 32, tree 94, air 42 of the class); which file of `src/seasons/fall/mini/` draws them was not traced.

The near discs. The size of a near spark had its hash tied to the hash that picks the near ones (`h.y`), so the range could not reach its top; it now has its own (`h2.w`). The trial that proves the range moves the widths: at `nearPx` [18, 42] the six widest read 58, 52, 54, 44, 42, 46 px against 28, 28, 26, 22, 18, 18 at [9, 21]. Now `nearPx` [8, 44] with `nearSkew` 2.4: 44 px at (717,261), 34 at (1059,188), 30 at (834,169), then 24, 24, 20, 16, 16; the approved 50, 44, 26, 26, 24, 22, 18. They are dim (`restDiscSeen` 0.08, faces 81 to 130 over grounds 45 to 87) and cover a little of what is behind them (`restDiscCover` 0.15), since light alone turned them pink over the green air.

The low glow (x 986 to 1049, y 478 to 579): 125 143 103, the approved 127 143 104. By the standing mist alone: `mistLow` [0.24, 0.42, 0.135], `mistStand` 3.4. By layers at draft: all on 113 128 99, mist off 99 101 79, haze off 90 114 75; the haze also carries 11 levels of the upper left, so it was not used.

The leaves by the counter: left 10, roof 17, fence 18; the approved 9, 12, 6; the scene's own orange reads 2, 0, 8 with the air off. So left 8 against 9, roof 17 against 12, fence 10 against 6. `leafRestShare` 0.8 to 0.95.

The band along the inside of the outline at the upper left is not the air's. Cut along the radius at bearing 135 from (958.5, 417.5): the approved has its outline at 355 px, air at 57 (67 55 44) right up to it, and a thin crest of 75 (81 75 62) 2 px inside, 9 px over half rise. Mine has the outline at 340 px, air at 69 (62 71 58), and a band 20 px over half rise with its crest at 139 (166 136 101) 13 px inside the outline. With the whole air, the mist and the fog off the band stands the same (21 px, crest 131 at 164 127 86). In fall's `glass.ts` the arcs add about 9 levels to the crest; the rim tint and the ring cover change only the outermost 6 px. So it is the shell's or the room's light at the limb (`src/globe/shell.ts`), not mended here.

The landed still with and without this list, both on a1f02de5 at review: of 2,073,600 pixels 15,132 move at all (0.73 percent), 4,873 by more than 8 levels (0.24 percent), 2,703 by more than 24; 13 of those over 8 lie outside the glass.

The storm in motion: five film frames in a row, 2148 to 2152 (shake-3), preview format, draft tier, on a1f02de5 (`fall-storm-strip.jpg`). The storm stands in the family of the approved shake: dense orange strokes over pale green air, the miniature seen through it. The glass and the miniature swing between frames and the bat near the top moves by 12 to 25 px a frame. Between neighbours 82 to 85 percent of the pixels inside the glass move by more than 8 levels and about half by more than 24; single leaves could not be followed by eye from frame to frame, so whether the storm reads as flow or as flicker at film speed is not settled by this strip. The landed pair moves by one spark of 13 px outside the glass's circle, at (1253, 652) on the lower right limb.

Proofs on a1f02de5: tsc 0; M3 fall-rest 0.8047 (miniature 0.927); strict pass for fall-rest and fall-shake; M4 0.9694, 0.8676, 0.9562, 0.9586; M5 0.9934, 1, 0.9761, 0.9996; vitest 68 files passed, 1 skipped, 943 tests passed, 8 skipped (four more skip here in `tests/mix.test.ts` without the sound tracks); triangles at high 1,799,613. Draft stills: the six of winter, spring and summer equal the guard list of ade42c8f; fall-rest d6cbaa19ce28ba70, fall-landed 4f35e4f988492da0.

Open: the points are paler than the approved's (183 149 119 against 192 141 108) and fewer of them carry the soft orange glow the eye sees in the approved; 79 specks stand alone against 35; the roof's and the fence's boxes hold more leaves than the approved's; the upper left's medians stand 7 over the approved's in each channel; the two widest discs are 44 and 34 px against 50 and 44.

Not seen in this list: the film played; only the five frames above. The storm's own numbers were not changed.

## The merge with summer's air (4e8b1336)

Summer's air (6ba34474) and the seventh list both changed three places in `cards.ts` and one in `looks.ts`. Resolved so that a light keeps every term summer's air gave it and a spark every term of the seventh list: the near size line carries summer's far softness for a light and the spark's own hash (`h2.w`); the disc closes in the storm for a light and `lid` is declared after it; the cover is one branch for a spark (with the lid inside) and one for a light (with the storm's hide), so that neither changes the other's arithmetic. In `looks.ts` the glow line and its comments are summer's, the spark line is fall's.

Proved at draft, hero, hd. Fall on the merged tree equals fall on main 3170155e with the seventh list alone (78bd9db7): fall-rest 0be7d8c0e55c5a56, fall-landed da572167d7d29c5c. Summer on the merged tree equals summer on main 3170155e with summer's air alone (a local trial merge, not pushed): summer-rest 21530702e84d8d0d, summer-landed c8d8b7e4fe5e44bb. Winter's and spring's four equal the list of 3170155e. On 4e8b1336: tsc 0, strict pass for fall-rest and fall-shake, M4 0.9694, 0.8951, 0.956, 0.9584, M5 0.993, 1, 0.9721, 0.9995, vitest 68 files passed, 1 skipped, 948 passed, 8 skipped, triangles at high 1,796,373.

Summer's air owes one more commit on its branch, a single number `glow.lensFilm` in `looks.ts`: that line is to stay as its branch has it.

The eighth list is given (09:34 and 09:47 UTC): a soft orange glow for each point on a measure of the approved's glow width over point width for ten points; the upper air in patches on a count; the leaves lobed, in three sizes, at every angle, on counts by size and hue; the large discs soft with no edge, on a measure of the edge's width. Measure before dealing; a pair when the glow and the leaves stand.

## Eighth list: a glow for each point, the upper air in patches, the leaves, the soft discs (f20f99c3, 57d80a27, pushed as fa2ea2e2 with main 9e7b660e)

Files: `src/particles/draw/cards.ts`, `src/particles/draw/looks.ts`, `src/seasons/fall/glass.ts`. Nothing else differs from main.

a. The glow. At rest each spark draws a halo whose reach is set in the fragment stage from the spark's own radius (`restHaloReach`, `restHalo`, `restHaloShare`, `restHaloTo`); about one in six is the wide class (`restBigFrom`). A fault found on the way and never pushed: the halo's limit read `vCore.y`, which in a quad is the pixel's own offset and not the card's reach, so halos were drawn as fans cut flat.
b. The patches. `glass.ts` MIST: a tile of 8 mm laid along a lean and bent by the mist's own noise, two lookups, one darkening (`mistDealDark`, `mistDealDarkBy`) and one greening (`mistDealGreen`, `mistDealGreenBy`); only the upper mist is dealt, the low standing mist is left.
c. The leaves. Size by the outline's own number (`leafRestMm` [0.7, 4.2, 2.6], `leafRestPx` 24), maple share at rest `leafRestMaple` 0.1, a roll at rest so the angles are dealt, hues dealt gold, orange, red (`leafGold`, `leafOrange`, `leafRed` and their `From` pairs). The storm keeps its own hues (`leafStorm...`) and `maple.share`.
d. The discs. `restDiscSoft` 0.5 over `restDiscSoftPx`, tint `restDiscTint`.

Measures at hd, review tier, on fa2ea2e2, the approved then mine. Points in the left air: 90, 97; point width 25/50/75 1.3 1.7 2.3, 1.3 1.6 2.2 px; glow width 3.2 3.9 10.9, 3.4 4.0 9.5 px; glow over point 1.9 2.5 4.3, 2.2 2.6 3.7. Small orange class 206, 414. Upper boxes: left 49, 54; middle 48, 46; right 57, 50. Green patches 14, 15. Leaves found in the upper left quarter of mine 19: under 12 px 10, 12 to 20 px 7, over 30 px 2, largest 34; gold 4, orange 9, red 6; level 42 percent, upright 31. Disc edges mine 3.1 px (0.20 of the radius) and 8.7 px (0.36), the approved's 5.2 and 6.1 (0.21, 0.27).

Proofs on fa2ea2e2: six guard stills equal main's list, fall-rest f2d573d57dfed682, fall-landed 34b0a09a08f4aff6; strict pass; M4 0.9694, 0.8951, 0.9571, 0.9594; M5 0.993, 1, 0.9666, 0.9997; M3 fall-rest 0.9129 at review with the miniature's share 0.943 (main 0.957); triangles 1,765,827; tsc 0; vitest 68 files passed, 948 tests passed, 8 skipped (four mix tests skip here for want of the film's tracks).

Still short, worst first: the leaves are larger and more crowded at the upper middle left than the approved's, and fewer are gold or lobed; the small orange class is twice the approved's; the patches are blotches, not thin streaks; no dim glow without a centre is made; M5 of shake-3 is 0.008 under main's.

Not seen: the film played; anything above hd; the lip and the air with the ball turned.

## Ninth list: the leaves at rest taken back, the glow dealt, streaks in the upper air (4f04e5f1, proved on c63f3770 with main 4f95670b)

Files: `src/particles/draw/cards.ts`, `src/particles/draw/looks.ts`, `src/seasons/fall/glass.ts`. Nothing else differs from main.

What changed. Leaves at rest: `leafRestShare` 0.64 (was 0.95), `leafRestMm` [0.65, 3.5, 6.5] (was [0.7, 4.2, 2.6]), `leafRestPx` 15 (was 24), `leafRestMaple` 0.18 (was 0.1; by eye 7 of about 38 leaves in the approved's upper left quarter are lobed), `leafMapleHue` [0.55, 1], `leafFace` 0.45 (was 0.32, so fewer leaves are seen on edge). Points at rest: the glow goes to the wide class (one in six), to `restGlowShare` 0.04 of the others and to every point out of focus (`restGlowPx` [0.7, 0.95] px of blur); the others are bare with the tint `restBare` [1, 0.57, 0.46]. Mist: the deal's noise is seven times finer across the lean (`mistDealLean` fourth number) and 0.3 along it; a grain of the same noise at `mistGrainMm` 5 under it (`mistGrain` [0.2, 1.8]).

Counts at hd, review tier, the same counter on each, as approved, main (4f95670b), mine (c63f3770).

1. Leaves. Window x 700 to 860, y 230 to 400: 10, 17, 11 leaves; longest 23.1, 33.2, 22.9 px; classes (under 12, 12 to 20, 20 to 30, over 30) 7 1 2 0, 7 6 3 1, 5 3 3 0. Upper left quarter (x 600 to 958, y 60 to 417): 29, 31, 25 leaves; classes 17 7 4 1, 13 13 4 1, 16 6 3 0 (the approved's one over 30 is a streak at the rim and no leaf). Over the upper glass 88, 110, 85. The counter (`leaf3.py`: orange blobs with a sharp edge, 7 px or longer) misses dark leaves and leaves that lie over a glow, and joins a leaf with a disc it touches; by eye the window holds about 13 leaves in the approved and about 20 in mine with the thin dark ones, about 14 that read as leaves.

2. Points. Small orange class over the whole glass 206, 273, 243 (the bar is 165 to 247). By region: rim 33, 24, 37; roof 10, 25, 20; tree 61, 104, 103; air 102, 120, 83. With all of fall's air off the scene and the glass alone read 169 (rim 30, roof 17, tree 87, air 35). Points found in the left air 90, 98, 105; point width 25/50/75 1.3 1.7 2.3, 1.2 1.6 2.2, 1.3 1.7 2.5 px; glow width 3.2 3.9 10.9, 2.7 3.7 5.9, 3.3 3.9 9.4 px; share with a glow over four times the point 27, 9, 20 percent; the middle class (2.5 to 4.5 px wide) glow 13.4, 6.2, 9.8 px.

3. Upper air. Streaks crossed along the rows y 150, 200, 250 (green over its own wide median, warm things left out): 4 6 14, 0 0 0, 2 10 9; their width 3 3 4 px, none, 12 5 6 px. Grain (the luma's step between neighbours, median and ninth tenth): 2.1 6.6, 0.7 1.9, 1.0 3.1. A finer grain (tile 2.5 mm) put 35 more pieces into the small orange class (rim 35 to 59), so it was not kept.

4. M5 of shake-3 at draft: main 0.9811, mine 0.9846. Each part back to main's once: the glass 0.9846; the leaves' numbers at rest 0.977; the glow off 0.9846; the discs hard 0.9846; the cards and looks whole as main's 0.9811. It is the leaves at rest (c) that move it: the eighth list's large ones took it down, the ninth's fewer and smaller ones leave it above main's. Nothing was taken out of the storm.

5. The miniature's share of M3 at review: main 0.957, mine 0.924. Each part back to main's once: the glass 0.935; the leaves' numbers at rest 0.937; the glow off 0.937; the discs hard 0.924; the cards and looks whole 0.946. Three items cost about a third each (streaks, fewer leaves, bare points); it is not back at 0.95.

Proofs on c63f3770: six guard stills equal main's list (winter 0cab5cd137ba09d9, a7ab4af383606ed0; spring 78ee21faa1da0061, c9d7c918a050607a; summer 086768daf3d1707d, ea9ae9d60385cd0d); fall-rest 850ceb14c75b767d, fall-landed da57001a29034654; strict pass; M4 0.9694, 0.8957, 0.9567, 0.9592; M5 0.993, 1, 0.9846, 0.9998; M3 fall-rest 0.8838 at review (base 0.884, miniature 0.924); triangles 1,765,827; tsc 0; vitest 68 files passed, 948 tests passed, 8 skipped (four mix tests skip here for want of the film's tracks), 294 s whole.

Below the bar, worst first: the miniature's share of M3 (0.924 against 0.95); the streaks are 5 to 6 px wide against 3 to 4 and the top row holds 2 against 4; the grain is half the approved's; the points found are 105 against 90 and the 75th width 2.5 px against 2.3 (main 2.2); the air's region of the small class is 83 against 102 (main 120); the quarter holds 25 leaves against 29 (main 31); by eye mine still holds more leaves in the window than the approved; the fine points' middle is dimmer than the approved's ([127, 94, 86] against [162, 110, 93]).

Not seen: the film played; anything above hd; the lip and the air with the ball turned; which moment of the shake shake-3 reads.

Tools of this list (in /tmp/w/s10, not committed): `leaf3.py` (the leaf counter), `grid.py`, `streak.py`, `tr.sh` (a trial), `mainstill.sh` (main's still), `sw4.sh`, `swset.sh`, `swsub.sh` (the switching), `off.sh` (the air off).

## Step A after the ninth list: the glass back at main's (a746190b, main bbdd4b03 in it)

The lead held the ninth list for the streaks of the upper air only: at 400 px they read as an even slanted hatch over the sky and the crown. `src/seasons/fall/glass.ts` is main's file again. `src/particles/draw/cards.ts` and `src/particles/draw/looks.ts` are as the ninth list left them (the leaves at rest, the dealt glow, the bare points).

Counts at rest, review, hd (the approved | main | step A): leaves in the window x 700 to 860, y 230 to 400: 10 | 17 | 11, the longest 23.1 | 33.2 | 22.9 px. Upper left quarter: 29 | 31 | 24. Upper glass grid: 88 | 110 | 86. Small orange class: 206 | 273 | 200 (rim 33 | 24 | 23, roof 10 | 25 | 20, tree 61 | 104 | 101, air 102 | 120 | 56). Points found: 90 | 98 | 98. Point width 25/50/75: 1.3 1.7 2.3 | 1.2 1.6 2.2 | 1.2 1.7 2.4 px. Glow width: 3.2 3.9 10.9 | 2.7 3.7 5.9 | 2.9 3.7 9.4 px. The fine points' middle: [162, 110, 93] | [126, 98, 78] | [130, 96, 85]. Streaks on rows 150, 200, 250: 4 6 14 | 0 | 0. Grain: 2.1 6.6 | 0.7 1.9 | 0.7 2.0.

Proofs on a746190b: the six guard stills equal main's list; fall-rest 1329342597a8f2f4, fall-landed da57001a29034654; strict pass; M4 0.9694, 0.8957, 0.9567, 0.9592; M5 0.993, 1, 0.9846, 0.9998; M3 fall-rest at review 0.8838 (base 0.884, miniature 0.935, the lead's floor for this head 0.92); triangles 1,765,827; tsc 0; the whole vitest green in one run (68 files, 948 passed, 8 skipped, 296 s; steps.test.ts did not stop at its limit, its longest test 136 s).

Motion at 3840: film B, frames 2700 to 2705 (the hold of fall, 9.0 s after the landing of shake-3, the camera's travel 0.02 to 0.03 px a frame), uhd, tier final, 24 samples, about 132 s a frame here. Drawn on a746190b and on main (cards.ts and looks.ts as on bbdd4b03). The masters never draw the still's rest moment (12 s after the landing): the hold of fall ends 9.6 s after it. Boxes at 3840: upper air x 1340 to 1790, y 330 to 800; the crown x 1790 to 2400, y 400 to 860. A step: the largest channel moves by more than 12 levels between neighbours. A one frame event: in one channel the pixel is more than 12 above both neighbours in time, or more than 12 below both.
- Upper air: steps, mean of five pairs, main 12.37 percent, mine 13.18; one frame events, mean of the four middle frames, main 2.07 percent of the box, mine 1.94.
- Crown: steps main 9.01, mine 10.14; one frame events main 1.42, mine 1.38 (frame by frame main 1.412 1.387 1.371 1.514, mine 1.360 1.358 1.386 1.401: mine is above main's in frame 2703 by 0.015 and under it in the mean).
- In the one crop I looked at (mine, the upper air, frame 2702) the events are short upright dashes where a fine point falls by more than its own width in a frame. By count on frame 2702 a pixel lit for one frame makes nine in ten of them in the upper air and four in five in the crown, on main as on mine. I read them as the points' travel; main's crop was counted, not looked at.
- More pixels step in mine than in main (by 0.8 and 1.1 of a percent of the box): a point with a glow moves more pixels over 12 levels than a bare point does.

Below the bar: the air's region of the small class (56 against the approved's 102; main's 120 is nearer); the 75th point width 2.4 px against main's 2.2 and the approved's 2.3; the grain is a third of the approved's; no dabs in the upper air; the fine points' middle is darker and less red than the approved's; the miniature's share 0.935 against main's 0.957; more stepping pixels than main at 3840.

Not seen: the film played; any frame at 3840 other than these twelve, and those read by the two boxes and one crop of the upper air, not looked at whole; the ball turned; which moment of the shake shake-3 reads.

Tools of this step (in /tmp/w/s12, not committed): `motion.py` (the two shares over a set of frames and boxes), `mainframes.sh` (main's two files, the six frames, back again), `travel.mjs` (the camera's travel over the hold of fall).

## Step B, the tenth list: green dabs and fine grain on the upper air, bright bare points (14cff75e, main 0fda3658 in it; pushed by the lead's word of 17:22 UTC without main 63914740)

What changed. `src/seasons/fall/glass.ts`: the mist's shader gains a grain (cells 1.4 px along each of the wall's two axes, a ladder by the screen's footprint with four cells cross faded, added to the light and signed, `mistGrain`, `mistGrainPx`, `mistGrainLimb`) and eight dabs (`mistDabs`: place, length, times longer than wide, lean, share; `mistDab` the colour), both on the upper air only; the low mist keeps its even glow. `src/particles/draw/cards.ts` (spark): a bare point at rest is lifted by its own brightness and drawn tighter as it is lifted (`restBareLift`, `restBareTight`); no change for summer's `light` and none in the storm. `src/particles/draw/looks.ts`: `restBare [1, 0.57, 0.46] -> [1, 0.37, 0.28]`, `restOutField 0.05 -> 0.15`, the two new numbers.

What I found. The lens works per vertex and the mist's mesh is coarse, so the far wall is seen piecewise affine: the dabs are written on the wall face by face, fitted to the hero camera and the rest moment's open ground; at other cameras they stretch with the faces. The first grain (cells by the footprint's area, multiplied into the mist, 2.2 px) met the two numbers and read as a blotchy weave right of the tree (step at 4 px 4.4 against the approved's 3.2); it was rebuilt per axis at 1.4 px and added, and is now alike left and right. For the fine points a dealt gain did not move the middle (dim embers entered the count); a lift by the point's own brightness did. The ninth list's counter did not count green streaks: of its 24 crossings in the approved about 2 are rim hairlines, about 4 ends or skirts of green dabs, the rest plain ground or edges of leaves, boughs, the bat or a glow; none is a bright thread.

Counts at rest, review, hd (the approved | main | step A | step B). Dabs in the upper left quarter: 9 | not counted | 0 | 8 (length median 19 px, width 9, length over width 2.1). Grain, step at 1 px, median and 90th: 2.1 6.6 | 0.7 1.9 | 0.7 2.0 | 2.1 5.6; step at 4 px 3.2 9.4 | not read | 1.0 5.1 | 3.6 9.2; left and right of the tree 2.2 and 2.1 against 2.1 and 2.1. Small orange class: 206 | 273 | 200 | 245 (rim 33 | 24 | 23 | 29, roof 10 | 25 | 20 | 22, tree 61 | 104 | 101 | 105, air 102 | 120 | 56 | 89). Points found: 90 | 98 | 98 | 96. Point width 25/50/75: 1.3 1.7 2.3 | 1.2 1.6 2.2 | 1.2 1.7 2.4 | 1.2 1.6 2.4 px. Glow width: 3.2 3.9 10.9 | 2.7 3.7 5.9 | 2.9 3.7 9.4 | 2.8 3.7 9.7 px. The fine points' middle: [162, 110, 93] | [126, 98, 78] | [130, 96, 85] | [166, 113, 92]. Leaves in the window: 10 | 17 | 11 | 11, the longest 23.1 | 33.2 | 22.9 | 23.4 px. Upper left quarter leaves: 29 | 31 | 24 | 23. Upper glass grid: 88 | 110 | 86 | 85. The bats unchanged.

Proofs on 14cff75e: the six guard stills equal main 0fda3658's list (and 63914740's, the same six); fall-rest facc6b458cc7988a, fall-landed 1e16b4471b000270; strict pass; M4 0.9694, 0.8957, 0.9567, 0.9597; M5 0.993, 1, 0.9844, 0.9997; M3 fall-rest at review 0.8834 (base 0.883, miniature 0.936 over 105,908 px; the floor 0.935); triangles 1,759,623; tsc 0; the whole vitest green in one run (68 files, 948 passed, 8 skipped, 292.5 s; steps.test.ts did not stop at its limit, its longest test 132 s).

Motion at 3840: film B, frames 2700 to 2705, uhd, tier final, drawn on 14cff75e, read by the same two boxes and thresholds as Step A (main | A | B). Upper air: steps 12.37 | 13.18 | 12.61 percent; one frame events 2.07 | 1.94 | 1.74 percent of the box. Crown: steps 9.01 | 10.14 | 10.37; one frame events 1.42 | 1.38 | 1.31. Under the 12 level threshold: the share of pixels moving by more than 3 levels between neighbours is 25.5 | 31.2 | 30.2 in the upper air and 18.6 | 22.1 | 22.8 in the crown. In the one crop I looked at (x 1400 to 1800, y 380 to 680, frames 2702 and 2703 and their difference at 8 times, beside main's) the grain and the dabs hold still and only the points and leaves show in the difference. Main's frames are of the head before the base's faces; the boxes hold none of the base.

Below the bar: a glow and a leaf in front of the chimney's top and right edge at rest (there since Step A, the approved's chimney is clear; B leaves them as A has them, 0.8 of a level in the chimney's box, 0.19 in the wall's); the 75th point width 2.4 px (approved 2.3, main 2.2: as far as main's on the other side); quarter leaves 23 (A 24, main 31, approved 29); grain 90th 5.6 against 6.6 and the step at 4 px 3.6 against 3.2; the fine points read paler, pinker and more even in size than the approved's orange gold by eye; the ground under them is lighter than the approved's ([52, 58, 48] against [44, 47, 39], the mist's colours left by order); the small class total 245 with 2 to spare; no dabs right of the tree; more stepping pixels than main at 3840 in the crown.

Not seen: the film played; any frame at 3840 other than these six, and those read by two boxes and one crop; the ball turned; the dabs at any camera but the hero's and the film's hold; the tree merged with main 63914740 or with the scene's tenth list.

Tools of this step (not committed): /tmp/w/s15 (`lensfit.py`, `wall.py`, `mkdabs.py`, `place.py`), /tmp/w/s16 (`an2.py` the points, `cmp.py`, `grain2.py` the steps at 1 to 8 px left and right, `blobmark.py`), /tmp/w/s14 (`dabs.py`, `markwin.py`), /tmp/w/s12/motion.py.

## The eleventh list: the chimney clear, the leaves, the points (03969235 on 1ee73b82, main 5d7029b3 in it)

What changed, in `src/particles/draw/cards.ts` and `src/particles/draw/looks.ts` only, all of it at rest.
- The chimney: no spark and no leaf afloat is drawn before it (`spark.restChimneyAt`, `restChimneyWide`, `restOutChimney`, `leafRestChimney`).
- The leaves: a leaf is let go as it turns through its edge (`leafRestEdge`); fewer leaves afloat are dark (`leafRestDarkFrom`); the sizes run larger (`leafRestMm` skew 4.5 from 6.5, `leafRestPx` 17 from 15); more of the leaves afloat are drawn (`leafRestShare` 0.95 from 0.64) with the right side held near main's share (`leafRestRight` 0.42, `leafRestRightFrom` -0.2 to 0.2) and at main's size skew (`leafRestRightSkew` 6.5, in 03969235).
- The points: the bare points are of two families, dealt by place (`restPaleShare`, `restPaleFrom`, `restPaleRim`, `restPaleBy`, `restPaleLift`): warm embers (`restBare` 1, 0.4, 0.235; no finer than `restWarmPx` 0.5 px) and pale beads (`restPale` at the middle, the ember's orange outward by `restPaleWide`; `restPaleDim` of the light and no more than `restPaleMost` at the middle). More sparks stand in the open air (`restOutField` 0.12, `restOutUp` 0.22) and fewer before the crown (`restCrownWide` 0.5, 0.48).

Which commit each column stands on. Approved: `references/approved/fall-rest.png` at hd. Main: 5d7029b3, read on a still drawn on 92247ca7; 5d7029b3 changed only tools, tests and the log after it, and 92247ca7's still is equal to bd0b2fcb's in every pixel above y 563 (the sheaf on the base is below). Main's air is Step B's (14cff75e, merged in chain 36), so the main column is Step B on the merged tree. New: 03969235, the pushed head. It differs from 1ee73b82 only by the size skew of the leaves right of the middle: left of x 886 the two rest stills are equal in every pixel, and in the marked quarter they differ by 41 pixels at three leaves near x 935 to 957. The leaves were marked on 1ee73b82's still and the marks were looked at again on 03969235's. Where Step B stands on its own tree (14cff75e, before the scene's tenth list and the engine's change) it is named so.

What I found.
- The approved's fine points are two families by the colour of the rise at the peak: pale (58 in a hundred, smaller and dimmer, more to the left) and warm (larger, brighter, more to the right). Step B's were one salmon hue.
- The pale ones of the first trials burned to white, and scaling their light from 0.7 to 0.55 left the peak where it was (238 and 241 in red). A cap at the middle (`restPaleMost`) brought the pale peak to 201 against the approved's 200.
- The small orange class in the tree's zone is not the air's: nearly all of it sits on the boughs (the scene's lights and lit bark), and a leaf of mine in front of a bough hides or uncovers three or four of them at a time. The zone moved between 114 and 121 over trials that changed no spark there.
- The automatic leaf counter misses real leaves and marks discs, glints and a crack, on both pictures. The marked pictures by eye stand over it.
- Each fine point has a blue row above and a red row below (the post's fringe, not mine).

The leaves, marked by eye in the upper left quarter (x 600 to 958, y 60 to 417; the approved | Step B 14cff75e on its own tree | the new 03969235). Leaves: 46 | 40 | 40. Under 12 px: 21 | 18 | 22. From 12 to 20: 18 | 20 | 14. Of 20 and over: 7 | 2 | 4. Largest: 34 | 23 | 22. In the upper half: 11 | 4 | 8. Left of x 720: 9 | 3 | 1. Dim or seen on the edge: 3 | 15 | 7. Main 5d7029b3 was looked at in the 3 times view and not marked: about 35, about 6 of them slivers.

The points at rest, hd, review (the approved | main 5d7029b3 | the new 03969235). Found in the upper left: 90 | 95 | 91. Pale and warm: 52 and 38 | 37 and 58 | 47 and 44. Warm, rise at the peak: 173, 111, 76 | 162, 100, 82 | 154, 93, 59; green over red 0.66 | 0.63 | 0.67; blue over red 0.47 | 0.51 | 0.44; the peak itself 219, 157, 116 | 218, 164, 134 | 217, 158, 117. Pale, rise: 151, 129, 120 | 194, 145, 132 | 149, 134, 116; green over red 0.92 | 0.75 | 0.91; blue over red 0.82 | 0.69 | 0.80; the peak itself 200, 179, 162 | 251, 205, 180 | 201, 197, 166. Point width at the 10th, 25th, 50th, 75th and 90th: 1.11 1.28 1.70 2.31 3.55 | 1.07 1.16 1.48 2.36 3.28 | 1.06 1.14 1.58 2.43 3.49; spread of log2 width 0.80 | 0.73 | 0.80. Warm widths at 25, 50, 75: 1.54 1.92 2.63 | 1.08 1.23 1.90 | 1.24 1.86 2.57; pale: 1.16 1.40 2.03 | 1.44 1.61 2.56 | 1.09 1.28 2.14. Glow width at the 75th: 10.9 | 9.2 | 9.2. Rise at 10, 25, 50, 75, 90: 66 93 122 169 195 | 74 95 127 151 168 | 68 87 122 144 161; quartile spread over the median 0.63 | 0.44 | 0.47. Pale share of the fine points: 63 | 33 | 55 percent. Small orange class: rim 33 | 29 | 31; roof 10 | 23 | 21; tree 61 | 109 | 117; air 102 | 74 | 101; total 206 | 235 | 270. Bright points over the ground in the upper ball: 572 | 540 | 497.

Further from the approved than main's, by my own measures: the 75th point width (2.43 against 2.31, main 2.36); the upper rise (the 75th 144 and the 90th 161 against 169 and 195, main 151 and 168: the cap on the pale ones flattens the top); the count of bright points over the ground (497 against 572, main 540: the pale ones are dimmer); the small class in the tree's zone (117 against 61, main 109) and with it the total (270 against 206, main 235; outside the tree's zone the three parts sum to 153 against the approved's 145 and main's 126); the counter's leaves by the fence (20 against 6, main 17).

The floor that broke on the way. 1ee73b82 read M5 of shake-3 0.9863 against main's 0.9878: three seconds after the landing its leaves hid 2018 pixels of the miniature against main's 1795. Fewer leaves right of the middle (`leafRestRight` 0.3, firmer keep-outs before the cottage and the fence) brought M5 to 0.989 but the miniature's part of M3 to 0.987, under the merged tree's 0.989, so that was dropped. 03969235 keeps the count and gives the leaves right of the middle main's size skew: 1724 hidden, M5 0.9883, the miniature's part 0.990. The two floors pull against each other: leaves before the miniature add to its sharpness at rest and hide it after a landing. Both hold by a small margin, so a change to the leaves' count or size reads both again.

Proofs on the pushed source (f86bc5ea: 03969235 with main 680ad25b merged; main's changes since 5d7029b3 are tools, tests, kit and status only).
- Guards, draft, hero, hd, drawn on 03969235: winter-rest 0cab5cd137ba09d9, winter-landed a7ab4af383606ed0, spring-rest caa42db060e03278, spring-landed bfda838820e392ab, summer-rest ac0bba01734380a6, summer-landed 261877d76a8ca74d (the six equal main's list). Fall's two: fall-rest e1d407107ca8c42b, fall-landed ed8d97048b9e0fc8.
- M3 fall-rest at review 0.9159 (base 0.916, miniature 0.990). Strict: pass for fall-rest and fall-shake. M4 of shakes 1 to 4: 0.9694, 0.9434, 0.9571, 0.9608 (main's). M5: 0.9923, 1, 0.9883, 0.9998 (main's 0.9923, 1, 0.9878, 0.9998). Fall at high: 1,786,164 triangles (main 1,786,236). tsc: 0. Vitest on the merged tree: 68 files passed and 1 skipped, 967 tests passed and 8 skipped of 975, 290 s, no stop of the steps test at its 300 s limit.
- Motion at 3840, read on 1ee73b82 and not on the pushed head: film B frames 2700 to 2705, uhd, final; upper air steps 11.736 percent, one frame events 1.556; crown steps 9.876, events 1.157 (Step B on its own tree: 12.61, 1.74; 10.37, 1.31). Main's frames on the present tree are not drawn.

Below the bar. The leaves: 40 against the approved's 46, the largest 22 px against 34, 1 leaf left of x 720 against 9. The points: by eye the approved's are orange gold, nearly each with a small orange glow round a bright middle; ours are paler and harder, beads more than embers, and the larger glows are pinker than the approved's amber. One dim red leaf stands at the chimney's left edge (taken for a leaf that lies; not verified). In the film's camera a glow stands at the chimney's upper left corner (frame 2702 of 1ee73b82): the keep-out is fixed to a place on the lens, fitted at the hero camera.

Not seen: the film played; 3840 beyond the six frames of 1ee73b82, and those read by two boxes, one crop and one reduced whole frame; any 3840 frame of the pushed head at the time of the push; the ball turned; other cameras; a fresh reviewer (the pass was my own).

Offered to round two: the chimney's keep-out tied to the chimney's place in the ball; leaves at the far left and of 25 px and over (pulls against M5 of shake-3); a small amber skirt on the fine points; whether the red leaf at the chimney lies or floats.

Tools of this step (not committed): /tmp/w/s17 (`t.sh`, `quick.sh`, `q2.sh`, `rd.sh`, `points3.py` the points parted warm and pale, `markleaf.py` with `leaflist.py` the marked leaves, `mklooks.py`, `zoom.py`, `treepair.py`, `speckmark.py`), /tmp/w/s12/motion.py.
