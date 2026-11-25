# Report: unit `change` (change_builder2), Phase 4, third set

Times UTC. Branch `agent/p4-change2`, last commit `bfec889` (pushed 08:10; a merge of main at c5577c6 on top of 664ba4a, no source of mine after 7cd19de). Looks `agent/p4-change2-looks`. `HANDOVER.md` beside this file holds the state of each change and arrival, what is wrong on the newest sheet, and the next things to do. The report of the pass before mine is `REPORT.md` on `agent/p4-change-looks`.

## Stand-ins and fallbacks

None. `BUILT_CHANGES` in `src/shake/change.ts` holds all four pairs. Neither named fallback (the plain dissolve of every part; an arrival faded in evenly) was used. The three arrival files add no mesh of their own at rest; summer's grains (in `src/seasons/summer/arrival.ts`) went to summer_air3 at 06:54.

## What was built, by commit

| Commit | What |
| --- | --- |
| 5614f5a | the outside of a change is a front of light, not a per pixel stipple: it runs from the collar down the base and from the foot out across the table inside the outside span; `uFront`; summer's sand jump lifted so it reads |
| 347457d | the light of the front sits on its broken edge (patches in the part's own space), not on a level band |
| 7cd19de | decision 89: the bokeh discs and the room's walls cross with the key light through the whole window (`src/scene/backdrop.ts`, one line, root's file, allowed at 07:27); the table's front is drawn out in fingers along the way the light runs and takes more of the span (`tableFrom` 0.26, `streak` 3.4) |
| ca6b570, b78f656, 9bedd89, 8f88c2f, 4eef67f, 94316de, 5d9cfe6, 664ba4a, bfec889 | merges of `origin/main` |

fall_base3 fixed Round 13 R4's major (the front face that lit, nearly died and lit again) in its own file, 54ac639 on `agent/p4-fall_base3`; I sent the cause and lines at 07:25 and changed nothing for it.

## Critics' issues given to me, and where each stands

| Round, issue | Stand |
| --- | --- |
| R13 R4 severe, R12 R4 severe, R11 R4 #1 severe: the outside of the swap reads as a cut | Answered in part. Seen on draft sheets of all four windows (even frames, hero): the bokeh and the walls cross through the whole window without a step; the base changes behind a broken lit front inside the flood; the table's scatter changes from the foot outward over 2 to 3 even frames (leaves near the foot at 2116, everywhere at 2120; petals half gone at 1396, gone at 1400). Not done: the scatter does not move with a gust. Petals, leaves and grains place themselves in their own vertex code (`spring/slab.ts`, `fall/slab.ts`, `summer/arrival.ts`, not my files) and their clocks stop at 0 in the air, so nothing of mine can carry them; it needs a blow-in clock in those three files. Not done: growing the stage over 1 to 2 s after the landing (R11's second way); the kit ("They change at the fastest moment of the strokes") and `tests/shake-change.test.ts` pin the outside to 4 to 9 frames at the fastest stroke, so that way is root's to decide. |
| R11 R4 #2 major: frame 666 half and half (storm pink, stage winter) | Answered in part by decision 89: the room and the bokeh now turn with the storm from the window's first frame. The base and the table still wait for their span (672.2), as the kit asks. Not done: holding the storm's colour back (the inner swell `CHANGE_BLOOM.swellFrom` 0.46 and the particles' turn 0.22 to 0.78); each needs a look at all four changes and a measure, for which no time was left. |
| R12 R4 major, R11 R4 #3 major, R13 R4 major: the weight of the shake, no tilt | Not taken, agreed with root at 07:27 (open item 71, `src/shake/table.ts` frozen). Readings sent: the drawn globe takes the table's tilt whole (`stage.ts` line 272); see HANDOVER.md for the two lists. |
| R13 R4 major: the front face lights, nearly drops out, lights again | fall_base3, 54ac639. |
| R12 R1 #12 and R3 major: summer's grains as streaks | summer_air3 (root, 06:54). |

## Measures

Thresholds M4 at least 0.85, M5 at least 0.6, M6 at most 0.002 and none outside the sphere. Final tier. A cycle is one change to the build and one measure.

