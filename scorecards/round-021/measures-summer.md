# Measures · summer

Complete: 19 of 19 lines, 0 red. Tier final, asset set full, engine 7bed76e87f414806, 2026-11-26T12:48:11.130Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `summer-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 318110 textured pixels in the sharp zone are under detail.minTexelsPerPixel (815133 textured pixels in all) |
| M3 Real sharpness | `summer-rest` | pass | 1.0416 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 1.643 over 166585 pixels of the part in the ids view; miniature 1.042 over 122358 pixels of the part in the ids view |
| M6 Nothing inside | `summer-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 317554 textured pixels in the sharp zone are under detail.minTexelsPerPixel (812688 textured pixels in all) |
| M6 Nothing inside | `summer-shake` | pass | 0.00001 | 0.002 | `sim.maxInsideFraction` | 1 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 566132 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `summer-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 663241 textured pixels in the sharp zone are under detail.minTexelsPerPixel (901731 textured pixels in all) |
| M6 Nothing inside | `summer-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `summer-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 584775 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1495580 textured pixels in all) |
| M6 Nothing inside | `summer-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `summer-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 342053 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1826291 textured pixels in all) |
| M6 Nothing inside | `summer-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `summer-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `summer-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 318246 textured pixels in the sharp zone are under detail.minTexelsPerPixel (815272 textured pixels in all) |
| M6 Nothing inside | `summer-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
