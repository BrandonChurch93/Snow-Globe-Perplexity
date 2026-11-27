# Fall base, handover

Branch agent/p6-fall-base, head c291a11c: the shader commit d2878876 with main 35d00e1b merged in (fall's scene fifth list and air fourth list). The fifth list changed src/seasons/fall/base.ts only. The mesh is as on the fourth list, whose asset script change still stands: `npm run make -- base-fall` must be run and its files committed by /root (80910 triangles, 1448 more than main's 79462; public glb 1348780 bytes, sha eb905811891fd477 on this VM).

## The fifteenth step, item 2 of the fourteenth order: the pumpkin faces (about 16:00 UTC), the newest head
- Head f213dfce: commit 93dbd9d9 (src/seasons/fall/base.ts, assets-src/base-fall/maps.mjs, RECIPE.md) with main 6d459061 (chain 32) merged in. The faces map changed, so `npm run make -- base-fall` changed and /root remakes. The mesh is as it was: 77,762 triangles, none spent.
- What changed. Shader: no glow round the cuts; the cut edge is antialiased over 0.6 of a pixel; the rind's cut wall is a dark red rim with a hard step to the hollow; the hollow is yellow with mottled pulp; the skin has eight meridian grooves and fine streaks in colour, ember and tilt; a thin line of ember where a gourd turns from the eye or meets the iron. Map: the carvings redrawn as slanted eyes of unlike size, a small nose, a crescent grin with ragged teeth.
- Numbers at review on f213dfce: M3 fall-rest 0.9573, base 0.970 (fourteenth 0.883), miniature 0.957. Face columns over approved, twelfth, fourteenth, fifteenth: x 728 to 786 0.41, 0.33, 0.81; x 960 to 1018 0.60, 0.62, 1.14; x 1018 to 1076 0.21, 0.24, 0.67; x 1134 to 1192 0.54, 0.56, 0.93. Flank runs 4.9 and 5.0, 90th percentile 105.5 (kept).
- Proofs on f213dfce: tsc clean; the whole vitest 948 passed, 8 skipped, 288.8 s (steps test 129 s); eight draft stills, the six others equal chain 32's list, fall-rest 7727bc3ba0df32df, fall-landed 9505f2e040e78c03. On e71342d9 with the same files: strict pass, determinism pass, stand-ins black, four frames at 3840 final.
- Short: the column x 1018 to 1076 reads 0.67, under the bar of 0.8 (0.73 without the two rows under the face, where approved has a white twig). The grooves read as broad dark bands, hard stripes at 3840, where approved has fine streaks. The hollow is paler and more yellow than approved's. The third gourd is brown where approved's is blue black.
- A correction: the column x 1260 to 1320 of the earlier reports is not a face, it is the flank right of the third face. The third face is at about x 1125 to 1195.
- Next: item 3 the sheaf, item 4 the wall, item 5 the web, each its own commit.

## The fourteenth step (about 14:20 UTC)

