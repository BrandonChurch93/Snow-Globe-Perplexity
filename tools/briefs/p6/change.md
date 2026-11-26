# Job: `change_finisher` · unit `change` · branch `agent/p6-change`

Read first: `kit/02-SUBJECT.md` lines 130 to 150 (the swap window), `kit/03-METHOD.md` lines 190 to 200, `kit/04-LOOK.md` line 55, measure M4 to M6 and checks G11 and G12 in `kit/07-QUALITY-BAR.md`, and in `kit/PROGRESS.md` the open items 154, 155, 181, 194, 200 and 219 (search for `^154\. ` and so on). Item 194 is the report of the builder before you: read what it tried and why.

## The fault (must-fix 2 of the review, open item 219)
In all four shakes the season change outside the glass is seen. In the film the old base is whole in one frame and gone in the next (film frames 673|674, 1393|1394, 2113|2114, 2833|2834 at 60 a second; in the 30 a second review cut 336|337, 696|697, 1056|1057, 1416|1417). The backdrop lights turn on the same frame. The table's dressing is out of step: winter's frost star on the table is gone three frames before the base, summer's sand the same, spring's petals come over four frames after it. The glow that should cover it "covers nothing". In the app's own path (no shutter) it is the same cut on one frame under a soft yellow-orange glow at the foot of the glass.

The kit: "The base, the dressing and the backdrop are outside the glass and cannot hide in the storm. They change at the fastest moment of the strokes, under motion blur, inside a short bloom of the new season's light pouring out of the globe. Across those few frames the old base gives way to the new." And: "In the swap window the bloom of the new season's light is allowed to flood the frame for a few frames. That is the one place it is strong."

## What has been tried, so you do not walk it again
- A morph of one base into the other across about 8 frames: a third base that is neither season's ("an off-model glowing orange drum"). Severe, four rounds running.
- A cut on one frame where the shutter is closed (the state now): no frame holds two bases, and the eye sees a pop, because nothing covers it. The blur of a stroke is only a few pixels long, so blur alone hides nothing.
- A mild glare centred on the seat of the glass (`CHANGE_BLOOM` in `src/scene/lighting.ts`): too weak to cover, and where it is stronger (the app, `glareLive`) it reads as an orange flash on the table.

## What is asked
Make the change outside the glass something no viewer can catch, at 60 frames a second in the film and in the app's own path, for all four changes. You decide how; judge by looking, frame by frame. Routes worth a first look, in the order I would try them:
1. Light does the hiding. For the few frames around the fastest stroke the storm inside flares with the new season's light and the room falls away from it, as a camera's exposure does when a lamp flares in a dark room: the base and the table drop to a near silhouette under the glare while the glass burns. In that near dark the old base dissolves into the new over several frames (two whole bases drawn, never a morphed one), with the dressing, the backdrop lights and the tint on the glass all inside the same few frames. Then the room comes back on the new season and the arrival carries on.
2. A real flood: the bloom is strong enough to take the base and the table to the light's own colour for two to four frames, rising and falling over a few more, and the dissolve happens under it. The kit allows exactly this. It must read as light pouring out of the globe, not as a white frame cut in.
3. Either of them with the base's change run as a front that sweeps with the stroke, so that the blur of the stroke lies along the front.
Whatever you choose: one window drives the base, the dressing on the table, the dressing on the glass, the backdrop and the room light, so that no clean frame holds parts of two seasons outside the glass; no frame shows a base that is neither season's; and nothing pops on a single frame anywhere in the window.

## Yours
`src/shake/change.ts`; the change of the outside parts in `src/core/materials.ts` (the block from `MODE` to `OUTSIDE_RAMP` and what reads it), `src/scene/lighting.ts`, `src/scene/stage.ts`, `src/scene/backdrop.ts`, `src/scene/frame.ts`, `src/post/post.ts`; in `src/scene/surface.ts` everything but the caustic (that is `summer_finisher`'s); every season's `base.ts`, `slab.ts`, `backdrop.ts` and `rig.ts`, and winter's, spring's and fall's `arrival.ts` and `glass.ts` where they read the change (summer's `arrival.ts` and `glass.ts`: only the lines that read `partChange` or `changeSpan`, and tell `summer_finisher` first); `tests/shake-change.test.ts`, `tests/light-flood.test.ts`, `tests/lens-glare.test.ts`, `tests/light-chunk.test.ts`. Not yours: the shake's path and timing (`src/shake/table.ts`), the camera, anything inside the glass but its light.

## Done means
- For each of the four changes, a sheet of every frame of the swap window at 60 a second (`--first` and `--last` on the window: 648 to 683, 1368 to 1403, 2088 to 2123, 2808 to 2843), at the `review` tier or better, looked at frame by frame at full size: no pop, no third base, no clean frame with two seasons outside the glass. Then the frames on each side of the strongest moment at the `final` tier.
- The same through the app's own path at the `high` and the `low` level, for a shake and for a jump by a season mark (winter to summer).
- At 400 px wide, played in order, the change reads as light, not as a swap.
- G11 and G12 pass (`npm run gate -- --phase 4`), M4 to M6 are green for all four changes (`npm run measure -- --unit change --tier draft`), `npm run determinism` passes, the strict run passes on all eight keys.
- The eight judged keys at rest and landed are the same pictures as before, or you say which moved and why.
