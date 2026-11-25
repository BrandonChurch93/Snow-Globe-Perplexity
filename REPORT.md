# REPORT: fall base and slab (fall_base2), 05:47 UTC

Branch `agent/p4-fall_base2`, last commit **0e36e95** (pushed 05:44; holds 9d9cfbe and a merge of origin/main). In the freeze of 05:20: **15ecc57**; a0e301d and 9d9cfbe came after it. Looks branch `agent/p4-fall_base2-looks`.
Make targets, in order: `npm run make -- base-fall`, `npm run make -- slab-fall`, `npm run texpack`, `npm run build`.

No stand-ins and no fallbacks in my files. No generated picture, no outside file: everything in `base-fall` and `slab-fall` is made by the scripts in `assets-src/`, so there are no rows for `ASSETS.md`.

One fault: merge commit 15ecc57 carries git's default message without the `Co-authored-by` trailer (told to /root at 05:16, logged, left as it is).

## Round 10 issues
| Issue | State | Commit |
|---|---|---|
| Jury: three faces look like copies | fixed: four carvings, own turn, ribs, glow | 2b9d7f0 |
| R1 #12 / R3-1 #7 / R3-2 #7 pumpkins: bright, bevel, deep cuts, bounce | fixed for brightness, bevel and cuts; bounce on branches raised (`baseCandle 3.6`) but not judged closely | 2b9d7f0, 69cf1fd |
| R1 #11 regular weave, loops | fixed: straight level branches behind the pumpkins | 69cf1fd, 838c64f |
| Jury "smooth tubular vines" | fixed in part: fibrous bark (in freeze), then darker with a glossy streak; still level, see open 1 | e7ab0b5 (in freeze), a0e301d, 9d9cfbe (after) |
| R1 #11 / R3-2 #3 cobweb | fixed: finer strands, sag 1.1, glint | 69cf1fd |
| R1 #10 / R3-2 #6 / R3-1 #3 wax | part: paler, glossier, teardrops draped over the crown branches, low puddles at the foot; still shorter and less glossy than approved | 2b9d7f0, 69cf1fd, 838c64f |
| R3-1 #3 / R3-2 #4 seat of the glass | part: dark seating edge, dashes gone; no modelled channel | 838c64f, 04c2655 |
| R1 #13 leaves sparse, lighter, glinting | fixed | 2b9d7f0 |
| R1 #21 pumpkin reflections under the foot | part: `candleInSlab`; cut by the hero frame | 2b9d7f0 |
| R4 issue 4 order and manner of lighting | fixed: uneven order (middle, right, left), spit, near death, tremble | a5e19a4 |
| G15 triangles | inside all three limits, see Measured | 2b9d7f0 to 838c64f |

## Measured
- My triangles at 0e36e95 (texpack report): high 89,572 (base 83,992 + slab 5,580), medium 83,822 (78,242 + 5,580), low 58,558 (52,978 + 5,580). G15 limits 120,449 / 86,644 / 59,953. At 216e427 they were 126,788 / 111,082 / 71,373.
- Base mesh: iron 59,010 (drum and seat 7,416), pumpkins 13,794 in 7 faces, wax 10,270 in 29 runs, web 918.
- Season drawn, `node out/work/bin/tris.mjs fall` at 05:12 on 04c2655 plus the bark paint (same meshes): high 1,661,337 of 1,800,000; medium 983,430 of 1,100,000; low 466,838 of 600,000.
- Bytes of my 7 files in `public/assets/fall`: 2,775,501 = 2.647 MiB.
- `npm run measure -- --unit fall --only M1,M2,M3,M6 --tier draft` on 04c2655 (05:06): stopped at the chunk budget with 16 of 19 lines; M1, M2, M6 pass on rest, shake, interior, base, surface; M2 0 soft pixels on all five; M6 2 of 102,000 inside a solid on fall-shake; M3 fall-rest FAIL 0.380 (base 0.557, miniature 0.380, threshold 0.75).
- `--only M3` on 15ecc57 (05:17): base 0.666, miniature 0.380. On a0e301d (05:20): base 0.791. On 9d9cfbe before the merge of main (05:36): base **1.039**, miniature 0.380; the line stays red on the miniature. Not measured again after the merge.
- `npm run determinism` on a0e301d (05:27): pass. Again on the merged head 0e36e95 (05:44): `determinism: pass · 3 pictures, 4 page loads, preview, draft, 357 s`.
- `npx tsc --noEmit` clean; `npx vitest run`: 432 passed, 4 skipped (on 0e36e95 after making all four targets again; the same on a0e301d and 15ecc57).
- Fit, box 620,860,2220,1584, mean difference per channel at 0e36e95: 35.8, 29.2, 23.3 (a0e301d: 36.0, 28.7, 22.8).

## Looks
base-fall 39 of 40 (the predecessor reported 39 and 32 of its own), slab-fall 8 of 40. All `--tier draft --format hd`.

## Still wrong, worst first
See `HANDOVER.md`, "Open, worst first": level branches, browner at left than approved; wax shorter and less glossy; side pumpkins a little small; no modelled channel at the seat; right pumpkin half hidden by wax from the low camera; reflections cut by the frame; no grey leather; base about 5% tall in frame.

## Constants and pitfalls
In `HANDOVER.md`.
