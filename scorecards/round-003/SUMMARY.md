# Round 3 · winter (Phase 3, the look lock; winter's first round)

Judged commit `2faac9e` (engine hash `c18b4b561b115610`). Started 2026-11-24 13:17 UTC; the last answer arrived 16:29 UTC. Stills at the `final` tier from the `full` set, motion sheets at `review`.

## Scores

| Role | Part | What it saw | Asked on | Score | Severe | Major | Minor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | | The two keys beside the approved images, and crops | `gpt_6_2_sol` | 4 | 5 | 10 | 0 |
| R2 | | 15 jurors on three judged stills, 10 on two controls | five families | fails | | | |
| R3 | 1 | Judged stills and native crops | `claude_opus_5_5` | 6 | 1 | 7 | 3 |
| R3 | 2 | Judged stills and native crops | `gemini_4_carbon` | 3 | 5 | 12 | 1 |
| R3 | 3 | Judged stills and native crops | `kimi_k3` | 4 | 3 | 7 | 2 |
| R4 | 1 | Ten sheets: the lift, the strokes, the set down, the first second after the landing | `gemini_4_carbon` (the replacement; the first critic, on `claude_fable_5_2`, did not answer inside `budget.agentWaitMinutes`) | 3 | 5 | 1 | 0 |
| R4 | 2 | Two sheets: the whole shake with its clearing, the globe at rest | `pplx_computer_glm_5_3_1009` | 7 | 0 | 2 | 1 |

A role split across critics takes the lowest score and every issue: R3 is 3, R4 is 3. R2: 4 of 15 jurors took a judged still for a photograph against 7 of 10 for the controls; the bar is a share of 0.5 and a gap of at most 0.2, so R2 fails and counts as one major issue. Measures at `final`: 24 lines, 1 red (M3 on `winter-rest`: 0.7156 against 0.75; the base held 0.716 of the approved image's fine detail). Machine checks on a clean clone: 4 red of 15 (G3, G5, G8, G10).

The pass bar asks green checks and measures, R1, R3 and R4 at 9 or more with no severe or major issue open, R2 passing, and every judged still at `final`. Round 3 does not pass.

## What the critics found, severe first

Likeness (R1):
- The miniature sat on a thick grey slab with a straight front edge; the approved image has a shallow, lumpy white bank.
- The storm at `landed` was long, broad, parallel ribbons.
- The icicles were short nubs half a second after the landing; the approved image shows them long.
- The base read as brown wood with dull relief; the approved base is near black with gold lights on the carving.

Craft (R3):
- The storm's strokes lay flat at one depth over the scene.
- The mirror image under the base was cut off along two straight edges.
- The inside was not bent or enlarged by glass and water, and had an opaque slate blue back.
- The frost on the slab was thick matte ribbon with rows of identical pellets.
- A noise mask turned the right half of the base to flat grey.
- The chimney smoke was a straight cone of stippled noise.
- The pond was a flat plane; the cottage stones one repeated shape; the roof snow a hard edged sheet.

Motion (R4):
- At the first frame of the swap window the icicles, the ledge snow, the glass frost and a whiteout stepped in one frame.
- The slab's frost dissolved in plain view during the last stroke and came back after the landing as an oval wipe.
- The globe hung still in mid air for 0.24 s and glided straight down, landing without weight.
- The strokes ran along a flat line, equal in length, with under 2 degrees of tilt; the lift rose straight up with no tilt.
- The storm was a fixed shell of streaks that never reversed with the strokes and stayed smeared after the landing; in the whole shake sheet it read as ribbons.
- The snow inside kept still through the lift and the first stroke.

## What was done with it

- 13:17 to 16:00 UTC: the second set of builders (decision 49) worked each answer as it arrived; the four red checks were cured (G3 and G10 in the engine and the mirror target, G8 by recipe headings, G5 by unpacking the sound files for the gate's clone). Their work was merged and frozen as Round 4's judged commit `53cd7dd` at 16:06.
- R4 part 1 arrived at 16:29, after that freeze. Its findings went at 16:37 to the third set of builders (decision 54) with the kit's own lines, and a tenth builder was started for the shake's path alone. Round 4 will therefore still show most of what R4 part 1 describes; Round 5 is the first to judge the fixes.
- Every answer is kept verbatim beside this file; `KEY.json` and `KEY-jury.json` were added after the last one; `MANIFEST.md` lists the pack.
