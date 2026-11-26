# Status 177

2026-11-26 21:10 UTC

- The shimmer at 3840 has its cause and its mend. Two farm machines found it on their own: the film chose the 24 sample places of a frame anew for every frame (`src/capture/showcase.ts` line 231), so ground that stands still was drawn differently each time. One line gives every picture the stills' set; it is in main as `1621ff09` (decision 166). Measured with it at 3840 final: spring's moss collar, frames 1290 and 1291, 19.7% of pixels over 12 levels before, 0.0% after; fall's lower third, frames 2734 and 2735, 8,871 pixels before, 316 after; the six guard stills of winter, spring and fall equal by sha256; the grain unchanged. Not seen yet: a shot in motion. Four machines draw one second each at 3840 final (winter's opening, spring, fall, the close) with clips to look at; no master before that (open item 246).
- The change from summer into fall fails its cover gate on main: "FAIL M4 shake-3: 0.7601 (threshold 0.85, shake.minCoverAtSwap)" on `6f6330ed`. A farm machine walked main back over ten commits: green at the review stop (0.9667) and up to `eca1ac61` (0.9603), red from the merge of summer's air for fix list 7 (`5f9a5fd2`, 0.7719), which also took spring into summer from 0.8968 to 0.8666. The change's owner proved one cause at draft: summer's held storm is thinned while summer leaves; with that term off shake-3 reads 0.9652 and nothing else moves. It is with the air's builder as a must (open item 245). The swap frame is also still milky green where it should burn warm; that is the change owner's mend, reported about 21:40 UTC.
- Summer's sand, third list, is in main (`8f6770e2`): the heap stays on the table when the globe is lifted and slumps into the foot's print, the stream ends with the lift, the apron and the sprinkle are gone. Still below the bar by the builder's own account and by my look: a white lobe with a clean outline where the approved has a low wedge of fine grain. Fourth list sent; the red line on its far rim is mended in the world, not in the lens (decision 167).
- Summer's tree, third pass, is in main since the last status; summer at rest was drawn again here on `8f6770e2` (picture 1).
- The standstill work is pushed (`agent/p6-standstill` `26e6ac52`) and merges clean; a farm machine guards its eight stills against main before it comes in, after the change's report.
- Sound: 7,420 of 10,000 credits spent, no call since.
- phase 6: 18.35 h used of its 12.00 h box
- allowance (after the review): 18.35 h used of 12.00 h allowed
- App: https://snow-globe-seasons.pplx.app
- Review page: https://snow-globe-seasons.pplx.app/review.html

- `out/stills/status/status-177-1.jpg`: Summer at rest on `8f6770e2` (hd, review tier), after the tree's and the sand's third passes
- `out/stills/status/status-177-2.jpg`: Summer's sand heap, approved picture left and build right: still below the bar
- `out/stills/status/status-177-3.jpg`: Spring's moss at 3840 final, frames 1290 and 1291 and their difference times 8: before the mend above, with it below
- `out/stills/status/status-177-4.jpg`: Summer into fall at the middle of the change on `6f6330ed`: the cover gate fails here and the light is milky green, both in work
