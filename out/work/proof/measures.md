# Summer tree, motion proof at 3840 x 2160: film B frames 1988 to 1993

Heads: main 6d45906192a596984e99bdbfedc83f5edeab1b95 (engine 4fe5385b7ecf765c), tree 01f1f0b9a89c37bfa3fd37ecc3d88f23e331e8fb (engine d788b65be510c179).
Command on each head: node tools/shutter-frame.mjs --what film-b --frames 1988,1989,1990,1991,1992,1993 --tier final --format uhd --tag <head>
Boxes x,y,w,h: { "a": [1786, 474, 680, 548], "b": [1850, 500, 480, 320], "c": [1400, 980, 480, 320] }
A step: the largest channel differs by more than 12 levels between two neighbours. A one frame event: in some channel the frame stands more than 12 above both neighbours or more than 12 below both.

head main: percent of the box's pixels
| box | x,y,w,h | step 1988-1989 | step 1989-1990 | step 1990-1991 | step 1991-1992 | step 1992-1993 | mean | event 1989 | event 1990 | event 1991 | event 1992 | mean |
| a | 1786,474,680,548 | 3.339 | 3.311 | 3.295 | 3.260 | 3.234 | 3.288 | 0.096 | 0.091 | 0.091 | 0.087 | 0.091 |
| b | 1850,500,480,320 | 2.775 | 2.782 | 2.816 | 2.760 | 2.720 | 2.771 | 0.024 | 0.020 | 0.014 | 0.017 | 0.019 |
| c | 1400,980,480,320 | 1.391 | 1.398 | 1.418 | 1.437 | 1.433 | 1.415 | 0.043 | 0.038 | 0.043 | 0.042 | 0.042 |

head tree: percent of the box's pixels
| box | x,y,w,h | step 1988-1989 | step 1989-1990 | step 1990-1991 | step 1991-1992 | step 1992-1993 | mean | event 1989 | event 1990 | event 1991 | event 1992 | mean |
| a | 1786,474,680,548 | 3.253 | 3.257 | 3.220 | 3.240 | 3.204 | 3.235 | 0.047 | 0.050 | 0.050 | 0.052 | 0.050 |
| b | 1850,500,480,320 | 3.737 | 3.742 | 3.685 | 3.719 | 3.674 | 3.711 | 0.063 | 0.068 | 0.057 | 0.059 | 0.062 |
| c | 1400,980,480,320 | 1.381 | 1.398 | 1.416 | 1.428 | 1.432 | 1.411 | 0.046 | 0.044 | 0.050 | 0.051 | 0.048 |

