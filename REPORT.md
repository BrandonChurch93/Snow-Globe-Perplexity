# spring_mini3: report (spring miniature, Phase 4, third set)

Branch `agent/p4-spring_mini3`, last commit `7bc93d5` (merge of `origin/main`; last work commit `20e7055`). Looks branch `agent/p4-spring_mini3-looks`. Measured numbers, constants, dead ends and the list of my files are in `HANDOVER.md` beside this file.

## Stand-ins and fallbacks
None in my files. The stills' records say `standIns: 9` for the page as a whole; I did not trace which parts those are.

## What I built, by commit (each followed by a merge of main and a push)
- `890edda`: crown as tufts on their own boughs, storm glow sprites, darker bank. Issue 8.
- `97e0b21`: moss mounds round the rim, NaN guards in my shaders. Issue 3, M1 spring-base.
- `94de95e`: one line in `src/miniature/surface.ts` (`villageBump` keeps the plain normal where the bumped one has no length), by `/root`'s leave (decision 87). M1 spring-base 6 invalid values to 0; winter's rest and landed hero stills byte for byte the same.
- `2189b1b`: layered bank, calmer pond rings toward the shore, darker mossed slates, varied stone, tighter lamp, tulip rows thinned. Issues 3, 7, 9 and R3's pond note.
- `ca786e8`: moss draped to the glass foot (after `/root`'s 06:57 note: no soil band), rounder tufts, cottage pale in the storm, chimney grey stone. Issues 3, 7, 8, landed state.
- `3cc5552`: crown rounder and taller with more air, bare twig ends, door keeps its tone in the storm. Issue 8, landed state.
- `20e7055`: five stepping stones from door to pond, fence as bare brown wood, roof pale in the storm, smaller storm flame. Issue 9, landed state.

## Left as it is because `/root` said so or an approved image shows it
- Chimney shape, door recess, window shape, trunk taper and root flare: the shared model, an open item for the polish rounds (`/root`, 06:57).
- The critic's "lower and thin the front berm" and R3's layered soil bank: the approved image shows moss to the glass foot and `bases3` raises the collar to the ground's front edge, so I draped the mounds instead of cutting the bank or widening the soil.
- Tulips stay in rows by the fence (the approved image has them there); I thinned them, I did not scatter them.

## What is still wrong, worst first
See `HANDOVER.md`, "What is still wrong". In short: low disk with a soil strip above the collar until the collar is raised; tree smaller, lower and heavier than the approved's; landed state too opaque with a faint lamp and a pink crown; cottage shapes; fence and stones small.

## Make targets, in order
`npm run make -- village-spring`, `npm run make -- tree-spring`, `npm run texpack`, `npm run build`.

## Tests run and what they printed
See `HANDOVER.md`, "Measures and tests at the last commit". Determinism pass; measure 19 lines, 3 red (M2 on the three hero stills, none of whose soft pixels is the miniature's); tsc clean; vitest 432 passed, 4 skipped.

## Looks
40 of 40 used for my two parts together (I counted them as one budget), all at draft tier, hd, each beside the approved crop except the interior and base cameras, which have no approved picture. 23 pictures are on the looks branch with `captions.txt`.

## Seen with my own eyes, and not
- Seen at the last code (draft, hd): rest hero (07:40), landed hero (08:00), settled hero (08:01), rest interior (08:02).
- Not seen: the base camera since 06:12 (an older commit), the shake still, macro or low cameras, anything above the draft tier, the medium and low live levels, the page in a real browser on a GPU.
- The last merge (`7bc93d5`) brought only `kit/` and `scorecards/`; I remade and rebuilt after it (same triangle counts printed) and did not render again.
