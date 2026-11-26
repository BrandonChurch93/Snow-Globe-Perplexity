# The lamps' blur in shake frames (open item 238)

Written by /root on Nov 26. Branch `agent/p6-blur` from `origin/main`. One builder, one report.

## What was seen

Film B, frame 621 (shake-1, before the swap), drawn at 3840 x 2160 at the final tier (24 samples) by a farm
machine on `b092f872`. In a crop of 400 pixels around (1625, 825) every lamp of the string is a row of
separate copies of itself, about 4 pixels apart, where a camera would draw one smooth streak. At full size the
rows read as dotted lines. Enlarged six times the copies are plain to see. The two pictures come with the
message that names this file.

Why: a frame is the mean of N pictures drawn at N moments inside the shutter (`picture` in
`src/capture/showcase.ts`, `tiers.final.samplesPerFrame` 24, `film.shutterDegrees` 180). In a shake the ball
travels about 100 pixels across the frame inside one shutter at this size, so 24 moments lie about 4 pixels
apart, and a lamp that is 2 to 3 pixels wide does not close the gap. The particles do not show it because
they are drawn as strokes along their travel.

## What is wanted

In a finished 4K frame of a shake no small bright thing reads as a row of copies. Frames without motion stay
exactly as they are, bit for bit.

The route I choose, unless your measure shows a better one (say so before you build another):
the number of samples of a frame follows its motion. For the film's and the loop's pictures

    samples = clamp(ceil(travelPx / spacingPx), samplesPerFrame, maxSamplesPerFrame)

where `travelPx` is the largest travel on screen, in pixels of the format being drawn, of the ball's contents
inside the shutter of that frame (take the ball's centre and its top, so the tilt counts; the camera's own
move counts too where a shot moves it), read from the timeline alone so the same frame always gets the same
number. The two new numbers live in `config/showcase.json` under the tier (`tiers.final.motion`:
`spacingPx`, `maxSamplesPerFrame`) with their lines in `src/configCheck.ts`. A tier without `motion` keeps a
fixed count, so draft and review draw as fast as today and every picture at those tiers stays the same.
Start from `spacingPx` 1.5 and `maxSamplesPerFrame` 96 and set them by what the picture needs: the smallest
count at which the rows are gone at full size.

## Measure first, then build

1. Before any change: frame 621 of film B at uhd at the final tier, and the same frame with 48 and with 96
   samples (the scan tool on `agent/p6-nan` takes `--samples`; say how you did it). For each: the crop of 400
   pixels around (1625, 825), the seconds for the frame, and one number for the beads that you define in a
   sentence (for example along one lamp's row: the depth of the dips between copies against the row's mean).
   Also frame 660 or whichever frame of shake-1 travels fastest: name it and its travel in pixels.
2. Build the rule. Then the same three crops by the rule, and the number.
3. Proof that still frames do not move: the sha256 of `winter-rest` at final at hd, and of film B frame 100
   and frame 1500 at final at hd, the same before and after.
4. The cost: a table of film B's 3600 frames by the count the rule gives at uhd (how many frames at 24, at 25
   to 48, at 49 to 72, at 73 to 96) and the same at hd, and from your measured seconds what the whole film
   costs against 24 everywhere.
5. `npx tsc --noEmit`, the whole `npx vitest run`, and `npm run strict` on `winter-rest,winter-shake` (the
   last line word for word).

## Limits

- Only the capture's sample count. No change to any look, to the shake's path, to the particles or to the
  post chain. If the rule cannot remove the rows inside 96 samples, stop and report what you measured; do not
  add a blur filter on your own.
- The record a film frame or chunk carries about its samples (`tools/lib/master.mjs` belongs to another
  agent): do not edit that file. Say in the report which line names the count so its owner can follow.
- The sanity scan and the `sheet` and `still` tools: when no count is given they follow the rule; a given
  `--samples` wins.
- The four seasons' sources under `src/seasons/` are not yours.
- 75 minutes. One report: head, the numbers above, the crops as attachments (at most ten files), what you did
  not see.