head against head, same frame, percent of the box over 12 levels
| box | 1988 | 1989 | 1990 | 1991 | 1992 | 1993 |
| a | 33.926 | 33.918 | 33.827 | 33.812 | 33.781 | 33.731 |
| b | 39.004 | 39.048 | 38.978 | 38.932 | 38.833 | 38.704 |
| c | 9.671 | 9.660 | 9.643 | 9.580 | 9.542 | 9.508 |
main box a: crown (leaves grown by 6 px) 143109 px, the rest 229531 px. One frame events at 1989..1992 on the crown 76, 70, 89, 66 px (0.053, 0.049, 0.062, 0.046 % of the crown's pixels), elsewhere 281, 269, 249, 259 px (0.122, 0.117, 0.108, 0.113 %). Steps for the five pairs on the crown 3.017, 2.975, 2.997, 2.938, 2.885 %, elsewhere 3.539, 3.520, 3.481, 3.460, 3.452 %
main box b: crown (leaves grown by 6 px) 94067 px, the rest 59533 px. One frame events at 1989..1992 on the crown 14, 9, 5, 11 px (0.015, 0.010, 0.005, 0.012 % of the crown's pixels), elsewhere 23, 22, 17, 15 px (0.039, 0.037, 0.029, 0.025 %). Steps for the five pairs on the crown 2.155, 2.182, 2.232, 2.190, 2.124 %, elsewhere 3.754, 3.729, 3.739, 3.662, 3.662 %
tree box a: crown (leaves grown by 6 px) 124480 px, the rest 248160 px. One frame events at 1989..1992 on the crown 68, 59, 52, 59 px (0.055, 0.047, 0.042, 0.047 % of the crown's pixels), elsewhere 108, 126, 135, 136 px (0.044, 0.051, 0.054, 0.055 %). Steps for the five pairs on the crown 3.167, 3.148, 3.069, 3.067, 3.002 %, elsewhere 3.297, 3.311, 3.296, 3.327, 3.306 %
tree box b: crown (leaves grown by 6 px) 84182 px, the rest 69418 px. One frame events at 1989..1992 on the crown 42, 39, 32, 41 px (0.050, 0.046, 0.038, 0.049 % of the crown's pixels), elsewhere 54, 65, 55, 50 px (0.078, 0.094, 0.079, 0.072 %). Steps for the five pairs on the crown 2.876, 2.887, 2.851, 2.893, 2.851 %, elsewhere 4.781, 4.778, 4.696, 4.722, 4.672 %

main box b, lit edge: 6111 px lit in frame 1990 (3.98 % of the box); of them stepping in the five pairs 547, 575, 616, 594, 548 px (8.95, 9.41, 10.08, 9.72, 8.97 %), one frame events at 1989..1992 5, 1, 0, 1 px. Lit in all six frames 5364 px (87.8 % of the lit); of them stepping 194, 185, 201, 198, 210 px, events 1, 0, 0, 1 px
tree box b, lit edge: 6232 px lit in frame 1990 (4.06 % of the box); of them stepping in the five pairs 558, 560, 547, 554, 531 px (8.95, 8.99, 8.78, 8.89, 8.52 %), one frame events at 1989..1992 14, 11, 12, 2 px. Lit in all six frames 5444 px (87.4 % of the lit); of them stepping 187, 175, 148, 171, 186 px, events 0, 2, 0, 0 px

Frames as drawn:
film-b frame 1988, 3840 x 2160, final: travel 0.04 px, 24 samples, 104.1 s (4.34 s a sample), sha256 378d7befe7bab71d118c9b4323b17d61c4c47b61424a179591805b560a5e48c6, out/work/shutter/film-b-001988-uhd-final-main-6d459061.png
film-b frame 1989, 3840 x 2160, final: travel 0.04 px, 24 samples, 85.2 s (3.55 s a sample), sha256 9fc7975bfbe0825eab250d465de961dafa9fe347a27e75db4190f79755d78aa2, out/work/shutter/film-b-001989-uhd-final-main-6d459061.png
film-b frame 1990, 3840 x 2160, final: travel 0.05 px, 24 samples, 86.8 s (3.62 s a sample), sha256 20e298f9155b6a450f22fa684e1e4b35042610f22c10247d37a35ebabd011f4e, out/work/shutter/film-b-001990-uhd-final-main-6d459061.png
film-b frame 1991, 3840 x 2160, final: travel 0.05 px, 24 samples, 84.2 s (3.51 s a sample), sha256 75ac3ff43e7d9a20f74e0c1e8363a487f3211d5c76a0ed6a1e75d518cfbea878, out/work/shutter/film-b-001991-uhd-final-main-6d459061.png
film-b frame 1992, 3840 x 2160, final: travel 0.06 px, 24 samples, 83.2 s (3.46 s a sample), sha256 d9ef0d09df22afbc37e93a629e65c14c3feb6b29d883f9c9ccbd268bf40cd125, out/work/shutter/film-b-001992-uhd-final-main-6d459061.png
film-b frame 1993, 3840 x 2160, final: travel 0.06 px, 24 samples, 83.6 s (3.49 s a sample), sha256 c7b667db9fe0b4d93d7c114fb6d3fe357c8c025ae41f180e2d32e039d19e121f, out/work/shutter/film-b-001993-uhd-final-main-6d459061.png
film-b frame 1988, 3840 x 2160, final: travel 0.04 px, 24 samples, 91.8 s (3.83 s a sample), sha256 b56f3d2c03dc77c5821cf1823f6219119b20b708572ffb33fcbbeb3137ddb3b9, out/work/shutter/film-b-001988-uhd-final-tree-01f1f0b9.png
film-b frame 1989, 3840 x 2160, final: travel 0.04 px, 24 samples, 84.4 s (3.52 s a sample), sha256 9bf05795d75b5280244e7ed49227014ef8c196773ec807924c73c26c6b8acb46, out/work/shutter/film-b-001989-uhd-final-tree-01f1f0b9.png
film-b frame 1990, 3840 x 2160, final: travel 0.05 px, 24 samples, 86.7 s (3.61 s a sample), sha256 e7a60aed9018144f14dbd27bec419baab167c09c1f6a1a73088a8b401509bf92, out/work/shutter/film-b-001990-uhd-final-tree-01f1f0b9.png
film-b frame 1991, 3840 x 2160, final: travel 0.05 px, 24 samples, 83.6 s (3.48 s a sample), sha256 43e12e9e80973a0103d95e1af337eef17a9161ccecaf5262d53cf6d06c5f814f, out/work/shutter/film-b-001991-uhd-final-tree-01f1f0b9.png
film-b frame 1992, 3840 x 2160, final: travel 0.06 px, 24 samples, 84.1 s (3.50 s a sample), sha256 ec3b5c6369117c5894c893971191ece2df3a809bb9f51436ccbb9f95c6b384bf, out/work/shutter/film-b-001992-uhd-final-tree-01f1f0b9.png
film-b frame 1993, 3840 x 2160, final: travel 0.06 px, 24 samples, 83.7 s (3.49 s a sample), sha256 7df141752c384217a9223daf92bc6134c0ffa379fed1a675ea3a1d0d77a91576, out/work/shutter/film-b-001993-uhd-final-tree-01f1f0b9.png
