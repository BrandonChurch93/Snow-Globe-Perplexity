# gate_checks_builder · branch `agent/tools-checks`

Also read: `kit/07-QUALITY-BAR.md` from the top through "Freshness", and "Judged stills and frames"; "Hosting" in `kit/05-ARCHITECTURE.md`; `kit/09-QA-GAUNTLET.md`.

You own: `tools/gate.mjs` (it exists: add to it, keep its shape, keep the checks it has), `tools/hostcheck.mjs`, `tools/lib/checks.mjs` if you want to split.

Add the checks the gate does not have yet, each exactly as the table words it, each with a detail line that states what was measured:

- G4, film part: `film().frameCount` against `cut/CUTLIST.json` (`frameCount`). Skipped with a clear line if the cut list does not exist.
- G5: a still without `interface` holds no interface pixel: render it, grab the canvas (`Session.grab`) and the stage (`Session.grabStage`), they must be pixel-identical, and `#ui` must be empty or hidden in `capture`. Same for a few frames of film B and of the loop. Every still in `config.stills` whose `interface` is true shows the controls: `[data-control="shake"]`, four `[data-control="season"][data-season]` and `[data-control="sound"]` are present and visible, and the stage grab differs from the canvas grab.
- G6: the page starts (startup validation throws otherwise), and every id from `dev.judged()` appears as a code span in the "Judged list" section of `kit/PROGRESS.md`, a table `Id | Unit | What`.
- G7: lengths, from `film()`, `opening()` and the config. The size limit is computed from the bitrates.
- G11: for every frame of the film, read `filmState(i)` (no rendering): every value of `change` is 0 or 1 outside the swap windows of `film().swaps`. Same for the test shake (`dev.testShake()`, `dev.testShakeState(i)`) and for the loop (`dev.loopState(i)`, where every value must not change at all).
- G12: for every shake of `film()`/`cut/CUTLIST.json` `shakes` (`first`, `liftEnd`, `landing`): `globe.heightMm` above zero from `liftEnd` until the frame before `landing`, the landing frame is in `barLines`, and `filmState(first).camera` equals `dev.pose('hero')` within a small tolerance you state.
- G13: the three tests of "Loading and memory" in `kit/05-ARCHITECTURE.md`, with `--unit ID` and the coverage rule of the table. The register is `parts/PARTS.json` (read `tools/parts.mjs` for its shape).
- G14: `renderLoopFrame(loop().frameCount, tier)` is pixel-identical to frame 0, at `draft`.
- G15 and G16 as worded. G16 reads the result of `tools/hostcheck.mjs`.
- D2 to D6 as worded. D2 and D3 compare the record beside the file with the current engine hash (`engineHash()` in `tools/lib/hashes.mjs`); D3 reads `out/work/local/proof.json`.
- `tools/hostcheck.mjs`: as "Hosting" says: build from a clean copy of the tracked files in a temp folder (`git ls-files`, copy, `npm ci`, `npm run build`), then report the size of `dist/`, the largest file, the bytes fetched before the first complete picture in `live` (the page sets `document.documentElement.dataset.firstPicture = '1'`) and the build time, to `out/work/hostcheck/result.json`.

Which phase each check is due from is in the tables: use `from` and `at` as the file does. `npm run gate -- --phase 2` must run every check due there and print a pass or fail line for each. A check whose inputs do not exist yet fails with a line that says what is missing. Test each check on the scene as it stands and report each line it prints.
