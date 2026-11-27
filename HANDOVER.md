# Winter glints, handover, second and third list

Branch agent/p6-winter-glints, head f47b33f1 (origin/main fe0f0202 merged in; it is on main since 26394c0a). Three items at 3840 x 2160. The third list changed no source.

## 1. The backdrop not drawn beside the frond (frames 30 and 31)

Cause. The blur map (the texels view in src/core/materials.ts, STAGE_INSIDE) takes a vertex's blur from the parallax between the eye and two moved eyes, 4 mm across and 4 mm up. A vertex at the limit of what the ball shows, which one of the three eyes cannot see, is placed on the limb. Its parallax is near nothing or negative, the map read that as a depth of infinity, and since the depth is carried across the triangle that one vertex flooded its stretched triangle with the blur of infinity. The tile maximum and the reach then carried that radius over the undrawn backdrop beside the frond.

The trial that showed it (hd, 12 samples, the map written out, frame 30): the wedge read 0.38 where infinity reads 0.388; the seen flags written to the map showed the wedge's far vertex unseen by the eye moved across; a floor on negative parallax changed nothing; giving the placed depth to a vertex any of the three eyes cannot see turned it off (wedge 0.38 to 0.09, tile maximum 0.387 to 0.262, reach 37.2 to 25.1 px). Frame 31 had the same fault in another place (tile maximum 0.381 to 0.257, reach 36.6 to 24.7 px).

Mend, with leave, in src/core/materials.ts: the two lensPlace calls of the moved eyes keep their seen flags, and one line gives the plain depth to a vertex any of the three eyes cannot see. tests/blur-map-unseen.test.ts holds it.

Read at 3840 final, the wedge box 240,1200 to 800,1530, before against after: frame 30 moves 10918 pixels by more than 2 levels, frame 31 moves 744. The after frames also hold main's change to the glass's limb.

## 2. Frame 650's frost

What it is. Not a step of one frame and not a patch that stays. Rows of white dots along the ball's travel on the rim frost. Each glint of the frost is narrower than a pixel, so a sample lights it or misses it, and in the shake the glass steps about 0.44 px between samples at hd (about 0.74 px at 3840), so the hits fall apart as dots about 2 px apart.

Trials. Widening the glint's footprint by two and by five times the step did not remove the rows. Fading the glints with the glass's step between samples did.

Mend, in src/seasons/winter/frost.ts: uTravel holds the glass's step between neighbouring samples of one picture in mm; the glints fade between 0.1 and 0.4 of a pixel of travel (look.glass.glintFade). At rest, in stills and on the live page the step is nothing and nothing changes.

Read at hd final, frame 650, old against mend: the rows are gone; 14346 pixels move by more than 2 levels, all inside the ball (x 514 to 1257, y 63 to 701).

At 3840 final on main 26394c0a (one frame, 650, before beside after): with the shutter's mend the old glints no longer stand as dots, they draw as thin bright lines along the travel. The fade takes those lines out: 51326 pixels move by more than 2 levels, all in the ball. Whether the lines are wanted back is /root's call; the limits are look.glass.glintFade in src/seasons/winter/frost.ts.

## 3. The pond's finest band

Not mended, and by /root's word (03:53 UTC) nothing is drawn for the number: the patch reading is retired as the pond's bar. The term that keeps the patch under 0.8 is not in winter's files.

Trials, 3840 final, 24 samples, frames 30 against 31, patch 1800,1760 to 2060,1960, sigma 2 px. S is the fine part both frames share, u the part each frame has alone, in levels squared; the reading is S / (S + u).

| trial | patch | S | u | core | top |
| --- | --- | --- | --- | --- | --- |
| as it is | 0.604 | 0.735 | 0.481 | 0.790 | 0.766 |
| flakes not drawn | 0.589 | 0.519 | 0.362 | 0.768 | 0.777 |
| flakes not drawn, grain and dither off | 0.677 | 0.516 | 0.247 | 0.804 | 0.830 |
| the same, lens fill off | 0.676 | 0.516 | 0.247 | 0.804 | 0.830 |
| flakes not drawn, the ice's roughness held flat | 0.484 | 0.169 | 0.181 | 0.506 | 0.286 |

What it shows. 76 percent of the patch is ice outside the lamp's core. In the 24 sample frame that ice is a smooth slope: its fine band holds under one level (shared 0.14, alone 0.30). The 0.30 is the post's grain and dither at that tone (smooth blocks elsewhere in the same frames read 0.13 at luma 0 to 20 and 0.27 at luma 170 to 200), and with both off the steps of the 8 bit picture itself (0.19). The flake discs give about 0.12 of u. The pond's own share is the lamp's core, about 0.06 of the 0.481.

Where: src/post/post.ts lines 201 to 206 (grain, tint, dither), src/particles/draw/shader.ts line 381 (the flakes' cover by a hash a pixel). Both are shared files and were not changed.

The pond's one term that is finer than a pixel in a single sample is the fine part of the ice's roughness in three's direct highlight (one sample, roughness held flat: the core's shared part falls from 59 to 3.2). It makes the dashes in the lamp's core. The dashes are most of what two frames share, so taking them out lowers every reading; they stay.

The core by eye, frames 29 to 32 at 3840 final on main 26394c0a, travel taken out (picture 03): the dashes stand still on the ice and move with the camera. The differences between neighbours are grain sized (2.4 to 2.6 levels rms in luma, 9 percent of the pixels over 4 levels), with a slow change of the light's left edge and two or three dashes of a few pixels at that edge that change by up to 18 levels. Core reads 0.805, 0.807, 0.806 and top 0.789, 0.777, 0.749 over the three pairs. The flake discs over the pond keep their shape and light through the four frames; no flicker seen.

## Checks on f47b33f1

- The eight draft hd stills equal main fe0f0202's list.
- M3 at review for the four seasons reads the same lines before and after; the rest stills at review do not move by one pixel (the lens fill that reads the blur map runs from 12 samples, the review tier draws 8).
- tsc exit 0; vitest 64 files passed, 1 skipped; 886 tests passed, 8 skipped.
- Strict run for winter-rest and winter-shake: pass, 0 pixels differ.
- No geometry changed; winter's triangles at high are as before.
