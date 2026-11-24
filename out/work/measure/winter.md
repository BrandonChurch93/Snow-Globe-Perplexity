# Measures · winter

Complete: 24 of 24 lines, 1 red. Tier final, asset set full, engine c5811ea1c5834970, 2026-11-24T18:45:42.582Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `winter-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `winter-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 393334 textured pixels in the sharp zone are under detail.minTexelsPerPixel (861245 textured pixels in all) |
| M3 Real sharpness | `winter-rest` | pass | 0.787 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.982 over 169635 pixels of the part in the ids view; miniature 0.787 over 106187 pixels of the part in the ids view |
| M6 Nothing inside | `winter-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `winter-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 365903 textured pixels in the sharp zone are under detail.minTexelsPerPixel (833189 textured pixels in all) |
| M6 Nothing inside | `winter-shake` | pass | 0.000118 | 0.002 | `sim.maxInsideFraction` | 12 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 516473 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `winter-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 787987 textured pixels in the sharp zone are under detail.minTexelsPerPixel (951746 textured pixels in all) |
| M6 Nothing inside | `winter-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-base` | fail | 21 | 0 | none | 21 invalid values in 2073600 pixels; the base lies inside the frame (81.7 to 1838.3 px across, 232.2 to 867.6 px down) |
| M2 Texture detail | `winter-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 742826 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1682922 textured pixels in all) |
| M6 Nothing inside | `winter-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `winter-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 378108 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1948101 textured pixels in all) |
| M6 Nothing inside | `winter-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `winter-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 394211 textured pixels in the sharp zone are under detail.minTexelsPerPixel (862060 textured pixels in all) |
| M6 Nothing inside | `winter-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `winter-macro` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `winter-macro` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 185371 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1591387 textured pixels in all) |
| M6 Nothing inside | `winter-macro` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M4 Cover at the swap | `test` | pass | 0.9477 | 0.85 | `shake.minCoverAtSwap` | 136197 of 143715 miniature pixels are hidden to at least shake.coverOpacity in the middle of the swap window |
| M5 Clearing | `test` | pass | 0.9931 | 0.6 | `shake.minVisibleAfterSettle` | 162407 of 163538 miniature pixels are hidden by less than shake.coverOpacity, shake.settleCheckSeconds after the landing |
