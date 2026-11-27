# Handover: spring's base (phase 6, fifth list)

Branch `agent/p6-spring-base`. Files: `src/seasons/spring/base.ts`, `assets-src/base-spring/build.mjs`, `layout.mjs`, `RECIPE.md`. Assets to make again: `npm run make -- base-spring`, then `npm run texpack -- --group spring` (texpack also rewrites `public/assets/spring/village-spring.glb`, which is not this job's; restore it with `git checkout`).

## What stands
- Cobbles: cells of about 9.2 by 7 mm, each a rounded stone (`rock` in `build.mjs`: a plateau with a dome over it), moss in every joint (`seam`). In the shader the stone is shaded by how high it stands and has almost no sheen. The stone is set 2.9 mm in (`- 2.9` in `rock`) so the cobbles stay inside the third list's outline.
- Where the stone is bare: only the front, azimuth about -60 to 20 degrees (`bare` and `shelf` in `build.mjs`); the left flank is mossed to the table and takes the light from the left.
- Outline: `swell` is the third list's again. The cushions over the rim are gone. `dip` wears the moss roll down by an uneven depth (2.2 mm at the front under the glass, up to 2.6 mm more in patches); it only lowers points above 35 mm and moves nothing outward.
- Rim tone: `liveTip` in `base.ts`. Its colour runs from moss green at the left to straw at the right and its strength from `0.33 + 0.75 * exp(-x * x / 400)` to 2.4 with `liveEast` (the sun is behind and to the right; the glass shades the left of the collar). `liveLip` starts at 37.5 mm so the dipped roll still has a lit top; `liveCrown` weighs 0.6 at the left and 0.08 at the right.
- Roots at the lit right: the sixteen thin ones are out. The stout root there (1.7 mm) forks twice and a thick one (1.45 mm) stands beside it; 41 roots in all. The low sun on the roots is narrowed to the faces that look at it (`smoothstep(0.4, 0.9, liveGraze)`), so they are pale on the lit tops and bark brown elsewhere.
- Water: the sun glint, the room's glints and the travelling glints are cut by about a quarter (`1.65`, `0.68`, `0.68`, and `mix(0.6, 1.1, ...) * fine`).
- The dew's lines are byte for byte as on main.

## What is short of the approved picture
- The base still stands taller than the approved's (picture 19): about 269 px high at the front against 245 by the hand trace, and its foot lies about 35 px lower. The seat's height is shared. Against the third list (picture 20) it is inside everywhere but for the mushrooms and slivers of up to three pixels at the left edge and the foot.
- The front dip shows a pale brown strip between the glass and the moss: in the ids view it is the miniature's part (249, 190, 16), the earth under its ground, not the base, and not this job's.
- The far right still has three strands close together near the silhouette (the stout root and its two forks, foreshortened); they read thinner than they are.
- At 400 px the body below the rim is still darker and less green than the approved's, which is mossed and lit over more of its side.
- The trickle is still a dark glossy ribbon; the approved's is a pale clear film. In the landed still it has only begun.

## How to look
`npm run still -- --season spring --state rest --camera hero --tier review --format hd --force`, then crop (560,640,1380,1020) beside the approved picture scaled to 1920. The rim is measured 5 to 35 px under the base's top edge in thirds x 670 to 860, 860 to 1060, 1060 to 1250 (the base's edge from the ids view, the approved's from the hand trace in `outline.py`'s polygon). The detail line: `npm run measure -- --unit spring --only M3 --force --tier review` (0.8566 on this head). It is the mean of the squared difference from a blur of 1.5 px over the base's pixels, so it is carried by the bright flanks.

## At 3840 in motion (film frames 1100 to 1103, final)
Each box laid on its neighbour by whole pixels, luminance; mean change a frame, the 99th percentile of the change, the share of pixels that change by more than 24 levels.
Second list, third list, fourth list, then fifth list:
- lit moss on the right: 8.2 to 8.6, p99 48 to 49, 7.0 to 7.7 percent; 9.2 to 9.6, p99 60 to 61, 9.5 to 9.9 percent; 6.5 to 6.9, p99 44 to 46, 4.8 to 5.5 percent; now 6.8 to 7.1, p99 47 to 48, 5.4 to 5.9 percent
- moss at the lip: 5.5 to 6.4, p99 38 to 44; 4.6 to 5.5, p99 32 to 37; 4.8 to 5.8, p99 32 to 36; now 2.7 to 3.0, p99 25 to 28, 1.1 to 1.5 percent
- stones: 2.1 to 2.5; 0.8 to 0.9; 1.1 to 1.3; now 1.1 to 1.2, p99 8 to 10. Roots: 2.7 to 3.0; 2.2 to 2.5; 1.8 to 2.1; now 1.9 to 2.1, p99 17 to 21
- water: 4.5 to 5.1, p99 60 to 63; 2.7 to 3.2, p99 42 to 45; 3.2 to 3.7, p99 44, 41, 44; now 3.0 to 3.6, p99 36, 37, 38
Four frames are not the film: nobody has watched this at 60 a second.
