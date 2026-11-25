# Measures · summer

Complete: 19 of 19 lines, 5 red. Tier final, asset set full, engine 860c085c45f24b98, 2026-11-25T02:33:51.724Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `summer-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-rest` | fail | 0.0851 | 0.03 | `detail.maxSoftPixelFraction` | 26623 of 312960 textured pixels in the sharp zone are under detail.minTexelsPerPixel (804854 textured pixels in all) |
| M3 Real sharpness | `summer-rest` | fail | 0.3649 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.604 over 170861 pixels of the part in the ids view; miniature 0.365 over 121778 pixels of the part in the ids view |
| M6 Nothing inside | `summer-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-shake` | fail | 0.0857 | 0.03 | `detail.maxSoftPixelFraction` | 26812 of 312822 textured pixels in the sharp zone are under detail.minTexelsPerPixel (803283 textured pixels in all) |
| M6 Nothing inside | `summer-shake` | pass | 0.000078 | 0.002 | `sim.maxInsideFraction` | 8 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 537678 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `summer-interior` | fail | 0.164 | 0.03 | `detail.maxSoftPixelFraction` | 103344 of 630266 textured pixels in the sharp zone are under detail.minTexelsPerPixel (865152 textured pixels in all) |
| M6 Nothing inside | `summer-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `summer-base` | pass | 0.0136 | 0.03 | `detail.maxSoftPixelFraction` | 7638 of 562943 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1351487 textured pixels in all) |
| M6 Nothing inside | `summer-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `summer-surface` | pass | 0.0186 | 0.03 | `detail.maxSoftPixelFraction` | 6068 of 326006 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1670696 textured pixels in all) |
| M6 Nothing inside | `summer-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-settled` | fail | 0.0847 | 0.03 | `detail.maxSoftPixelFraction` | 26513 of 312885 textured pixels in the sharp zone are under detail.minTexelsPerPixel (804788 textured pixels in all) |
| M6 Nothing inside | `summer-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
