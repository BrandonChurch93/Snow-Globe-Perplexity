# REPORT: bases3 (spring and summer bases and slabs), Phase 4 third set

Branch `agent/p4-bases3` (started from `origin/main` at `e39ec6c`, `origin/agent/p4-bases2` merged in at once). Looks on `agent/p4-bases3-looks`.

## Commits and what each answers
| Commit | Season | What | Issue |
|---|---|---|---|
| `4e8c188` | spring | M2 fix on the base | measures |
| `1ae3d5c` | summer | slab heaps and grains, shells paler, stone fill | Round 12 R1 #10, #11 |
| `5f62548` | spring | fill light, moss colour, warm graze on the right flank, flared profile, fewer fuller roots, petals cupped and scattered, wet stone | Round 11 R1 #4, #10 |
| `33b81d9` | spring | collar rim up 5.3 mm (37.3 to 42.6 mm), lit moss crown, trickle as a thin film without beads, rounder roots with bark, shade where roots meet the table | 06:57 collar; R3 trickle, roots, contact |
| `5c732e0` | summer | collar and ledge up 3.2 mm, warm stone light, frosted sea glass, pole normals, softer sand edges, crest broken by grain | 06:57 collar; R3-2 severe 1, 3; R3-1 crest; R1 #9 |
| `cef5449` | summer | foot rounded and tucked, bottom disc inside the foot, strata broken, sea glass sunk in sockets, warm matte shells with finer growth lines and ears, sand shaded under the overhang | R1 #9, #12; R3-2 severe 3, major 4 |
| `b400f2c` | spring | water: small leading bead, foam only on arrival at the floor | Round 11 R4 #6 |
| `52cee95` | summer | sand left of the foot a deep sparse sheet; sea glass keeps more colour | R3-2 severe 2 (part) |

## Seen with my own eyes (all draft tier, hd)
- Summer hero rest against approved (su3-l to su3-p), base camera rest (four stills), hero landed (one still).
- Spring hero rest against approved (sp3-a to sp3-l), base camera rest and landed (one each).
- Not seen: any motion sheet or film; mid-shake frames; macro, interior, surface and low cameras; final tier; medium and low quality levels on screen.

## What the approved pair asks that a critic disliked
- None undone. The base heights follow `config/showcase.json` (sphere centre at 79 mm); both approved bases look shorter than that allows, so after the collar raise both bases stand taller in the frame than approved. The raise was asked for at 06:57 and is kept.

## Not mine, said to /root
- Summer caustic web and its reach under the foot: `src/seasons/summer/glass.ts` (`surfacePool`) and `src/scene/surface.ts`.
- The sand mound's missing mirror image, the green mirror image under the spring foot, the teal wash on the near floor: `src/scene/surface.ts`.
- When the water starts and when the petals jump: `src/seasons/spring/arrival.ts`.

## Last state
- Branch head `ab66a93` (merge of `origin/main` at `5998056` over `52cee95`). No stand-ins, no fallbacks, no placeholders in my files (the materials of my files pass `standIn: false`). An earlier spring still's JSON read `standIns: 9`; I did not trace whose they are.
- Make targets, in order: `npm run make -- base-spring`, `npm run make -- slab-spring`, `npm run make -- base-summer`, then `npm run texpack`, `npm run build`.

## Tests (on `52cee95`, before the last merge of main)
- `npx tsc --noEmit`: clean (also clean on `ab66a93`).
- `npx vitest run`: 32 files passed, 1 skipped; 432 tests passed, 4 skipped. Not re-run on `ab66a93`.
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 344 s`.
- `npm run measure -- --unit summer --only M1,M2,M3 --tier draft`: 13 of 19 lines, 0 red. M3 summer-rest 0.7623 (base 1.377, miniature 0.762).
- `npm run measure -- --unit spring --only M1,M2,M3 --tier draft`: 13 of 19 lines, 2 red. M3 spring-rest 0.7265 against 0.75 (base 0.727, was 0.519 on the judged build; miniature 0.873). M1 spring-base: 6 invalid values. M2: 0 on all six stills.
- After the merge (`ab66a93`), `dev.sanity()` on the spring base camera at rest, draft: 0 invalid of 2,073,600. I do not know which change removed them; my make found no normal without length in rock, growth or water.

## Triangles on `ab66a93` (high / medium / low)
- Summer: 1,637,207 / 888,450 / 417,916 (limits 1,800,000 / 1,100,000 / 600,000). My files: base 199,110 / 51,291 / 23,653; slab sand 24,954 at every level it is drawn. Before me (bases2): base 199,661 / 52,867 / 25,000; slab 25,114.
- Spring: 1,454,956 / 823,619 / 372,175. My files: base 106,259 / 44,490 / 29,120; petals 13,200. bases2's high total was 128,791, mine 119,459.

## Still wrong, worst first
### Summer
1. The base stands taller in the frame than approved and narrows upward; approved is a squat drum. The height follows the config's sphere seat plus the asked collar raise.
2. Sea glass reads as flat opaque colour: no light inside, no bright thin edge (Round 12 R3-2 severe 3 only part answered: the centre dots are gone and each piece sits in a socket).
3. Slab sand: in front right it is a dim smooth cloth at the base camera, single grains do not show; the heap still ends on cut-out specks that fringe at the right edge of the hero frame; no mirror image of the mound (table's pass).
4. No stream of sand down the right flank (approved has a thin backlit fall).
5. Stone: no sunlit top ledge; strata still long on the right; grain too fine to read at the hero distance.
6. Scallop: ears were added but cannot be made out; treat as not done.
7. The sheet of sand left of the foot is paler and cooler than approved's gold sparkle.
### Spring
1. M3 spring-rest 0.7265 against 0.75: the base needs a little more fine detail (grain on the stones, sparkle on the moss).
2. The base stands taller than approved after the collar raise (rim 42.6 mm).
3. Trickle: at the hero distance a broad pale band, approved a thin clear thread; in motion (R4 #6) the bead and the late foam are seen on one landed frame only.
4. Roots thicker and fewer than approved, meeting in one knot; tips end on the table without a wet line (the line itself would be the table's).
5. Petal jump (R4 #8): untouched; one petal seen in the air on a landed frame.
6. Mushrooms alike; petals redder than approved and without thickness.

## Looks used
- Summer: 16 hero fits against approved (su3-a to su3-p), 1 landed hero still, 8 base-camera stills: 25 of 40.
- Spring: 5 diagnostics, 12 hero fits (sp3-a to sp3-l), 3 base-camera stills: 20 of 40.
- One winter still rendered by mistake (`still -- --help`).
- Other renders: measures once a season, determinism once, tris four times for summer and five for spring, one sanity check.
- No generated assets, no takes.
