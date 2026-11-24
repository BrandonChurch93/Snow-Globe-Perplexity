# Round 4 · winter (Phase 3, the look lock; winter's second round)

Judged commit `53cd7dd` (engine hash `a657047103a04c48`). Started 2026-11-24 16:06 UTC; the last answer arrived 17:45 UTC. Stills at the `final` tier from the `full` set, motion sheets at `review`.

## Scores

| Role | Part | What it saw | Asked on | Score | Severe | Major | Minor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | | The two keys beside the approved images, and crops | `grok_4_7` (the replacement; the first critic, on `claude_fable_5_2`, did not answer inside `budget.agentWaitMinutes`) | 5 | 0 | 11 | 2 |
| R2 | | 15 jurors on three judged stills; the 10 votes on the two controls reused from Round 3 (same bytes) | five families | fails | | | |
| R3 | 1 | Judged stills and native crops: hero at rest, landed, interior | `gemini_4_carbon` | 4 | 1 | 7 | 1 |
| R3 | 2 | Judged stills and native crops: base, surface, settled | `kimi_k3` | 6 | 0 | 3 | 5 |
| R3 | 3 | Judged still and native crops: macro | `pplx_computer_glm_5_3_1009` | 7 | 1 | 5 | 0 |
| R4 | 1 | Ten sheets: the lift, the strokes, the set down, the first second after the landing | `gpt_6_2_sol` | 6 | 1 | 2 | 0 |
| R4 | 2 | Two sheets: the whole shake with its clearing, the globe at rest | `claude_opus_5_5` | 5 | 1 | 1 | 0 |

A role split across critics takes the lowest score and every issue: R1 is 5, R3 is 4, R4 is 5 (Round 3: 4, 3, 3). R2: 4 of 15 jurors took a judged still for a photograph or a film frame (rest 1 of 5, settled 1 of 5, landed 2 of 5) against 7 of 10 for the controls; the bar is a share of 0.5 and a gap of at most 0.2, so R2 fails and counts as one major issue. Measures at `final`: 24 lines, 0 red (M3 on `winter-rest` 0.8324 against 0.75; M4 0.9449; M5 0.9975). Machine checks: the Phase 3 gate on a clean clone, all 15 green.

The pass bar asks green checks and measures, R1, R3 and R4 at 9 or more with no severe or major issue open, R2 passing, and every judged still at `final`. Round 4 does not pass. Against Round 3: the checks and the measures are green for the first time, no critic names a slab, a cut-off mirror, a grey base or a stepped swap any more, and every score rose or held; the bar is still far.

## What the critics found, severe first

Motion (R4), two severe, both on the storm:
- Between frames 70 and 72 the bowl turns opaque in one beat; at frame 78 it is "a flat, opaque white fill ... a ball of milk or frosted glass", with no separate flakes, folds or gaps.
- The base hangs from 1.80 to 2.00 s and then lowers straight down without weight.
- The tabletop frost vanishes under the orange burst and grows back "like a mask", "a frost decal scaling and resetting".

Craft (R3), two severe:
- The landed storm "reads as a concentric 2D spin-blur and milky haze" that hides the cottage and the pond.
- The trunk's bark is cut with deep regular grooves.
- Majors: the snow on the crown in repeated rounded clumps; flakes as opaque pebbles and polygon shards that pass into objects, and one hot red pixel; shrubs and fence post caps; the chimney's plume a smooth tube; the glass edge stair-stepped with a dark gap at the collar; frost with comb teeth at its roots and no melt edge; icicles as "flat-shaded resin spikes" on a dry rim, cutting into the pinecone and the rope; the far snowbank from `macro` in parallel bands; hard-ringed bokeh discs and a mirror as sharp far from the foot as at it; the inside not bent toward the rim and a highlight with a razor edge.

Likeness (R1), no severe, eleven major (the same six things in both keys):
- The collar's snow is taller and puffier than the low crystalline ring, and the glass ends on a hard dark line with a gap.
- The trim and the relief read pale brass (about 216, 191, 164) against antique bronze (about 217, 176, 131).
- The icicles are thicker, blunter and smoother than the slender glassy taper.
- The table frost is clumpy and granular, not flat dendritic crystals, and the mirror under the foot is dull.
- The frost on the glass is separate fronds with gaps, not a continuous dense band; at `landed` it is fainter.
- The crown's snow is round puffy pads, not broad blankets; the star is a bloom without its thin stem.

Jury (R2): what the jurors named for "computer made": the repeated rounded clumps of snow on the tree (2), the chimney's plume (3), a too regular vortex of streaks (1), weak bending in the glass (1), the centred studio framing (5).

## What was done with it

- Every issue was sent to the builder that owns the files, in the critic's words and with the file it names, within minutes of its arrival (16:54, 16:58, 17:09, 17:46 UTC). The third set of builders (decision 54) was already at work on Round 3's motion findings; its pushes of 17:06 to 17:40 answer most of the craft and motion list and are frozen as Round 5.
- Decision 58: two of R3 part 2's majors describe trees, a lamp, cobblestones and a puddle that are in no file of its pack. The answer is kept verbatim and its score counts; each of the two stays open against what its named crops show (the ledge snow, the icicles).
- Decision 59: the shake path may wind up in the lift and carry its last swing into the set down; the test that forbade it was the Builder's own, not the kit's. The new path flips two engine tests, so it is held back from Round 5 until the engine holds them with room.
- Declined, each with the choice it would move away from (`kit/PROGRESS.md`, "Declined issues"): the fix that asks to keep the tabletop frost fixed through the shake (the kit's change of the dressing in the bloom and winter's arrival; what the critics saw, a mask, stays open); the half of the glass issue that asks for more magnification than the approved images show.
- The far snowbank's bands are a limit of 24 lens points where the blur circle is about 30 px: the lens points were moved to a sunflower spiral (finer steps, not a cure) and a cure is briefed for the next set of builders (open item 36).
- Every answer is kept verbatim beside this file; `KEY.json` and `KEY-jury.json` were added after the last one; `MANIFEST.md` lists the pack.
