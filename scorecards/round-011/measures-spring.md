# Measures · spring

Complete: 19 of 19 lines, 5 red. Tier final, asset set full, engine ef5ff56337adb0bb, 2026-11-25T06:30:19.734Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `spring-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-rest` | fail | 0.05 | 0.03 | `detail.maxSoftPixelFraction` | 14548 of 290695 textured pixels in the sharp zone are under detail.minTexelsPerPixel (841996 textured pixels in all) |
| M3 Real sharpness | `spring-rest` | fail | 0.5187 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.519 over 176691 pixels of the part in the ids view; miniature 0.722 over 117734 pixels of the part in the ids view |
| M6 Nothing inside | `spring-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-shake` | fail | 0.0546 | 0.03 | `detail.maxSoftPixelFraction` | 16581 of 303421 textured pixels in the sharp zone are under detail.minTexelsPerPixel (852970 textured pixels in all) |
| M6 Nothing inside | `spring-shake` | pass | 0.000235 | 0.002 | `sim.maxInsideFraction` | 24 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 554634 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `spring-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 422258 textured pixels in the sharp zone are under detail.minTexelsPerPixel (650998 textured pixels in all) |
| M6 Nothing inside | `spring-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-base` | fail | 3 | 0 | none | 3 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `spring-base` | pass | 0.006 | 0.03 | `detail.maxSoftPixelFraction` | 4109 of 682618 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1896280 textured pixels in all) |
| M6 Nothing inside | `spring-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `spring-surface` | pass | 0.0256 | 0.03 | `detail.maxSoftPixelFraction` | 11162 of 435742 textured pixels in the sharp zone are under detail.minTexelsPerPixel (2029385 textured pixels in all) |
| M6 Nothing inside | `spring-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `spring-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `spring-settled` | fail | 0.0499 | 0.03 | `detail.maxSoftPixelFraction` | 14548 of 291568 textured pixels in the sharp zone are under detail.minTexelsPerPixel (842833 textured pixels in all) |
| M6 Nothing inside | `spring-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