/root held the thirteenth (efca8b82) at 13:20 for one thing: the vines read grey (flank runs 6.0 and 5.6, 90th percentile 133.3). The fourteenth is that one thing and nothing else: commit e3414aeb (base.ts, two lines: BRAMBLE.SOFT 0.85 to 1.18, the soft light's power 18 to 60, its bead 0.6 + 0.9 to 0.3 + 1.7), then main 06954500 and bbdd4b03 merged (status files only). The mesh is the thirteenth's; make base-fall is still owed by /root.

Proofs on bbd70386 (e3414aeb with main 06954500, local make): M3 at review 0.8835, base 0.883, miniature 0.957; tsc; whole vitest 948 passed, 8 skipped; strict pass; determinism pass; stand-ins black; draft stills fall-rest fdcfa55bae4d4cd2, fall-landed c6cfb98c9d3c1690, the six others as the list of b22b5be4; frames 2364 to 2367 at 3840 final.

Measures (flank box x 1190 to 1330, y 760 to 920): runs 4.9 and 5.1, 90th percentile 105.0, median 19.4 (approved 3.7, 4.8, 113.3, 34.6). Neutral pixels of x 1080 to 1260, y 700 to 1010 (neutral.py): 75th percentile 31.1, 90th 88.7 (approved 33.0 and 94.4, twelfth 35.6 and 92.2, thirteenth 48.9 and 115.0). The light cut square to four vines (perp.py): 3 to 4 px over half of its peak, the thirteenth 5 to 6. Cells: 1.02 2.25 1.34 0.99 / 0.80 0.58 0.47 0.74 / 1.11 1.05 1.21 1.23.

Tries (t15.py makes base.tN.ts from base.s14.ts): power 60 with the old strength read base 0.789; power 60 at 1.05 read 0.835; the bead at 8 per mm read 0.871 but is finer than the proven 6; power 76 and 110 narrow the light to 2 to 3 px and bring the 90th percentile to 101.0 and 96.0, outside ten of approved's. base.t7.ts is the pushed one.

Still wrong: the light is bright at its peak (about 160 to 230) and broken, so the vines lean toward wet where approved's are matt with a soft grey; the flank's median is low; everything listed under the thirteenth except the band.

Next, /root's order of 13:20, after this push: (2) the pumpkin faces: hard edged cuts with the rind's thickness as a darker rim, ribs on the skin, the three 60 px columns (x 720 to 780, 1020 to 1080, 1260 to 1320) to 0.8 or more by form, not by gain; (3) the sheaf: 9 to 13 lines of 1.6 to 2.0 px across the counted row, curled and crossing; (4) the wall: fewer and larger smooth facets with one glossy edge each, no grain finer than 3 px at hd; (5) the web down to the right foot with more cross threads. Each with approved, twelfth and ours from one counter, three pictures side by side.

## The thirteenth step (about 12:55 UTC)

Pushed head efca8b82: commit 3849097e (src/seasons/fall/base.ts, assets-src/base-fall/mesh.mjs, RECIPE.md) on main a6fe2ff4 (chain 30), then main 4f95670b merged (ebbf96e0, chain 31 and status 213), then efca8b82 (one line of base.ts: the wall's angle round the drum asked in the tested form, since tests/glsl-normalize.test.ts failed on the first form; 6 pixels of the hd review still move by 1 level). Draft stills on efca8b82's content: fall-rest 58138a1c63fae961, fall-landed 01f0ca196c990e4f, the six others as the list of b22b5be4. The whole vitest (948 passed, 8 skipped), tsc, strict, determinism and the stand-ins still were taken on that content too; G15 and the frames at 3840 on a6fe2ff4 with the first form of the angle. The asset script changed, so `npm run make -- base-fall` must be run and its files committed by /root: 77,762 triangles (iron 54,874 with 80 strands and 82 thorns, pumpkins 13,458, wax 8,512, web 918), the twelfth had 79,830. G15 reads 1,759,623 of 1,800,000 at high (1,765,827 before; the base is counted three times there). Everything below this section describes older heads.

What it is, against the twelfth. Mesh: strand thorns at 2.2 times the spacing, 1.4 times as long, thicker at the root, more bent; a strand's third paint channel is its radius over 2.5 mm; three vines on the wall right of the third face (1.25, 0.36, 0.32 mm); a sheaf of 52 three sided fibres (0.075 to 0.125 mm) behind the vines left of the first face, paint kind 0.65. Shader: vines matt (roughness 0.78), the long line gone, a soft grey light on a normal mixed with the bark and pebbled; fibres lit gold along their whole length (baseFibre); the dashes (barkRun) gone, the bark's striations run on and a bead noise breaks them, dimmer at the foot; the wall cut into lumps by a cell pattern wrapped round the drum (baseLump, lumpOn, lumpTilt, lumpShade, the WALL block of numbers), dark seams between and one glossy facet on each lump; the web drawn as 7 hanging threads with their own bow and weight, 4 slanted cross threads that sag, a rim thread, a faint veil and a few round dew beads.

Frames 2364 to 2367 at 3840 final: lit stone correlates 0.966 to 0.991 after its own shift of 1 to 2 px, the wide stone 0.999, the left tangle 0.977 to 0.978, the sheaf 0.984 to 0.985, the web 0.974 to 0.976; 99 to 100 percent of the bright tenth stays bright.

Measures at hd review, the same on a6fe2ff4 and on efca8b82's content, with the local make: M3 0.8669, base 0.867 (floor 0.85; the twelfth 0.884), miniature 0.957. Cells: 1.02 2.23 1.26 0.96 / 0.79 0.55 0.46 0.73 / 1.10 1.05 1.20 1.12. Left box: median 26.5, 90th percentile 116.5, top 3 percent 228 182 138, runs 3.8 and 4.9 (approved 26.4, 106.0, 234 191 159, 4.1 and 5.2). Flank: median 27.8, 90th percentile 133.3, runs 6.0 and 5.6 (approved 34.6, 113.3, 3.7 and 4.8). Foot rows from x 580 by 40: 3.8 6.8 17.2 22.4 0.8 0.7 1.3 (approved 6.1 12.0 5.8 4.3 1.9 1.6 0.3). Between the pumpkins: warm 0.2 percent, median 8.1, 90th percentile 23.1 (approved 0.5, 9.9, 26.0). Shaded stone: median 15.3, darkest tenth 7.2 (approved 15.9, 10.0). Wall box (x 1150 to 1200, y 790 to 830): lit share 32.5, median 36.5, 90th percentile 106.0, facet spacing 25.5 by 15.9 (approved's first box 45.8, 46.0, 115.8, 31.1 by 32.5). Fibres across one row of the sheaf's box (x 642 to 699, y 855 to 903): approved 9 to 13 lines, 1.6 to 2.0 px wide; ours 5 to 11, 1.8 to 2.8 px.

How the floor was met: a try with the foot vines dimmed to 0.35 read 0.822 and 0.846, under the floor; the pushed tune dims them to 0.55 only. The shortfall of M3 sits mostly at the pumpkin faces (energy by 60 px columns: x 720 to 780 0.43, x 1020 to 1080 0.33, x 1260 to 1320 0.58), which this step did not touch.

Still wrong, by eye beside the approved: the wall is a grey salt and pepper grain on lumps, brighter and finer than approved's split coal with smooth glossy facets; the soft light on the vines covers about half of a vine's width, wider and brighter than approved's third; the sheaf reads as straw, straighter and paler than approved's fibres, and fewer across; the warm share on the foot rows at x 660 to 740 is still 17.2 and 22.4 against 5.8 and 4.3; the top 3 percent at the left is more orange than approved; the web is a few hanging threads and has no sheet that reaches down to the right foot as approved's does; thorns are fewer than approved's now in the crop.

Tries of the thirteenth are kept in /tmp/look: base.s14.ts is the pushed shader, made by s13.py from base.a7.ts (the twelfth) and then s14.py; mesh.s12.mjs is the mesh one try before the pushed one (44 fibres, wider spread); final23.sh is the proof chain and final23.log its print.

## The twelfth step (about 11:15 UTC)

Pushed head 6f76d000: commit 847ce15f (base.ts only), then main e5671c9c merged (5dff0ce2), then main 21ebbe2d (chain 28) merged. Draft stills on 6f76d000: fall-rest 9c19a7a5744536f6, fall-landed 7813cfab7aeba6c6, the six others as the list of 21ebbe2d. Strict, determinism and the stand-ins still were taken on 5dff0ce2; tsc and the whole vitest (948 passed, 8 skipped) on both. No mesh change: 79,830 triangles in the base, fall 1,796,373 of 1,800,000 at high. Everything below this section describes older heads.

What it is, against the eleventh. The wall: the fold field is the same size across and up (lumps, not long folds), its weight in the normal 6 to 9, the sheen reads 0.03 in a fold and 1.3 on a lump's back, the grain's weight 2 to 3.4, and a grey fill lifts the shaded stone (0.36 of the sky's grey, less at the far left and where the paint's shade is deep). The vines: the lines along a vine are cut by a break field into runs of unequal length (barkRun), a hold (barkHold, x -28 to -50 mm) keeps the bark paint, the warm ridge and the card's light to the left third, the ridge colour is cooler, the long cool line is broken too.

Measures at hd review, the same on 5dff0ce2 and on 6f76d000: M3 base 0.884 (the eleventh 0.941; the whole reads 0.8742 on main e5671c9c and 0.8837 on 21ebbe2d, the miniature's part moved with main). Grid of the base's cells: 1.04 2.48 1.23 0.87 / 0.78 0.99 0.43 0.77 / 1.92 3.97 1.16 0.75 (the two cells were 4.20 and 5.87). Left box: median 24.9, 90th percentile 99.2, top 3 percent 242 198 153, runs 6.9 and 5.6 px (approved 26.4, 106.0, 234 191 159, 4.1 and 5.2). Flank: runs 5.2 and 5.3, 90th percentile 118.6 (approved 3.7, 4.8, 113.3). Warm bright share between the pumpkins 1.1 percent (was 3.0, approved 0.5); on the foot rows from x 580 by 40 px: 8.4 12.2 16.6 24.2 5.0 2.9 2.0 against approved's 6.1 12.0 5.8 4.3 1.9 1.6 0.3. Wall: lit share 34 and 64 percent in two boxes (approved 46 and 53), facet spacing 26 by 14 and 21 by 37 px (approved 31 by 32 and 23 by 33). Shaded stone median 16.1, darkest tenth 10.6 (approved 15.9 and 10.0; the eleventh 5.1 and 2.9).

Frames 2364 to 2367 at 3840 final, drawn on 5dff0ce2: the dots, the lumps and the broken lines keep their places; lit stone correlates 0.977 to 0.980 after the 1 px shift, the left tangle 0.976 to 0.977.

Still wrong, by eye beside the approved: the left is orange dashes on thick tubes (copper rope) where approved has dark matt wood and thin twisted twigs with 1 to 2 px glints; the runs 4.1 and 3.7 are not reached; the warm share is still over at x 660 to 740 on the foot rows; the wall's lumps are flatter, its folds grey and not near black, no glossy facet; the flank's vines are glossy black with a white line where approved's are matt grey; thorns: approved about 19 in the crop, 35 to 120 px long at hd, 8 to 14 px thick at the root and curved, ours about 54 seen, the strand thorns' median 38 px, thin and straight.

Next, /root's rulings of 10:36: (1) the wall's folds to near black and one glossy facet on each lump; (2) the thick vines matt with a soft grey light and no long streak, the left tangle as thin twisted twigs with fine glints, or one thick tube shaded as a bundle of thin strands of unequal width, irregular and crossing; base part of M3 never under 0.85 and no dimmer light to buy cells; (3) thorns longer and curved as far as the triangles go; (4) the vines right of the third pumpkin, approved 4 thick and 2 thin against our 3 and 0, cost by a make before one is added.

Counting without a render: /tmp/look/count.mjs imports a copy of the asset scripts (/tmp/look/t13/assets-src/bf, with knobs EV, LEN, RAD, BEND in the environment) and prints triangles and thorns. The strand thorns are 119 with 7,872 triangles; with half as many, 1.6 times as long, they are 50 with 3,384.

Tries of the twelfth are kept in /tmp/look: base.a7.ts is the pushed shader, v12.py and w12.py make it from base.b2.ts (the eleventh).

## The eleventh step (about 10:00 UTC)

Pushed head fc68c28f: commit 069171a2 (base.ts only), then main ade42c8f merged (d48bdad5), then main 3170155e merged. No mesh change: 79,830 triangles, 1,796,373 of 1,800,000 at high, as on the tenth. Everything below this section describes older heads.

What it is, against the tenth: the bare stone of the right flank where the key strikes it. /root ruled b at 09:06 on my measure: approved's lit stone is a fine even pebble on a lit grey ground, ours was pale blotches on near black. DRUM_SHEEN 1.8 to 2.8, DRUM_CRINKLE 1.5 to 0.8, the grain's cell from about 3 px to about 2 px at 3840 (frequency 3.5 to 5.5, offset 0.12 to 0.076), the crinkle's weight in baseScale 0.8 to 0.35 and in the sheen (0.55 + 0.75) to (0.85 + 0.3), the sheen's colour 0.56 0.84 1.3 to 0.72 0.92 1.3, and the sheen's light gate reads three quarters from the wall's own round and one quarter from the bent normal, so the ground between the dots is lit. The shaded stone is not touched.

Measures at 3840 final (steps between neighbours at 1, 2, 4, 8 px; points 40 over ground; median; lit half's blue over red). Approved's one clean lit patch, x 2458 to 2488, y 1664 to 1694: 22.9, 27.3, 16.1, 14.2; 9.8 percent; 106; 1.24. The tenth, box A (x 2326 to 2400, y 1584 to 1624): 15.3, 23.4, 26.0, 21.3; 11.3 percent; 47.5; 1.50. The eleventh, box A: 22.6, 27.4, 21.1, 15.4; 12.4 percent; 81.4; 1.24. The eleventh, box B (x 2444 to 2476, y 1670 to 1740): 25.5, 26.8, 22.8, 24.3; 11.7 percent; 84.4. Shaded stone at hd: approved median 15.9, darkest tenth 10.0; ours 5.1 and 2.1 before and after the step.

Frames 2364 to 2367 at 3840 final (drawn on the shader of 069171a2 before the merges): the stone moves 1.0 px down and 1.5 px left a frame; after that shift the frames correlate 0.983 to 0.986 and 98 to 99 percent of the bright points stay bright. The 2 px cell is kept.

Still wrong: the median stops at 81 to 84 and not 106, held there on purpose since ours shows one large bare wall where approved shows small lit patches; the 4 px step is 21 to 23 against 16.1; points a little over; the wall is evenly lit with no shade of folds; dark violet pixels between dots at six times; at hd the stone is finer than approved (1 px step 28.6 against 20.5); the shaded stone is darker than approved's (5 against 16). The aim rests on one patch of 30 by 30 of the approved.

Next: the twelfth step from /root (08:42): the lines along the left vines broken into short runs of unequal length with dark between (approved 4.1 along the row and 5.2 down the column, ours 7.3 and 5.5; flank 3.7 and 4.8 against 5.1 and 5.3); the lit lines paler and cooler (approved's top 3 percent 234 191 159, ours 233 183 133); the two cells of the grid at 4.20 and 5.87 brought down; the warm stripes of the front band held back to where approved's warm light ends (on the foot rows y 925 to 990 approved's warm bright share is under 2 percent from x 740 on, ours reaches to x 820). No triangle is free.

Tries of the stone are kept in /tmp/look: base.b2.ts is the pushed stone, stone_patch.py makes it from base.f31.ts (the tenth).

## The tenth step (08:37 UTC)

Pushed head 0f7d05f9: commit 853bdefc, then main d2013ce3 merged (4f185596), then main 82d0b882 merged.

What it is, against c291a11c: at the left the body's light falls off to both edges of each tube (round), the bark's field is long along the vine and finer around it and cut to a narrow line, with a small lean round the tube; away from the left the knobs' height in the normal is halved and the key line no longer breaks on the bark, so the flank's highlights join into one line; twigs are thinner (radius 0.24 to 0.42) and the near thorns have 6 sides, 79,830 triangles in the made mesh, 1,796,373 of 1,800,000 at high.

Proofs on 4f185596: M3 fall-rest at review 0.868 (base 0.913, miniature 0.868); left box median 23.5, 90th percentile 83.2, top 3 percent 233 183 133, runs 7.3 and 5.5 (approved 26.4, 106.0, 234 191 159, 4.1 and 5.2); flank runs 5.4 and 5.5, 90th percentile 98.0; six other draft stills as the list of d2013ce3, fall-rest 20c131488b1344df, fall-landed 227b1db8c05cd105; landed at review drawn and looked at; counts pass; strict pass; frames 2400 to 2403 at 3840 final drawn and looked at, lines steady.
Proofs on 0f7d05f9: tsc clean; vitest 68 files passed, 1 skipped, 943 passed, 8 skipped; fall's two draft stills the same two values.

Still wrong: at 3840 the left vines read as orange satin with broad pale stripes; the left is too orange and too clean, a few thick tubes where approved is a broken tangle (the mesh, and no triangle is free); the lines are a pattern in the bark and not one highlight that winds along the lit edge, and the approved's angle was not measured; the flank's line is wider than approved's; the warm stripes reach too far toward the middle of the front band. The ruler's 4.5 for the runs along the row was not reached in thirteen tries: lines finer than about 1.5 px at hd merge into a pale band, a short field reads as blotches.

Next: the eleventh step from /root (08:25): the lit stone between the vines reads as static at 3840, single blue white pixels; measure first (step between neighbouring pixels and between blocks of eight, count of points 40 over ground, mean colour, on approved and ours at hd and 3840), then move the grain's energy to mottling of 4 to 10 px at 3840.

Tries are kept in /tmp/look as base.f17.ts to base.f31.ts (f31 is the pushed shader), pictures f17.png to f30.png and fin.png.

## The heads of the fifth list, in order
- 127e2210: knobs and a grain of 1.8 in the vines' normal, a narrow lit ridge. M3 base 0.830. Beside the approved at two times it reads as frost: pale speckled patches on black.
- b2a13724: grain 2.6, wider ridge. M3 base 0.902, which was grain. Ruled out by /root at 06:25: frosted.
- The one try of 06:25 (not pushed): grain at a third, only inside the lit ridge. Runs 9.3 and 7.0 px, 90th percentile 73.7, share over 106.0 7.0 percent, M3 0.796. Smooth tubes with long unbroken pale lines. Dropped.
- 7064f4d0, the fallback: 127e2210 with the grain off the vines and the wider ridge. M3 base 0.752. Pale blobs on black. /root at 06:39: too near the threshold to merge, since a round measures at the final tier, which reads about 0.05 lower.
- d2878876, this head: the fallback plus bark fissures and a matt brown body at the left. M3 base 0.805.
- A note on the history: the commit bed15e9c is titled "Fall's base: the grain is off the vines" but it only set base.ts back to 127e2210's state, because a script edit had failed. 7064f4d0 does what that title says and its message says so. History was not rewritten.

## What d2878876 is
- Knobs in the vines' normal (BRAMBLE.KNOB 9 on a noise of 1.7 mm cells). No grain on the vines; the hide keeps its own (DRUM_GRAIN).
- Bark fissures: a field stretched along each vine (barkAt in base.ts: uv1.x times 3 along, uv1.y times 30 around, a slow wind, and a second part 2.1 times finer). It darkens the paint in a fissure, tilts the normal across the vine (BRAMBLE.FISSURE 2.4) and takes the light of the lit ridge out of a fissure (barkCut). The paint and the tilt reach from the left to x -8 mm and stop there, so the front band and the right flank are not hatched by them. On the right flank barkCut only breaks the key's thin line.
- A matt brown body at the left (BRAMBLE.BODY 5): a broad lobe (power 4) on the tube's own round toward the lamps, in the rim's colour times 1.0, 0.62, 0.4, striped by the fissures, off on thorns.
- The lit ridge at the left as on the fallback: ironRidge (power 16 on the tube's round) times a tight lobe (power 110) on the bent normal. WARM_WEST 140, CARD_WEST 85.
- Web: rings weigh 0.25 (was 0.45), spokes 0.15 (was 0.35), thread alpha 0.36 (was 0.48).

## Where d2878876 stands
- M3 at hd review: base 0.805 over 174567 pixels (the tool prints 0.8047), threshold 0.75, /root's bar for a merge 0.80 at review. It is thin over that bar. Over the tries of this step it read 0.786, 0.791, 0.803, 0.808 (with the fissures on every vine, which hatched the front band and the flank and was dropped), 0.795, 0.797, 0.805.
- Grid: 0.85 2.94 1.25 0.70 / 0.71 1.21 0.42 0.77 / 1.83 1.03 1.18 0.83.
- Left tangle box (hd review at two times, x 575 to 690, y 800 to 925), approved then d2878876: runs along the row 4.1 and 6.0 px; down the column 5.2 and 5.6; median 26.4 and 27.6; 90th percentile 106.0 and 107.8; share of pixels over 106.0 10.0 and 10.3 percent; top 3 percent 234,191,159 and 235,192,153. Main's base in the same box: runs 5.8 and 4.9, median 22.6, 90th percentile 87.0, share 7.5 percent, top 3 percent 233,171,99.
- Right flank box (hd x 1190 to 1330, y 760 to 920), approved then d2878876: runs 3.7 and 5.1 along the row, 4.8 and 5.3 down the column; 90th percentile 113.3 and 94.8.
- Web, threads over their ground (luma minus a 9 px median, one box on the big sheet): approved 95th percentile 57.8, 99th 131.3; main 64.2 and 115.4; d2878876 50.0 and 94.2. Approved's ground there is 40.8, ours 14.9, so ours still stands out more than the numbers say.
- Boxes at hd review, approved then d2878876: band 90th percentile 28.7 and 33.9; low vines 27.1 and 26.3; right flank median 20.6 and 13.9, 90th percentile 49.9 and 47.9; left tangle 25.7,19.7,18.8 median 18.8 p90 41.0 and 34.1,20.8,18.6 median 23.3 p90 37.4; left pumpkin 98.8,51.9,16.7 median 31.9.

## Proofs, and the head each was taken on
- On c291a11c (the pushed head, main 35d00e1b in it), with the remade base asset: "pass M3 fall-rest: 0.8047 (threshold 0.75, detail.minSharpnessRatio) high frequency energy of the still over the approved image at the same size: base 0.805 over 174567 pixels of the part in the ids view; miniature 0.875 over 103565 pixels of the part in the ids view".
- On c291a11c: npx tsc --noEmit exit 0. The whole vitest: 67 files passed, 1 skipped; 926 tests passed, 8 skipped (/root counts 930 and 4 on main; the 4 are the kept music, absent on this VM).
- On c291a11c, the eight draft hd stills, hero, sha256 first 16: winter-rest 0cab5cd137ba09d9, winter-landed a7ab4af383606ed0, spring-rest 9b154a27fa206941, spring-landed 090fcd4913cf6e39, summer-rest c94ba85c547231c1, summer-landed 89a1ae337305dc2a: the six match 35d00e1b's list. fall-rest 793083561c331581 and fall-landed 7eb20339375e9e73 changed (main's are fe43165395e93efc and 9d24a913e888a863), as they may.
- Triangles: the mesh is untouched, 80910, as on the fourth list. G15 was not finished on this head when this was written; by sum it should print fall high 1,799,613 of 1,800,000 (main's 1,795,269 and the base's 4,344).
- Not run on this head when this was written: strict, determinism, the stand-ins still, the landed still at review, the hero still at 3840, the four neighbouring frames 2400 to 2403. The last full set (strict pass, determinism pass, stand-ins black, G15 pass, frames steady) was taken on e490169c, the fourth list. The report to /root says what came in after.

## What is still short on d2878876
- The pair does not read as the same base.
- Left tangle: brown striped wood with short pale glints. The stripes are broad, and the thick vine at the top left reads flat, like a striped ribbon; approved's twigs are thin, round, darker and redder, with small copper glints. The bright runs are 6 px where approved's are 4 to 5. The vines are thicker than approved's.
- The knobs are on every vine, so the front band and the right flank read lumpy; approved's vines there are smooth, thin and wet. A few vines at the front left, between x -8 and -36 mm, show fine stripes from the fissures' tilt.
- Right flank: broken cool light on black, bodies lumpy and thicker than approved's, which carry one thin wet line. The top right cell of the grid is 0.70.
- Web: thinner and dimmer, still a clear coarse net; approved's is a few faint threads.
- Everything listed under the fourth list below that is not named here stands as it was (left pumpkin, the middle cells, the long vine's length, the hide's pebble).

## Not seen
- This head at 3840 one to one. The fissures are new fine lines on the vines; whether they hold still over neighbouring frames at 3840 and 60 frames a second is not proven on this head.
- The landed state at review on this head.
- The storm in motion, and the framing on the phone and the tablet as pictures.

## Where to go next
- The number rides on the left: the fissures and the body there carry it from 0.752 to 0.805. They are paint and a tilt on tubes that are too thick. Approved's small glints sit on thin twigs with real bark relief. That wants form in the mesh: thinner twigs at the left and a knobbly radius along the tube in mesh.mjs, paid for inside the base's triangles (fall has about 1971 left at high after this base and the scene's fifth list).
- The right column (0.70, 0.77) wants the knot of thorns at the top of the flank and thinner flank vines, not light.

## Fourth list, what was done
- Right flank: 11 thin vines of 0.75 to 1.15 mm curve over the hide on slants of 24 to 56 degrees, standing 1 to 4.5 mm off it, each with a few thorns.
- Bark: the grain that made rows of scales is off the vines (it stays on the hide). The vines carry a fibre field stretched along their length (barkAt in base.ts, BARK_GRAIN 1.6), and the copper light at the left is broken along the vine by baseDash.
- Left tangle: the pairs are 1.6 to 2.0 mm and 1.1 to 1.3 mm. The thorns are dark: they took the drum's broad warm lobe from the left (power 5 on ironWarm and ironLeft at weights 0.45 and 0.1); vines and thorns take the vines' own narrow lobe now, and the edge sheen and the sky's lift are cut on thorns.
- Left pumpkin: the blue fill on the rind is a warm one at under half the strength, and the body glow is down by 0.68 at the west.
- Front vines: radius 0.85 to 1.7 mm (was 1.0 to 2.05).
- Web: the rings run straight between the spokes (the sag and the wobble are nearly off), the veil is thin, the threads weigh less.
- The long vine at the right foot (TWIGS in layout.mjs, az 72): 25 mm long. At 32 mm the base reached 79.7 mm from the axis and failed tests/app.test.ts, which holds every base inside 74 mm for the phone and the tablet; it reaches 73.6 mm now.

## Where it stands
- M3 at hd review: base 0.823 (was 0.797), bar 0.75, asked 0.78.
- Grid of the base's energy, this branch over approved, columns x 612, 786, 960, 1134 to 1308, rows y 762, 868, 974 to 1080. Before: 0.95 2.30 1.26 0.70 / 0.75 0.46 0.45 0.66 / 2.27 0.38 1.12 0.80. After: 1.05 2.63 1.24 0.71 / 0.75 0.67 0.42 0.68 / 2.30 0.18 1.16 0.79.
- Boxes at hd review, approved against this branch: band 90th percentile 28.7 and 32.6, median 10.1 and 7.7; low vines 27.1 and 28.6; right flank 23.1,25.6,29.4 median 20.6 p90 49.9 against 23.3,23.8,27.4 median 17.3 p90 57.6; left tangle 25.7,19.7,18.8 median 18.8 p90 41.0 against 23.7,16.8,17.1 median 15.4 p90 29.8; left pumpkin 102,52,28.5 median 29 against 96.8,50.9,15.9 median 31.0.

## How the number moved, said plainly
- With the thin vines modelled and the scale grain off the vines the base read 0.739 to 0.833 over six tries of tone. The highest had a silver glare on the vines of the right flank and was dropped; the pushed one reads 0.823. Its last step, from 0.747, came mostly from the copper light at the left: stronger (WARM_WEST 30, CARD_WEST 30) and broken along the vine by a noise field (baseDash). That is tone on modelled vines, not new form.
- The right column did not rise with the new vines (0.70, 0.66 before; 0.71, 0.68 now). Approved's energy there is in thin wet lines and in the knot of thorns; these vines are thicker with a wider sheen.

## What is still short against the approved picture
- The pair does not read as the same base yet.
- Left tangle: the vines read as flat ribbons with pale orange stripes; approved's are round dark brown wood with small copper lights. Darker than approved in the median (15.4 against 18.8).
- Right flank: the vines are thicker than approved's, the sheen wider; no knot of thorns at the top; the hide is pebbled where approved's is smooth with soft folds.
- Front vines: thinner, but still matt next to approved's wet ones; the long cool highlight is faint.
- Left pumpkin: brown and orange, no purple, median 31 against 29, but blue is 15.9 against 28.5, so it is more orange than approved's, and it glows over more of its skin.
- Web: a clear net now, coarser and brighter than approved's fine one.
- Middle row, third cell 0.42 and bottom row, second cell 0.18: the dark front between the pumpkins has less fine detail than approved.
- Under the lip the green of the air stands over the vines (102 against 43 median); not the base's, passed to fall's air by /root.

## Where to go next
- Tones are constants at the top of base.ts (BRAMBLE, DRUM_SHEEN, DRUM_FOLD, DRUM_CRINKLE, DRUM_GRAIN, BARK_GRAIN, PUMPKIN_BODY).
- The left vines want form, not stripes: a knobbly radius along the tube in mesh.mjs would do more than the fibre field. Fall has 1977 triangles left at high and the base counts three times, so any new form must be paid for inside the base.
- /tmp/look/grid.py on the builder's VM copies the tool's M3 into the grid; it is not in the repo.

## Which head each proof was taken on
- On e490169c (main d13d29c6 merged in; the pushed head f77009c7 adds only main's b1cb4567, which changes index.html, kit, public/first and out/stills, nothing under src, assets-src, tools or tests): M3, the grid, the boxes, tsc, the whole vitest (917 passed, 8 skipped), strict on fall-rest and fall-shake (pass), determinism (pass), the stand-ins still (black), G15 (pass, high 1798023 of 1800000), the landed still, the hero still at 3840 final, frames 2400 to 2403 at 3840 final.
- The six stills of winter, spring and summer matched d13d29c6's list on 450d2bfc (the same tree but for the length of the long vine) and again on the build of e490169c.
- On f77009c7 itself: the whole vitest again, 916 passed, 9 skipped, none failed; one more skipped than on e490169c, and which one was not found.
- Main has since moved to b4bc96c0 (chain 16); it is not merged into this branch.

## Not seen
- The storm in motion. The storm was looked at as the landed still only.
- The four 3840 frames were looked at in two cuts (the right end of the ring and the left tangle), not whole.
- The hero still at 3840 final was looked at in two cuts (the left tangle and the right flank), not whole.
- Phone and tablet framing with the long vine: held by the test's number (73.6 mm inside 74), not looked at as pictures.
