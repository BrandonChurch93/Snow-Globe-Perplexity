# Handover: unit `change` (the four changes of season, the three arrivals)

Written by change_builder2 (third set). Branch `agent/p4-change2`, looks `agent/p4-change2-looks`. Times UTC. The handover of the pass before mine is on `agent/p4-change-looks`; what it says about the engine, the arrivals and the owners' agreements still holds and is not repeated here.

## State in one line each

| Part | Film frames | State | Worst thing on the newest sheet (draft, hero, even frames, 7cd19de) |
| --- | --- | --- | --- |
| change-winter-spring (shake-1) | window 648 to 683, outside span 672.2 to 677.8, landing 720 | built, no stand-in | the frost star on the table is whole at 672 and gone at 676; the storm is pink from 660 while the base is winter until 672 |
| change-spring-summer (shake-2) | 1368 to 1403, 1392.2 to 1397.8, landing 1440 | built, no stand-in | the moss base is sharp under the flood at 1392, not washed out; petals are taken from the foot outward (half at 1396, none at 1400), they do not move |
| change-summer-fall (shake-3) | 2088 to 2123, 2112.2 to 2117.8, landing 2160 | built, no stand-in | leaves appear from the foot outward (near the foot at 2116, everywhere at 2120) but do not travel; the sand spill is whole at 2112 and gone at 2116; the storm is green from 2096 |
| change-fall-winter (shake-4) | 2808 to 2843, 2832.2 to 2837.8, landing 2880 | built, no stand-in | winter's base is rust orange in winter's own amber flood at 2836 and 2840 (frozen look) |
| arrival-spring | from 720 | `arrival.ts` only sets the landing clock; rows live in their owners' files | beads and mist cannot be read at sheet size (not looked at close by me) |
| arrival-summer | from 1440 | the grains are summer_air3's since 06:54; the sand jump at the landing reads (seen 1440 to 1460 on 347457d) | what summer_air3 changed after 06:54 was not seen by me |
| arrival-fall | from 2160 | `arrival.ts` only sets the clock for the candles and the skitter | the faces' new curve (fall_base3 54ac639) was not seen by me merged; bats and crack not readable at sheet size |

No stand-in and no fallback in any part.

## How the outside of a change works now (what to keep)

`src/shake/change.ts` is as it was: `OUTSIDE` 0.69 to 0.85 (5.6 frames at the fastest stroke), bloom ramp 0.12. Do not move `OUTSIDE`: `src/shake/table.ts` (line 303), `changeSwell` in `lighting.ts` and winter's `arrival.ts` and `base.ts` read `changeSpan('base')`, so moving it changes the frozen path and winter's test shake. I looked at widening it toward the test's 9 frames and dropped it for that reason.

`src/core/materials.ts`, `stageChange()`:

