# Recipe: the glass and the liquid

The parts `glass` and `liquid` ship no file. Everything is computed in `src/globe/shell.ts` from the constants in `glassLook`, in five draw calls (the view through the liquid, the wall, the bubble, the depth stamp, the ring at the limb), 41984 triangles, no texture. State reached: `built`.

## src/globe/shell.ts (`glassLook`)
Made by: hand, fitted with `assets-src/glass/measure.mjs` and `assets-src/glass/profile.mjs` (Node 20.20.2, sharp)
From: `references/approved/winter-rest.png`, `tools/lib/refcam.mjs` (the camera of the approved image), `config/showcase.json`
Prompt or command: `node assets-src/glass/measure.mjs`, then the loop in "Making it again" below
Takes: 0 generated assets. 28 tuning looks in the first round, 37 in the finishing round; in the closing rounds 19 by the builder and about 26 by the closer up to the Round 6 freeze (over the limit of 40 if every crop counts as one), and 40 in the round to the Round 7 freeze (limit 40 a round)
Why this one: three reflections of one window, the wall zone, the through view and the bubble land within about 15 of the approved image in the open liquid, the top cap and the panes; the ring at the limb puts the rim within about 15 at 105 to 200 degrees and at -30 to -54 degrees; the gap between the panes, the pane's edges and the bubble's rings are further off (see "Still off")
Date: 2026-11-24

### What the approved image holds

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

### Still off

Against the approved image at the Round 7 freeze (the fit camera, hd draft), worst first:

