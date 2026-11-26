# Summer after Round 20: the third list of the same fix pass

`tools/briefs/p6/COMMON.md`, `summer-fix.md` and `summer-fix-2.md` hold as before, with the changes below. Read this file to the end, then your own section.

## Where summer stands now
Your five branches of the second list are in `main` at `bbc967b4` with the made assets (engine `7bed76e87f414806`). The merged picture was drawn at the review and the final tier, at rest and half a second after a landing; the pairs beside the approved images are attached to your start message, whole, at 400 px, and as crops of the base, the bank, the net of light and the ball.

It is a good picture now and it is still not the approved one. The critics have not seen it: this is the same fix pass, not a round. They see it after this list. Summer has two rounds left.

What a first look says, approved first, worst first:
1. The approved base is one mound of packed cream sand, carved by wind into soft waves, in low sun and soft shade. Ours is grey slate with dozens of thin dark level lines and a tan left end. At 400 px this is the first thing that differs.
2. The approved ball is crowded: seeds and lights overlap everywhere, also across the top and the upper right. Ours is a smooth pale haze with seeds in the upper left only, so it reads as fog.
3. The approved crown is one full canopy. Ours is five clumps on bare branches.
4. The approved bank of sand under the lawn is in shade with a lit rim and the lawn hanging over it. Ours is one flat bright cream band, the brightest thing in the lower ball.
5. The approved table has a wedge of sunlit sand at the left front, cut by the base's shadow, with the net of light running out of it. Ours has the net alone, as even thin lines.
6. The approved heap at the right is brightest against the base and thins outward. Ours is brightest further out, a wide flat sheet, and its fall is drawn as short dashes.

