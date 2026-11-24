# The cut in words

Written by `npm run cut` from the page. Do not edit by hand: change the config or the audio map and run it again.

- Source of the timing: the default grid, until the music has a map.
- Film B is 60 s: 3600 frames at 60 a second, 25 bars of 4 beats at 100 beats a minute.
- Times are from frame 0 of film B. In film A everything moves later by the opening, 14.5 s (870 frames).

## Shots

| Shot | Kind | Season | Starts | Bar | Bars | Frames | Length |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `open` | hold | winter | 0:00.00 | 1 | 4 | 0 to 575 | 9.6 s |
| `shake-1` | shake | winter to spring | 0:09.60 | 5 | 1 | 576 to 719 | 2.4 s |
| `spring` | hold | spring | 0:12.00 | 6 | 4 | 720 to 1295 | 9.6 s |
| `shake-2` | shake | spring to summer | 0:21.60 | 10 | 1 | 1296 to 1439 | 2.4 s |
| `summer` | hold | summer | 0:24.00 | 11 | 4 | 1440 to 2015 | 9.6 s |
| `shake-3` | shake | summer to fall | 0:33.60 | 15 | 1 | 2016 to 2159 | 2.4 s |
| `fall` | hold | fall | 0:36.00 | 16 | 4 | 2160 to 2735 | 9.6 s |
| `shake-4` | shake | fall to winter | 0:45.60 | 20 | 1 | 2736 to 2879 | 2.4 s |
| `close` | hold | winter | 0:48.00 | 21 | 5 | 2880 to 3599 | 12 s |

## Shakes

Each shake is one bar with the camera locked. The season changes inside the swap window, behind the storm, and the globe is down on the bar line.

| Shake | Change | Lift starts | In the air | Strokes end | Swap window | Landing | Landing frame |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `shake-1` | winter to spring | 0:09.60 | 0:10.20 | 0:11.40 | 0:10.80 to 0:11.38 | 0:12.00, bar 6 | 720 |
| `shake-2` | spring to summer | 0:21.60 | 0:22.20 | 0:23.40 | 0:22.80 to 0:23.38 | 0:24.00, bar 11 | 1440 |
| `shake-3` | summer to fall | 0:33.60 | 0:34.20 | 0:35.40 | 0:34.80 to 0:35.38 | 0:36.00, bar 16 | 2160 |
| `shake-4` | fall to winter | 0:45.60 | 0:46.20 | 0:47.40 | 0:46.80 to 0:47.38 | 0:48.00, bar 21 | 2880 |

## Sound cues

| Time | Frame | Cue | Note |
| --- | --- | --- | --- |
| 0:00.00 | 0 | `music-box` | only if it has a kept take |
| 0:09.60 | 576 | `lift` |  |
| 0:09.60 | 576 | `shake-spring` |  |
| 0:12.00 | 720 | `land-spring` |  |
| 0:12.00 | 720 | `glass-clink` |  |
| 0:21.60 | 1296 | `lift` |  |
| 0:21.60 | 1296 | `shake-summer` |  |
| 0:24.00 | 1440 | `land-summer` |  |
| 0:24.00 | 1440 | `glass-clink` |  |
| 0:33.60 | 2016 | `lift` |  |
| 0:33.60 | 2016 | `shake-fall` |  |
| 0:36.00 | 2160 | `land-fall` |  |
| 0:36.00 | 2160 | `glass-clink` |  |
| 0:45.60 | 2736 | `lift` |  |
| 0:45.60 | 2736 | `shake-winter` |  |
| 0:48.00 | 2880 | `land-winter` |  |
| 0:48.00 | 2880 | `glass-clink` |  |
| 0:57.60 | 3456 | `music-box` | only if it has a kept take |

## Ambience

| Bed | From | To | Fade in | Fade out |
| --- | --- | --- | --- | --- |
| `amb-winter` | 0:00.00 | 0:12.00 | 0 s | 2.4 s |
| `amb-spring` | 0:09.60 | 0:24.00 | 2.4 s | 2.4 s |
| `amb-summer` | 0:21.60 | 0:36.00 | 2.4 s | 2.4 s |
| `amb-fall` | 0:33.60 | 0:48.00 | 2.4 s | 2.4 s |
| `amb-winter` | 0:45.60 | 1:00.00 | 2.4 s | 0 s |

## Music sections

| Season | From | To | Bars |
| --- | --- | --- | --- |
| winter | 0:00.00 | 0:12.00 | 5 |
| spring | 0:12.00 | 0:24.00 | 5 |
| summer | 0:24.00 | 0:36.00 | 5 |
| fall | 0:36.00 | 0:48.00 | 5 |
| winter | 0:48.00 | 1:00.00 | 5 |

## Film A's opening

| Part | From | To | Frames |
| --- | --- | --- | --- |
| The prompt is typed | 0:00.50 | 0:06.50 | 30 to 389 |
| The reasoning control is opened and set | 0:06.50 | 0:08.05 | 390 to 482 |
| The send control is pressed | 0:08.85 | 0:09.10 | 531 to 545 |
| The build screen | 0:09.10 | 0:14.50 | 546 to 869 |

The steps of the build appear on frames 582, 636, 690, 744, 798. The reasoning menu opens on frame 411 and the choice is made on frame 465.

- `key-tap`: 84 times, one for each character, from 0:00.50 to 0:06.43. The frames are in `opening.cues` of `CUTLIST.json`.
- `ui-send`: 0:08.85, frame 531.
- `riser`: 0:13.30, frame 798.

## The card loop

8 s, 480 frames at 60 a second, from the `hero` camera in the `hd` format. The camera stands at 765.9 mm: moved back from 616 mm along its own axis, so the glass and the base stay inside the centred square crop of the card through the shake. One shake: lift on frame 48, in the air on 84, strokes end on 156, landing on 192. The season does not change, and the frame after the last is frame 0.
