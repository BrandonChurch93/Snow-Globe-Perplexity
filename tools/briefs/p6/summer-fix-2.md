# Summer after Round 20: the second list of the same fix pass

`tools/briefs/p6/COMMON.md` and `tools/briefs/p6/summer-fix.md` hold as before, with the changes below. Read this file to the end, then your own section.

## Where summer stands now
All five branches are merged into `main` at `0e9dbcca` with the made assets. For the first time there is one picture with all five parts in it: `summer-rest` and `summer-shake` at the final tier, attached to your start message beside the approved images, whole and at 400 px. Each of you said of your own part: bettered, not mended. So do I. This is not a new round; the critics have not seen it. They see it after this list, and summer has two rounds left.

What the whole picture says at the size of a feed, approved first:
- The approved ball glows and sparkles with seeds. Ours is a dark sky with white stars.
- The approved base is carved stone in low sun, with deep shade. Ours is evenly lit and reads grey.
- The approved heap of sand at the right is the brightest thing outside the ball. Ours is a dark wedge with one lit edge.
- The approved net of light is fine gold thread. Ours is a white bolt of lightning.
- The approved storm is fine streaks with dark between them and a bright haze low. Ours is an even cream fog of short thick strokes.

The approved images outrank this list. Where my words and the approved picture disagree, the picture is right: say so in your report.

