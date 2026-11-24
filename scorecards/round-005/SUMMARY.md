# Round 5 · winter (Phase 3, the look lock; winter's third round)

Judged commit `9be1c06` (engine hash `c5811ea1c5834970`). Frozen 2026-11-24 18:02 UTC; the last answer arrived 19:11 UTC. Stills at the `final` tier from the `full` set, motion sheets at `review`.

## Scores

| Role | Part | What it saw | Asked on | Score | Severe | Major | Minor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | | The two keys beside the approved images, and crops | `gemini_4_carbon` | 5 | 1 | 6 | 1 |
| R2 | | 15 jurors on three judged stills; the 10 votes on the two controls reused from Round 3 (decision 62) | five families | fails | | | |
| R3 | 1 | Judged stills and native crops: hero at rest, landed, interior | `gpt_6_2_sol` | 7 | 1 | 3 | 0 |
| R3 | 2 | Judged stills and native crops: base, surface, settled | `claude_opus_5_5` | 6 | 0 | 6 | 8 |
| R3 | 3 | Judged still and native crops: macro | `grok_4_7` | 6 | 0 | 3 | 1 |
| R4 | 1 | Ten sheets: the lift, the strokes, the set down, the first second after the landing | `kimi_k3` | 3 | 3 | 2 | 1 |
| R4 | 2 | Two sheets: the whole shake with its clearing, the globe at rest | `pplx_computer_glm_5_3_1009` | 7 | 0 | 2 | 0 |

A role split across critics takes the lowest score and every issue: R1 is 5, R3 is 6, R4 is 3 (Round 4: 5, 4, 5; Round 3: 4, 3, 3). R2: 3 of 15 jurors took a judged still for a photograph or a film frame (rest 0 of 5, landed 1 of 5, settled 2 of 5) against 7 of 10 for the controls; the bar is a share of 0.5, so R2 fails and counts as one major issue. Measures at `final`: 1 red, M1 on `winter-base` (one invalid pixel where the glass leaves the frame). Machine checks on a clean clone: 14 of 15 green; G2 red on one test (`tests/engine-cover.test.ts`, the roof layer 0.1857 against 0.2), cured on `main` at 18:30 UTC.

The pass bar asks green checks and measures, R1, R3 and R4 at 9 or more with no severe or major issue open, R2 passing, and every judged still at `final`. Round 5 does not pass. Against Round 4: the craft score rose from 4 to 6 (two of its three parts rose, one held), likeness held at 5, motion fell from 5 to 3 on a critic that read the globe as never moving, and the jury fell by one vote. The new shake path and the liquid's cure were held out of this freeze and are judged first in Round 6.

## What the critics found, severe first

Motion (R4), three severe, all from part 1:
- "the globe does not move during the shake: it stays seated and centered on the surface with no strokes, no reversals, no lagging tilt; the only change is the interior fogging up". On the judged path the globe moved about 11 mm either side.
- "the lift never happens: the globe stays seated on the surface for the full run". The lift is 7.25 mm (decision 45).
- "a mid-strokes pop: the frosted storm globe suddenly flares warm orange and reads as smooth unfrosted glass, the scattered snow on the surface vanishes, then everything snaps back to cold and frosted ~0.2 s later".
- Majors: "the set down is missing"; the storm "builds as uniform fog filling the globe evenly, with no directional slam or lag against the glass"; at rest "a dense cluster of large flakes holds nearly the same shape and height above the ground for seven seconds"; the clearing "leaves a broad, nearly level opaque belt that thins in place".

Likeness (R1), one severe, six major:
- Severe, the landed storm: "sparse, rigid, straight white dashes tilted at steep diagonal and vertical angles across the flow over a blotchy dark-grey cloud ring near the rim, with no warm light glints", where the approved image has dense curved streaks in one vortex that catch the warm light.
- The lower storm is "a smooth, featureless airbrushed white fog bank".
- The collar's snow is missing across the front and stops in a step on the right.
- The star is unlit, the string lights pale and greenish, and they do not light the trunk.
- A wide white reflection band on the upper right glass where the approved image has dark glass.
- The surface under the base reflects cold grey where the approved image is warm amber; frost creeps up to the rope trim.
- The chimney, the roof snow and extra bushes.

Craft (R3), one severe, twelve major:
- Severe, the landed storm: "The continuous milky ribbon reads as a fog effect rather than suspended snow. It wipes out the pond and much of the cottage".
- The lower glass "reads as an opaque grey felt dome, not glass", ending "on a dead-straight line on top of the brass collar ring with no seat and no contact shadow"; the rim snow "reads as grey felt or fondant icing" with "a row of evenly spaced rounded drips all the same size".
- "a cluster of broken pixels about 10 px across, in pure green, cyan and yellow" at the top edge of the base still: measure M1's pixel, seen by eye.
- The nearest tabletop frost is "tan and beige"; the far edge of the surface does not line up behind the globe.
- The roof's snow "a nearly even gray sheet"; the pond "a uniform blue insert"; the crown "flocked rather than built up from branches".
- The macro still: "the foreground blur breaks into a comb of steps and wavy streaks", "a hard white facet" at the trunk's foot, bands across the far snow.

Jury (R2), what the jurors named for "computer made": the uniform icicles (3), the storm as a smooth blur (2), "minimal water-sphere refraction" (2), clean glass, an illustrative tree and cottage.

## What was done with it

- Every issue went to the builder that owns the files, by owner and in the critic's words, with the name of the still it was found on (`out/work/briefs/r5-issues.md`, attached to each of the ten closers started at 19:13 UTC; the last craft part was added before they started).
- The third set's branches were merged into `main` between 19:00 and 19:09 UTC (415 tests pass). On the new shake path the storm one second after the landing is a cream bank that hides the cottage; it is the first job of the flakes' and the liquid's closers.
- Measure M1: the cause is proven (the lens puts points the eye cannot see exactly on the limb, and a sliver triangle is shaded out of range); the cure is the glass closer's first job, due before the Round 6 freeze.
- Ladder moves 6 to 10 (`kit/PROGRESS.md`, "Ladder moves (the plateau rule)"): the storm to rung 3 of the particles' ladder; the shake to rung 4, the surroundings react; the tabletop frost to rung 2 of the arrival's ladder; the chimney's plume to rung 4 of the still's ladder; the glass to rung 4, its named fallback; the base to rung 4, seat it.
- Declined (Declined issues, 4): the fix that asks to remove the bloom, which the kit's change requires. What the critic saw stays open.
- Decision 62: the two controls of this round's jury pack are cropped 6 px narrower than Round 3's; their votes are reused.
- Every answer is kept verbatim beside this file; `KEY.json` and `KEY-jury.json` were added after the last one; `MANIFEST.md` lists the pack.
