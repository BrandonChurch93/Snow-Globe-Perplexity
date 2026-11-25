# Handover: spring base, surface dressing, arrival (spring_base)

Written for someone who has never seen this work. Work branch `agent/p4-spring_base`, looks branch `agent/p4-spring_base-looks` (this one). Parts in the register: `base-spring`, `surface-dressing-spring`, `arrival-spring`. Target: `references/approved/spring-rest.png` and `spring-shake.png`.

## Files (all mine, nothing else touched)

- `assets-src/base-spring/layout.mjs`: every measured number of the base: profile, cobbles, moss drips and patches, the trickle's path and `TRICKLE_WIDTH`, the roots, mushrooms, flowers.
- `assets-src/base-spring/build.mjs`: makes `base-spring.glb` (meshes `rock`, `growth`, `water`; the water carries `lengthMm` and `foot` in its extras), `base-relief.lin.w2048.png` (red and green fine normal, blue cavity with the shade under roots), `base-cover.lin.w2048.png` (red moss, green wet band, blue how far down the trickle a wet texel lies), and three tiling sheets with their detail maps (`base-{moss,stone,bark}.srgb.tile.w512.png`, `base-{moss,stone,bark}-detail.lin.tile.w512.png`).
- `assets-src/base-spring/gen/`, `prompts/`, `ref/`, `RECIPE.md`: three generated sheets (moss, stone, bark), their prompts, the reference crop.
- `assets-src/slab-spring/build.mjs`: makes `slab-petals.srgb.w1024.png` (12 petals, 4 by 3, wet cells 6, 9, 11) and `slab-far.srgb.w2048.png` (440 petals as one picture from 232 mm out, thinned to three in ten where z is over 60 mm).
- `assets-src/slab-spring/gen/`, `prompts/`, `ref/`, `RECIPE.md`: the generated petal sheet, its prompt, the reference crop.
- `src/seasons/spring/base.ts`: materials of rock, growth and water; `FLOW`, `flowFront`, `trickle`, `waterUniforms`; the base giving way inside the bloom through `partChange('base', ...)`.
- `src/seasons/spring/slab.ts`: 300 real petals as instances near the foot, the far picture, the pool; `PETALS`, `JUMP`, `POOL`, `dressing()`, `setJump`, `setPool`, `poolFill`; `standIns` is empty.
- `src/seasons/spring/arrival.ts`: `landingClock(moment)` feeds the jump of the petals, the water front and the pool from the pose alone.
- `tests/spring-arrival.test.ts`: 7 tests of `flowFront`, `poolFill`, `landingClock`.

## Make targets, in this order

1. `npm run make -- base-spring` (about 70 s)
2. `npm run make -- slab-spring` (about 4 s)
3. `npm run texpack`, then `npm run build`

`main` tracks the built files under `assets-full/` and `public/assets/`. So `git checkout -- assets-full public/assets` before a merge puts main's older versions of my files back, and both makes must be run again after every merge. If a merge complains about untracked files there, `git clean -fdq assets-full public/assets` first. Nothing under those two folders is ever committed from this branch. `npm run still` refuses to run until `npm run build` has been run after a source change.

## Constants a successor should know

