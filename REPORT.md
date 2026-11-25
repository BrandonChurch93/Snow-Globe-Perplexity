# Report: bases and slabs of spring and summer (bases2)

Times are UTC on 2026-11-25. Work branch `agent/p4-bases2`, last commit 51df97e (merge of main over 777bfbf "Summer slab sand on a 1.3 mm grid"), pushed 05:32. In the freeze of 05:20: cfa100f. Looks branch `agent/p4-bases2-looks`.

## Stand-ins and fallbacks left

None. No placeholder ships, no threshold lowered, no test changed. No generated picture was made in my time (the three base sheets and the petal sheet are my predecessors', one take each).

## What I built (by issue)

Spring
- R3-2 #2 (severe, surface camera: out-of-focus petals as translucent rectangles): petals fade through a soft window; seen at the surface camera 03:42. Fixed.
- R3-2 #12, #13 (petals pasted on, all the same): a contact shadow under each, smaller and varied sizes and tints. Seen 03:42. Partly: they still lie flat.
- R3-2 #11, R2 (roots as smooth tubes): thicker at the collar, tapered, sunk into the rock, bark ridges, six sides where thin, six long roots removed. Partly: they still lie on the rock.
- R3-2 #9, R2 (procedural moss): clumps, deep green body with bright tips only where the light from behind reaches, three patches left of the fall. Partly: levels off (see below), folds read as cloth.
- R3-2 #10, R2 (ribbon waterfall): several white strands over a wider wet bed. Partly: still plastic, no spray.
- R3-2 #5 (glass meets moss on a hard line): contact darkening where the glass sits and where the stone meets the table. Partly: no seat, no caustic.
- R3-2 #14: not mine (shared surface part), told to `/root` 04:30.

Summer
- R1 #3 (severe: brown ramp at the right, flat sheet over the right third of the table): dune made compact with a lit crest, less sand on the table, the left sheet thinned to grains. Partly: hard outline at the table.
- R3-1 #9, R3-2 #6, R2 (clay base, candy sea glass, sticker shells): greyer sandstone with grain; sea glass cloudy, pitted, no centred highlight, light through the thin edge; seat and foot shadows. Partly: the drum shape and its creases are untouched; shells brown and dark.
- R3-2 #3, #5: ambient-occlusion band at the seat and the foot only.
- R4 #5: the heap runs on under the foot at an angle of repose (filled footprint). Not seen with the base lifted.
- After the rig moved (05:10 merge): stone, shells and sand refitted (side light from the sun on the right).

G15: both bases thinned (`thin.mjs`), own medium and low lists; summer slab sand 75,670 to 31,010 triangles.

## Measured numbers

Triangles drawn (tris.mjs), high / medium / low, limits 1,800,000 / 1,100,000 / 600,000:
- summer on 51df97e (05:34): 1,774,288 / 1,014,375 / 543,258. All green.
- spring on 51df97e (05:43), the same as on cfa100f (05:14): 1,740,075 / 1,268,431 / 647,361. High green; medium 168,431 over, low 47,361 over. My spring base is 115,591 / 60,975 / 40,894 in the three lists, so the medium and low overage is not in my files alone; the largest spring meshes at high are 204,000, 163,360, 136,381 and 85,591, none of them mine.
- My files at high: spring rock 82,316, growth 30,619, water 2,656, slab petals 12,600 + 600; summer stone 118,416, shells 37,197, sea glass 19,200, ledge sand 24,848, slab sand 31,010.
- Against fe1072c (spring base 157,056; summer base 282,656 + slab 75,670): spring base 115,591 = 0.74; summer base and slab 230,671 = 0.64.

Spring, hero rest, medians approved against build (fit sp-o, 04:59): mossTop 58,58,37 / 30,30,12 (p85 151 / 130); mossMid 12,18,12 / 30,30,11; mossR 118,87,56 / 71,66,34; left 29,27,15 / 9,11,6; stones 12 / 10; lowL 15 / 18.

Summer, hero rest, red medians approved > build over the base, 8 columns from x 880 to 1960 (fit su-w, 05:09):
- y1103: 108>126, 115>106, 94>69, 60>50, 55>39, 67>64, 87>121, 161>147
- y1166: 115>150, 126>128, 77>92, 56>68, 50>47, 66>55, 95>106, 181>137
- y1230: 105>164, 144>146, 50>83, 43>47, 54>47, 55>48, 87>73, 182>148
- y1293: 94>159, 152>149, 83>112, 42>45, 49>30, 49>39, 77>62, 160>107
- scallopR 82,78,79 > 70,61,51; cowrie 89,85,76 > 75,63,54; scallopL 132,105,83 > 130,104,71; green glass 33,56,40 > 31,55,30 (04:58).
- dune after the loose grains left main (su-x, 05:29): flank 217,180,145 > 159,134,96; crest 227,191,155 > 114,90,60.

## Tests and what they printed

- `npx tsc --noEmit`: nothing (clean), on 51df97e.
- `npx vitest run`: Test Files 32 passed | 1 skipped (33); Tests 432 passed | 4 skipped (436), on 51df97e.
- `npm run determinism` (on cfa100f, 05:20): `determinism: pass · 3 pictures, 4 page loads, preview, draft, 347 s`. Not run again after the 1.3 mm grid.
- `npm run measure -- --unit spring --only M1,M2,M3 --tier draft` (on cfa100f, 05:27): `measure spring: not complete · 13 of 19 lines, 5 red`. Red: M2 spring-rest 0.0504, spring-shake 0.0557, spring-settled 0.0508 (limit 0.03); M1 spring-interior (the miniature touches the edge of the frame); M1 spring-base 3 invalid values. Pass: M3 spring-rest 0.7977 (base 0.877, miniature 0.798), M2 spring-base 0.006, M2 spring-surface 0.0257. I did not find out which part's pixels are soft in M2 at the hero.
- `npm run measure -- --unit summer --only M1,M2,M3 --tier draft` (on 51df97e, 05:41): `measure summer: not complete · 13 of 19 lines, 0 red`. M3 summer-rest 0.8291 (base 2.127, miniature 0.829); every M2 0.

## Looks used

Summer 28 (hero stills 2, ids 1, fits su-a to su-x 24, 1 zoom set from existing stills); spring 17 (hero 1, surface 1, fits sp-a to sp-o 15). All draft hd, each beside the approved crop. Also 3 M1 sanity renders, 5 tris runs, 1 determinism run, 2 measure runs.

## Rows for ASSETS.md

None new: no picture was generated. The existing rows of `base-spring` (moss, stone, bark, one take each) and `slab-spring` (petals, one take) stand.

## Handover

See `HANDOVER.md` beside this file: files, make targets, what is open worst first, numbers that worked, what was tried, what I could not see.