- A part's kind rides in `uState.z`: 0 and above is the lag of a part inside the glass; between -9 and 0 the table's gain (`DRESSING_FRONT.gain` 2); at -10 and under the base (`BASE_CODE` 10 plus `OUTSIDE_FRONT.gain` 3).
- Base: `way` runs 0 at the collar (`topMm` 33 above the floor of the globe's own space) to 1 at the foot; the front reaches a point when `through / share * (1 + gain) - gain * way` passes the patch value there. `share` 0.62: the base is whole 3.5 frames into the span.
- Table: `far` is 0 at 58 mm from the stage's axis, 1 at 230 mm; the front starts at `tableFrom` 0.26 of the span and ends with it. The patch noise is read in polar coordinates (`rayMm` 110 to a radian, the radius divided by `streak` 3.4), so the patches are fingers along the way out; the seam of the angle lies behind the globe as hero sees it (x = 0, z < 0).
- `stagePatch` is two octaves of value noise (`cellMm` 6.5, `fineMm` 2.3, `fine` 0.36, `contrast` 2.6) in the part's own space, so on the base it travels with the globe. `stageGone` compares the patch value, feathered by the per sample hash (`feather` 0.14), in place of the old per pixel hash; parts inside the glass, the glass dressing and the backdrop keep the old hash.
- The light: `stageFront = live * exp(-at^2)`, `at` the distance from the edge in shares of the way (`glowBase` 0.11, `glowTable` 0.07), added as `uFront * stageFront` at the tail of every stage fragment. `uFront` is the new season's inner colour times `CHANGE_BLOOM.front` 14 over the peak, set in `lighting.ts` only when two seasons meet.
- When from equals to, `uState.w` is 0 and `stageChange()` returns before any of this; `uFront` is 0.

`src/scene/backdrop.ts` (root's file, decision 89): `this.set(f.from, f.to, f.from.season === f.to.season ? f.mix.base : f.mix.light)`. Two seasons: discs, walls, floor and haze cross linearly through the whole window. One season: the old number, so nothing in a test shake moved.

`src/scene/lighting.ts`: `CHANGE_BLOOM = { flood: 200, lens: 0.6, pool: 8, swellFrom: 0.46, fall: 0.6, front: 14 }`. Flood 800 was a white flash, 150 let the change show; kept at 200.

## Measures (final tier)

Thresholds: M4 at least 0.85, M5 at least 0.6, M6 at most 0.002, none outside the sphere.

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

Cycles used: 3 of 5 on each change. `npm run measure -- --unit change --only M4,M5 --tier final` (about 250 s), then `--only M6` (about 190 s). The printed tables are in `measures/` on this branch.

## The hand: two readings asked by root (no change made; `src/shake/table.ts` is frozen, open item 71)

The drawn globe takes the table's pose whole: `src/scene/stage.ts` line 272, `this.globe.rotation.set(g.tiltX, 0, g.tiltZ)`, `g` being `globePoseAt` of the film's timeline. Read from that function for shake-1 (degrees round x, round z, and the whole lean):

| Frame | tiltX | tiltZ | whole | y of the foot's centre, mm | lowest point of the rim above the table, mm |
| --- | --- | --- | --- | --- | --- |
| 600 | -1.62 | -1.42 | 2.16 | 5.19 | 3.00 |
| 620 | -0.96 | 5.08 | 5.17 | 7.13 | 1.91 |
| 640 | -1.34 | 1.58 | 2.07 | 5.38 | 3.28 |
| 660 | -2.57 | -3.73 | 4.53 | 6.74 | 2.15 |
| 680 | -3.21 | -4.52 | 5.54 | 7.19 | 1.58 |
| 690 | -1.72 | -1.06 | 2.02 | 7.17 | 5.13 |
| 700 | -0.80 | 4.38 | 4.45 | 6.68 | 2.18 |
| 710 | -0.56 | 2.94 | 2.99 | 3.98 | 0.96 |
| 712 | -0.53 | 2.83 | 2.88 | 2.92 | 0.01 |
| 718 | -0.15 | 0.82 | 0.83 | 0.86 | 0.02 |
| 720 | 0 | 0 | 0 | 0 | 0 |

So the tilt reaches the drawn globe and peaks at 5.5 of the 6 degrees allowed; most of it is round z, which hero sees as a roll in the picture plane: 5.1 degrees at 620, -4.5 at 680; the lean round x (toward the camera) stays under 3.3. The trailing edge of the rim touches the table at frame 712 (8 frames, 0.13 s, before the landing) and the foot rolls flat on it to be level exactly at 720; the centre of the foot is still 0.86 mm up at 718. After the landing it rocks back (0.79 degrees at 722, 0.83 at 726, 0.12 at 732). The critic's "about 692" is the last turn of the strokes (the rim is 5.5 mm up there), not a touch.

## Open, worst first as a viewer sees it

1. The scatter on the table is not carried by a gust: it is taken and laid from the foot outward by a front of light in 3 to 4 frames. To carry it, the three scatters need a blow-in and blow-out clock in their own vertex code (`src/seasons/spring/slab.ts` petals, `src/seasons/fall/slab.ts` leaves, `src/seasons/summer/arrival.ts` grains; owners bases3, fall_base3, summer_air3): today `setJump` and `setSkitter` clamp at 0 in the air, and the state before the landing is not the state at rest. The lines to ask for: a second uniform, the share of the outside span passed (0 to 1), that pushes an outgoing piece away from the foot by about 60 mm along its own direction with its hop and spin, and holds an incoming piece that far inside until the front has passed it. `stage.ts` can hand `partChange('surface-dressing', change)` to both.
2. The storm turns to the new season's colour (from 0.3 of the window) before the base does (0.69). Decision 89 made the room turn with the storm; the base and the table wait by the kit's rule. Next try: `CHANGE_BLOOM.swellFrom` 0.46 to about 0.56 in `lighting.ts`, and the particles' turn (`swapAt` 0.22 to 0.78 in `engine.ts`) later, for example 0.4 to 0.9; look at all four windows and measure M4 to M6 after each (2 cycles are left).
3. The old base is sharp in the flood on the frame before its span (672, 1392, 2112, 2832): the flood lights it but does not wash it out. `CHANGE_BLOOM.flood` above 200 goes white at 800; try 320 with `lens` kept, and judge at final tier, where the shutter's blur helps.
4. The weight of the shake (open item 71): see the readings above.
5. The arrivals are not staged one thing after another across the first 3 s (owners' rows); not worked on in this pass.
6. Glass dressing, backdrop discs and parts inside the glass still change by the per pixel hash.

## Not seen by me, so not claimed

- Any change as moving video; everything was judged on sheets of even frames. Odd frames were never rendered (the sheet tool renders even film frames only).
- The changes at hd, and at final tier beyond frames 1394 and 2114 (on 347457d, before the fingers).
- The table's front close up on shake-1 and shake-4 after the fingers (7cd19de); close crops were looked at only for shake-2 (1392 to 1398) and shake-3 (2112 to 2118), `close-shake-2.jpg` and `close-shake-3.jpg`. At that size the fingers do not read as fingers: the scatter thins from the foot outward in a ragged band.
- fall_base3's new face curve and summer_air3's changed grains, merged.

## Files

Mine: `src/shake/change.ts`, `src/scene/stage.ts`, `src/scene/lighting.ts`, `src/scene/surface.ts`, `src/core/materials.ts`, in `src/particles/engine/engine.ts` the change of kind, `src/seasons/spring/arrival.ts`, `src/seasons/fall/arrival.ts`; `src/seasons/summer/arrival.ts` is shared with summer_air3 since 06:54 (the grains that fall outside the bowl are theirs). Changed in this pass: `materials.ts`, `lighting.ts`, `summer/arrival.ts` (5614f5a only), and one line of root's `src/scene/backdrop.ts` (decision 89).

`npm run make` targets: none. `ASSETS.md` rows: none. Triangles: my files draw 0 at rest at every level.

Winter check: `npm run still -- --season winter --state rest|landed --camera hero --tier draft --format hd --force`, sha256 rest `f6a5bfd6b05a584dbfe3e3344f464111ee9389b25fe3540b87da78d6c7681bf9`, landed `06ce7056f5a4ce7e45d414b6f98da58b995c0a4b8e8f2969ff233430d05bf0cd`; test shake `npm run sheet -- --motion swap --shot test --fit --tier draft --force`, nine frames in `out/work/seq/test-preview-draft/`, compared file by file with the same frames of e39ec6c. Last checked 07:46 to 07:51 on 7cd19de: both stills and all nine frames identical.

## Looks used

change-winter-spring 13 (3 mine, 10 before); change-spring-summer 10 (6, 4); change-summer-fall 14 (8, 6); change-fall-winter 7 (3, 4); arrival-spring 3 (1, 2); arrival-summer 6 (2, 4); arrival-fall 4 (2, 2). All under 40. Checks, not looks of a part: the winter into winter test shake 3 sheets, the two winter stills 4 pairs.
