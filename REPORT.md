# REPORT: unit `change`, `change_builder3`, fix pass after Round 17

Branch `agent/p4-change3`, last proven commit **e7c7bdd** (merge of `origin/main` 6066ae4 into e70a11e; main brought only `kit/`, `scorecards/`, `planning/`, `out/`, no source). The last proven commit before it is 6d42039 (the path alone).

## Stand-ins and fallbacks

None. No part of a change or of an arrival is a stand-in.

## What was proven on the tip, and what it printed

| Proof | On | Result |
| --- | --- | --- |
| `npx tsc --noEmit` | e7c7bdd | clean |
| `npx vitest run` | e7c7bdd | 33 files passed, 436 tests passed, 4 skipped (as on `dcda6ca`) |
| `npm run determinism` | e70a11e | `determinism: pass · 3 pictures, 4 page loads, preview, draft, 341 s` |
| G11, G12 | e70a11e | G11 pass; G12 pass, lowest foot 0.46 mm; `gate, phase 4: all 2 green` |
| M4 at final (cycle 5) | e70a11e | 0.983 / 0.9647 / 0.9658 / 0.9721 (bar 0.85) |
| M5 at final | e70a11e | 0.9851 / 1 / 0.9777 / 0.9997 (bar 0.6) |
| M6 at final, swap and landing | e70a11e | 0.000167 and 0.000167, 0.000294 and 0.00002, 0.000186 and 0, 0.000029 and 0.000088 (bar 0.002), 0 outside the sphere |
| Rest stills, hero, hd, draft | e70a11e | all four byte-identical to `dcda6ca`: winter f6a5bfd6, spring 89ce6718, summer 0e5068e3, fall f2d6d8cd |
| Landed stills, hero, hd, draft | e70a11e | all four byte-identical to `dcda6ca`: winter 06ce7056, spring 7d55c581, summer 6e91f319, fall 11c9fdc5 |

Not run: M1, M2, M3 of the unit (8 lines; no time left for them: one judged still at the final tier is long and I had no cycle left), so `change.json` is `complete: false` with 16 of 24 lines. Not run: `npm run measure -- --unit winter --tier draft` and the seasons' `--only M1,M2,M3,M6`; in their place the eight rest and landed stills are byte-identical, the single season shakes keep the first hand (`keepsOldHand`), and every new line acts only when two seasons meet (`uState.w > 0.5`, `a !== b`). I did not render a single season shake still before and after, so that last sentence is from the code, not from a picture.

Cycles: cycle 4 on 6d42039, cycle 5 on e70a11e. None left.

## What was built (see HANDOVER.md for the lines)

1. The path of the shake (fc13124): lean held through the stroke, straight set down, rock after the landing. Amounts unchanged.
2. Petals and leaves on the table lift ahead of the table's front and come down behind it (9b0eafc).
3. The storm takes the new kind, the veil and the light late (8be4587, a8c1a27, 4b1ae14).
4. The base is cut between two film frames, with no dissolve and no half base on any frame (c003939).
5. Between two seasons the swell lays a sixth of a shake's light on base and table, and the change adds none of its own (df4c00e, e70a11e).

Make targets: none. Triangle counts unchanged. `config/showcase.json` untouched.

## Where base and table change on the tip (root's question)

| Swap | Base old on | Base new on | Table dressing changes on | Petals or leaves in the air |
| --- | --- | --- | --- | --- |
| shake-1 | 674 | 675 | 675 to 678, from the foot outward | about 673 to 680 (petals come) |
| shake-2 | 1394 | 1395 | 1395 to 1398 | petals leave; sand is not carried |
| shake-3 | 2114 | 2115 | 2115 to 2118 | leaves come; sand is not carried |
| shake-4 | 2834 | 2835 | 2835 to 2838 | leaves leave; frost and snow are winter's |

How much the storm covers on that frame: of the base and the table, nothing. The storm is inside the glass; the base is outside it and is cut in open view, in mid stroke, with the globe about 6 mm off the table and leaning. Of the miniature inside the glass, the measured cover is M4 at the middle frame of the window (666, 1386, 2106, 2826): 98.3, 96.5, 96.6 and 97.2 percent; I did not measure the cover on the cut frame itself.

## What is still wrong, worst first

