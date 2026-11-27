# Measures · summer

Complete: 19 of 19 lines, 0 red. Tier final, asset set full, engine 60d39792f3f3d6c1, 2026-11-27T06:32:17.452Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `summer-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 326174 textured pixels in the sharp zone are under detail.minTexelsPerPixel (840485 textured pixels in all) |
| M3 Real sharpness | `summer-rest` | pass | 0.7875 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.788 over 163280 pixels of the part in the ids view; miniature 0.892 over 131079 pixels of the part in the ids view |
| M6 Nothing inside | `summer-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 324853 textured pixels in the sharp zone are under detail.minTexelsPerPixel (825227 textured pixels in all) |
| M6 Nothing inside | `summer-shake` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 590147 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `summer-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 706730 textured pixels in the sharp zone are under detail.minTexelsPerPixel (967087 textured pixels in all) |
| M6 Nothing inside | `summer-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `summer-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 571680 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1550062 textured pixels in all) |
| M6 Nothing inside | `summer-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `summer-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 325426 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1894129 textured pixels in all) |
| M6 Nothing inside | `summer-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 326088 textured pixels in the sharp zone are under detail.minTexelsPerPixel (840347 textured pixels in all) |
| M6 Nothing inside | `summer-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
