# Job: winter's pond glitter and a frost frond at 3840 (name `winter-glints`, branch `agent/p6-winter-glints`)

Read `COMMON.md` in this folder first. Your limit is 2 hours from your start.

## The fault
Two farm machines drew winter in motion at 3840 x 2160, final tier, 60 frames a second: the film's opening (frames 15 to 44, the camera travelling about 10 px a frame) and its close (frames 3270 to 3299, the picture growing about 0.6 % a frame). The tree's leaves, the outline of the glass, the stone, the bark and the snow hold from frame to frame. Two things do not:

1. The lamp's reflection on the pond ice. In the opening it stands at about x 1800 to 2040, y 1900 to 2040 in frame 15 and y 1540 to 1680 in frame 43; in the close at about columns 1680 to 2160, rows 1680 to 1920. It is a field of dots one pixel in size, white, pink, red and blue, and almost none stands in the same place in the next frame. By measure its fine part agrees 0.06 to 0.26 with the next frame where the leaves agree 0.86 and the frost 0.90; inside one frame the fine part is 9 to 14 levels rms. In play it is fine twinkling noise on the ice. The ids view calls those pixels the miniature, not particles.
2. One frond of the frost on the glass at left, about x 440 to 540, y 1330 to 1450 in frame 30 of the opening. It is a soft pale shape in frames 27 to 30 and crisp crystals from frame 31 on, in one frame. The frond below it does the same between frames 31 and 33. If the frost is growing in those frames that may be meant; a frond that changes from soft to crisp in one frame is not.

Smaller, look at it and say what you think: in the close, each bright glint of the frost near the rim (lower corners, bottom edge) draws as a patch of 20 to 30 px made of separate small coloured dashes, not a soft disc. It keeps its shape and rides with the picture, so it does not boil.

The film's masters are drawn at this size, so 1 and 2 must be gone before them.

## What I read in the code (read, not tried; find the cause yourself before you mend)
- `src/seasons/winter/mini/village.ts` lines 287 to 291: `iceGlitter` is `0.6 + 1.4 * smoothstep(0.45, 0.85, texture2D(map, vMapUv * 2.3 + 0.37).g)` and multiplies `villageMirror(...)` with the tight lobe `MIRROR.tight`; the last line adds `MIRROR.sparkle` times a texture term. A tight mirror lobe on a bumped normal, times a grain finer than a pixel, is another answer at each of a pixel's sample places and in each frame as the camera travels. It wants a lobe no tighter than the pixel's footprint asks for (widen it by the normal's change over the pixel), and a glitter whose grain is no finer than about a pixel and a half at 3840 from the nearest framing, read with levels.
- `src/seasons/winter/frost.ts` lines 194 to 206: a place of the frost comes on by `smoothstep(0.0, FROST_SOFT, lvl - m.g)` with `lvl` from `uGrow.x`, and by `frostStay` and `frostCrumb` from `uGrow.z`. Read what `uGrow` does over frames 27 to 33 of the opening and which term steps. Line 150 reads the frame behind with `textureLod(uBehind, at, 0.0)`, one tap at the finest level; lines 188 to 208 take footprints with `dFdx` and `dFdy`.

## Files you own
`src/seasons/winter/mini/village.ts` (the pond's lines only) and `src/seasons/winter/frost.ts`. If the cause sits in a shared file (`src/core/`, `src/capture/`, `src/film/`), send `/root` the exact lines and why, and do not change it yourself.

## How to see it
- `npm run build`, then draw film frames 30 to 33 of the opening and 3281 to 3284 of the close at the `uhd` format and the `final` tier as the film draws them (read `tools/README.md` for `seq` and for the film tool's ranges; the farm machines used `npm run master -- --what film-b --first N --last M`, whose ranges are chunks of 30). A uhd final frame took 65 to 83 s on a machine with 8 CPUs, so draw few frames and small windows. Cut the same window out of each frame at one to one and lay them side by side at 8 times, before and after.
- A number for the pond: over the reflection's patch, the fine part's rms inside one frame, and its agreement with the next frame once the travel is taken out. Give both before and after. For the frond: the mean absolute step of its box from frame to frame over 27 to 34, before and after.

## Done means
- At 3840 final the lamp's reflection on the ice is a soft warm streak with, at most, a few steady glints that keep their place on the ice. No field of dots. Its agreement with the next frame is 0.8 or more.
- The frond comes on over several frames or stands from the first; no frame in which it turns from soft to crisp.
- Winter at rest and at the landing at hd review look as they do on `main` (put the pair side by side; the pond's light may be a little softer, never brighter, never gone). `npm run measure -- --unit winter --only M3 --force --tier review` reads no lower than on `main` by more than 0.015.
- The other three seasons' stills at rest are byte for byte as on `main` (draft tier, hd, by sha256).
- The live app's winter still draws (`npm run still -- --season winter --state rest --camera hero --live high --format hd --force`), and the strict run passes on `winter-rest` (`winter-shake` fails on `main` already by 754 pixels in the reading against its own picture; say what yours reads and do not chase it).
- `npx tsc --noEmit` and the whole `npx vitest run` pass before every push.

## Report
One message to `/root`, at most 30 lines: branch and commit; the cause of each as you found it, with the trial that shows it; the numbers before and after; the pictures (four frames at 8 times, before above and after below, the pond and the frond, as one JPEG attached to the message); what you did not see; checks run and their last lines.
