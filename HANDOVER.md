# Winter glints, handover, second list

Branch agent/p6-winter-glints, head f47b33f1 (origin/main fe0f0202 merged in). Three items at 3840 x 2160.

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

Not done: four frames at 3840 final before and after for frame 650. A frame there takes several minutes on this machine and the time did not reach.

## 3. The pond's finest band

Not mended. Frames 30 against 31 at 3840 final on this head, fine part at sigma 2 px, travel removed: patch 0.604 (rms 1.12), core 0.790 (1.60), top 0.766 (1.73). At sigma 4 px: 0.797, 0.921, 0.883. Removing the grain and dither alone reads 0.613, 0.798, 0.796 (patch, core, top) at 12 samples, so the grain is not the whole of it. What is new in each frame is the samples' own noise on detail finer than a pixel, plus the grain. By a model fitted to the two readings (not a proof), 0.8 in the patch needs about 48 samples and no grain on the ice, which is twice the render time of these frames and a change in the post, a shared file.

## Checks on f47b33f1

- The eight draft hd stills equal main fe0f0202's list.
- M3 at review for the four seasons reads the same lines before and after; the rest stills at review do not move by one pixel (the lens fill that reads the blur map runs from 12 samples, the review tier draws 8).
- tsc exit 0; vitest 64 files passed, 1 skipped; 886 tests passed, 8 skipped.
- Strict run for winter-rest and winter-shake: pass, 0 pixels differ.
- No geometry changed; winter's triangles at high are as before.
