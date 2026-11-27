# Fall base, handover

Branch agent/p6-fall-base, head c291a11c: the shader commit d2878876 with main 35d00e1b merged in (fall's scene fifth list and air fourth list). The fifth list changed src/seasons/fall/base.ts only. The mesh is as on the fourth list, whose asset script change still stands: `npm run make -- base-fall` must be run and its files committed by /root (80910 triangles, 1448 more than main's 79462; public glb 1348780 bytes, sha eb905811891fd477 on this VM).

## The eleventh step (about 10:00 UTC), the newest head

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
