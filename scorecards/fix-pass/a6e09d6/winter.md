# Measures · winter

Complete: 24 of 24 lines, 0 red. Tier final, asset set full, engine a3f6d8084017227f, 2026-11-25T12:10:25.886Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `winter-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `winter-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 404157 textured pixels in the sharp zone are under detail.minTexelsPerPixel (924900 textured pixels in all) |
| M3 Real sharpness | `winter-rest` | pass | 0.9203 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.920 over 173266 pixels of the part in the ids view; miniature 0.931 over 99001 pixels of the part in the ids view |
| M6 Nothing inside | `winter-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `winter-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 397437 textured pixels in the sharp zone are under detail.minTexelsPerPixel (916314 textured pixels in all) |
| M6 Nothing inside | `winter-shake` | pass | 0.000029 | 0.002 | `sim.maxInsideFraction` | 3 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 478218 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `winter-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 776525 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1017331 textured pixels in all) |
| M6 Nothing inside | `winter-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `winter-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 712241 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1665173 textured pixels in all) |
| M6 Nothing inside | `winter-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `winter-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 388209 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1972943 textured pixels in all) |
| M6 Nothing inside | `winter-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `winter-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 404830 textured pixels in the sharp zone are under detail.minTexelsPerPixel (925598 textured pixels in all) |
| M6 Nothing inside | `winter-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-macro` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `winter-macro` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 192734 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1609397 textured pixels in all) |
| M6 Nothing inside | `winter-macro` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M4 Cover at the swap | `test` | pass | 0.9922 | 0.85 | `shake.minCoverAtSwap` | 141341 of 142454 miniature pixels are hidden to at least shake.coverOpacity in the middle of the swap window |
| M5 Clearing | `test` | pass | 0.9994 | 0.6 | `shake.minVisibleAfterSettle` | 155843 of 155941 miniature pixels are hidden by less than shake.coverOpacity, shake.settleCheckSeconds after the landing |
