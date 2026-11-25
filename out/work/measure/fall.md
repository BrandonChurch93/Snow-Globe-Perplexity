# Measures · fall

Not complete: 13 of 19 lines, 4 red. Tier final, asset set full, engine 6a40f6c83e3f1513, 2026-11-25T03:24:51.405Z.

| Measure | Still or shake | Result | Number | Threshold | Config key | What was measured |
| --- | --- | --- | --- | --- | --- | --- |
| M1 Sanity | `fall-rest` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-rest` | fail | 0.2345 | 0.03 | `detail.maxSoftPixelFraction` | 41035 of 175007 textured pixels in the sharp zone are under detail.minTexelsPerPixel (666161 textured pixels in all) |
| M3 Real sharpness | `fall-rest` | fail | 0.3938 | 0.75 | `detail.minSharpnessRatio` | high frequency energy of the still over the approved image at the same size: base 0.394 over 175136 pixels of the part in the ids view; miniature 0.447 over 86965 pixels of the part in the ids view |
| M6 Nothing inside | `fall-rest` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-shake` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 90.7 px, foot at 1029.8 px, base from 597.8 to 1322.2 px) |
| M2 Texture detail | `fall-shake` | fail | 0.2138 | 0.03 | `detail.maxSoftPixelFraction` | 41078 of 192156 textured pixels in the sharp zone are under detail.minTexelsPerPixel (684150 textured pixels in all) |
| M6 Nothing inside | `fall-shake` | pass | 0.00002 | 0.002 | `sim.maxInsideFraction` | 2 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-interior` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; the miniature, 360768 pixels in the ids view, stays clear of the edge of the frame |
| M2 Texture detail | `fall-interior` | pass | 0 | 0.03 | `detail.maxSoftPixelFraction` | 0 of 401313 textured pixels in the sharp zone are under detail.minTexelsPerPixel (582817 textured pixels in all) |
| M6 Nothing inside | `fall-interior` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
| M1 Sanity | `fall-base` | pass | 0 | 0 | none | 0 invalid values in 2073600 pixels; no framing rule for this camera |
| M2 Texture detail | `fall-base` | fail | 0.1702 | 0.03 | `detail.maxSoftPixelFraction` | 15019 of 88269 textured pixels in the sharp zone are under detail.minTexelsPerPixel (417405 textured pixels in all) |
| M6 Nothing inside | `fall-base` | pass | 0 | 0.002 | `sim.maxInsideFraction` | 0 of 102000 particles inside a solid, 0 outside the sphere |
