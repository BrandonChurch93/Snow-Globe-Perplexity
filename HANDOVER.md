# summer_stone, Phase 6 fix pass: handover

Branch `agent/p6-summer-stone`. Files: `src/seasons/summer/base.ts`, `assets-src/base-summer/{profile,mesh,field,maps}.mjs`, `RECIPE.md`.
To see it: `npm run make -- base-summer`, `npm run texpack`, `npm run build`, then a still.

## What changed
- The stone's own rim stands at 40.4 mm (r 50.3) and a rounded seat runs down to the crown at 38.6 mm (r 44.8), the same all round; the old flat collar band and its dark ring on the left are gone. `RISE = 0`.
- The belly is drawn in between 24 and 34 mm so `tests/summer-fall.test.ts` holds (the fall clears the stone by 0.22 mm or more).
- Frames for shells and glass bend with the wall; every piece sits level with the middle of its own seat, with `halo()` as a ring of shade (`maps.mjs`: `dark *= 1 - 0.4 * halo^2`).
- Scallops: ribs with growth steps. Sea glass: thick pebble, level in the middle, outline near convex (`two`, `tri` and the 5th and 8th waves cut down), new shader (`GLASS`): dark rim, glow on the far side, sheen.
- The sand ring on the ledge thins on the left back (`lee` in `ledgeSand`), which took away the white clipped wedge at the left end of the seam.
- `base.ts`: `shadeIn()` shades the front (warm left, deep middle, lit right edge) for stone, shells and glass; a `rake` light along the ridges; `FRONT_SHADE`, `STONE.room`, `STONE.table`, `STONE.direct` set the level.

## What is still wrong, worst first
1. The middle and right of the stone read warm grey, not cream, and the top band under the glass is dark where the approved has sunlit patches. The approved's own numbers there are dark and near neutral (about 60,60,54 in the middle third, 80,80,81 in the right third); it reads cream because its neighbours are dark. Ours has a bright bank inside the glass above it and a bright apron beside it. A cool tint that matched the approved's numbers (room `mix(vec3(1.0,0.98,0.96), vec3(0.8,0.95,1.22), smoothstep(-34,4,x))`, table `vec3(0.64,0.82,1.0)`) read as blue slate in the base camera and was taken out again.
2. Ridges are softer and shallower than the approved's carved ones; shells on the right are grey beside the approved's pale pink.
3. Sea glass has a rim, glow and sheen but still reads more as glossy pebble than as frosted glass that light goes into.
4. Thin dotted crease lines on the stone at draft; not looked at above draft.

## Numbers
M3 at final, base: 1.025 (was 0.692), measured on the commit before the last tint change. Draft: base 2.129.
