# Measures · fall

Complete: 19 of 19 lines, 1 red. Tier final, asset set full, engine a3f6d8084017227f, 2026-11-25T12:18:54.145Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `fall-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 183827 textured pixels in the sharp zone are under detail.minTexelsPerPixel (682155 textured pixels in all) |
| M3 Real sharpness | `fall-rest` | fail | 0.5518 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.682 over 173864 pixels of the part in the ids view; miniature 0.552 over 101369 pixels of the part in the ids view |
| M6 Nothing inside | `fall-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 186156 textured pixels in the sharp zone are under detail.minTexelsPerPixel (683753 textured pixels in all) |
| M6 Nothing inside | `fall-shake` | pass | 0.000069 | 0.002 | `sim.maxInsideFraction` | 7 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 439582 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `fall-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 483002 textured pixels in the sharp zone are under detail.minTexelsPerPixel (666170 textured pixels in all) |
| M6 Nothing inside | `fall-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `fall-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 113852 textured pixels in the sharp zone are under detail.minTexelsPerPixel (437278 textured pixels in all) |
| M6 Nothing inside | `fall-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `fall-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 98511 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1745561 textured pixels in all) |
| M6 Nothing inside | `fall-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 184094 textured pixels in the sharp zone are under detail.minTexelsPerPixel (682338 textured pixels in all) |
| M6 Nothing inside | `fall-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