- `FLOW { startSeconds 0.12, runSeconds 2.1, power 0.8, speedMm 30, leaveLead 0.6 }`: when the first water starts after the landing, how long the front takes to reach the foot, how fast the highlight runs.
- `PETALS { count 300, nearMm 63, farMm 240, sizeMm [4.8, 8.6], clumpMm 46, wetShare 0.2 }`. Sizes of 5 to 9.4 mm read too big at the foot and 3.8 to 7 too small.
- `JUMP { reachMm 60, shockMmPerSecond 1500, heightMm 15, flight [0.34, 0.8], shiftMm 9, rise 0.5, floor 0.1 }`: the jump of the petals on the landing.
- `POOL { radiusMm 15, outMm 8.5, fillSeconds 5 }`.
- `surfaceDressing { tint [1, 0.7, 0.8], amount 0, reachMm 240 }`.
- Moment: the incoming season in a change has `arrived` 0 and a real `sinceLanding`; the outgoing one has `sinceLanding` Infinity and `arrived` 1. States: landed 0.5 s, rest 12 s, settled 40 s. `HELD = 1e3` in `arrival.ts` is the clock of a held season.
- Stone: tint `vec3(2.3, 1.75, 1.3)` over the sheet, a second grain scale, wet stone times `vec3(0.36, 0.38, 0.42)`, an olive film at 0.8 on the stone between the roots.
- Moss: threshold `smoothstep(0.44, 0.72, cover + grain + noise)`; body `mix(vec3(0.2, 0.22, 0.15), vec3(0.56, 0.6, 0.18), sun)`; indirect light times 0.42; `liveShade = mix(0.24, 1.2, smoothstep(0.3, 0.8, wrap))` darkens the side away from the key; tips `vec3(0.5, 0.6, 0.08)`.
- Roots: taper `mix(1.22, 0.26, t^1.1)` with knots in `build.mjs`; in the shader grey mix 0.38 and `vec3(1.8, 1.62, 1.44)`.
- Water: ribbon width 0.38, body glow 0.13, threads 1.3, bright edge lines 0.5 along the fall and 0.16 at the foot, sparks at `step(0.78)`, alpha 0.07.
- Rig (owned by `spring_air`): key `[1, 0.9, 0.84]` x 0.75 from `[380, 430, 200]`; rim `[1, 0.66, 0.74]` x 0.75 from `[430, 170, -330]`; rose card `[1, 0.7, 0.74]` from `[-420, 170, -260]`.

## What is still wrong, worst first

1. The moss is still too even and too bright a green band (`02-base-crop.jpg`). The image has a dark body, warm lit tips on the right, shade on the left and ragged thin edges; the build has a clean hem and one tone across the front.
2. The trickle is thinner and darker than the image's glassy stream, and the pool at its foot hardly shows at the hero: no ripple highlights (`02-base-crop.jpg`, `01-rest-hero.jpg`).
3. Near petals read as flat cutouts: no shadow and no mirror image under them on the wet surface (`04-surface-camera.jpg`).
4. Roots are darker and thicker than the image's pale forked roots (`02-base-crop.jpg`).
5. From the base camera the moss reads as a knitted carpet with a thick hem, and the stone under the trickle is a smooth dark channel (`03-base-camera.jpg`).

## Tried and did not help

- Swapping the bark sheet's two directions on the roots: rings across the roots.
- Cutting the water's mirror and the wet stone's room reflection to remove a grey sheen beside the trickle: the sheen came from the water's own glow terms and from pale smooth wet stone, fixed there instead.
- Pulling the petals 72 percent toward grey: they read tan under the warm key.
- A bright edge line on the water at one strength everywhere: a thick white arc at the trickle's foot. It is now weaker at the foot.

## Size and triangles

- Size after `npm run texpack`: my files in `public/assets/spring/` are 6.20 MiB of the 6.5 MiB allowed. Count them with `ls -la public/assets/spring/ | awk '/base-|slab-/ && !/w1024\.(first\.)?webp/{s+=$5} END{print s/1048576}'`. `main` still holds 18 stale stage 1 tiles `base-{moss,stone,bark}[-detail].*.tile.w1024.*` (9.05 MiB) that no script writes and no code loads; `/root` was told at 01:46 with the `git rm` lines.
- Triangles: 157,056 (rock 111,240; growth 43,160 of which roots 34,816; water 2,656), unchanged since 01:09. Petals are 300 instances of an 8 by 6 plane. No per-season numbers came from `/root`.

## Rows for ASSETS.md (for `/root`, section "Generated images")

