# flake_builder · branch `agent/p3-flakes`

Also read, every line: `kit/02-SUBJECT.md` sections 3 (Winter) and 4; `kit/03-METHOD.md` section 8; in `kit/04-LOOK.md` sections 2, 4, 6 and 8 and the ladder steps "The particles look like confetti or a filter", "The storm does not hide the change" and "The picture shimmers or crawls"; in `kit/07-QUALITY-BAR.md` the measures M4 and M5 and the critics R3 and R4.

You own: everything under `src/particles/draw/`, `src/core/chunks/veil.ts`, `src/seasons/winter/veil.ts`, `assets-src/flakes/`, files named `assets-full/shared/flake-*` and `assets-full/winter/flake-*`.

Goal: how winter's particles and its veil look. The parts are `particle-flake`, `particle-glitter` and `veil-winter`. Where the particles are and how they move belongs to another builder; you read `ParticleSource`.

What the approved images show, and what must be true of yours:

- `winter-rest.png`: flakes of many sizes all through the dome. Far ones are tiny specks. Those in focus are soft irregular clusters with several lobes, never discs. A few near the front glass are large soft out-of-focus discs, fainter as they grow. Near the lamp, the window and the tree's lights they are warm; elsewhere blue-white. They take the scene's light (the light grid inside, the key through the glass), so they have a lit side.
- `winter-shake.png`: a dense storm. Streaks along the motion. A bright lit haze that hides more than half of the miniature. Tiny warm sparks of glitter.
- A flake has thickness: several crossed cards or a small shape, from a set of variants built by script or generated, turned by the particle's own turn (`phase`).
- Blur by depth: a particle's disc grows with the lens's blur circle at its depth (`f.focalPx`, `f.blurMm`, the pose in `src/scene/cameras.ts`, `uCoc` in `src/core/materials.ts`) and its brightness falls as it grows, so energy holds.
- Glitter is a tiny flat mirror: nearly unseen until its face, turning with its `phase` and the time, throws a light at the eye; then a short bright flash that the glow picks up. A flash is a pure function of the particle and the time.
- What lies at rest is drawn lying, flat to what it lies on, and merges into a layer where `stageCover` says much lies.
- Hashed coverage, nothing sorted. Motion blur: with a `sample` each particle sits between `prev` and `pos` by `moment.mix`; live, with `sample` null, it is stretched along its velocity. In a storm they streak; the miniature does not.
- The veil is a lit volume: its density follows the liquid's turbulence, it is lit by the light grid and the key along the path through the sphere, it is uneven like stirred water and not a flat tint, it can hide the miniature almost completely at the height of a storm (M4: at least `shake.minCoverAtSwap` of the miniature's pixels at `shake.coverOpacity` or more in the `cover` view) and it is gone at rest (M5).

Contract:

- Keep the names and signatures of `VEIL_FRAG_PARS`, `VEIL_FRAG`, `veilUniforms`, `updateVeil`, `stageVeil(float path)` and `stageFogged(vec3 col, vec3 lit, float fog)`: `src/core/materials.ts` and the glass use them. Keep what `src/scene/stage.ts` calls in `src/particles/draw/` (`rg -n "particles/draw" src`).
- The live app draws the first `quality.particleFraction` of the particles by index.
- At most 4 draw calls. Clear the `standIns` in `src/seasons/winter/veil.ts` and the flag in `src/particles/draw/points.ts` when the kinds are real.

Test: `npx vitest run`, `npm run determinism`, `npm run measure` for winter (see `tools/README.md`), a sheet across the test shake, stills at `landed`, `rest` and `settled` from `hero` and `macro`, and the `cover` view.

Looks: flakes at rest beside the approved image at full size; the storm beside `winter-shake.png`; a close view of single flakes and of glitter flashing; a sheet across the shake.