1. The bubble at the crown (Round 6, R1: "a flat oval disc" where the approved image has "a raised neck ring with visible glass thickness"). The approved feature's upper oval spans shares 0.941 to 0.99 and its ring's lower edge 0.889 to 0.914; the render's patch spans 0.925 to 0.961 and its ring's lower edge 0.867 to 0.878. On the centre column the patch sits about 15 px of the 2816 frame too low, with a dark gap (53 to 55 against 88 to 111) between it and the outline; below the patch the levels agree within 10. The lens presses everything inside the liquid below share about 0.96, so the patch cannot reach 0.99 from inside: matching it needs a disc drawn by the wall itself (angular radius about 5.2 degrees, centred about 11 degrees from true up toward the viewer, with a rim), which is not built. `leanDeg` 13 puts the ring's lower edge right (share 0.90) but squeezes the patch to 0.944 to 0.956, so 16 stays. A lit band inside the lower rim was tried and cut (129 to 154 where the approved image reads 85 to 119).
2. The lower front between the pond and the collar (Round 6, R3-2: "a broad opaque gray band with a clean cutoff at the collar"). Read up from the collar ring's top at the centre column, at 0.8, 1.5, 2.5, 3.5, 5 and 6.5 mm: approved 67, 86, 95, 98, 109, 124; render 79, 76, 87, 92, 119, 126; before the seat's front shade and mirror 72, 65, 76, 101, 130, 133. The bank's lit top, 8 to 10 mm up, is the landform's, and the frost there is the frost's. The "narrow refracted edge" the critic asked for is not in the approved image, which darkens evenly down to one thin contact line; see `seat` below for what was tried.
3. The first reflection: share 0.99 at 65 to 70 degrees is 42 to 49 too bright; shares 0.965 to 0.975 at 85 to 90 degrees are 40 to 75 too dark (the bubble's patch again); shares 0.965 to 0.97 at -10 to -5 degrees are 40 to 68 too dark.
4. In the outer 4 percent of the lower half the render is smooth where the approved image is granular frost to the outline (`src/seasons/winter/frost.ts`).
5. At `landed` the limb highlights are fainter than in `winter-shake.png`. The approved rest and shake images disagree at the rim; rest was followed.
6. At draft tier (2 samples) the outline shows single pixel steps; at review tier (8) it is smooth.

### What the closing rounds added (rounds 5 to 7)

| Where | What it does | Locked value |
| --- | --- | --- |
| `src/globe/lens.ts`, `lensPlace(p, eye, out seen)` | Also says whether the point can be seen through the glass. The stage wrapper in `src/core/materials.ts` carries it as `vStageSeen` and `stageOutside()` draws nothing where all three corners of a triangle are unseen; that cured the invalid values of measure M1 at the base camera. Placement is unchanged, so `tools/lib/lens.mjs` is unchanged | 0 invalid values at 6 cameras, rest and landed |
| `assets-src/glass/sanity.mjs` | Renders hd stills and counts the values outside the finite range, camera by camera | `sanity: pass` |
| `band.dim` | How much the band inside the rim darkens the wall | 0.25 (was 0.5) |
| `window.orders[0].outFrom`, `outSlope`; `edgeDeg.firstOuter` | The first reflection reaches the rim between 45 and 60 degrees and its outer edge is crisp | 0.8, -1; 1.12 |
| `tip.tailLevel`, `tailLeanDeg` | The first reflection's low tail | 0.021, 3.2 |
| `edge.line` | A crisp line on the lit limb at shares `from` to `peak`: `dir` and `lobe` say where along the limb, `spanDir` and `span` how far it runs, `rest` its level elsewhere, `wander` its slow noise, `glint`, `glintDir` and `glintLobe` the hot spot | `from` 0.9955, `peak` 0.998, `gain` 1.3, `rest` 0.35, `wander` 0.5, `glint` 1.8 |
| `edge.keyOn`, `keyLow`, `keyLowDir`, `keyLowLobe`, `tip`, `tipShare` | Where the key light is piped along the rim and how far down it reaches | 0.35, 0.45, [0.5, 0.866, 0], [0.8, 0.93], 0.5, [0.984, 0.997] |
| `seat.topMm` | How much of the shell above `SEAT_Y` the collar ring hides; everything below is measured up from there | 4 |
| `seat.lineMm`, `lineDepth` | The thin dark contact line on the ring | 0.8, 0.7 |
| `seat.shadeMm`, `shade`, `gain` | The contact shade at the limb (squared) and the lift of the base's reflection near the seat | 4.5, 0.4, 1.5 |
| `seat.wideMm`, `wide` | On the front the shade is linear over this height instead | 9, 0.32 |
| `seat.footMm`, `footWideMm`, `foot`, `footTint` | A thin warm line above the collar | 1.1, 0.14, 0.1, [1.5, 1.15, 0.85] |
| `seat.mirrorMm`, `mirrorSpanMm`, `mirror`, `mirrorCap`, `mirrorTaps` | Between the collar and `mirrorMm` the inner face gives back a faint, flipped image of the bank, squeezed from `mirrorSpanMm` more, read from the copy of the inside; strongest a third of the way down, nothing at the collar | 4, 2, 0.2, 0.8, 4 |
| `seat.limb` | Shares between which the front's treatment hands over to the limb's | [0.9, 0.975] |
| `bend` (`from`, `soft`, `shift`, `power`, `dark`, `taps`, `bubbleDeg`), `uBehind`, `uBehindSize`, `uBubbleAt`, `copyBehind()` | The named fallback of `kit/03-METHOD.md` section 2: the inside is copied when the wall is about to be drawn (`THREE.FramebufferTexture`, no draw call) and the rim zone from share `from` outward is read from that copy, squeezed toward the rim. Skipped with no target, a multisampled target or a diagnostic view. At rest it moves 1237 pixels of the hd still by more than 2 (largest 42), because the rim zone holds dark liquid, frost and reflections and the lens already places every vertex by exact refraction; the approved image shows no more | 0.92, 0.2, 0.16, 2, 0.5, 4, [13, 19] |
| `bubble.under`, `underTint` | A faint warm line under the bubble's outer ring on the front | 0.03, [1, 0.66, 0.36] |

Tried for the seat and cut: a bent edge that replaced the lowest 2.4 mm with a stretched copy of the inside (a dark band at the hero camera, stretched stripes at the base camera; the approved image has neither), a sheen of sky light above the collar (it put a step where it began), and a shade of 0.7 over 9 mm (20 to 40 darker than the approved image in the lowest 2.5 mm).

### Making it again for another season

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
   `npm run still -- --season <season> --state rest --camera hero --tier draft --format preview --diag normals --force 2>&1 | grep -a -i error`
   (`-a`, or grep calls the page's log a binary file and prints only that it matched.)
   `node assets-src/glass/profile.mjs --season <season> --patches --looks <tag>` writes `out/work/fit/<tag>-glass.jpg`, `-shoulder.jpg`, `-crown.jpg` and `-collar.jpg`, approved beside render.
   The edges of the panes: `window.edgeDeg` holds how soft each edge is, in degrees on the window (`outer` the first reflection's edge toward the gap, `outerMain` and `innerMain` the main pane's, `cut` its lower end, `end` and `tail` the ends), and `wobble` at `wobbleRate` moves every reflection but the first by a slow noise so that no edge is a straight line. A degree on the window is far less than a pixel near the limb and many pixels in the middle of the disc, so read the rise across an edge in shares, approved beside render, before moving one. `window.tip.widen` over `widenDeg` broadens the first reflection inward toward its top end.
7. The bubble: `glassLook.bubble` holds its width, depth, the flat patch against the wall (`patch`), the widest ring (`waist`), the lean and how far it slides and wobbles with `f.liquid`. Check it at `landed` as well as `rest`.
8. The ring at the limb (`glassLook.ring`) is the fifth draw, after the frost, and carries the outline. It takes the exact ray of each pixel, so its edge is the true silhouette. `from`, `to` and `soft` are where it starts; `side`, `low` and `wallSide` bound the top and upper left, where it is a translucent wall (`keep`, `cover`, `wall`) with a bright line at the outline (`edge`, `line`, `lineTop`, `lineMix`); in the lower half (`low`, `lowEnd`) it covers only the last 1 percent (`lowFrom`, `lowTo`) with the line `lowLine` over `lowAt`, so the frost and the bank run to the outline. Past the outline the ring is transparent: an opaque fill there (the old `night`) shows as a dark stair-stepped line against any backdrop lighter than itself, so a frost pixel outside the silhouette has to be cut in the frost's own shader. `mirror` is the band of the inside mirrored at the very edge: the chord of each pixel, reflected once inside the glass, is marched through the light grid (`steps`), and what it meets is laid from `from` (`lowFrom` on the lower left, bounded by `side`) over `wide` with `cover` (`coverHigh` in the upper half) and `gain`. `mottle`, `streak` and `streakRings` break the upper left wall into soft blotches and streaks along the rim; keep `streakRings` and `mirror.streakRings` near 110 to 150 so one ring is some pixels wide at hd. Read the rim in polar boxes, approved beside render, and move one value at a time:
   `node assets-src/glass/polar.mjs approved 1410.9,652.7,553.1 60,210,15 0.956,1.0,0.006 50 rgb <season>`
   `node assets-src/glass/polar.mjs <the still that npm run fit printed, under out/work/stills/> 1407.6,643.5,549.2 60,210,15 0.956,1.0,0.006 50 rgb`
   The three numbers after the file are the centre and radius of the glass circle in pixels of a 2816 by 1584 frame (`node assets-src/glass/outline.mjs` fits them); then angles from, to, step in degrees (0 is right, 90 is up), shares from, to, step, the percentile, and `rgb` or `lum`.
9. Test: `npx vitest run`, `npm run determinism`, the fit of step 1, stills at `rest` and `landed` from `hero`, `macro`, `low` and `interior`, `--diag standins`, and once at `--format hd`.
10. After every merge of `origin/main` run the loop of step 6 once and read the patches: the rig, the room and the grade all move the glass. If the open liquid drifts, only `room.level` should need to change.
11. The seat at the collar. `seat.topMm` first: `node assets-src/glass/sanity.mjs --season <season> --cameras base --states rest --keep` writes `out/work/glass/sanity-rest-base.png`; move `topMm` until the dark contact line sits on the ring's top edge. Then read the approved image up from the ring on the front and the fit still the same way (one step of 0.0167 is about 1 mm; angles run from -90 to 270, so the columns left of the bottom are `250,270,10`):
   `node assets-src/glass/polar.mjs approved 1410.9,652.7,553.1 -90,-70,10 0.66,0.78,0.0167 50 lum <season>`
   `node assets-src/glass/polar.mjs out/work/stills/<season>-rest-hero-hd-draft-rig.png 1407.9,652.5,554.1 -90,-70,10 0.66,0.78,0.0167 50 lum`
   Set `seat.wide` until the upper rows agree, then `seat.mirror` until the lowest 3 mm agree. Never replace what is behind with a stretched copy there: it shows as stripes at the base camera. Look at the base camera's still after every change.
12. The rim zone (`bend`) needs no fitting; keep `bend.from` below 1. Its check is `npm run still -- --season <season> --state rest --camera hero --tier draft --format hd --diag refraction --force`: the miniature must be larger with the lens than without.
13. Before every push: `npx tsc --noEmit`, `npx vitest run`, `node assets-src/glass/sanity.mjs --season <season>` (12 lines of `"invalid":0`, then `sanity: pass`), `npm run measure -- --unit <season> --only M1 --tier draft`, `npm run determinism`, and `npm run still -- --season <season> --state rest --camera hero --tier draft --format hd --diag standins --force` (black).