1. **The base still changes in open view.** It is now one cut between two frames with the base looking like itself on both sides (seen on the shake-1 sheet: winter's at 672, spring's at 676, no orange drum, no half base). That is the fix Round 17 part 1 asked for word for word. Round 15 and Round 16 ask the opposite ("never a one-frame exchange", "change only under the storm or by growing in"), and nothing covers the cut: no blur, no shadow, no storm outside the glass. The bloom cannot be moved onto the cut (`tests/shake-change.test.ts`). On the sheets of shakes 2, 3 and 4 (seen at 11:06 to 11:14, on e70a11e) the same holds: each old base looks like itself on its last tile (1392, 2112, 2832: no bleached block, no peach block at 2836) and each new base on its first (1396, 2116, 2836). What those sheets also show: at 1396 the sand heap is there at once while petals still lie and fly; at 2836 leaves and snow flecks lie on the table together; the sand heap is whole at 2112 and gone at 2116.
2. **The landing still reads static.** The rock is in the path (1.16 degrees at 724, 0.12 at 732) but on the landing sheet (every 6th frame) the globe looks the same in every tile. No compression. To try: `rockGain` up to about 2.5 degrees and a 1 mm dip of the collar on 720 to 723; needs a cycle.
3. **The table dressing.** Petals and leaves now fly, but all of them inside 8 frames, not "a few at a time through the arrival". The frost star is whole at 672 and gone at 676, the sand heap is whole at 2112 and gone at 2116: winter's star and summer's sand are height fields, not pieces, and are not carried. Two seasons' dressing lies on the table together for the frames of the front: petals and sand at 1396, leaves and snow flecks at 2836 (seen; Round 17 part 3 calls this severe). It is the table's front passing in open view; to try: let the old dressing leave on frames 660 to 674 under the gust, before the cut, and the new one come only after it.
4. **The inside of the glass is a flat milky disc on 672 and 676.** The tenfold light inside is held by `tests/light-flood.test.ts`. Not touched.
5. **Shake-3's storm is green from 2092.** Not the veil, not the light, not the particles' kind (all three late now, the sheet did not change). I believe it is fall's miniature coming through from 0.05 of the window; not proven.
6. **Seasons are unveiled, not grown** (Round 17 parts 2, 3, 4; Round 14). Not taken: it changes the landed stills of three seasons and their measures.
7. **The air at the landing** (Round 2 of 17: ribbons, a uniform suspension). Not taken. To try: shorten the streak with the liquid's speed at the landing frame and thin the veil's glow there; changes the landing stills and M6.
8. **Fall's faces snap on at 2162 to 2164.** `faceLevel` in `src/seasons/fall/base.ts` eases the ember with `tau 0.03` (two frames). To try: `tau 0.1`; it moves fall's landed still (0.5 s after the landing), so fall's measures must be run again.
9. **The lift is hard to read** (7.25 mm) and the set down holds the height from 693 to 706 before it drops (the "stall in the air" of Round 14): the edge must touch first at more than 2.7 degrees (`touchShare 0.8`), a test holds it.

## One line each on what root asked

- Why a twelve-frame sheet of a shake shows one pose (Round 15): the sheet takes one frame in thirteen, a stroke is 9 to 16 frames, so it samples nearly the same place of every stroke; and the amounts are small on a tile (25 mm of stroke on a 120 mm globe, 6 degrees, 7.25 mm of lift). On my path's numbers for shake-1, one frame in thirteen gives the globe between -12 and +14 mm and a lean under 3 degrees on every tile but one (680: 27 mm, 5.8 degrees). I did not render that sheet.
- The mirror image gone while the globe is lifted (Round 14): the mirror is a true planar one, but `surface.ts` blurs the near image with height (`nearBlur` to `nearBlurFar` over `nearBlurRiseMm`), so at 5 to 7 mm the base is a soft oval of its own colour. From the code, not from a picture.
- The late wide stroke at 680 and the stall 692 to 706 (Round 14): the last stroke is the path's widest, on mine too (27 mm from the mark at 680, the others reach 10 to 14 mm on the frames I listed); not reworked; the stall is item 9.
- The rim reads -0.04 to -0.05 mm on frames 728 to 734 (the pad model, the same on `dcda6ca`).

## What I saw with my own eyes

Swap sheets of shake-1 on fc13124, 8be4587, c003939, df4c00e and e70a11e; of shake-3 on 8be4587, 03a92a1 and 4b1ae14; the set down of shake-1 on fc13124; the landing of shake-1 on c003939. On e70a11e also the swap sheets of shakes 2, 3 and 4, each once, every 4th frame. Not seen: anything moving; shakes 2 and 4 on any commit but e70a11e; the set down and the landing of shakes 2, 3 and 4; the cut frames 673 to 675 themselves (sheets are every 4th frame); a single season shake before and after.

## Looks used (mine, added to the predecessors')

change-winter-spring 7 (20 with theirs), change-summer-fall 4 (18 with theirs), change-spring-summer 1 (11 with theirs), change-fall-winter 1 (8 with theirs), arrival-spring 1 (4 with theirs). All under 40.
