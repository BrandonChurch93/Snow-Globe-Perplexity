# Measures · summer

Complete: 19 of 19 lines, 1 red. Tier final, asset set full, engine ef5ff56337adb0bb, 2026-11-25T06:30:24.713Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `summer-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 324266 textured pixels in the sharp zone are under detail.minTexelsPerPixel (827436 textured pixels in all) |
| M3 Real sharpness | `summer-rest` | fail | 0.5806 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 1.236 over 173494 pixels of the part in the ids view; miniature 0.581 over 124813 pixels of the part in the ids view |
| M6 Nothing inside | `summer-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 322813 textured pixels in the sharp zone are under detail.minTexelsPerPixel (822134 textured pixels in all) |
| M6 Nothing inside | `summer-shake` | pass | 0.00002 | 0.002 | `sim.maxInsideFraction` | 2 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 555681 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `summer-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 660441 textured pixels in the sharp zone are under detail.minTexelsPerPixel (891324 textured pixels in all) |
| M6 Nothing inside | `summer-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `summer-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 597559 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1462965 textured pixels in all) |
| M6 Nothing inside | `summer-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `summer-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 345709 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1833954 textured pixels in all) |
| M6 Nothing inside | `summer-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 324276 textured pixels in the sharp zone are under detail.minTexelsPerPixel (827446 textured pixels in all) |
| M6 Nothing inside | `summer-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
