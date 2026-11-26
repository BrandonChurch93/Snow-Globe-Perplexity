# Job: spring's drops and dew speckle at 3840 (name `spring-drops`, branch `agent/p6-spring-drops`)

Read `COMMON.md` in this folder first. Your limit is 2 hours from your start.

## The fault
A farm machine drew spring in motion at 3840 x 2160, final tier, 60 frames a second (film frames 1135 to 1164, the camera pulling back, about 8 px of travel a frame). The moss, the outline of the glass, the chimney and the roof hold from frame to frame. Two things do not:

1. The drops on the glass in front of the scene. Each larger bead is a patch some 15 px across filled with white, red and violet dots one pixel in size, and the dots are other dots in every frame. In play it sparkles as noise.
2. The dew pinpoints in the dark moss under the lit rim of the collar. Each draws as a small ring of dots about 8 px across. The rings keep their place on the moss, their dots change from frame to frame. Faint, since it is dark there. Also seen in a single still of frame 1290.

The film's masters are drawn at this size, so both must be gone before them.

## What I read in the code (read, not tried; find the cause yourself before you mend)
- `src/seasons/spring/glass.ts` line 260: `dewTap` reads the frame behind a drop with `textureLod(uBehind, ..., 0.0)`, one tap at the finest level. A drop is a lens that shows a share of the frame small, so one pixel of the drop stands for many texels of the copy, and one tap picks a single one of them. As the camera travels, each frame picks others. A lens that makes things small wants the mean of what it gathers: levels on the copy and a level from the drop's footprint, or a few taps over the footprint, or a smaller soft copy made once a sample.
- The same file, `dewKeep`: a drop is cut by a hash of the pixel and `uSeed` when `uFlags.w` is below 1. In a hold `uFlags.w` should be 1. Check that it is on frames 1135 to 1164.
- `src/seasons/spring/base.ts` lines 244 to 249: the dew on the moss is `pow(..., 120.0)` and `pow(..., 40.0)` on a facet normal. A lobe that sharp on a facet smaller than a pixel is a different answer at each of the pixel's sample places. It wants a lobe as wide as the pixel's footprint asks for, or facets no smaller than about a pixel and a half at 3840 from the nearest framing.

## Files you own
`src/seasons/spring/glass.ts` and, in `src/seasons/spring/base.ts`, only the dew's lines (244 to 249 and what they read). If the cause sits in a shared file (`src/core/`, `src/capture/`), send `/root` the exact lines and why, and do not change it yourself.

## How to see it
- `npm run build`, then draw film frames 1135 to 1138 at the `uhd` format and the `final` tier as the film draws them (read `tools/README.md` for `seq` and for the film tool's ranges; the farm machine used the film tool). A uhd final frame took 72 s on a machine with 8 CPUs, so draw few frames and small ranges. Cut the same window out of each frame at one to one and lay them side by side at 8 times, before and after.
- Find a bead: any bead of about 15 px that shows the dots will do. `/root/farm_machine_5` drew the frames and holds them; ask it once, short, where its bead and its dew pinpoints stand in frame 1135 (x and y in the 3840 frame).
- A number for it: over a bead's patch, the mean absolute difference between neighbouring pixels inside one frame, and the share of the patch's pixels that differ by more than 24 levels between two neighbouring frames once the travel is taken out. Give both before and after.

## Done means
- At 3840 final, a bead reads as a small clear lens with a dark edge and a glint, as it does at hd, and holds from frame to frame. No dots inside it.
- The dew pinpoints on the dark moss are steady points or gone. No rings of dots.
- Spring at rest and at the landing at hd review look as they do on `main` (put the pair side by side; the drops may be a little softer, never brighter, never gone). `npm run measure -- --unit spring --only M3 --force --tier review` reads no lower than on `main` by more than 0.015.
- The other three seasons' stills at rest are byte for byte as on `main` (draft tier, hd, by sha256).
- The live app's drops still draw (`npm run still -- --season spring --state rest --camera hero --live high --format hd --force`), and the strict run passes on `spring-rest,spring-shake`.
- `npx tsc --noEmit` and the whole `npx vitest run` pass before every push.

## Report
One message to `/root`, at most 30 lines: branch and commit; the cause as you found it, with the trial that shows it; the two numbers before and after; the pictures (four frames at 8 times, before above and after below, as one JPEG attached to the message); what you did not see; checks run and their last lines.