The approved images outrank this list. Where my words and the approved picture disagree, the picture is right: say so in your report. Twice in the second list my words were wrong and a builder said so; both are corrected below (the base's surface, the sand at the left).

## The ruler, extended
`node tools/briefs/p6/regions.mjs <our still> --steps` now prints for each region a second line: the luminance at the 10th, 25th, 50th, 75th and 90th percentile and the share of pixels between 40 and 80. Eight regions are new (the base's body in the middle and at the left, the bank's face, the bank at the left, the top centre of the ball, the heap near the base and further out, the sand at the left front). It still judges nothing.

MEASURED on `bbc967b4`, final tier, hd, hero, at rest (luminance at 10, 25, 50, 75, 90 percent; approved then ours):

| Region | Approved | Ours |
| --- | --- | --- |
| base front, whole | 42, 52, 68, 91, 115; 8.4% below 40 | 33, 47, 70, 106, 144; 17.9% below 40 |
| base body, middle | 37, 44, 52, 59, 70; 79.8% between 40 and 80; spread 14.8 | 28, 36, 52, 76, 127; 44.2% between 40 and 80; spread 40.6 |
| base top band, middle | 32, 41, 53, 66, 81; spread 22.8 | 30, 42, 56, 102, 171; spread 48 |
| base body, right | 44, 56, 72, 90, 108; bright end (137, 143, 152) | 41, 55, 74, 120, 147; bright end (197, 177, 154) |
| base body, left | 58, 74, 95, 118, 149 | 57, 78, 100, 123, 174 |
| bank face, centre | 56, 83, 132, 194, 223; middle (162, 127, 95); spread 61.3 | 166, 176, 184, 193, 201; middle (210, 182, 137); spread 13.7 |
| bank, left side | 39, 50, 78, 118, 188; middle (97, 76, 49) | 33, 42, 176, 201, 211; middle (200, 175, 134) |
| ball, top centre | 67, 78, 102, 157, 180; middle (112, 100, 82) | 58, 60, 64, 89, 154; middle (69, 62, 48) |
| ball, upper right | 79, 99, 131, 155, 176; middle (148, 129, 108) | 60, 63, 70, 97, 146; middle (76, 68, 53) |
| crown of the tree | middle (83, 72, 46); 23.4% below 40 | middle (68, 63, 36); 37.8% below 40 |
| heap, near the base | 64, 77, 126, 206, 229; 28.7% above 200 | 63, 92, 122, 154, 195; 7.2% above 200 |
| heap, further out | 32, 50, 114, 161, 208; 12.5% above 200 | 40, 51, 167, 205, 214; 31.9% above 200 |
| sand at the left front | 21, 28, 50, 110, 207; 12% above 200; bright end (251, 223, 186) | 18, 37, 63, 77, 105; none above 200; bright end (173, 132, 76) |
| net of light, table left | 6.4% above 200; 43.3% below 40 | 4% above 200; 37.1% below 40 |

Half a second after the landing: ball upper left, dark end (110, 96, 71) and spread 35.6 against ours (140, 118, 88) and 27.7; ball bottom band, spread 36.9 against ours 19.9.

What the numbers say that the eye gets wrong:
- The middle tone of our base is right (52 against 52 in the middle of the body). What is wrong is the spread: the approved stone is smooth (four fifths of the body's middle lies between 40 and 80), ours is streaked with black lines and bright dapples (a third below 40, a tenth above 127). It reads as slate because of the lines, not because it is dark.
- The approved ball is not clearer than ours at the top. It is half as bright again at the top centre and twice as bright at the upper right, and the light is in things (seeds, glints, discs), not in an even haze: its 75th and 90th percentiles stand far above its middle, ours lie flat at 60 to 64 up to the middle.

## Changes for this list
- First merge `origin/main` (`bbc967b4` or later, it holds the extended ruler from the commit that carries this file) into your branch. Never rebase, never force.
- Your limit is 45 minutes from your start message. Report at the limit with what is done, finished or not.
- Your own files, as before. `summer_glass` may add or change one light for the sand at the left front if `summer_sand` asks with exact lines (item 1 of the sand's list).
- Tune at `draft`, judge at `review` on the whole picture at rest and half a second after a landing, at 1200 px and at 400 px beside the approved image.
- Checks before the report: `npx tsc --noEmit`; `npx vitest run`; `winter-rest`, `spring-rest` and `fall-rest` at `draft` on your branch and on `origin/main`, file hashes compared (`summer_air` also the three `landed`); the strict run on the keys you touched if you changed a shader; the ruler's lines with `--steps` for your regions before and after.
- Report: ONE message to `/root`, at most 25 lines: each item as mended, bettered or not; the ruler's lines; your branch's head; the make targets to run; at most 4 pictures (JPEG, at most 1200 px), one of them the whole picture at rest beside the approved. Push your branch; if the push fails, try again after half a minute, then attach a bundle (`git bundle create <name>.bundle origin/main..HEAD`).

## The five lists

### `summer_stone` · `/root/summer_stone` · branch `agent/p6-summer-stone`
You said it yourself and you were right: the approved's lines are fewer, softer and wavier than level beds, and ours read as stacked slate. My second list asked for crisp strata; the picture does not show them. Follow the picture (crops `appr-base-left.jpg` and `appr-base-right.jpg`).
1. The surface. Packed cream sand, not rock: a fine even grain, single grains sparkling where the sun reaches it. Take every thin dark level line out. In their place four to six shallow troughs that wander: they rise and fall by up to 0.05 globe radii across the width, merge and part, each 0.02 to 0.04 radii wide with a soft shaded side that is at most 20 levels under its surround. On the lit left the shade in a trough is warm brown (red at least 25 above blue), on the right it is neutral. No hairline, nothing black, no hard edge anywhere on the body.
2. The top. The approved top is a thick rounded lip of packed sand, soft, with sand lying on it. My second list called it the rim of a sack and asked for a slab; the picture shows the lip. Round it again, keep it level, and let the glass sit in it with a thin line of shade.
3. The light. Keep the distribution you reached (lit left third and right end of the top band, the glass's shade in the middle, cool neutral right, warm left). Take the bright dapples out of the middle of the top band (90th percentile 81 against our 171) and narrow the body: middle of the body 37, 44, 52, 59, 70 with four fifths between 40 and 80; whole front no more than 10% below 40. The shade must come from the form and the light, on a pale albedo, never from dark paint.
4. The sea glass and the small things. Translucent: a soft glow inside each piece, lighter at its thin edge, with a small soft highlight (not a mirror). The approved also has pale amber and yellow pieces at the far left and the far right of the band and a few clear drops of water on the sand.
5. The dark dashes left of the top of the sand's fall (your sand layer in `src/seasons/summer/base.ts`, lines 405 and 410): out.
6. M3 on the base must hold above 0.75 at the final tier with the lines gone: the fine grain carries it, not the lines.

### `summer_air` · `/root/summer_air_p6` · branch `agent/p6-summer-air`
The seeds read as seeds now. There are too few of them, they stand apart, and they fill only the upper left.
1. The crowd. About twice as many in sight (120 to 140), across the whole upper two thirds of the ball: the top centre, the upper right up to the flare, in front of the crown and beside it, a few low before the cottage. They overlap. Near the glass a dozen large soft ones, tuft up to 0.07 globe radii across; far ones small and sharp. Keep each seed as you made it. Targets with your layers and the glow together: ball, top centre 67, 78, 102, 157, 180; ball, upper right 79, 99, 131, 155, 176. Do not raise the counts at the medium and low levels of quality beyond what keeps the frame time; say what you did there.
2. The lights. More of the middle and large soft discs across the top and the right, so that at 400 px the ball sparkles all over and not in one corner.
3. The storm. More dark between the streaks: ball upper left, dark end near (110, 96, 71) and spread at least 33 (ours 140, 118, 88 and 27.7); and the low band not one flat white: spread near 37 (ours 19.9), with the lanterns showing through as warm discs.
4. M4 for the four shakes must hold above 0.85.

### `summer_glass` · `/root/summer_glass` · branch `agent/p6-summer-glass`
1. The glow, where it is still missing. The top centre and the upper right are flat and dim (middles (69, 62, 48) and (76, 68, 53) against (112, 100, 82) and (148, 129, 108)). The sun is behind at the right: the liquid is brightest toward the flare, in a soft lobe about 0.6 radii wide that fades to the left and down, warm (red above green by a seventh). The air's builder doubles the seeds there; with your glow alone aim at a 25th percentile of about 78 at the top centre and 99 at the upper right. Do not raise the low left further.
2. The net of light. Right in kind and place, too even. The approved filaments are thick and nearly white within 0.3 radii of the node (2 to 3 px at hd) and thin out to hair at their tips; they waver, swell into bright knots and break; lit grains of sand sit along them as single sparks. 6.4% of the region above 200 (ours 4%), the table between them black as now.
3. A light for the sand at the left front, only if `summer_sand` asks with exact lines: the low sun reaching the table to the left of the base, cut by the base's shadow.
4. Only when 1 and 2 are done: the room's discs with a crisper edge (left from the second list).

### `summer_sand` · `/root/summer_sand` · branch `agent/p6-summer-sand`
You were right about the left: the approved shows a pale lit band of sand there and my second list asked for it dark.
1. The sand at the left front (crop `net.jpg`). A thin sheet of sand on the table from under the foot to the left and forward, about 0.9 radii long, lit by the low sun as one bright wedge: pale cream (251, 223, 186) at its brightest, a tenth of the region above 200, with the base's shadow cutting it in a straight soft edge and single grains sparking beyond it. The net of light runs out from under it. If you need a real light for the wedge, ask `/root/summer_glass` with exact lines, once.
2. The heap at the right. Brightest against the base, thinning outward: near the base 28.7% above 200 (ours 7.2%), further out 12.5% (ours 31.9%). Higher against the flank, a hollow slope, and past 1.25 radii a thin scatter of single grains on a table that shows through, not a sheet. In the body of the heap the grain reads as noise: smooth it, and keep sparkle on the lit crest only.
3. The fall. Ours is drawn as short straight dashes, some of them dark. Approved: a fine soft veil of grains, like mist, brightest at the top. Round grains, no stroke longer than 3 px at hd, none darker than the stone behind them.

### `summer_mini` · `/root/summer_mini_p6` · branch `agent/p6-summer-mini`
1. The crown. Its size is right (0.8 radii wide, 0.65 tall, as the approved). It is not full: five masses with the room showing between them. Approved: one broad canopy of 10 to 14 overlapping clumps, the gaps no more than a tenth of its outline, the lit sides as you made them, deep shade between and under. This needs the mesh (`npm run make -- tree-summer`), not the shader alone. Crown middle toward (83, 72, 46), at most a quarter below 40.
2. The bank (crop `band.jpg`). I asked for bright cream and you gave it; the whole face is now one flat bright band (spread 13.7 against 61.3). Approved: the face in soft shade, middle (162, 127, 95), a lit rim along its top edge near white at the left, single lit grains, and the lawn ending over it in ragged tufts with shade under them. At the left side of the ball the approved bank is mostly hidden by grass and fence and dark (middle (97, 76, 49) against our (200, 175, 134)).
3. Only when 1 and 2 are done: the far edge of the lawn as mounds, the pond a quarter larger (left from the second list).
