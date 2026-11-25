# Measures · spring

Complete: 19 of 19 lines, 1 red. Tier final, asset set full, engine a3f6d8084017227f, 2026-11-25T12:10:19.614Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `spring-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 273082 textured pixels in the sharp zone are under detail.minTexelsPerPixel (841107 textured pixels in all) |
| M3 Real sharpness | `spring-rest` | fail | 0.394 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.394 over 176612 pixels of the part in the ids view; miniature 0.883 over 111716 pixels of the part in the ids view |
| M6 Nothing inside | `spring-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 281632 textured pixels in the sharp zone are under detail.minTexelsPerPixel (849197 textured pixels in all) |
| M6 Nothing inside | `spring-shake` | pass | 0.000206 | 0.002 | `sim.maxInsideFraction` | 21 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 496097 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `spring-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 387397 textured pixels in the sharp zone are under detail.minTexelsPerPixel (654759 textured pixels in all) |
| M6 Nothing inside | `spring-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `spring-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 550552 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1924600 textured pixels in all) |
| M6 Nothing inside | `spring-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `spring-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 446619 textured pixels in the sharp zone are under detail.minTexelsPerPixel (2029668 textured pixels in all) |
| M6 Nothing inside | `spring-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 270003 textured pixels in the sharp zone are under detail.minTexelsPerPixel (838042 textured pixels in all) |
| M6 Nothing inside | `spring-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
