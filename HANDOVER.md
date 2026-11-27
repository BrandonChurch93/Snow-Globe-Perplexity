# Handover: spring's base (phase 6, tenth list)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Cobbles: cells of about 9.2 by 7 mm, each a rounded stone (`rock` in `build.mjs`: a plateau with a dome over it), moss in every joint (`seam`). In the shader the stone is shaded by how high it stands and has almost no sheen. The stone is set 2.9 mm in (`- 2.9` in `rock`) so the cobbles stay inside the third list's outline.
- Where the stone is bare: only the front, azimuth about -60 to 20 degrees (`bare` and `shelf` in `build.mjs`); the left flank is mossed to the table and takes the light from the left.
- Outline: `swell` is the third list's again. The cushions over the rim are gone. `dip` wears the moss roll down by an uneven depth (1.0 mm at the front under the glass since the sixth list, 2.2 before, up to 2.6 mm more in patches); it only lowers points above 35 mm and moves nothing outward.
- Rim tone: `liveTip` in `base.ts`. Its colour runs from moss green at the left to straw at the right and its strength from `0.33 + 0.75 * exp(-x * x / 400)` to 2.4 with `liveEast` (the sun is behind and to the right; the glass shades the left of the collar). `liveLip` starts at 37.5 mm so the dipped roll still has a lit top; `liveCrown` weighs 0.6 at the left and 0.08 at the right.
- Roots (see the eighth list below for their count and place). The low sun on the roots is narrowed to the faces that look at it (`smoothstep(0.4, 0.9, liveGraze)`), so they are pale on the lit tops and bark brown elsewhere.
- Water: the sun glint, the room's glints and the travelling glints are cut by about a quarter (`1.65`, `0.68`, `0.68`, and `mix(0.6, 1.1, ...) * fine`).
- The dew's lines are byte for byte as on main.
- Sixth list, the cap: the moss over the upper third is a cap written into the height (`cap`, `capEdge`, `CAP_TONGUES`, `capOn` in `build.mjs`), 2.8 mm thick at its lower edge and 4.6 mm near the seat, with twelve tongues at the front and sixteen in all. `swell` sets the upper body in by 1.6 mm so the cap overhangs without a wider outline. The cap falls to nothing over the last 3.2 mm before the seat; at the two ends of the rim (`flank`, azimuth beyond about 48 degrees) it thins from 10 mm before the seat, so the ends are lumps and not horns. The tufts of the older moss (`thick`) are half as high inside the cap.
- The trickle's strip and its foot are laid on `wideBare`, the height without the cap, so the water is where it was. Roots are laid on `rootBed`, the stone plus 0.85 of the blurred cap, so they lie on the cap.
- The cap's light in `base.ts`: `liveTop` (how far the mesh's own normal looks up) gates `liveCrown` and `liveLip`, so the light over the glass falls on crowns and the cap's face stays in the shade. The fill on the moss rises to 4.4 above 38 mm and turns warm there (`vec3(1.08, 0.96, 0.84)`). The low sun reaches further round on high moss (`liveReach` from 0.0, the third power of `liveGrazeM` eased toward the second). Stone in the deepest cavity keeps 0.12 of its light (`0.12 + 0.88 * smoothstep(...)` in `baseAo`), because the cavity under the cap's edge would be black otherwise.
- The moss line above the glass's lowest point, approved against sixth list: middle 106 against 113 px, left 148 against 163, right 154 against 146 (`/tmp/line.py` on the ids view; the approved by eye on the picture).

