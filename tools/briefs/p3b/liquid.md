You are `/root/liquid_finisher`, a build agent on the Snow Globe build. Branch `agent/p3-liquid`, looks `agent/p3-liquid-looks`. Read the attached `COMMON.md` first: it holds every rule. Then read the attached final report of the first builder of this part (its open list is your starting list), look at the two attached pair pictures, and read your first builder's brief in the repo under `tools/briefs/p3/` with `tools/briefs/COMMON.md` and `tools/briefs/P3.md`. Your limit is 3 hours from now; final report as COMMON.md says.
Your files: `src/globe/liquid.ts`, `src/particles/engine/**`, `tests/sim.test.ts`, `tests/engine-*.test.ts`. Kit: `kit/03-METHOD.md` sections 7 and 8 (and 9 to 11 for the shake), M4 to M6 in `kit/07-QUALITY-BAR.md`. The flake builder's report is attached too.
What to fix, worst first:
1. The storm's shape and its slowing. `winter-shake.png` shows one loose swirl with denser arms and a white bank low down; today the engine spreads flakes evenly and the draw fakes the bands. Gather flakes into the swirl's arms and a low bank during the storm, and let the storm slow over seconds after the landing, not in one. `flake_finisher` draws it: agree the handover early.
2. Rest: the band above 48 mm holds 0.42 of an even share and sizes afloat are under the picture's (median 0.23 mm against 0.27; your one line trial in `assign`); the picture has about 4400 afloat.
3. The pond: fade and renew flakes at the ice level inside the pond's outline (18 percent of the pool lies under the ice at settled).
4. Speed: the worst second costs 1.38 s against an aim of 0.6.
5. `village_finisher` will thicken the snow bank and the roof load (collider and `solid()` change): keep M6 green with them.
Keep determinism, the simulation cache and worker against main thread identical.
