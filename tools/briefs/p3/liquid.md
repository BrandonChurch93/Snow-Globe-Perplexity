# liquid_builder · branch `agent/p3-liquid`

Also read, every line: `kit/02-SUBJECT.md` sections 4, 5 and 6; `kit/03-METHOD.md` sections 7, 8 (with "Replaying the simulation") and 10; in `kit/04-LOOK.md` the ladder steps "The particles look like confetti or a filter" and "The storm does not hide the change"; in `kit/07-QUALITY-BAR.md` the measures M4, M5 and M6 and the critic R4; open items 2, 3, 6, 20 and 21 in `kit/PROGRESS.md`.

You own: `src/globe/liquid.ts`, everything under `src/particles/engine/`, `tests/liquid.test.ts`, `tests/sim.test.ts`, and new tests you name `tests/engine-*.test.ts`.

Goal: the liquid and the simulation of winter's two kinds, `flake` and `glitter`, moving as a real globe's do: a storm that fills the whole dome after a shake, slows over seconds, sinks at many speeds, comes to rest on what it meets, builds up, and is thrown back by the next shake. The parts are `liquid` (its model) and `particle-engine`. How a particle is drawn belongs to another builder.

What must be true:

- The liquid is the small model of `kit/03-METHOD.md` section 7, a pure function of the seed and the globe's motion so far, stepped at `sim.stepHz`.
- Open item 3: the flow treats the ground as a wall to slide along, as it does the glass, so a landing storm fills the dome evenly as in `references/approved/winter-shake.png` and does not press into a low layer. Use the season's distance field for it; it will change shape when the real miniature lands, so tune to nothing in the stand-in.
- Open item 6: real sizes and sink speeds. `sizes[i]` is a particle's real diameter in millimetres. The approved image shows flakes of many sizes, most of them small and a few large; measure them (the glass is 120 mm across and 1098 px wide there) and give the spread a long tail. The table in `kit/02-SUBJECT.md` section 4 gives how each kind behaves in still liquid.
- At rest (`states.restSeconds` after a landing) flakes still drift through the whole dome as `references/approved/winter-rest.png` shows, a little denser low down; settled (`states.settledSeconds`) far fewer float and more lie. Read the `settled` lines of both keys in the config.
- Coming to rest, lying, and being thrown back, as section 8 says. M6: the share inside a solid is at most `sim.maxInsideFraction` and none is outside the sphere, in every judged state.
- Building up: fill `ParticleSource.cover` as `tools/briefs/P3.md` defines it, from what lies at rest. After `states.settledSeconds` a roof holds a fresh layer a critic can see; nothing exceeds `COVER_MAX_MM` in `src/core/chunks/cover.ts`; a shake clears nearly all of it.
- The storm serves the swap: through the swap window the particles are spread through the whole sphere and the turbulence is high, so the veil can hide the miniature (M4); `shake.settleCheckSeconds` after the landing the miniature is seen again (M5). The veil itself is another builder's; give it the state it needs and report M4 and M5 as they stand.
- Open items 2 and 21: speed. The storm's worst second cost 2.3 s of work for one simulated second at winter's full pool. Aim for 0.6 on your VM, measured by a bench you commit, by repacking the per-particle data and cutting work per step, never by changing what the same seed gives on another machine. The worker and the main thread give identical results.

Contract:

- `ParticleSource` in `src/core/stage.ts` is fixed. Keep the exported `LIQUID_*` indexes and their meanings (the glass and the veil read them); append if you add a number.
- Counts stay inside `particles.tuneMin` to `particles.tuneMax` times the config's values; if you want a count moved, say the number in your report.

Test: `npx vitest run`, `npm run determinism`, `npm run simcache`, `npm run measure` for winter (see `tools/README.md`), a sheet across the test shake, and stills at `landed`, `rest` and `settled` from `hero`.

Looks: a sheet across the test shake; the storm at the landing beside `winter-shake.png`; rest beside `winter-rest.png`; the `cover` view at the swap.