- Seventh list, the light: the low sun and the crest light no longer blow out. Both are a colour (`liveLowSun`, `liveCrest`) bounded toward `SUN_TOP` (2.4, 1.7, 0.7) by `x / pow(1 + abs(x / SUN_TOP)^3, 1/3)`, so a lit edge ends at a warm cream and the lens's fringe (`src/post/post.ts`, not this job's) has no pure white to split into a red and a blue line. On the growth the low sun's gain is 2.4 times the graze squared (7.0 times the cube before). In film frame 1030 the base's box held 1,409 deep blue and 1,081 pure white pixels at 3840 on the sixth list and holds 647 and 0 now; what is left is the fringe itself, one pixel wide.
- Seventh list, the lit moss: `liveBlade` (from the moss sheet's blue channel) scales the low sun and the crest light on moss, so each lit tuft has a lit tip and its own shade. The crest's ridges are still a smooth cream (picture 28).
- Seventh list, the body: `PROFILE` in `layout.mjs` leans in from the table all the way up (radius 60.4 mm at 1.6 mm, 50.6 at 32.5). Width over the glass's diameter, approved against build: under the cap 0.939, 0.932 against 0.912, 0.930; mid height 0.972 against 0.961; foot 0.996, 1.003 against 0.999, 0.997. The belly's swell is `6 * fbm - 2.2`.
- Seventh list, the crest: its clumps are gone again (eighth list). The moss line over the glass's lowest point was 106 px, as the approved's.

- Eighth list, the crest: a near level soft line. `PROFILE` in `layout.mjs` ends in a tight roll, so the lit edge is the outline itself. `dip(az)` in `build.mjs` wears five low unequal swells into the front (`SWELLS`); the seventh list's clumps are out and `CAP_TONGUES` holds eight tongues at the front. A fringe of moss heads stands on the crest's edge from azimuth -66 to 82 degrees: three rows, heads 0.34 to 0.64 mm apart and 0.16 to 0.42 mm high. On the ids view at 1920, x 790 to 1190: the edge lies 1.95 px sd about its slow line (the approved by the same trace 2.06, the seventh list 5.2 with one dip of 28 px), range -2.5 to +6.0 px.
- Eighth list, the roots: `ROOTS` in `layout.mjs` is eighteen strands traced from the approved picture, 30 roots built (41 before): one limb at the right (radius 1.15 mm) and three thin ones on the right flank. Roots are made before the height field; the moss is cleared under them and the cap is cut under the thick ones. The random fine roots are out. `MUSHROOMS` is 17 single caps; the bunches of children are out. The petals on the ledge lie under the lit band.
- Eighth list, the light in `base.ts`: the lit moss sat in the shoulder of the tone curve, which is why its grain did not show. On the right flank (x over 30 to 34 mm) the moss in the low sun is broken into round heads before the knee (`liveHeads`, `liveHead`, gain `mix(0.12, 3.5, ...)`) and its diffuse light after the knee by `liveBead`. Moss takes the low sun by a normal leaned 0.7 toward the mesh's own (`liveSoft`, with `liveLean` as the guard against a zero vector). On the lit rim the blade grain is half as deep (`liveBlade = mix(1.0, mix(0.5, 1.0, smoothstep(0.25, 0.85, baseMossD.b)), baseMoss)`). `liveCrest *= 1.6` is out. The glass's shade on the collar is narrower (`mix(0.55, 1.0, smoothstep(0.2, 1.8, dist - 60.0))`). The roots' graze looks from `(0.75, 0.55, -0.15)` and their ridge phase carries `4.0 * baseNoise(vBasePos * 2.3)`, so the bark lines break up.
- Made size: rock 97,237, growth 22,845, water 2,800, 122,882 triangles in all, 4.62 MB (131,052 on the sixth list).

## What is short of the approved picture
- The lit top is a narrow band on the edge; the approved's top is a broad cushion that slopes up to the glass. Against the globe the build's moss line stands about 20 px higher than the approved's at 1920, so the build's lit band lies above the crop the sharpness measure reads (picture 30).
- The lit line at the middle is brighter than the approved's: brightest quarter (161,154,103) against (148,137,90), median half (96,94,53) against (71,75,40). The dark band above it is darker: median half (18,20,5) against (40,43,30).
- The front right crown, box 1080,748 to 1200,766: brightest quarter (107,104,52) against the approved's (167,146,97); (54,66,30) on the seventh list.
- The heads on the moss in the sun are about 6 px across at 1920; the approved's beads are about 3 px. The fringe on the crest: 75 heads over x 790 to 1190, 5.3 px apart.
- The limb at the right is about half as thick as the approved's.
- The moss's lower edge is close to one level band; the approved's runs down in tongues between the stones and thins out. Not touched on the eighth list.
- The stones are cells of 9.2 by 7 mm, more, smaller and rounder than the approved's, which are flat with a wet sheen.
- The trickle is a dark glossy rope; the approved's is a thin clear sheet with a pale lit edge and a small splash at the table. Not touched on the eighth list.
- The petals on the moss (`LEDGE_PETALS`) read as flat discs in the shade at 3840.
- The table to moss line is 0.375 of the glass's diameter against the approved's 0.334 (not derived again on the eighth list; the middle of the moss line moved by 1 px). It stays: `globe.baseHeightMm` is 33 for all four seasons (decision 40).
- The crest stands lower than the sixth list's clumps, so more of the miniature's foot ring shows over it: at draft in shake 2's frames 2,553 pixels of the miniature show that the sixth list covered (1,588 of them under the storm, 965 bare); M4 of shake 2 reads 0.8937 (0.8957 on main b22b5be4, threshold 0.85).
- The detail line's miniature part reads 0.860 where main's base on the same head reads 0.867. All of it is one cell, x 1134 to 1191, y 671 to 719 of 1920: the sixth list's clump stood at y 716 there, inside the miniature's crop (which ends at y 720), and its bright edge was counted in the miniature's pixels beside it; the eighth list's edge lies at y 724 to 718, under the crop. Without that cell the two read 0.8607 and 0.8610.

## How to look
The eighth list's stills were drawn on 51269646 (main a6fe2ff4 merged) and the rest still at review is the same byte for byte on 6fb838b0 (main 4f95670b merged, which is b22b5be4 plus status files). The film frames 1030 and 1200 to 1202 were drawn on 51269646.
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (500,640,1440,1040) beside the approved picture scaled to 1920. The detail line: `npm run measure -- --unit spring --only M3 --force --tier review` (0.8597 on the eighth list: base 0.922, miniature 0.860; main's base on the same head 0.8666: base 0.909, miniature 0.867). It is the mean of the squared difference from a blur of 1.5 px over the part's pixels inside a crop set on the globe: the base's crop reads the build from x 612 to 1308, y 762 to 1080.

## At 3840 in motion (film frames 1200 to 1202, final, eighth list, drawn on 51269646)
`tools/fine-motion.mjs`: the share of pixels that change by more than 12 levels at the fine shift, frame 1200 against 1201 and against 1202, and the fine measure of frame 1200. In brackets the sixth list's shares.
- lit rim at the middle, box 1900,1420, 100 by 100: 1.9 and 3.8 percent (0.9 and 3.0), fine 3.12 (2.15). The crest moved: the box now holds the crest's edge and about 20 rows of the miniature behind the glass. The same box 20 rows lower: 0.8 and 2.3, fine 2.35.
- lit rim right of the middle, box 2240,1395: 2.4 and 7.8 (2.7 and 8.0), fine 3.76 (3.80).
- cap face, box 1900,1530: 0.0 and 0.0. Right shoulder with the new heads, box 2360,1440: 6.9 and 11.3, fine 4.67. Water with the moss beside it, box 1250,1500: 1.2 and 1.7.
- film frame 1030, the base's box (2400,800,3600,2080): pure white 0, deep blue 532 (647 on the seventh list).
Three frames are not the film: nobody has watched this at 60 a second.

## Ninth list (head 056ed155, main bbdd4b03 merged; the sections above describe the eighth list and are kept for what did not change)
What was built:
- The cushion. `PROFILE` in `layout.mjs` now runs on along the glass after 39.6 mm: (51.6, 41.5), (52.3, 43.5), (52.9, 45.5), (52.9, 46.9), (52.2, 47.6). In `build.mjs`, `seam(az)` gives the height of the moss's seat on the glass for each azimuth (4.65 mm over the old 42.9 at the middle, more toward 34 degrees, 1.2 at the sides, nothing behind 135), `surf()` lifts every point toward it by `ease(h)` and moves it out with the glass (`glassR`), and `brow(az, h, s)` lays a straight bank of 4.4 mm on the front between 39.2 and 43.2 mm. `dip()` lost its constant at the front. The rock sheet's normals take one sign from the winding (`wound`, `face`); a thin tan line of turned normals under the brow went with that.
- The light in `base.ts`: `baseBank` marks the bank at the front (how far the point lies toward +z, faded out past x 24 to 38 mm) and `baseAo` on it falls to 0.16 where the glass is nearer than 3.5 mm, so the bank lies in the glass's shade and the brow keeps the light. `liveHeads` no longer reaches the shoulder above 37 mm (`smoothstep(30, 38, x) * smoothstep(37, 34.5, y)`, or x over 42 to 50).
- The dew's 20 lines are byte for byte as on main (hash 15b5bfc744510ff3 on both).
- Made size: rock 106,029, growth 22,844, water 2,768, 131,641 triangles in all, 4.88 MB.

What it reads (one counter each, approved, main's base, the ninth):
- M4 of shake 2 at draft: 0.9647 (main 0.8957, eighth 0.8937); 118,607 of 122,948 miniature pixels hidden. M4 of shakes 1, 3, 4: 0.9694, 0.9567, 0.9592, as main. M5: 0.9919, 1, 0.9811, 0.9998 (main 0.993, 1, 0.9811, 0.9998).
- The detail line at review: 0.9072, base 0.911 over 171,740, miniature 0.907 over 96,078 (main's base 0.8666: 0.909, 0.867; eighth 0.8597: 0.922, 0.860).
- The dark band of the miniature's underside above the lit line is gone on the pair at one to one (pictures 33, 34).
- The crest's trace on the ids view, x 790 to 1190: sd 3.00 about its slow line, range -3.3 to +7.9, no dip over 3.4 (eighth 1.95). The seat follows the rim of the slab's wall, which itself runs y 688, 705, 680 across that span.
- The moss line over the glass's lowest point: middle 140 px (eighth 107), sides 157 and 149 (156 and 142).
- Build outside the traced outline: 52,951 px (eighth 31,774), of which 26,602 above the traced top line (5,409) and 25,807 under the table line (unchanged).

What is short of the approved picture on the ninth list:
- The cap is about twice as tall as the approved's: its lower edge did not move and its top rose about 5 mm. It reads as a lid with square upper corners where the approved has a rim with a sloped lit top.
- The lit line is a soft olive band about 15 px high without the approved's beads, about 12 px higher than the approved's; the face under the brow is near black (14 to 23 against 29 to 41).
- The left third of the bank is dark: x 700 to 800 brightest quarter (59,66,35) against the approved's (86,82,77). Between x 800 and 900 it is too bright: (92,95,50) against (38,44,31).
- The crest's trace at sd 3.0 is over the bar of about 2.
- Not started: the heads toward beads of 3 px, the front right crown, the limb's thickness, the moss's lower edge, the trickle.

At 3840 in motion (film frames 1200 to 1202, final, drawn on the ninth list's tree before the commit; the rest still at review has the same hash on 056ed155). Share over 12 at the fine shift, 1200/1201 and 1200/1202:
- shoulder, box 2360,1440: 6.4 and 9.8 (main's base 10.0 and 13.2, seventh 9.7 and 14.4, eighth 6.9 and 11.3; with the heads still on the shoulder 6.5 and 10.1). The heads term is not what moves there: what differs is the edges of the sunlit patches, the mushroom's rim and the root, which shift by (-3, 4) where the middle shifts by (1, 4.6) (picture 35).
- middle 1900,1420: 0.9 and 2.4; right rim 2240,1395: 1.8 and 7.0; face 1900,1530: 0.0 and 0.0; water 1250,1500: 1.3 and 1.7.

Single pixels (film frames 1251 and 1252, 3840 final, `spk.py`: a pixel counts when one channel stands at least T over all eight neighbours):
- box 2496,1560, 96 by 80: T 32: 15 and 13; T 64: 1 and 0; T 96: 0 and 0. Whole base region (1100,1280 to 2760,2080): T 64: 11 and 12; T 40: 108 and 125.
- They are yellow green single pixels in the dark moss under the caps, with red and blue beside them from the lens. With the dew's grains switched off for a trial (not kept), frame 1251: box T 32: 1, T 64: 0; region T 64: 4, T 40: 68. So the source is the dew's pinpoint, a grain of about one pixel at 3840, in the 20 lines that belong to the drops mender. Tried for them, frame 1251 only, not kept: `1.8` in place of `1.22` in `liveWide`: box T 32: 1, T 64: 0; region T 64: 4, T 40: 77 (picture 36). Its look at hd was not seen.
Three frames and two frames are not the film: nobody has watched this at 60 a second.

## Tenth list (head aa229f81, main 63914740 merged; the ninth list was held and is replaced by this)
What was built:
- The roll. `PROFILE` in `layout.mjs` after (51.2, 39.6) is now (51.5, 41.2), (51.6, 42.8), (51.2, 44.2), (50.5, 45.1), (49.9, 45.6): it rolls in over the glass's foot and ends on the glass, so there is no flat top. In `build.mjs`, `seam(az)` is `SEAT_FRONT` 4.4 mm over the old 42.9 at the middle of the front, 5.6 at 30 degrees, falling from 34 to 70 degrees to 1.2 at the sides, nothing behind 135. `brow(az, h)` stands the roll 4.6 mm proud at `BROW_H` (40.7 mm) at the front with a top that is steep at the glass and flatter at the crown (0.3 v + 0.7 v squared, v the share of the way down from the end to the brow), and 2.2 mm proud at 39.5 mm from 40 to 70 degrees on round the sides and the back. The ninth's draw-in at the sides is out.
- The light in `base.ts`: the bank's shade (`baseBank`, one line) now reaches 4.4 to 6.8 mm from the glass (ninth 3.5 to 7.0). Nothing else in the shader moved. The dew's 20 lines are byte for byte as on main.
- Made size: rock 102,034, growth 22,845, water 2,768, 127,647 triangles in all, 4.73 MB. Spring at high by sum 1,493,420 (main 1,496,825).

What it reads (approved, main's base which is the sixth list's, the tenth):
- M4 of shake 2 at draft: 0.9447, 123,053 of 130,257 (main 0.8957, ninth 0.9647, eighth 0.8937). Shakes 1, 3, 4: 0.9694, 0.9567, 0.9597, as main. M5: 0.9923, 1, 0.9845, 0.9997.
- The detail line at review: 0.8947, base 0.900 over 171,750, miniature 0.895 over 102,258 (main 0.8666: 0.909, 0.867; ninth 0.9072: 0.911, 0.907). The base's part is 0.009 under main's.
- Seat over the glass's lowest point: middle 135 px, y 708 (ninth 140, eighth 107); side crossings (651,685) and (1259,697).
- Build outside the traced outline: 46,638 px (ninth 52,951, eighth 31,774, bar 31,774): above the traced top line 20,276 (ninth 26,602, eighth 5,409), under the table line 25,822, left 501, right 9, other 30. Traced and not covered 3,753. The bar would need the part above the top line at or under 5,412, that is the seat within about a pixel of the eighth's line at y 734 to 737, where M4 of shake 2 read 0.8937 and the plain wall showed.
- The crest's trace on the ids view, x 790 to 1190: sd 2.45 about its slow line, range -2.6 to +6.1 (ninth 3.00); it now carries the climb toward the shoulders.
- Row levels at x 900 to 1020 from y 690 by 5: 153, 155, 115, 33, 36, 46, 40, 46, 59, 69, 78, 59, 38, 34, 25, 17. Approved: 154, 161, 166, 170, 131, 89, 63, 49, 44, 39, 82, 97, 58, 41, 36, 29.

What the approved's top line is: its traced line (y 742 to 744 across x 840 to 1160) is where its glass meets its moss. The dark band over it, y 715 to 739, is the miniature's own mossy bank seen through the glass, and the lit rim is y 740 to 750. In the build the miniature shows, in the same place, the lower rows of its turf's skirt: a plain olive wall from about y 705 at the middle (695 at x 800, 690 at x 700) down to the base. That is why the seat cannot go down to the approved's line with the miniature as it is. The wall is `SKIRT` and `MOUND` in `assets-src/village-spring/build.mjs` (the 18 skirt rows of the turf, shaded to soil under the mossy foot), drawn by the turf's material in `src/seasons/spring/mini/village.ts` (`SKIRT_FILL`, `SOIL`). If the skirt carried the bank's moss down to the collar, the seat could go to y 743, `SEAT_FRONT` near 0, and the brow could become a crest in front of the glass with the lit fringe the approved has.

What is short of the approved picture on the tenth list:
- The roll is about 60 px tall at the middle against about 45, and its seat is 35 px over the approved's line.
- The lit line reads 64 to 78 against 97 to 103 and is a speckled band, not a fringe of bright tips against a dark bank. The face under it is 17 to 38 against 29 to 58.
- The right end of the roll is pale yellow; the approved's is green with a warm rim.
- Small slivers of the plain wall still show under the glass's rim at x 725 to 745 and near x 1190 (about 4 px high).
- The pale band at the left of the glass's foot (x 650 to 680, y 660 to 690) is the miniature through the glass's lower rim, not the base (picture 39).
- Not started: the heads toward beads of 3 px, the front right crown, the limb's thickness, the moss's lower edge, the trickle.
- Not seen: any film frame of the tenth list at 3840, the shake stills at review other than spring landed, the back of the base.

The dew's line: branch `agent/p6-spring-dew` carries `liveWide` 1.8 for 1.22 as one commit on main. See picture 40 and the report: on main the line changes almost nothing in the box at (2496,1560); what stands out there is the caps' rims, which the seventh list's bound of the low sun mends (on this branch since the seventh list).

Proofs run on aa229f81: tsc 0; the whole vitest 68 files passed and 1 skipped (`tests/shake-looks.test.ts`, which runs only when asked), 950 tests passed, 8 skipped, 293 s, `tests/steps.test.ts` 133 s; strict pass for spring-rest and spring-shake; G15 pass (the gate prints fall's 1,759,623 of 1,800,000); the six draft stills that are not spring's equal the list of 63914740; spring-rest caa42db060e03278, spring-landed bfda838820e392ab; spring landed at review looked at.

## The seat at the approved's line (head d061e85e, main 5d7029b3 merged; round one of two)
Pushed as e6eed734, which is d061e85e with main 50c72767 merged (kit, status, one tool and one test; nothing under src, assets-src, public or config differs), so the pictures and numbers drawn on d061e85e stand for it. Whole vitest on e6eed734: 967 passed, 8 skipped, 288 s, steps.test.ts 130 s.
What was built, by grant in `assets-src/base-spring/build.mjs`, `layout.mjs`, `src/seasons/spring/base.ts` and `src/seasons/spring/mini/village.ts`:
- The roll's top falls 4.8 mm inward to the glass at the front (`TROUGH`, from `BROW_H` 42.5 mm), so the crown of the roll is the crest the camera sees and the miniature's bank shows over it. `CREST` moves the crown by azimuth; its 21 front nodes are fitted to the approved's fine lit edge with `/tmp/sk/fine.py` (greatest luma step in rows 725 to 760 of the approved against the top of the base in the ids view).
- The seat's line, hd review, build against approved: x 960: 743.0 and 743.0; from x 780 to 1160 within 2.2 px (worst at x 1160: 730.0 against 732.2; x 1120: 735.9 against 737.6). At x 760 the build is 5.6 px high: the flank's climb begins there.
- The rock's second colour number is the drop under the crown (a tenth to the millimetre); `liveLip` in base.ts lights the rim by it. The fringe of heads stands on the crown (`crownAt`). Twenty petals lie on the roll's shoulder (`ROLL_PETALS`, placed by `underCrown`); two stay on the body.
- village.ts: `SKIRT_FILL` 60, `SOIL.tone` and `SOIL.fill`, the bank's moss at half its gain, and the skirt's fill split into a fuzz term lit by the room, a warm lip term and the unchanged rock fill. `BANK`, `BANK_EARTH`, `BANK_TINT`, `BANK_SUN` and the lawn are as on main.
- Make target changed: `base-spring` only (127,661 triangles; spring by sum 1,493,434 of 1,800,000). The village asset was not remade.

Numbers, all on the tree of d061e85e:
- M3 spring-rest at review 0.9022: base 0.934 over 171,751 pixels, miniature 0.902 over 110,773 (main reads 0.8947: 0.900 and 0.895).
- Guards (hd draft): spring-rest c5cd17d91bc346bc, spring-landed 066fa33e081d9d26; the other six equal main's list.
- M4 of shakes 1 to 4: 0.9694, 0.889, 0.9571, 0.9608 (main 0.9694, 0.9434, 0.9571, 0.9608). Shake 2 fell by 0.054: the bank that now shows under the lawn is not hidden by the storm at the swap. It passes the kit's 0.85. M5: 0.9932, 1, 0.9878, 0.9998.
- 3840, film frames 1250 to 1253, final: one frame events (a pixel one channel at least T over its eight neighbours, absent within 6 px in the frame before and after) at 1251 and 1252: rim whole (1240,1400, 1400 by 160) 0 and 0 at T 32 and T 64; rim middle 0; right shoulder (2240,1395, 300 by 100) 0; bank through the glass (1400,1380, 1040 by 90) 0; whole base region (1100,1280, 1660 by 800) T 32: 2 and 2, T 64: 1 and 0. Share over 12 at the fine shift, 1250/1251 and 1250/1252: middle 1900,1420: 0.4 and 1.3; right rim 2240,1395: 0.2 and 0.5; shoulder 2360,1440: 0.9 and 2.2; the box 1900,1380 (100 by 60, the pond's moving water over the bank's top): 4.9 and 9.9.

Below the bar, by what shows most:
- The bank through the glass: a band about 40 px high of flat olive brown with cream caps; the approved has low dark green mounds with a warm fuzzy sunlit lip and the lawn's mounds over them (x 800 to 1100, brightest quarter at rows 705 and 715: build (99,88,53) and (90,82,54), approved (218,180,152) and (119,96,71); median at row 725: build (24,25,16), approved (38,42,30)). The caps show flat facets at 3840 (picture 43). The bank's top line is nearly straight (`MOUND.lipMm` in the village build is the lever, not tried). Its hue is the mesh colour times `BANK_TINT`, which is not in the grant.
- The roll is a brighter, more saturated green than the approved's dark olive (x 850 to 1070, median at rows 753, 756 and 759: build (56,66,34), (42,56,25), (31,45,19) against (45,54,33), (30,41,26), (26,36,25)).
- The rim's lit line: a cream band without the approved's beads of heads; the right shoulder (x 1180 to 1280) is a smooth lit slab where the approved has piled heads with dark creases.
- The petals on the roll read as dark mauve wedges at 3840 and are hard to see at hd; the approved's are pale grey pink, 6 to 10 px.
- M4 of shake 2 at 0.889.
Not seen: the film at speed; any camera but the hero; the low and medium tiers of the base's mesh.

## Round two (pushed as e020f831 = 4f917bac with main ed9180da merged; the numbers were read on 4f917bac, main 5b76c959 merged)
The report with every number is `report-round-two.txt` on this branch. Pictures 45 to 48.
What was built, in `src/seasons/spring/base.ts` and by grant in `src/seasons/spring/mini/village.ts`; no asset script changed and no make target:
- The critic's items of 21:32 first. The caps, stems, flowers and the petals on the roll take a warm light from above in the shade of the front (GROWTH_AFTER, the one fill line; cut where the low sun reaches, halved on pale paint). The roots in the shade of the front take the room's fill at 1.6, falling back to 0.55 from x 22 to 36 mm so the sunlit right keeps the roots' dark sides. The stones are unchanged.
- The roll's fill is lower and pulled part way to a warm grey olive (`liveRoll`, `liveOlive` in ROCK_AFTER).
- The bank through the glass: `BANK_TINT` (0.55, 0.62, 0.6); `turfRoom` greener with 0.22 of the moss's hue, lower on the mounds; the lip's sun takes 0.6 of the moss's hue at gain 760 with the catch squared.
- `MOUND.lipMm` 3.0 gives the lawn's edge its mounds but M4 of shake 2 reads 0.8847 under the floor 0.889, so it is 1.25 as on main (picture 46, bottom row).

What the measures taught:
- M3's base part is a plain ratio of fine energy, build over approved, and the build is under 1: anything that fills the dark sides of the sunlit roots on the right loses energy (fill of 1.6 on all bark read 0.905; with the fall from x 22 to 36 mm it reads 0.925).
- Matching the bank's box means to the approved made a flat pale band that read worse beside the approved: the approved's rows hold pale petals and lit lawn. Look, then measure.

Below the bar, by what shows most: the front's stones have no warm wrap and no lit bottom edge; the bank is scaly with flat lit facets and a straight top line; the roll is too grey by the median (green over red 1.19 against the approved's 1.48), has no beads on its lit line and a dark right shoulder face; the right flank's caps are dark; the petals on the roll read as pale domes at 3840; M4 of shake 2 stands at the floor.
Not seen: the film at speed, any camera but the hero, the low and medium tiers beyond their first picture.
