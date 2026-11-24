# Round 1 · blockout (Phase 2, the floor round)

Judged commit `48afed3` (the pack was built at `b94e722`, whose source is the same; engine hash `e4a8b9bdbc7a55ec`). Started 2026-11-24 06:36 UTC, answered 07:08 UTC.

## Scores

| Part | What it saw | Asked on | Score | Severe | Major |
| --- | --- | --- | --- | --- | --- |
| 1 | Ten film sheets: the whole film, the opening with its reveal frame, each shake, each hold | `gpt_6_2_sol`, reasoning max | 8 | 1 | 0 |
| 2 | Six camera pairs (approved image beside the stand-in from each camera) and the three screens | `gemini_4_carbon`, reasoning medium although max was asked | 5 | 2 | 5 |

Merged score: 5. The bar is `quality.blockoutPass` (7) with no severe issue open. Round 1 fails.

## Top issues

1. Severe, `set-A-04.jpg`, the spring hold: the move runs all the way to the `base` camera and the miniature leaves the frame for several seconds.
2. Severe, `set-B-05.jpg`, camera `surface`: the frame is filled by the wall of the base, not by the surface.
3. Severe, `set-B-03.jpg`, camera `interior`: a wide shot of the whole sphere from outside, the miniature only the middle third.
4. Major, `set-C-03.jpg` and `set-C-01.jpg`: at 1024 by 1366 and 1920 by 1080 the foot of the base stands 23 px and 28 px above the Shake control.
5. Major, `set-B-01.jpg`, camera `hero`: 2.2 percent under the foot of the base against 10 percent above the glass.
6. Major, `set-B-06.jpg`, camera `low`: the top of the glass 1.1 percent from the top edge, and the shot nearly the same as `hero`.
7. Major, `set-B-02.jpg`, camera `macro`: the cottage's left gable, chimney and fence cut by the left edge, the right third a bare trunk.

## What changes next

- Issue 1: decision 34. The spring move goes toward `base` and stops where the foot of the base and the cottage's ridge keep the same room (55 percent of the way). Built at `98d9ca1`, merged.
- Issue 5: decision 35. `shake.liftMm` 13.5 and the hero aim 70.5, so the foot stands 4.2 percent above the bottom edge and the lifted glass still stays inside the top. The critic's 10 to 12 percent cannot be reached with the fill check and a locked camera together; the rest is carried as an open item and listed for Brandon.
- Issues 2, 3, 6, 7: the four cameras are framed again from rendered candidates by `engine_engineer_2` (branch `agent/engine2`).
- Issue 4: the app's framing gets a rule: on the two wide screens at least 7 percent of the height between the foot at rest and the highest control (`film_app_engineer_2`).
- Also found while reading the answers: in the spring hold the petals hide the miniature for nine seconds at draft; the particle kinds are tuned so every storm thins within the first bar (`particles_engineer_2`).

## Notes on the round

- Part 2 judged the screens of `48afed3`, before the live framing of decision 33 was merged; the foot's height above the controls did not change with it, so its two issues stand.
- The critics were not told what each camera and each hold's move is for. `tools/pack.mjs` now writes both into the file lines, for round 2.
- Nothing is declined outright. One part of the first critic's fix is not taken: it asked the spring move to stay on the miniature; the kit sends that move to the `base` camera, so it keeps going there and stops short (decision 34).
- Round 2 is the last blockout round the config allows (`quality.blockoutMaxRounds`).
