# Handover: spring's base (phase 6)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Cobbles: cells of about 9.4 by 6.6 mm in `voronoi`, domed by distance to the seed, blurred 0.75 mm. Dark and damp in the shader (`baseStone`).
- Moss: `drape` is a base line of -4.5 mm from the shoulder plus the tongues of `DRIPS` (added, not the greater of the two: a tongue's bell is above zero everywhere, so a base line below zero had no effect before). Tufts and sprigs in the height, the moss sheet at 22 mm a repeat.
- Light: the moss is lit along the lip only (`liveLip`); the low sun on the right flank is `ROCK.flank` with `liveGrazeM` cubed, on the stone, the moss and the roots. The dew's lines are the mender's and untouched.
- Roots: thinner, more twigs, eleven thin wanderers in front; paler wood; the bark's ridges take the low sun.
- Trickle: one strand, bright at its edges, clear in the middle; `TRICKLE_WIDTH` 2 to 3.4 mm.
- Petals on the moss: ten more in `LEDGE_PETALS`, paler.

## What is short of the approved picture
- The base's outline is a drum; the approved one tapers and bulges. Not in this job.
- The approved roots are thicker, smoother and curve more; these are thinner and straighter.
- The warm light reaches a few stone faces left of the root knot that are dark in the approved picture.
- The moss cushions are lumpier than the approved fine carpet; the lip has no row of bright beads.
- The trickle has fewer glints at its foot than approved.

## How to look
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (560,640,1380,1020) beside the approved picture scaled to 1920. The detail line: `npm run measure -- --unit spring --only M3 --force --tier review`.

## At 3840 in motion (film frames 1100 to 1103, final, head 15ad02bc)
The camera moves the base by 1 to 3 pixels a frame there. Each box laid on its neighbour by whole pixels, luminance, mean change a frame against the box's own mean step from one row to the next:
- moss at the lip 9.3 to 10.3 against 14.6; lit moss on the right 9.8 to 10.4 against 19.1
- stones 1.4 to 1.8 against 2.4; roots 2.9 to 3.2 against 4.7; water 3.3 to 3.9 against 4.4
The moss's flecks keep their places from frame to frame (picture 04), but they are 2 to 4 pixels wide and far brighter than the green between them, so they will crawl as the camera drifts. The lines that make them: in `src/seasons/spring/base.ts` the lit tip (`1.0 + 14.0 * liveTuft`) and the moss's share of the low sun (`0.3 + 7.0 * liveTuft`, with `liveGrazeM` cubed). Lowering both and widening the tuft's grain is the next step; the M3 line (0.830) leans on them and will fall when they are lowered.
