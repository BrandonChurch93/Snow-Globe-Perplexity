# Measures · spring

Complete: 19 of 19 lines, 7 red. Tier final, asset set full, engine 860c085c45f24b98, 2026-11-25T02:25:17.764Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `spring-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-rest` | fail | 0.0531 | 0.03 | `detail.maxSoftPixelFraction` | 15551 of 292889 textured pixels in the sharp zone are under detail.minTexelsPerPixel (844020 textured pixels in all) |
| M3 Real sharpness | `spring-rest` | fail | 0.3942 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.394 over 176530 pixels of the part in the ids view; miniature 0.557 over 118286 pixels of the part in the ids view |
| M6 Nothing inside | `spring-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-shake` | fail | 0.055 | 0.03 | `detail.maxSoftPixelFraction` | 16626 of 302170 textured pixels in the sharp zone are under detail.minTexelsPerPixel (849904 textured pixels in all) |
| M6 Nothing inside | `spring-shake` | pass | 0.000275 | 0.002 | `sim.maxInsideFraction` | 28 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-interior` | fail | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 585290 pixels in the ids view, touches the edge of the frame |
| M2 Texture detail | `spring-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 403397 textured pixels in the sharp zone are under detail.minTexelsPerPixel (628292 textured pixels in all) |
| M6 Nothing inside | `spring-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-base` | fail | 3 | 0 | none | 3 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `spring-base` | pass | 0.0024 | 0.03 | `detail.maxSoftPixelFraction` | 1701 of 721855 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1918965 textured pixels in all) |
| M6 Nothing inside | `spring-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `spring-surface` | fail | 0.0346 | 0.03 | `detail.maxSoftPixelFraction` | 15218 of 439401 textured pixels in the sharp zone are under detail.minTexelsPerPixel (2032727 textured pixels in all) |
| M6 Nothing inside | `spring-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-settled` | fail | 0.0531 | 0.03 | `detail.maxSoftPixelFraction` | 15551 of 293076 textured pixels in the sharp zone are under detail.minTexelsPerPixel (844208 textured pixels in all) |
| M6 Nothing inside | `spring-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
