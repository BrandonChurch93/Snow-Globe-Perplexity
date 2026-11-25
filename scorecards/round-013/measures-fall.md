# Measures · fall

Complete: 19 of 19 lines, 2 red. Tier final, asset set full, engine ef5ff56337adb0bb, 2026-11-25T07:32:40.837Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `fall-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-rest` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 189808 textured pixels in the sharp zone are under detail.minTexelsPerPixel (685305 textured pixels in all) |
| M3 Real sharpness | `fall-rest` | fail | 0.279 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.407 over 172715 pixels of the part in the ids view; miniature 0.279 over 102062 pixels of the part in the ids view |
| M6 Nothing inside | `fall-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-shake` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 187642 textured pixels in the sharp zone are under detail.minTexelsPerPixel (684159 textured pixels in all) |
| M6 Nothing inside | `fall-shake` | pass | 0.000039 | 0.002 | `sim.maxInsideFraction` | 4 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-interior` | fail | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 426741 pixels in the ids view, touches the edge of the frame |
| M2 Texture detail | `fall-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 473465 textured pixels in the sharp zone are under detail.minTexelsPerPixel (652558 textured pixels in all) |
| M6 Nothing inside | `fall-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `fall-base` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 107251 textured pixels in the sharp zone are under detail.minTexelsPerPixel (434393 textured pixels in all) |
| M6 Nothing inside | `fall-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-surface` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `fall-surface` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 97867 textured pixels in the sharp zone are under detail.minTexelsPerPixel (1737641 textured pixels in all) |
| M6 Nothing inside | `fall-surface` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-settled` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-settled` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 189331 textured pixels in the sharp zone are under detail.minTexelsPerPixel (684740 textured pixels in all) |
| M6 Nothing inside | `fall-settled` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