| Change | Cycle | What changed | M4 | M5 | M6 swap | M6 landing |
| --- | --- | --- | --- | --- | --- | --- |
| winter-spring | 1 | predecessor, c568e8a | 0.9444 | 0.9864 | 0.000284 | 0.000265 |
| spring-summer | 1 | same | 0.9797 | 1 | 0.000353 | 0.000029 |
| summer-fall | 1 | same | 0.9198 | 0.9728 | 0.000088 | 0.000039 |
| fall-winter | 1 | same | 0.9603 | 0.9996 | 0.000088 | 0.000039 |
| winter-spring | 2 | the front of light (347457d), 16,000 leaves | 0.9447 | 0.9883 | 0.000284 | 0.000196 |
| spring-summer | 2 | same | 0.9797 | 1 | 0.000245 | 0.00001 |
| summer-fall | 2 | same | 0.9196 | 0.9891 | 0.000118 | 0.000029 |
| fall-winter | 2 | same | 0.9632 | 0.9997 | 0.000078 | 0.000029 |
| winter-spring | 3 | decision 89 and the table's fingers (7cd19de in 664ba4a), 10,000 leaves | 0.9447 | 0.9883 | 0.000284 | 0.000196 |
| spring-summer | 3 | same | 0.9797 | 1 | 0.000245 | 0.00001 |
| summer-fall | 3 | same | 0.9189 | 0.9925 | 0.000108 | 0.000029 |
| fall-winter | 3 | same | 0.9627 | 0.9996 | 0.000108 | 0.000029 |

Cycles used at final tier: 3 of 5 on each change. Nothing is red; 0 outside the sphere in every line. No threshold and no input of a measure was touched.

## Tests and checks, as printed

- `npx tsc --noEmit`: no output (clean), 07:52 on 664ba4a.
- `npx vitest run`: `Test Files 32 passed | 1 skipped (33)`, `Tests 432 passed | 4 skipped (436)`, 07:53 on 664ba4a. No test of my own was added: `vitest` only collects `tests/**/*.test.ts`, which is root's folder, so a test under `src/shake/` would not run.
- `npm run measure -- --unit change --only M4,M5 --tier final`: `measure change: not complete · 8 of 24 lines, 0 red · final · 284 s`, 07:51 to 07:56; `--only M6`: `16 of 24 lines, 0 red, 8 lines kept from the last run of this build · final · 198 s`, to 07:59. Engine df92c2ee63c32c09. The 8 lines not run are M1 on the unit's judged stills (not run by me).
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 337 s`, 07:59 to 08:05 on the source of 664ba4a.
- Winter, frozen: rest and landed hero hd draft stills byte-identical to the stills kept before any change (sha256 rest `f6a5bfd6…81bf9`, landed `06ce7056…bf0cd`), 07:50 and 07:51 on 7cd19de; before that after 5614f5a and 347457d.
- A shake inside one season: the nine frames of the winter into winter test shake (`npm run sheet -- --motion swap --shot test --fit --tier draft --force`) compared file by file with the same frames rendered from e39ec6c: all nine identical, 07:46 to 07:48 on 7cd19de; before that on 347457d.
- Triangles by G15's method (`tris.mjs`, hd, rest, hero; high / medium / low), 08:05 to 08:08 on the source of 664ba4a with 10,000 leaves: spring 1,492,992 / 869,699 / 394,312; summer 1,660,058 / 916,170 / 438,632; fall 1,606,733 / 937,690 / 417,788. Limits 1,800,000 / 1,100,000 / 600,000. The same numbers as on the frozen build: my files draw nothing at rest and added nothing.

## Pushes

Branch: ca6b570 (first push, between 05:55 and 06:10; it went up one log-only commit of main behind and was corrected at once with b78f656 at 06:11; told to root then), 8f88c2f 06:40, 4eef67f 07:06, 94316de 07:28, 664ba4a 07:53, bfec889 08:10. Each after a merge of `origin/main`, tsc and vitest; never forced, never to main.
Looks: 834b316 06:09, d6057fa 06:39, 342193d 07:07, f112509 07:33, 32ac349 07:54 and the one with this file.

## Looks used

Mine plus the predecessor's, of 40 a part: change-winter-spring 13 (3 mine, 10 before); change-spring-summer 10 (6, 4); change-summer-fall 14 (8, 6); change-fall-winter 7 (3, 4); arrival-spring 3 (1, 2); arrival-summer 6 (2, 4); arrival-fall 4 (2, 2). All under 40. Checks, not looks of a part: the winter into winter test shake 3 sheets, the two winter stills 4 pairs..
