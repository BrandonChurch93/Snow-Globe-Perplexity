# Recipe: the glass and the liquid

The parts `glass` and `liquid` ship no file. Everything is computed in `src/globe/shell.ts` from the constants in `glassLook`, in four draw calls (the view through the liquid, the wall, the bubble, the depth stamp). State reached: `built`.

## src/globe/shell.ts (`glassLook`)
Made by: hand, fitted with `assets-src/glass/measure.mjs` and `assets-src/glass/profile.mjs` (Node 20.20.2, sharp)
From: `references/approved/winter-rest.png`, `tools/lib/refcam.mjs` (the camera of the approved image), `config/showcase.json`
Prompt or command: `node assets-src/glass/measure.mjs`, then the loop in "Making it again" below
Takes: 0 generated assets. 19 tuning looks up to this file's date
Why this one: three reflections of one window, the wall zone, the through view and the bubble land within about 15 of the approved image along the rays measured below
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

The bubble's span, share 0.876 to 0.985, equals a lean of 16 degrees toward the viewer; strict true up would put it at share 0.964 to 1.0. `glassLook.bubble.leanDeg` holds that choice.

Display value against linear light before the tone curve of `src/post/post.ts`: 34 is 0.026, 62 is 0.053, 100 is 0.10, 143 is 0.18, 193 is 0.39, 211 is 0.56, 230 is 0.94, 234 is 1.10, 241 is 1.53, 249 is 2.77. The glow starts at 1.0, so the panes are capped per channel at `glassLook.shoulder.to` (1.06): the inner edge keeps its blue, the outer edge goes white, and nothing spills outside the rim.

## Making it again for another season

1. Render the frame the approved image was taken from and put it beside the image:
   `npm run texpack && npm run build && npm run fit -- --season <season> --tier draft --box 820,60,2000,1260 --name glass --force`
2. Read the approved image along rays from the glass centre and in the open liquid:
   `node assets-src/glass/profile.mjs --season <season> --rays 10,30,40,70,100,110,160 --from 0.66 --to 1.02 --step 0.01`
   `node assets-src/glass/profile.mjs --season <season> --patches`
   The patch boxes in `profile.mjs` are winter's open liquid; move them to where no miniature stands in the new image.
3. Find the window. In `assets-src/glass/measure.mjs` set the outline of each pane as (share, angle) pairs, then run `node assets-src/glass/measure.mjs`. It traces each outline off the sphere into the room and prints the window's centre, its two axes and the span in degrees along and across. Put the first pane's centre and axes in `glassLook.window` and each pane's span in `glassLook.window.orders` (first reflection, second, third, and the through view, which reuses the first).
4. Set the inner faces. `second.face` and `third.face` are the radii, as a share of the glass, of the faces that make the second and third images; move them until the panes sit at the measured shares (0.72 and 0.6 for winter).
5. Set the levels with the table above. `window.gain` and the first order's `inner` and `power` give the first pane's ramp; `second.gain` and `third.gain` scale the other two; `window.halo` is the blue around the panes and in the gap; `room.level` and `room.tint` turn `f.ambient` into the room the glass sees; `through.lift` is the deep blue behind the miniature; `ceiling` is the lighter cap above share 0.75; `body` and `edge` are the wall zone and the rim line (the bright side follows `f.keyDir`, the far side `f.rimDir`); `strip` is the soft arc on the far side.
6. Loop until the rays agree. `npm run fit` hides shader errors, so check for them each time:
   `npx tsc --noEmit && npm run build && npm run fit -- --season <season> --tier draft --box 820,60,2000,1260 --name glass --force`
   `npm run still -- --season <season> --state rest --camera hero --tier draft --format preview --diag normals 2>&1 | grep -i error`
   `node assets-src/glass/profile.mjs --season <season> --patches --looks <tag>` writes `out/work/fit/<tag>-glass.jpg`, `-shoulder.jpg`, `-crown.jpg` and `-collar.jpg`, approved beside render.
7. The bubble: `glassLook.bubble` holds its width, depth, the flat patch against the wall (`patch`), the widest ring (`waist`), the lean and how far it slides and wobbles with `f.liquid`. Check it at `landed` as well as `rest`.
8. Test: `npx vitest run`, `npm run determinism`, the fit of step 1, stills at `rest` and `landed` from `hero`, `macro`, `low` and `interior`, `--diag standins`, and once at `--format hd`.
