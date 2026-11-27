# Handover: spring's base (phase 6, fourth list)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Cobbles: cells of about 9.2 by 7 mm, each a rounded stone (`rock` in `build.mjs`: a plateau with a dome over it), moss in every joint (`seam`). In the shader the stone is shaded by how high it stands (`smoothstep(0.1, 0.95, baseRelief.b)` in `baseAo`, weighted `0.25 + 0.75 * baseAo` in the fill) and the lustre is 0.04, so there is almost no sheen. A try with a rounder cross section (a square root profile) read as flat paving and lost the detail line (0.6746); it was taken back.
- Where the stone is bare: only the front, azimuth about -60 to 20 degrees (`bare` and `shelf` in `build.mjs`); the left flank is mossed to the table as the approved has it, and takes the light from the left (`ROCK.kick`, on the tufts and the clumps).
- Rim: `cushion` in `build.mjs` raises moss cushions of unequal height that bulge over the rim; the foot's spread is more uneven (`foot * (0.4 + 9 * ...)` in `swell`).
- Tones in the middle: roots dark brown (`baseWood` 0.25, 0.195, 0.155, little of the left light), a little of the room's light on the bark so they are not black; the low sun reaches only where the side of the mound looks toward it by more than 0.2 (`liveReach`, and the same on the roots).
- Lit moss on the right: its share of the low sun follows the clumps (`baseClump`) and half the mound's own form, half the tuft's tilt; the tuft term is `(0.7 + 1.5 * liveTuft)`. This is what brought the change from frame to frame at 3840 under the second list's.
- Roots: eight more thin ones at the lit right (the last eight of `ROOTS`), 54 roots in all.
- The dew's lines are byte for byte as on main.

## What is short of the approved picture
- The base still stands taller and wider than the approved's (picture 11): about 310 px high at the front against 245, the top about 720 px wide against 647, the foot about 815 against 750, at 1920 (mine read from the ids view, the approved's from a trace by hand). The cushions and the wider foot made it larger than the third list's, not smaller. The height is set outside this job's files. The rim's cushions rise at the two ends but the front edge under the glass still reads as one roll, lit pale straw where the approved's is green moss with small highlights.
- The darks are still too black in the middle band (5th percentile 4.7 against 7.1) and the 95th percentile is over (66 against 50), nearly all of it in the right quarter of the band (x 1085 to 1210: 135 against 101), where the lit roots begin.
- Lip green: mean of the green pixels 23 32 15 against 28 37 21, share 0.37 against 0.41. Less dark than the third list (18 25 10, 0.24), not there.
- The thin roots of the right read as a comb of pale strands at twice the size; the approved has fewer, thicker roots with bark and moss between them.
- The trickle is still a dark glossy ribbon with white glints; the approved's is a pale clear film. Its 99th percentile of change at 3840 is 41 to 44, so still up to two over the mark of 42. The top hundredth of the change lies on the glints that travel with the flow (`fine` in the water's shader).
- In the landed still the trickle has only begun where the approved shake picture shows it whole.

## How to look
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (560,640,1380,1020) beside the approved picture scaled to 1920. In that crop: lip rows 70 to 130 over x 80 to 740, flank rows 150 to 330 in thirds x 80 to 300, 300 to 520, 520 to 740; the middle band is rows 160 to 250 over x 150 to 650. The detail line: `npm run measure -- --unit spring --only M3 --force --tier review` (0.8444 on this head). It is the mean of the squared difference from a blur of 1.5 px over the base's pixels, so it is carried by the bright flanks: it read 0.69 with the front right and the cobbles alone, 0.74 with the stones shaded round, 0.7575 with the left flank lit, 0.8444 with the eight thin roots.

## At 3840 in motion (film frames 1100 to 1103, final)
Each box laid on its neighbour by whole pixels, luminance; mean change a frame, the 99th percentile of the change, the share of pixels that change by more than 24 levels.
Second list, third list, then fourth list:
- lit moss on the right: 8.2 to 8.6, p99 48 to 49, 7.0 to 7.7 percent; 9.2 to 9.6, p99 60 to 61, 9.5 to 9.9 percent; now 6.5 to 6.9, p99 44 to 46, 4.8 to 5.5 percent
- moss at the lip: 5.5 to 6.4, p99 38 to 44; 4.6 to 5.5, p99 32 to 37; now 4.8 to 5.8, p99 32 to 36, 2.1 to 3.0 percent
- stones: 2.1 to 2.5; 0.8 to 0.9; now 1.1 to 1.3, p99 9 to 11. Roots: 2.7 to 3.0; 2.2 to 2.5; now 1.8 to 2.1, p99 16 to 20
- water: 4.5 to 5.1, p99 60 to 63; 2.7 to 3.2, p99 42 to 45; now 3.2 to 3.7, p99 44, 41, 44
Four frames are not the film: nobody has watched this at 60 a second.
