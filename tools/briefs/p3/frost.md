# frost_builder · branch `agent/p3-frost`

Also read, every line: `kit/02-SUBJECT.md` sections 3 (Winter) and 6 (all of it); `kit/03-METHOD.md` sections 3, 6, 11 and 16; in `kit/04-LOOK.md` section 2 and the ladder step "An arrival looks like a wipe"; in `kit/07-QUALITY-BAR.md` the critics R3 and R4.

You own: `src/seasons/winter/frost.ts`, `src/seasons/winter/arrival.ts`, `assets-src/frost-winter/`, files named `assets-full/winter/frost-*`.

Goal: what winter puts on the glass and on the slab, and how winter arrives. The parts are `glass-dressing-winter`, `surface-dressing-winter` and `arrival-winter`.

What the approved image shows:

- Fern frost on the glass, grown inward from the rim: strong on the left, with long feathered arms, lighter on the right, clear in the middle. It is crystalline, has height, sparkles along its edges, is translucent white and softens what lies behind it.
- On the slab, frost fern arms reaching out from the foot in every direction, and scattered grains and small clumps of snow near the foot, with sparkle. The mirror image shows between the arms.

How:

- The pattern is grown by a script (`assets-src/frost-winter/build.mjs`), not painted: branching growth from seeded points, on the sphere for the glass and on the plane for the slab. Each map holds, for every point, when it appears (a threshold: the rim and the foot first, the tips last), its height, and what its sparkle needs. A generated picture may guide the look; the growth stays yours so that it can be revealed.
- The frost is on the glass, so it turns with the globe when the camera moves round it: place it by direction, strong toward -x and lighter toward +x, and check it from `live.orbitYawDeg` to either side.
- Export `dressing()` from `frost.ts`, returning `{ glass, surface }`: the glass dressing is your own mesh just outside the outer surface, drawn after the shell (render order above 10), a child of the inside frame; the surface dressing is your own object on the slab at render order 2, in the world frame. Set `glassDressing.amount` to 0 so the stage's flat tint is off, and empty `standIns`. Keep the exports `standIns`, `prepare`, `glassDressing`, `surfaceDressing` and `update`.
- Lit, not painted: the key and the rim light catch the height; sparkles hold their place in time and come and go with the angle of view. No picture of the scene behind is available to a material, so soften what is behind by coverage and scatter, and say in your report what a true blur would need.
- Near the camera the things on the slab are real small shapes; further off, a picture with height, as `kit/03-METHOD.md` section 6 says.
- The arrival, in `arrival.ts`, as "The arrival" in `kit/02-SUBJECT.md` section 6 says for winter: on landing a ring of frost bursts outward from the foot, fast at first; the ferns grow on the glass from the rim inward by the threshold; everything is a pure function of `moment.sinceLanding`, and with `Infinity` it is fully arrived. It must never read as a wipe: the growth front is uneven, branch by branch. Keep the exports `prepare`, `arrival` and `update`; `arrival()` already holds the miniature's fresh things, add yours to it. You may export `arrival()` from `frost.ts` for shapes of your own.
- In a shake the dressing answers: read `f.globe` and the change (`change: 'glass-dressing'` and `change: 'surface-dressing'` on your materials). The base's icicles are the base builder's.
- At most 4 draw calls. Every material `standIn: false`.

Test: `npx vitest run`, `npm run determinism`, `npm run fit -- --tier draft --box 840,90,1200,900 --name frost-left`, `--box 1620,90,1980,900 --name frost-right`, `--box 300,1250,2600,1584 --name frost-slab`, stills from `surface`, `low` and `hero`, and frames after a landing (see `renderShakeMoment` and the sheet commands in `tools/README.md`).

Looks: the left rim beside the approved image; the slab beside it; four frames of the arrival; the frost from 35 degrees to one side.