| Picture | What it feeds | Model | Reference crop | Takes | Recipe | Date |
| --- | --- | --- | --- | --- | --- | --- |
| `assets-src/base-spring/gen/moss-take1.png` | The moss sheet of spring's base (colour and the grain its detail map is taken from) | Nano Banana Pro through the image tool of this product | `references/approved/spring-rest.png`, x 820, y 960, 1180 by 520 px | 1 made, take 1 kept | `assets-src/base-spring/RECIPE.md` | 2026-11-25 |
| `assets-src/base-spring/gen/stone-take1.png` | The stone sheet of spring's base (colour and grain) | Nano Banana Pro through the image tool of this product | The same crop | 1 made, take 1 kept | `assets-src/base-spring/RECIPE.md` | 2026-11-25 |
| `assets-src/base-spring/gen/bark-take1.png` | The bark sheet of the roots on spring's base (colour and grain) | Nano Banana Pro through the image tool of this product | The same crop | 1 made, take 1 kept | `assets-src/base-spring/RECIPE.md` | 2026-11-25 |
| `assets-src/slab-spring/gen/petals-take1.png` | The twelve fallen petals on the surface around spring's base, near ones and the far picture | Nano Banana Pro through the image tool of this product | `references/approved/spring-rest.png`, x 1700, y 1250, 900 by 310 px, enlarged to 1800 by 620 | 1 made, take 1 kept | `assets-src/slab-spring/RECIPE.md` | 2026-11-25 |

The two reference crops are committed at `assets-src/base-spring/ref/approved-base-crop.png` and `assets-src/slab-spring/ref/approved-petals-crop.png`. They were shown to the image tool only; no pixel of them is drawn in a frame.

## Named fallbacks

None used. They would be: base, a turned shape with the approved image projected and a height picture; surface dressing, one flat picture on the slab; arrival, the finished state faded in evenly over 3 s.

## Checks and their numbers

- `npx tsc --noEmit` clean and `npx vitest run` "Test Files 32 passed | 1 skipped (33); Tests 432 passed | 4 skipped (436)" on `81fb823`.
- `npm run determinism` at 02:40 UTC: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 335 s". It ran one commit before the tip; the tip changes 541 normals at the hidden centre of the cup and nothing else. Run it again.
- Stand-in view at the hero, 02:43 UTC, on the tip: all 2,073,600 pixels black.
- `npm run measure -- --unit spring --only M1,M2,M3,M6 --tier draft` at 02:33 UTC, one commit before the tip:
  - M1 fails at the base camera with 3 invalid values (one pixel that is not a number); every other camera has 0. It still failed with 3 when M1 was run again on the tip at 02:48 UTC. The cause is not found. Removed and so ruled out: the last row of the cup in `buildRock()` of `assets-src/base-spring/build.mjs` has radius 0 and its 541 normals were zero (now up); the basis vectors in the water and rock shaders could be a zero vector (now guarded); the petal's thin term could raise a negative number to a power (now clamped). `spring_air` saw the same 3 with its whole glass dressing hidden, so it is in the base, the slab, the pour, the miniature or the glass as the base camera sees them. Next step: hide `rock`, `growth`, `water`, the petals and the pool one at a time and run `--only M1` (about 5 minutes a run), or read the float frame behind `sc.dev.sanity()` in `src/capture/showcase.ts` to get the pixel's place. This is the first thing to fix.
  - M1 fails at the interior camera because the miniature touches the edge of the frame (not this part).
  - M2 fails at the hero: rest 0.0592, shake 0.0664, settled 0.0593 against 0.03; it passes at the base camera 0.0113 and the surface camera 0.0296 (close to the limit: the far picture of petals is 2048 px over 1040 mm). Whose pixels are soft at the hero was not looked at; `--diag texels` shows it.
  - M3 fails at rest: 0.6483 against 0.75; base 0.648, miniature 0.703. The base is softer than the approved image. The sheets go into the pack at 512 px to stay inside the size allowance; the fine grain comes from the detail maps and from noise in the shader. More sharpness would have to come from the shader (finer moss tufts, grain on the roots), not from larger files.
  - M6 passes on all six.
- Looks used: base-spring 40 of 40 (none left), surface-dressing-spring 5 of 40, arrival-spring 4 of 40.
