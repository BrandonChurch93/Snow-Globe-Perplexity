# HANDOVER: unit `change`, after `change_builder3` (fix pass of Round 17)

Branch `agent/p4-change3` (code), `agent/p4-change3-looks` (pictures, this file, REPORT.md, measures). Read REPORT.md first for what is still wrong.

## What the tip holds on top of `dcda6ca`

| Commit | File | What |
| --- | --- | --- |
| fc13124 | `src/shake/table.ts` | The hand `HELD`: lean held through the stroke (`leanDeg`, `heldFlip 0.27`, `heldTrace`, `heldReach`, `heldJoin`), straight set down (`homeLead 0.17`: sideways travel ends at frame 706, 6 frames before the edge touches), rock after the landing (`rockGain [0.07, 0.11]`). `keepsOldHand(name)` keeps the first hand for `test`, `test:*` and `preroll`, so every single season shake and its stills are as on `dcda6ca`. |
| 9b0eafc | `src/core/materials.ts`, `src/seasons/spring/slab.ts`, `src/seasons/fall/slab.ts` | `GUST` and `STAGE_GUST_GLSL` (`stageGust(rest, a, b)`): petals and leaves on the table lift before the table's front reaches them and come down behind it. Acts only when `uState.w > 0.5` (two seasons meet), so no still of a season moves. |
| 8be4587 | `src/particles/engine/engine.ts`, `src/scene/lighting.ts` | The particles take the new kind from 0.5 to 0.86 of the window (`SWAP_FROM`, `SWAP_TO`, `SWAP_HALF 0.14`), not round 0.5 with half 0.22. `CHANGE_BLOOM.swellFrom` 0.46 to 0.56. |
| a8c1a27 (with 03a92a1) | `src/scene/stage.ts` | `VEIL_LATE 2.5`: the veil's crossing is raised to this power, but only where the season that leaves has the thicker veil (winter to spring, summer to fall). Late everywhere, M4 of shake-2 and shake-4 fell to 0.83 and 0.82 at draft: there the coming veil is part of the cover. |
| 4b1ae14 | `src/scene/stage.ts` | `LIGHT_LATE 2.5`: `f.mix.light` (rig, grid, lamps of the particles, backdrop lights, surface) crosses late in the same way. |
| c003939 | `src/core/materials.ts` | `OUTSIDE_FRONT.cutFrom 0.24`, `cutLong 0.1` in place of `share 0.62`: the base changes between two film frames (674 and 675 of shake-1; 1394/1395, 2114/2115, 2834/2835), no frame shows a half base. `OUTSIDE` in `change.ts` is untouched. |
| df4c00e, e70a11e | `src/scene/lighting.ts` | `CHANGE_BLOOM { outside: 3, flood: 0, lens: 0.2, pool: 2 }`: between two seasons the swell lays 3 x lift on base and table where a shake of one season lays `ROOM_RIG.flood.outside` 18 x lift, and the change adds no flood of its own. The light inside still swells tenfold (`tests/light-flood.test.ts` holds it). 8d43d92 (flood 300) is superseded by these. |

## Frame numbers of a change (shake-1; add 720, 1440, 2160 for the others)

- Window 648 to 684 (`change = (frame - 648) / 36`). Middle frame 666 is where M4 is read.
- Particles change kind from frame 661 to 684; veil and light cross late (a sixth at 666, 0.37 at 672).
- Outside span 0.69 to 0.85 = frames 672.84 to 678.6. `through = (change - 0.69) / 0.16`: 673 is 0.028, 674 is 0.201, 675 is 0.375, 676 is 0.549, 677 is 0.722, 678 is 0.896.
- Base: old up to 674, new from 675. Table dressing: its front runs from the foot outward from `through` 0.26 to 1, frames 675 to 678; petals and leaves fly from about 673 to 680.
- Landing 720; rock 1.16 degrees at 724, 0.12 at 732, still by 740.

## What binds (tests you must not weaken)

- `tests/shake-*.test.ts`: tilt jerk under 250,000 deg/s3 (so a flip of the lean needs 0.27 beat, about 10 frames; strokes are 9 to 16 frames, so the hold is 2 to 6 frames), on screen stroke ratio over 1.25, edge first tilt over 2.7 degrees at touch (`touchShare 0.8` stays), x jerk under 2e6 (`homeLead 0.25` fails).
- `tests/shake-change.test.ts`: the bloom is over 0.5 on the whole outside span and rises over frames; so the flash cannot be moved to the cut.
- `tests/light-flood.test.ts`: tenfold light inside for the new season where two seasons meet; the outside flood of a shake of ONE season is pinned, the one between two seasons is free.

## How to work

- Three trees: render in one, edit in another (editing sources while a render queue runs breaks `requireBuild`). Baselines: `out/work/base/` (rest and landed stills of `dcda6ca`, hashes in REPORT.md).
- Costs here: sheet 4.5 min, rest still 60 s, landed still 70 to 130 s, `measure --only M4,M5` 240 s at either tier, `--only M6` 206 s, determinism 365 s.
- M4 and M5 read the cover view, which is the same at draft and at final: a draft run is a free forecast of a cycle. Light and outside changes do not move M4 to M6 (seen: identical numbers on 4b1ae14 at draft and e70a11e at final).

## Next, worst first

See REPORT.md, "What is still wrong".
