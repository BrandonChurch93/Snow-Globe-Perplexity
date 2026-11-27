# Handover: spring's base (phase 6, third list)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Light on the moss: the low sun's share on moss is tinted `vec3(1.2, 1.5, 0.55)` over the sun's own warm colour, not over the moss's green, and the lit tip (`liveTip`) is a warm olive that grows toward the east (`liveEast`). The lit band at the lip is `liveLip`, the top 1.4 mm only.
- Shade: `liveReach` in the rock and the factor on the roots' graze take the low sun off every face whose side of the mound looks away from it, so the left and middle flank get the fill alone. The moss's fill falls with height (`mix(0.45, 1.3, smoothstep(27, 40, y))`).
- Cobbles: cells of about 13 by 9 mm, warped, domed; bare below a ragged line at the left and middle (`bare` in `build.mjs`), moss in the joints (`seam`), on the top and on the lit right.
- Roots: one thick root taken out, eight thin pale ones on the right (the last eight of `ROOTS`), wood pale tan under the sun with dark gaps.
- Trickle: a clear film (alpha 0.06 to 0.24), no bright edge lines, fine glints that grow toward the foot.
- Outline: `swell` in `build.mjs` moves the three meshes outward unevenly (belly, spread at the table, lumps, waist under the lip); `crest` raises tufts at the top edge.

## What is short of the approved picture
- The outline is still nearer a drum than the approved mound. The approved base is lower in the frame (about 280 px tall against 325 px here at 1920) and has two tiers at the top, a ring of moss at the glass and a shelf under it. The height is set by the table and the glass's seat, outside this job's files; inside them the next step is a wider belly and a lower, rounder shoulder in the profile.
- Green on the lip is now darker and less of it than the approved (green pixels mean 18 25 10 against 28 37 21, share 0.24 against 0.41). The moss band under the lip is still a broad even collar where the approved has it thin and broken.
- The cobbles read as smooth dark slabs; the approved's are rougher with a thin moss film and small cool glints.
- The lit right has less saturated green than the approved, whose moss there is bright green with warm tips; the top hundredth is under (241 216 176 against 253 232 204) and the band from the 70th to the 90th percentile is over (134 108 65 against 103 80 53).
- The left flank's brightest tenth is bluer than the approved (53 49 50 against 49 45 35).
- In the landed still the trickle has only begun where the approved shake picture shows it whole.

## How to look
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (560,640,1380,1020) beside the approved picture scaled to 1920. In that crop: lip rows 70 to 130 over x 80 to 740, flank rows 150 to 330 in thirds x 80 to 300, 300 to 520, 520 to 740. The detail line: `npm run measure -- --unit spring --only M3 --force --tier review` (0.8093 on this head; it fell to 0.688 when the front went dark and came back with the eight thin roots and brighter backs on the roots of the right. A try that bought the line with a sharper tuft term, `(0.15 + 5.0 * liveTuft) * 4.8`, read 0.787 but doubled the change from frame to frame of the lit moss at 3840 (p99 82) and looked like yellow grit at one to one; it was taken back to `(0.6 + 2.6 * liveTuft) * 3.4`).

## At 3840 in motion (film frames 1100 to 1103, final)
Each box laid on its neighbour by whole pixels, luminance; mean change a frame, the 99th percentile of the change, the share of pixels that change by more than 24 levels.
Second list, then third list:
- moss at the lip: 5.5 to 6.4, p99 38 to 44, 3.3 to 4.9 percent; now 4.6 to 5.5, p99 32 to 37, 2.1 to 3.3 percent
- lit moss on the right: 8.2 to 8.6, p99 48 to 49, 7.0 to 7.7 percent; now 9.2 to 9.6, p99 60 to 61, 9.5 to 9.9 percent. This is worse than the second list and about where the first base stood: the moss there is lit harder now. The leaflets keep their place and brightness in the four frames (pictures 03 and 07).
- stones: 2.1 to 2.5; now 0.8 to 0.9. Roots: 2.7 to 3.0; now 2.2 to 2.5, p99 19 to 23
- water: 4.5 to 5.1, p99 60 to 63; now 2.7 to 3.2, p99 42 to 45. The mark was p99 35 to 42, so this is still up to three levels over.
Four frames are not the film: nobody has watched this at 60 a second.
