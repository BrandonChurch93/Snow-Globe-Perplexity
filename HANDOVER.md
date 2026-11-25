# HANDOVER: spring air (glass dressing, veil, rig, backdrop, petal and mote rows)

Branch `agent/p4-spring_air2`; looks on `agent/p4-spring_air2-looks`. Make targets: none (nothing of mine is built by `npm run make`).

## Files and what each holds

- `src/seasons/spring/glass.ts`: dew (9,000), beads (420), 26 run slots with short straight clear trails (14 segments each). Drops are drawn soft by an analytic defocus (`dewSoft`, lens far plane from `src/scene/cameras`), because the glass dressing is left out of the stage's lens blur. Drops and trails shrink to nothing toward the limb (`look.limb`). `glassDressing.amount` stays 0: the shell's film halves the glass's alpha, which is the shared glass's look.
- `src/seasons/spring/veil.ts`: three meshes. Dawn mist (`look`, 26 sheets of 10 by 4). Storm mist (`storm`, 22 sheets of 10 by 10): `stormAt()` gives thickness and evenness from the liquid; the fragment shapes it (lanes, streaks, dashes, thin before the miniature, thick on the tree's side, on the bank below the lawn not thinned). Wash (72 by 8 band inside the glass, only while the liquid turns). Also the kit's `particles` colours (petal, mote).
- `src/seasons/spring/rig.ts`: key, rim, card. The shell reads key and rim only; the card lights the base, the miniature and the petals (`inside` 0.45).
- `src/seasons/spring/backdrop.ts`: colours (warm, gain 1.7) and `gain(at)`: lights to the right of the hero's axis up to 2.1 times, to the left 0.75.
- `src/particles/engine/kinds.ts`, rows `petal` and `mote`: petal floats 0.085, sink 0.2 to 1.9 mm/s, size 0.9 to 3.3 mm with skew 2.1.

## How the storm runs in time (the thing most likely to be touched next)

`stormAt()` in `veil.ts`:

- Until the swap closes (beat 3) the thickness is the flood: 0.26 per mm, even 0.75. M4 is measured there.
- From beat 3 the release `u` runs 0 to 1: the set down is the first 0.545 of it, the 0.5 s after the landing the rest (`releaseLanding`, `releaseSeconds`). Thickness goes from the flood's to the stirred mist's by equal ratios (`flood * (after / flood) ^ ease(u)`), and the fragment opens the mist before the miniature by the same measure (`pow(thin, after)`).
- After +0.5 s the thickness is `stirred * turbulence ^ 1.3`, down to the floor `calm` (0.0055) by about +2.5 s.
- Film values: beat 3.0 0.260; 3.5 0.185; landing 0.086; +0.25 s 0.043; +0.5 s 0.027; +1.5 s 0.012; +3 s 0.0055.
- A still has no beat: `sinceLanding` in 0 to 1 s gives the same release, so the `landed` still equals the film at +0.5 s.

If M5 goes red, lower `stirred`; if M4 goes red, raise `flood`. Do not bring back a ramp over a few beats: the motion critics read it as a step.

## What was tried and did not work

- Rim light 0.75 to 0.5 to darken the pale right limb: 3 of 255. That band is the shell's; taken back.
- Still air's haze as a tall ball between the cottage and the tree: read as a detached fog ball (R3-1 #14). It is now low and behind the trunk (`calmAt`, `calmReach`).
- From the first agent, still true: the shared veil as the storm's mist, long sinuous trails, thick dawn mist at rest, an even haze everywhere, fast petal sink.

## What is left, worst first

1. Right limb of the glass is a broad pale band; left limb has no highlight; ring at the apex. Shared (`src/globe/shell.ts`).
2. Upper air at rest is darker than the approved (median 91,81,85 against 141,127,135 at the top). The approved has a pale haze on the upper glass and soft near petals; the first is the shell's film, the second is the petal draw.
3. Landed: the lower half is an even pale pink; the approved keeps darker lanes there. Levers: `storm.lane`, `storm.near`, `storm.washLight`.
4. Landed: the crown is a pink shape, in the approved a white ghost. Levers: `storm.treeSide`, `storm.treeSideMm` (more mist before the crown).
5. Bokeh discs behind: hard double ring and size are the shared backdrop's draw; colours, gain and side weights are done.
6. Quality levels: a season's parts are not told the level, so my meshes are the same at high, medium and low. If the kit ever passes the level, halve the dew at low first.

## Tools I left in `out/work` (not committed)

- `out/work/bin/tris.mjs spring`: triangles per level (from /root).
- `out/work/stormlog.mjs <frames>`: needs a temporary `globalThis.__airLog?.push(...)` line in `updateMist()`; prints beat, turbulence and thickness per film frame.
- `out/work/sanity.mjs`: invalid values with groups hidden (needs a temporary hide hook).
