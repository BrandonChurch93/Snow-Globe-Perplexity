# Measures · summer

Complete: 19 of 19 lines, 1 red. Tier final, asset set full, engine 4708b960e00eb5d2, 2026-11-26T09:20:11.236Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `summer-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 306697 textured pixels in the sharp zone are under detail.minTexelsPerPixel (802481 textured pixels in all) |
| M3 Real sharpness | `summer-rest` | fail | 0.6923 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.692 over 170194 pixels of the part in the ids view; miniature 1.135 over 120255 pixels of the part in the ids view |
| M6 Nothing inside | `summer-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 306511 textured pixels in the sharp zone are under detail.minTexelsPerPixel (801062 textured pixels in all) |
| M6 Nothing inside | `summer-shake` | pass | 0.000088 | 0.002 | `sim.maxInsideFraction` | 9 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 517245 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `summer-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 646444 textured pixels in the sharp zone are under detail.minTexelsPerPixel (888950 textured pixels in all) |
| M6 Nothing inside | `summer-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `summer-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 554685 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1467508 textured pixels in all) |
| M6 Nothing inside | `summer-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `summer-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 340576 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1756670 textured pixels in all) |
| M6 Nothing inside | `summer-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 306671 textured pixels in the sharp zone are under detail.minTexelsPerPixel (802509 textured pixels in all) |
| M6 Nothing inside | `summer-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
