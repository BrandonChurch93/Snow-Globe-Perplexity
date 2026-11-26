# Job: `framing_finisher` · unit `globe`, the app's framing · branch `agent/p6-framing`

Read first: `kit/02-SUBJECT.md` section 7 (the app) and section 9 (framing, checked), measure M1 in `kit/07-QUALITY-BAR.md`, `src/app/framing.ts` whole, and in `kit/PROGRESS.md` the open items 180, 216 and 221 (search for `^180\. ` and so on) and decision 33.

## The faults (must-fix 4 of the review; open items 216, 180, 221 c)
1. "On a phone the globe leaves the screen during the shake." At 390 x 844, on a Shake press and on the space bar, "the glass reaches about x 418 of 390: the right limb of the glass and the right end of the base are cut by the screen edge; in the second shake the glass is hard against the edge again." Picture: `out/stills/phase-5/final-pass/phone_shake_clipped.jpg`. At 1920 x 1080 the reviewer's three stills stay in frame "with the top of the glass about 15 px from the top edge": check the top of the lift there too.
2. On the phone the base is wider than the screen at rest: the app fits the glass to the width, not the globe with its base, and measure M1 is red for `screen-phone` (item 180).
3. "390 x 844: the top quarter of the screen is flat dark, with one backdrop light cut in half by the left edge at y 237."
The standard this is judged by: one unmistakable focal point; the hero and the primary controls in one viewport; "stack cleanly on mobile"; no rough edge in responsiveness or edge cases.

## What is asked
- On every screen shape, from 320 x 568 to 2560 x 1080, tall, square and wide: the whole globe with its base, and what the season heaps at its foot, stays inside the frame with a margin through the whole of every shake (all `FRAME.shakePaths` live paths, the lift, every stroke, the set-down), through a jump by a season mark, and at rest; and it clears the controls.
- At rest on a tall screen the globe sits well: as large as the shake allows, placed so that the dark above it reads as room, not as an empty quarter of the screen; nothing bright is cut in half by an edge at rest.
- Decide by looking between fitting the stroke to the free margin (the globe stays large at rest, the shake is smaller on a narrow screen: is it still a shake?), standing the camera back for the bars of the shake and easing in again after the landing (the shake stays whole: does the move read as the camera breathing or as a lurch?), or both in measure. The film's shake and the film's cameras do not move: `src/shake/table.ts` and `src/scene/cameras.ts` are not yours, and `npm run determinism -- --film` must pass.
- The numbers that decide it are named and written once, and the tests state the rule (`tests/framing.test.ts`): for a grid of screen shapes, every sampled moment of every live path keeps glass, base and heap inside the frame by the margin.

## Yours
`src/app/framing.ts`, `tests/framing.test.ts`, `tests/measure-framing.test.ts`. If a number of the camera's orbit under `live` in `config/showcase.json` must change (`orbitYawDeg`, `orbitPitchMinDeg`, `orbitPitchMaxDeg`), send `/root` the line. `first_frame_finisher` reads your framing to place the page's first still: keep the names it can call stable, and tell it in one line when the phone's framing has changed. `src/app/app.ts` is `first_frame_finisher`'s: send it exact lines if the app must call your code differently.

## Done means
- Through the app's own path (`npm run sheet -- --app shake --level high --format phone`, and the stills of `node tools/visit.mjs --layout phone`): the top of the lift, the far end of each stroke and the set-down on `phone`, `tablet` and `hd`, and on 320 x 568, 360 x 800, 844 x 390 (a phone on its side) and 2560 x 1080: whole globe and base inside the frame with a margin, in every one. Say which you drew and which you only computed.
- At rest on `phone`: the still beside the reviewer's left panel, at full size and at 200 px wide. Say what you see.
- M1 green for `screen-phone`, `screen-tablet` and the wide screen (`npm run measure -- --unit globe --only M1 --tier draft`), `npm run determinism` and `npm run determinism -- --film` pass, tsc and vitest clean.
