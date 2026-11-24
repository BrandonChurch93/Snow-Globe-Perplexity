# Recipe: the glass and the liquid

The parts `glass` and `liquid` ship no file. Everything is computed in `src/globe/shell.ts` from the constants in `glassLook`, in five draw calls (the view through the liquid, the wall, the bubble, the depth stamp, the ring at the limb), 41984 triangles, no texture. State reached: `built`.

## src/globe/shell.ts (`glassLook`)
Made by: hand, fitted with `assets-src/glass/measure.mjs` and `assets-src/glass/profile.mjs` (Node 20.20.2, sharp)
From: `references/approved/winter-rest.png`, `tools/lib/refcam.mjs` (the camera of the approved image), `config/showcase.json`
Prompt or command: `node assets-src/glass/measure.mjs`, then the loop in "Making it again" below
Takes: 0 generated assets. 28 tuning looks in the first round, 37 in the finishing round (limit 40 a round)
Why this one: three reflections of one window, the wall zone, the through view and the bubble land within about 15 of the approved image in the open liquid, the top cap and the panes; the ring at the limb puts the rim within about 15 at 105 to 200 degrees and at -30 to -54 degrees; the gap between the panes, the pane's edges and the bubble's rings are further off (see "Still off")
Date: 2026-11-24

## What the approved image holds

Glass outline in `winter-rest.png`: centre (1409, 646), radius 549 px. "Share" is the distance from that centre as a fraction of the radius; angles run counter-clockwise from 3 o'clock. Colours are display values, median or 3 by 3 mean.

| Feature | Where | Colour |
| --- | --- | --- |
| First pane (outer face) | share 0.93 to 0.975, angle 18 to 66, tip at 72 | (193, 211, 230) at its inner edge, rising to (241, 244, 249) at the outer edge |
| Second pane (inner face) | share 0.80 to 0.865, angle 18 to 46, tip near share 0.835, angle 49 | (166, 198, 224) inside, rising to (251, 250, 253) at a sharp outer edge |
| Third band | share 0.71 to 0.755, angle 16 to 44 | (63 to 80, 92 to 123, 120 to 158) |
| Gap between the first two panes | share 0.87 to 0.92 | (63 to 136, 90 to 146, 114 to 161), blue |
| Just past the first pane's tip | angle 70, share 0.955 and 0.985 | (40, 99, 143) and (64, 109, 147), saturated blue |
| Dark band inside the rim | share 0.978 to 0.989 | right (80 to 102, 124 to 140, 145 to 169); top (14, 51, 78) |
| Rim line | share 0.99 to 1.0 | right (143 to 214, 164 to 224, 184 to 250); top and left no brighter than the wall zone |
| Wall zone, left and top | share 0.969 to 0.997, angles 110 to 160 | (71 to 90, 92 to 118, 104 to 139) |
| Room outside | beyond share 1.01 | (9, 27, 42), no halo |
| Open liquid | centre, mid left, left low | (34, 50, 65), (40, 54, 69), (38, 57, 74) |
| Top cap | angle 100, share 0.75 to 0.96; jump at 0.75 | (62 to 79, 86 to 121, 106 to 151) above (30 to 37, 48 to 53, 61 to 71) |
| Left soft arc | share 0.74 to 0.78, angles 170 to 200 | (33 to 64, 67 to 105, 86 to 139) on (28 to 32, 48 to 51, 62 to 65) |
| Bubble | about 190 by 60 px (20.8 mm wide), share 0.876 to 0.985 at the crown | ring (80 to 111, 84 to 119, 95 to 130) below, white swirls on the left up to (164, 203, 234); flat patch (84 to 94, 111 to 117, 126 to 134), its left part (158, 188, 213), warm glints (82, 81, 74) under it; around it (58, 88, 114) |
| Collar | lowest band | thin dark shadow line, the snow bank seen through the band, no bright wedge at the corners |
| Limb band, key side | share 0.995, angles 45, 55, 62, 66, 70, 74, 78, 84 | (155, 181, 200), (123, 166, 197), (155, 202, 234), (171, 210, 239), (141, 186, 223), (95, 132, 161), (58, 95, 118), (40, 68, 87) |
| Limb band, inside the rim line | share 0.987, angles 45, 62, 66, 70 | (105, 145, 165), (104, 159, 198), (81, 137, 180), (59, 110, 153) |
| First pane across | angle 45, share 0.943 to 0.972 | (208 to 232, 223 to 243, 237 to 252) |
| First pane, tip | angle 66 then 70, share 0.957, 0.965, 0.972 | (143, 187, 225), (174, 199, 223), (201, 218, 235) then (51, 117, 168), (110, 164, 211), (186, 213, 242) |
| Beyond the first pane's tip | angles 74 to 84, share 0.943 to 0.98 | (18 to 47, 47 to 78, 65 to 111), deep blue |
| First pane, low tail | angle 10, share 0.943 to 0.972 | (118, 134, 154), (142, 155, 173), (134, 142, 157), (98, 113, 129) |
| Second pane, lower end | share 0.82 to 0.85 ends between angles 17 and 20; share 0.805 runs on to about 15.5 | bright (167 to 237, 194 to 250, 219 to 254) above the end, (52 to 94, 72 to 123, 91 to 152) below it |
| Gap between the panes | share 0.885 to 0.90, angles 20 to 30 | (63 to 112, 90 to 138, 114 to 159) |
| Third band | share 0.72 to 0.75, angles 20 to 40 | (38 to 80, 72 to 123, 98 to 158), brightest at its inner edge |
| Right of the tree, no reflection | share 0.66 to 0.705, angles 20 to 40 | (34 to 48, 53 to 67, 68 to 91) |
| Left wall zone | angle 160 then 110, share 0.972 to 0.995 | (113, 125, 138), (79, 99, 113), (78, 100, 114), (81, 99, 110) then (80, 104, 122), (81, 106, 122), (72, 95, 111), (49, 69, 83) |
| Upper left under the frost | angles 120 and 150, share 0.82 to 0.94 | (95 to 130, 105 to 149, 124 to 167) |
| Bubble, closer | flat patch, its left, its right, above it | (94, 119, 137), (123, 143, 161) up to (198, 224, 249), (78, 102, 120), (51, 81, 101) |
| Bubble, rings | low edge of the patch, between the rings, outer ring bottom, left, right | (78, 78, 74) with glints to (255, 253, 246); (93, 113, 128); (111, 113, 122), (81, 126, 154), (58, 82, 97) |

