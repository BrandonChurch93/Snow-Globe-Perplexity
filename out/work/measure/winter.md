# Measures · winter

Complete: 24 of 24 lines, 0 red. Tier final, asset set full, engine a657047103a04c48, 2026-11-24T16:45:23.521Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `winter-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 91.2 px, foot at 1029.2 px, base from 598.2 to 1321.8 px) |
| M2 Texture detail | `winter-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 382469 textured pixels in the sharp zone are under detail.minTexelsPerPixel (844496 textured pixels in all) |
| M3 Real sharpness | `winter-rest` | pass | 0.8324 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.896 over 169169 pixels of the part in the ids view; miniature 0.832 over 108614 pixels of the part in the ids view |
| M6 Nothing inside | `winter-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 91.2 px, foot at 1029.2 px, base from 598.2 to 1321.8 px) |
| M2 Texture detail | `winter-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 357334 textured pixels in the sharp zone are under detail.minTexelsPerPixel (819425 textured pixels in all) |
| M6 Nothing inside | `winter-shake` | pass | 0.000059 | 0.002 | `sim.maxInsideFraction` | 6 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 530621 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `winter-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 762862 textured pixels in the sharp zone are under detail.minTexelsPerPixel (938256 textured pixels in all) |
| M6 Nothing inside | `winter-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `winter-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 708758 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1653549 textured pixels in all) |
| M6 Nothing inside | `winter-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `winter-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 367060 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1925619 textured pixels in all) |
| M6 Nothing inside | `winter-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 91.2 px, foot at 1029.2 px, base from 598.2 to 1321.8 px) |
| M2 Texture detail | `winter-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 383143 textured pixels in the sharp zone are under detail.minTexelsPerPixel (845238 textured pixels in all) |
| M6 Nothing inside | `winter-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-macro` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `winter-macro` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 183925 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1561973 textured pixels in all) |
| M6 Nothing inside | `winter-macro` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M4 Cover at the swap | `test` | pass | 0.9449 | 0.85 | `shake.minCoverAtSwap` | 133747 of 141550 miniature pixels are hidden to at least shake.coverOpacity in the middle of the swap window |
| M5 Clearing | `test` | pass | 0.9975 | 0.6 | `shake.minVisibleAfterSettle` | 161398 of 161796 miniature pixels are hidden by less than shake.coverOpacity, shake.settleCheckSeconds after the landing |
