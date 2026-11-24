# shake_builder · branch `agent/p3-shake`

Also read, every line: `kit/02-SUBJECT.md` sections 5, 6 (all of it) and 9; `kit/03-METHOD.md` sections 7, 10 and 11; in `kit/04-LOOK.md` the ladder steps "The shake looks keyed, light or mechanical" and "The storm does not hide the change"; in `kit/07-QUALITY-BAR.md` the measures M4 and M5 and the critic R4; open item 29 and decision 35 in `kit/PROGRESS.md`, and what "Look lock" there says about real shakes.

You own: everything under `src/shake/`, and new tests you name `tests/shake-*.test.ts`.

Goal: the globe's motion in a shake, as a heavy glass thing in a hand, and the change number. The part is `shake`. No approved image shows the globe in the air: `kit/02-SUBJECT.md` section 6 and real footage are the target.

What to build:

- A hand model, as `kit/03-METHOD.md` section 10 says: a grip path; a stiff spring with a limit on jerk, so the globe has weight and never snaps; tilt coupled to the strokes about two axes; the set down solved backward from the landing so it lands on its beat exactly, with a small settle after it over `shake.landSettleSeconds`. Written in beats (`shake.liftBeats`, `strokeBeats`, `setDownBeats`, `strokes`), a table from the seed, a pure function of the beat.
- Position, velocity and acceleration are continuous from the first frame of the lift to the end of the settle; jerk is bounded. Prove each with a test.
- No two strokes alike; a small tremor of a hand while it is held, from the seeded stream.
- Open item 29: from `hero` at `hd`, through every frame of the test shake and of the film's four shakes, the highest point of the glass stays about 5 percent of the frame's height below the top edge. Prove it with a test that projects the glass through the pose for every frame.
- The numbers `shake.liftMm`, `shake.strokeMm` and `shake.tiltDeg` are read from the config; `/root` may move each by a quarter. Say the values you want and why.
- The change, in `src/shake/change.ts`, as `kit/03-METHOD.md` section 11 says: the number runs from 0 to 1 inside the swap window; inside the glass the far side of the miniature goes first and the near side after, behind the storm; outside the glass each part changes as the kit says. Check every span against the kit and the motion.

Contract:

- Keep `GlobePose`, `REST_POSE`, `ShakePath`, `makeShake(name)`, `SEASONAL_PARTS`, `changeSpan`, `changeRamp`, `partChange` and `changeBloom` with their signatures (`rg -n "shake/" src tools tests`).
- What answers the shake is drawn by others from `StageFrame.globe`: the mirror image by itself, the shadow and the pool by the scene's builder, the dressing by the frost's builder, the liquid and the particles by their builders. Look at each in your sheets and name in your report, by owner, what does not yet answer.
- M4 and M5 depend on the veil, which is being rebuilt: report them as they stand and tune nothing to the stand-in veil.

Test: `npx vitest run`, `npm run determinism`, a sheet across the test shake and the frames round the landing (`npm run sheet`, `npm run seq`, `testShake()` and `renderTestShakeFrame` in `tools/README.md`), and `npm run measure` for winter.

Looks: a sheet across the test shake; the highest frame of the lift with the clearance marked; the landing frame by frame; curves of height, tilt and speed over the beats drawn as a picture.