The bubble's span, share 0.876 to 0.985, equals a lean of 16 degrees toward the viewer; strict true up would put it at share 0.964 to 1.0. `glassLook.bubble.leanDeg` holds that choice.

The three reflections, so that nobody mixes them up again: the first (outer face) is the bright band along the limb, share 0.93 to 0.975; the second (inner face) is the main window pane on the shoulder, share 0.80 to 0.865; the third is the thin arc at share 0.72 to 0.75. `glassLook.window.orders` holds them in that order, then the through view.

The tone curve is the one in `src/post/grade.ts`: x(2.51x + 0.03) / (x(2.43x + 0.59) + 0.14), glow from 0.9. Linear light before it against display value: 0.016 is 34, 0.045 is 57, 0.06 is 71, 0.10 is about 100, 0.14 is 122. The white of the panes needs about 1.25 to 4.0 in blue and 0.5 to 1.0 in red, so the panes are capped per channel between `glassLook.shoulder.from` and `.to` (1.4 and 3.6). Read the curve again if the grade changes; the levels below were fitted on it.

What the room gives and what the glass takes from it (main `b6ab917`): every reflection and the through view read `stageRoomSeen` (wall, wash, the discs through `stageRoomLights`, and the room's two sources at the 1.2 percent the backdrop draws). `stageRoom` at full strength puts the room's window (16.7 by 31.8 degrees at the key's direction) on the outer face at share 0.5 to 0.8, a grey block where the approved image is clear; that is why the highlight is the glass's own limb window, fitted to the approved panes, lit by `f.keyCol`. The sky colour the glass sees is the hue of `kit.backdrop.room` at the luminance of `f.ambient` times `room.level`, so a change of the rig's sky hue does not tint the liquid.

## Still off

Against the approved image on the last look of the finishing round (g8, the fit camera, hd draft), worst first: the inside is not squeezed toward the rim and no mirrored band shows at the very edge (the lens in `src/globe/lens.ts` is unchanged); the main pane is a white blade with crisp edges where the approved pane feathers to blue inward and ends broad at 46 degrees (ours tapers above 36); the gap between the panes at share 0.860 to 0.867 is (52 to 114, ...) against (94 to 156, ...); in the lower half the ring covers the frost in the outer 3 percent, so the band there is smooth where the approved image is frost to the edge; the approved outline sits about 3 pixels inside the fitted circle at 195 to 200 degrees and the render's does not; the bubble's lip is brighter on the left and its rings fewer; the render's sphere sits 3.3 approved pixels left and 9.2 higher than the approved outline with a radius 3.9 smaller (layout and cameras, not the glass).

## Making it again for another season

1. Render the frame the approved image was taken from and put it beside the image:
   `npm run texpack && npm run build && npm run fit -- --season <season> --tier draft --box 820,60,2000,1260 --name glass --force`
2. Read the approved image along rays from the glass centre and in the open liquid:
   `node assets-src/glass/profile.mjs --season <season> --rays 10,30,40,70,100,110,160 --from 0.66 --to 1.02 --step 0.01`
   `node assets-src/glass/profile.mjs --season <season> --patches`
   The patch boxes in `profile.mjs` are winter's open liquid; move them to where no miniature stands in the new image.
3. Find the window. In `assets-src/glass/measure.mjs` set the outline of each pane as (share, angle) pairs, then run `node assets-src/glass/measure.mjs`. It traces each outline off the sphere into the room and prints the window's centre, its two axes and the span in degrees along and across. Put the first pane's centre and axes in `glassLook.window` and each pane's span in `glassLook.window.orders` (first reflection, second, third, and the through view, which reuses the first).
4. Set the inner faces. `second.face` and `third.face` are the radii, as a share of the glass, of the faces that make the second and third images; move them until the panes sit at the measured shares (0.72 and 0.6 for winter).
5. Set the levels with the table above. Start with the open liquid: `room.level` and `room.tint` until the centre patch reads the approved value, then `through.lift`. `window.level` and `window.gain` and the first order's `inner` and `power` give the limb band's ramp; `second.gain`, `second.tint` and `third.gain` scale the other two; each order's `cutDeg`, `cutSlant` and `tail` cut its lower end on a slanted line and leave a dim tail (winter's second pane: -12, 0.39, 0.035; -90, 0, 1 means no cut); `edgeDeg` holds the edge softness (`tipInner` near the tip, `cut` at the cut); `window.halo` is the blue around the panes and in the gap; `window.dark` is the dark sector beside the tip; `ceiling` is the lighter cap above share 0.75; `body` and `edge` are the wall zone and the rim line (the bright side follows `f.keyDir`, the far side `f.rimDir`); `strip.gain` is the soft arc on the far side per reflection, and its fourth value, the through view, stays 0 or a pale block shows at mid height on the right.
6. Loop until the rays agree. `npm run fit` hides shader errors, so check for them each time:
   `npx tsc --noEmit && npm run build && npm run fit -- --season <season> --tier draft --box 820,60,2000,1260 --name glass --force`
   `npm run still -- --season <season> --state rest --camera hero --tier draft --format preview --diag normals 2>&1 | grep -i error`
   `node assets-src/glass/profile.mjs --season <season> --patches --looks <tag>` writes `out/work/fit/<tag>-glass.jpg`, `-shoulder.jpg`, `-crown.jpg` and `-collar.jpg`, approved beside render.
7. The bubble: `glassLook.bubble` holds its width, depth, the flat patch against the wall (`patch`), the widest ring (`waist`), the lean and how far it slides and wobbles with `f.liquid`. Check it at `landed` as well as `rest`.
8. The ring at the limb (`glassLook.ring`) is the fifth draw, after the frost, and carries the outline. It takes the exact ray of each pixel, so its edge is the true silhouette. `from`, `to` and `soft` are where it starts; `side`, `low` and `wallSide` bound the top and upper left, where it is a translucent wall (`keep`, `cover`, `wall`) with a bright line at the outline (`edge`, `line`, `lineTop`, `lineMix`); in the lower half (`low`, `lowEnd`) it covers what lies under it, replaces the mirror of the lit base in the last pixels by `lowLine` over `lowAt`, and reaches `reach` of the radius so that no bright pixel of the frost shows outside the silhouette (`night` is the room's tone there). Read the rim in polar boxes, approved beside render, and move one value at a time:
   `node assets-src/glass/polar.mjs approved 1410.9,652.7,553.1 60,210,15 0.956,1.0,0.006 50 rgb <season>`
   `node assets-src/glass/polar.mjs <the still that npm run fit printed, under out/work/stills/> 1407.6,643.5,549.2 60,210,15 0.956,1.0,0.006 50 rgb`
   The three numbers after the file are the centre and radius of the glass circle in pixels of a 2816 by 1584 frame (`node assets-src/glass/outline.mjs` fits them); then angles from, to, step in degrees (0 is right, 90 is up), shares from, to, step, the percentile, and `rgb` or `lum`.
9. Test: `npx vitest run`, `npm run determinism`, the fit of step 1, stills at `rest` and `landed` from `hero`, `macro`, `low` and `interior`, `--diag standins`, and once at `--format hd`.
10. After every merge of `origin/main` run the loop of step 6 once and read the patches: the rig, the room and the grade all move the glass. If the open liquid drifts, only `room.level` should need to change.
