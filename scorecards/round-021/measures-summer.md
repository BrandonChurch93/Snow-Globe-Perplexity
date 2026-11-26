# Measures · summer

Complete: 19 of 19 lines, 0 red. Tier final, asset set full, engine d9c3f29b3999ef20, 2026-11-26T16:52:17.551Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `summer-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 319872 textured pixels in the sharp zone are under detail.minTexelsPerPixel (810434 textured pixels in all) |
| M3 Real sharpness | `summer-rest` | pass | 0.8142 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 1.118 over 165836 pixels of the part in the ids view; miniature 0.814 over 132535 pixels of the part in the ids view |
| M6 Nothing inside | `summer-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 318740 textured pixels in the sharp zone are under detail.minTexelsPerPixel (803929 textured pixels in all) |
| M6 Nothing inside | `summer-shake` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 575248 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `summer-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 686972 textured pixels in the sharp zone are under detail.minTexelsPerPixel (948872 textured pixels in all) |
| M6 Nothing inside | `summer-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `summer-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 557498 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1468078 textured pixels in all) |
| M6 Nothing inside | `summer-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `summer-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 331168 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1806860 textured pixels in all) |
| M6 Nothing inside | `summer-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 319850 textured pixels in the sharp zone are under detail.minTexelsPerPixel (810263 textured pixels in all) |
| M6 Nothing inside | `summer-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