## The ruler
`node tools/briefs/p6/regions.mjs <our still>` cuts fifteen regions of the object (in globe radii about the globe's centre) from the approved image and from ours and prints for each three colours: the dark end, the middle and the bright end (2nd, 50th and 98th percentile of luminance), the share of pixels above 200 and below 40, and the spread. For the storm add `--approved references/approved/summer-shake.png`. It judges nothing. It says which way a thing is off, and it has already corrected my eye twice (below). Run it on your `review` or `final` still before and after, and give your regions' lines in the report.

MEASURED on `0e9dbcca`, final tier, hd, hero. Rest, as middle and bright colours, approved then ours:

| Region | Approved | Ours |
| --- | --- | --- |
| base front, whole | (74, 67, 57) and (197, 164, 120), 8.4% below 40 | (111, 98, 80) and (186, 171, 142), 1.9% below 40 |
| base top band, left third | (110, 80, 51) and (250, 221, 181), 4.3% above 200 | (136, 110, 76) and (192, 166, 126), none above 200 |
| base top band, middle | (59, 51, 41) and (136, 108, 81), 22.7% below 40 | (99, 85, 70) and (160, 140, 110), 0.1% below 40 |
| base top band, right end | (84, 88, 91) and (246, 216, 187), 4.6% above 200 | (111, 103, 94) and (207, 188, 162), 0.5% above 200 |
| base body, right | (74, 72, 69) and (137, 143, 152) | (109, 101, 91) and (183, 168, 148) |
| base body, lower left | (130, 90, 50) and (210, 185, 141) | (173, 126, 68) and (180, 175, 142) |
| heap, table right | (145, 112, 88) and (253, 236, 209), 19.9% above 200 | (86, 79, 67) and (237, 217, 186), 10.2% above 200 |
| net of light, table left | (65, 45, 27) and (252, 237, 201), 6.4% above 200, 43.3% below 40 | (122, 84, 42) and (254, 239, 216), 13.7% above 200, 21.5% below 40 |
| ball, upper left | dark end (63, 58, 47), middle (122, 106, 81), bright (241, 220, 173), 4.1% above 200 | dark end (41, 44, 37), middle (76, 71, 52), bright (202, 194, 155), 1.4% above 200 |
| ball, upper right | (148, 129, 108) and (236, 211, 167) | (50, 53, 45) and (204, 190, 144), 10.8% below 40 |
| crown of the tree | (83, 72, 46) and (234, 209, 160), 23.4% below 40 | (32, 34, 16) and (182, 175, 134), 58.3% below 40 |
| cottage | (89, 56, 33) and (249, 208, 129) | (115, 88, 36) and (242, 211, 138) |

The storm, half a second after the landing:

| Region | Approved | Ours |
| --- | --- | --- |
| ball, upper left | dark end (110, 96, 71), middle (199, 168, 127), bright (252, 232, 197), spread 35.6 | dark end (159, 138, 105), middle (204, 182, 146), bright (238, 215, 181), spread 22.4 |
| ball, upper right | dark end (76, 70, 43), middle (206, 175, 137), spread 38.9 | dark end (112, 93, 61), middle (204, 182, 147), spread 28.5 |
| ball, bottom band | (210, 177, 130) and (252, 232, 200), 35.4% above 200 | (165, 139, 103) and (232, 206, 165), 9.6% above 200 |

What the numbers say that the eye gets wrong:
- The approved base is not paler than ours. It is darker in its middle tones and has what ours lacks: near white sunlit stone on the left third and the right end of its top band, deep shade under the glass (a quarter of the middle of the top band is below 40, ours has none), and a cool neutral shade at the right. It reads as cream because it is lit, not because it is pale.
- The approved ball is not darker and clearer than ours. It is half as bright again at the upper left and three times as bright at the upper right, and warm: the liquid glows. Ours reads as fog only because nothing bright stands on it.
- The approved storm is not whiter than ours. Its middle is the same cream and warmer; it has dark between its streaks (dark end 110 against our 159) and a far brighter haze low down.

## Changes for this list
- First merge `origin/main` (`0e9dbcca` or later) into your branch. Never rebase, never force. If `origin/main` does not hold `tools/briefs/p6/regions.mjs` yet, copy the attached file to that path in your clone and do not commit it.
- Your limit is 40 minutes from your start message. Report at the limit with what is done, finished or not.
- Your own files, as in the first list. The lights that reach the base, the sand and the table stay as they are at `0e9dbcca`: `summer_stone` and `summer_sand` bring their parts to the approved picture with their own materials against that rig, and `summer_glass` changes those lights only if one of them asks with exact lines.
- Tune at `draft`, judge at `review` on the whole picture at rest and half a second after a landing, at 1200 px and at 400 px beside the approved image.
- Checks before the report: `npx tsc --noEmit`; `npx vitest run`; `winter-rest`, `spring-rest` and `fall-rest` at `draft` on your branch and on `origin/main`, file hashes compared (`summer_air` also the three `landed`); the ruler's lines for your regions before and after. The round's gate runs the rest.
- Report: ONE message to `/root`, at most 25 lines: each item as mended, bettered or not; the ruler's lines; your branch's head; the make targets to run; at most 4 pictures (JPEG, at most 1200 px), one of them the whole picture at rest beside the approved. Push your branch; if the push fails, attach a bundle (`git bundle create <name>.bundle origin/main..HEAD`).

## The five lists

### `summer_air` · `/root/summer_air_p6` · branch `agent/p6-summer-air`
1. The seeds at rest. This is the first thing wrong with the whole picture and a must-fix of the fresh review (open item 220: summer reads as snow at the size of a feed). Ours are white asterisks: six to eight thick straight spokes of one length crossing at a centre, all alike, all face on. They read as snow crystals or stars. A seed in the approved image is: a hair-thin stalk about two and a half times the tuft's radius long with a small dark seed at its lower end, and at its top a tuft of 25 to 40 filaments finer than a pixel at hd, spreading as a shallow cone, so that from the side it is a fan opening away from the stalk and from its tip a disc of fine spokes with a soft centre. Every tilt occurs. Sizes vary one to three with depth; the near ones are large and soft, the far ones small and sharp. About 40 to 55 are in sight, most in the upper left two thirds of the ball, some across the crown. Warm white, about (255, 244, 225), brighter on the side of the sun (behind, at the right). No two alike: tilt, size, spread and filament count vary by the seed's own number. The test: at 400 px the ball must not read as a night sky or as snow, and at 1200 px each seed must read as a seed.
2. The storm. Ours is short thick strokes with pointed ends (about 3 px by 30 to 60 at hd) spread evenly on an even cream fog: it reads as chopped straw. Approved: hair-fine streaks (1 px, 60 to 200 px long, curved along the whirl), among them whole seeds with their fans a little smeared, dark between the streaks so that the crown and the room show through (dark end of the upper ball 110, 96, 71 against our 159, 138, 105; spread 35.6 against 22.4), the lanterns glowing through as warm discs, and a bright haze low down that makes the ground and the foot of the tree nearly white (bottom band 35.4% above 200 against our 9.6%). So: strokes to a third of their width and twice their length, their brightest near (252, 232, 197), the even fog out of the upper two thirds, the bright haze into the lowest fifth, 30 to 50 whole fans near the glass. Keep the green leaf bits, fewer and darker. Do not raise the counts at the medium and low levels of quality; the fineness comes from the stroke.
3. The fireflies. Ours are small even dots. Approved has three sizes: many small sharp beads, some middle ones with a halo, and 10 to 15 large soft discs out of focus (two to three times the middle ones, flat, a slightly brighter edge, half see-through), green-yellow from (190, 230, 90) to (230, 240, 120).
4. The dust. Ours is an even field of tiny dots that sums to an olive veil (upper left middle 76, 71, 52, red about equal to green). Approved: single gold glints on a warm glow. The glow is the glass builder's and is on its list; yours is to make the dust single glints, warm, a few hundred, and to say in the report how much of the ball's brightness your layers give (draw the rest still with your layers off and run the ruler).
5. Only when 1 to 4 are done: something resting on the roof, the haze's edges.

### `summer_glass` · `/root/summer_glass` · branch `agent/p6-summer-glass`
1. The glow of the liquid. You made the top of the ball dark; the approved ball is bright and warm all through: upper left dark end (63, 58, 47), middle (122, 106, 81); upper right middle (148, 129, 108) against our (50, 53, 45). Bring the glow up through the whole ball, warm (red above green by about a seventh, ours is olive), brightest low at the left behind the cottage where the approved has a white-hot patch on the glass (low left bright end 248, 224, 188 with 5% above 200; ours 224, 197, 141 with 1.8%). The seeds and fireflies of the air's builder add to the middle; aim at the dark end with your glow alone, about (60, 55, 45) at the upper left and (70, 65, 50) at the upper right.
2. The net of light on the table. Ours reads as a white bolt of lightning: thick jagged trunks with bloom. Approved: fine gold filaments, 1 to 1.5 px at hd, about (255, 195, 100) fading to amber at their tips, smooth forking curves, dozens of them from one small bright node under the front left of the foot, most of them dim, with single lit grains between. No zigzag, no white trunk, no bloom wider than the node. By the ruler ours has twice the bright area (13.7% above 200 against 6.4%), half the black (21.5% below 40 against 43.3%) and twice the middle (122, 84, 42 against 65, 45, 27): thinner, dimmer, on a table that stays black between the threads. It also lights the lower left of the base too much (173, 126, 68 against 130, 90, 50).
3. The glass at the left. Ours has three or four broad milky arcs across the left third of the ball. Approved: one thin bright line at the limb, a few short soft streaks high at the upper left, and the white-hot patch of item 1 low at about eight o'clock (about 0.12 radii wide and 0.25 tall, white core, amber edge). Take the broad arcs down to a third or out.
4. The flare at the upper right. Approved: a white core on the rim, 12 to 16 fine rays reaching about 0.3 radii, a tight warm halo. Ours: a small core, a few faint rays and a broad amber disc of glow beside it.
5. Only when 1 to 4 are done: the room's discs with a crisper edge.
6. Do not change the lights that reach the base, the sand or the table in this list, unless `summer_stone` or `summer_sand` asks with exact lines.

### `summer_stone` · `/root/summer_stone` · branch `agent/p6-summer-stone`
1. Light, not paleness. Read the ruler's first six lines above. The approved base is darker than ours in the middle (74, 67, 57 against 111, 98, 80) and it has near white sunlit stone on the left third of its top band (bright end 250, 221, 181, 4.3% above 200; ours 192, 166, 126 and none) and at the right end (246, 216, 187), deep shade under the glass in the middle of the top band (22.7% below 40; ours 0.1%), a cool neutral shade on the right of the body (middle 74, 72, 69, bright end 137, 143, 152, bluer than ours) and a warm brown lower left (130, 90, 50; ours 173, 126, 68). Ours is one even tone and so reads grey. Bring it to that distribution with your own material against the rig as it stands: the sunlit patches as soft-edged warm light broken by the ridges, with small cast shadows; the shade of the glass on the middle of the top band; middle tones down by about a third. If you need a real light, ask `/root/summer_glass` with exact lines, once.
2. The surface. Ours has broad soft folds that run like draped cloth and ends at the top in a thick soft roll like the rim of a sack, with a waist under it. Approved: five to seven strata flowing level round the body, each with a crisp upper edge that catches the light as a thin bright line and a thin shadow under it, and at the top a slab with an uneven, slightly overhanging edge; the glass sits in a shallow socket with a thin lip. Fill the waist; crisp the edges.
3. The sea glass. Ours are saturated wet gems with mirror highlights (emerald, cobalt). Approved: frosted, pale and matt with a soft sheen: mint about (170, 215, 190), aqua (150, 200, 205), one deeper green, one dulled cobalt (70, 110, 170), a little light through the thin edges, no mirror highlight.
4. The shells. Ours are the tan of the stone. Approved: white to cream with a rosy or peach tint, brighter than the stone round them, each with a soft shadow in its seat.
5. M3 on the base must hold above 0.75 at the final tier (your 1.027).

### `summer_sand` · `/root/summer_sand` · branch `agent/p6-summer-sand`
1. The heap at the right. Ours is a dark grey-brown wedge with one hard lit edge at its top left; at 400 px it is a dark triangle. Approved: after the flare the brightest thing outside the ball (middle 145, 112, 88 against our 86, 79, 67; 19.9% above 200 against 10.2%), a low wide drift of pale cream sand that begins on the base's right flank at about half its height, falls in a hollow slope and runs out to the right and forward as a thin sheet for about 1.2 globe radii, its edge breaking into single sparkling grains. Soft everywhere: no ridge line, no flat facet, no hard shade line. The low sun from behind at the right rakes it. Reach it with your own material against the rig as it stands (albedo, and light scattered back through the grains if needed); if you need a real light, ask `/root/summer_glass` with exact lines, once.
2. The fall. Approved: a soft see-through veil of grains down the right flank of the base from its top edge, about 0.15 radii wide, brightest at the top where the sun catches it, single grains flying off to the right. Ours: a thin bright line at the top right and a spray of dots. Widen, soften, thin out.
3. The left. Approved has a thin sheet of sand from under the foot to the left front, dark, with single grains that spark where the net of light runs over them. Ours is a lit dusting that makes the table amber (the region's middle is 122, 84, 42 against 65, 45, 27, shared with the net of light, which its builder thins). Keep the table black there and the grains single.
4. The foot. The ragged dark gap between the foot of the base and the sand at the right must go: sand lies up against the stone.
5. The single dark pixels in the thin edge at the right (x 1280 to 1340, y 690 to 870 at hd).

### `summer_mini` · `/root/summer_mini_p6` · branch `agent/p6-summer-mini`
1. The crown of the tree, the largest thing in the ball. Ours is an even dark green stipple with no lit side (middle 32, 34, 16; 58.3% below 40). Approved (middle 83, 72, 46; 23.4% below 40; part of that is the glow and the seeds before it): 8 to 12 clear clumps, each with a bright yellow-green lit side to the right and top (the sun is behind at the right) over deep green shade, gold along the edges against the glow. Give the clumps form and a lit side.
2. The band at the bottom of the glass. Ours is a flat tan band with a hard jagged dark line on top; it reads as a cut through soil. Approved: a low bank of bright cream sand seen through the glass (about 231, 197, 154 where I measured a small box of it, against our 126, 107, 76), granular and lit, near white at the left where the low sun reaches it, on which the lawn ends in ragged tufts with little drifts of sand lying over its edge. In front it stands about 0.07 globe diameters high against our 0.11: lower it or hide more of it behind taller grass.
3. The lanterns and their light. The approved lanterns bloom: an orange-cream body with a brighter core, the large one at the trunk nearly white-yellow in its middle, and their light on the walls and the trunk is orange (the cottage's middle is 89, 56, 33, red well above green; ours 115, 88, 36 is yellower and greener). Raise the cores, keep the ribs, warm the light they throw.
4. By the ruler the cottage and the pond are near the approved in brightness; leave their levels. If time is left: the far edge of the lawn as mounds, and the pond a quarter larger.
