# Handover of the surface job (`agent/p5-surface`), written 17:28 UTC, 2026-11-25

For the agent that takes `src/scene/surface.ts` and `src/miniature/mirror.ts` in the next polish round. The report of this round is `REPORT.md` beside this file. Line numbers are those of the tip `5ba8eaf`. Nothing here was rendered after 17:08 UTC.

## What is on the branch

Three code commits, all in `src/scene/surface.ts` only: `9ace369` (the mirror image of the foot's underside is dark felt lit through the slot, lines 458 to 463 and 494 to 495; the mirror fade is measured from the foot's level), `5c883e5` (the shadow leans with the globe and opens from the foot's own rim, `slabRim` line 213, the shade lines 220 to 230, `shadeOpen` line 131), `7d933d0` (the baked image at `low`, lines 477 to 490, constants `bakedFoot` to `bakedThrough`, lines 116 to 121). The four rest keys and `winter-shake` are byte-identical to the kept ones (three of them proven at the final tier, see the report).

## Items not mended: cause, next change, proof

### Item 161 (fall, frames 2808 to 2819): the hard-rimmed dark oval under the lifted globe

- Cause: not in the surface. `src/seasons/fall/slab.ts`, `RIM_FRAG`, `main()`. Line 224 `out2 = P.xz - uFoot.xy - uLean.xy` carries the dressing with the foot. Line 229 (the dust `line`, 1.6 mm outside the rim) and line 230 (`skirt`) fade only by `down = exp(-lift / uRimLook.w)` (line 227) with `uRimLook.w` 7 (line 280), so 0.37 of the line is left at the 7.25 mm lift. Lines 237 and 239 cut the lanterns' light on the slab at the rim with `smoothstep(-2.0, 3.0, gap)` and `smoothstep(-1.0, 2.0, gap)`: a 3 to 5 mm edge that does not open with height.
- Change tried locally, seen on frame 2808 at the review tier (picture `fall-2808-kept-after-fix.jpg`, bottom row): line 236 `* dust * down;` to `* dust * down * exp(-lift / 1.2);`; line 237 to `smoothstep(-2.0 - 3.0 * lift, 3.0 + 1.0 * lift, gap)`; line 239 to `smoothstep(-1.0 - 3.0 * lift, 2.0 + 1.0 * lift, gap)`. The thin line and the hard edge go. At lift 0 all three equal today's values, so `fall-rest` and `fall-shake` should stay byte-identical; that was not rendered. The numbers 1.2, 3.0 and 1.0 are a trial: they belong in the file's constants, and 1.2 should be the surface's `SLAB.contactLiftMm`.
- Do not change `uRimLook.w` itself: line 239 also multiplies the lanterns' mirror image by `down`, and that image should stay when the globe is lifted.
- Still bad after the trial, and the next changes: (1) the leaves under the foot are as bright as those in the open: line 188 `lit += candleOnSlab(vStageWorld, n, uFoot.w) * 3.2` and the `occl` of `slabLight` have no shadow of a lifted foot; multiply the lanterns' term by the same widened gap term as line 237, measured at the leaf's place. (2) The pool under the foot is wide and nearly black with no readable mirror image of the base. In `surface.ts` the image of the underside (`underSeen`, line 463) is felt at `underFelt` 0.3, and fall's base is dark; try letting the lanterns' colour into `underSeen` through the slot, which needs fall's face uniforms in the slab shader, or raise `underKey` for a low warm source.
- Proof: `npm run seq -- --first 2808 --last 2819 --tier review --look no` in the kept tree and in yours, then pairs of the crop (300, 400, 760, 540) of the 1149 px wide frames; then `npm run still -- --key fall-rest --tier final --force` and `--key fall-shake`, with `sha256sum` against the kept hashes.
- Winter's frost has a front tied to the foot of the same kind (`src/seasons/winter/frost.ts` lines 256 to 263, and line 283 `slabCast` with `uFoot.w`); spring's petals read `uFoot` at lines 107 to 109 of `src/seasons/spring/slab.ts`. Neither was tested for a hard rim at the lift.

### The shadow at the lift (step 2): half done

- Where: `surface.ts` lines 213 to 230. `tight` (lines 222 and 228) closes the contact shadow by `exp(-lift / contactLiftMm)`; `open` (line 230) widens the ambient shade by `shadeSoftMm + shadeOpen * lift`.
- What the pictures show: a small change at draft on frame 660 (winter); in fall it is hidden under the dressing's own rim. Two tries that changed nothing on frame 2808 and were taken out: fading the haze with the rim's gap, and a wider cast and ambient penumbra.
- Next: land the fall change above first, then judge the shadow on frames 2808 to 2819 and on winter frames 650 to 670. If the shadow is still a disc, raise `shadeOpen` (1) and make the cast's offset `lift * keyDir.xz / keyDir.y` visible: draw the surface's shade alone with a local probe (paint the diffuse term red, the near mirror green, the far mirror and sheen blue) before you believe any number.
- Proof: the same twelve frames at review, kept over yours, and the four rest keys by hash.

### Item 160, second half, and items 72 and 126: seen at the final tier on one frame only

- The mirror image at the lift and at the landing is mended at draft on 716 to 727 and at final on 718. The image under the foot is dim. Not seen: the landing at review or final as a run of frames, the strokes at peak lift, shake-2 and shake-3.
- Next: `npm run seq -- --first 716 --last 727 --tier final --format hd --look no` in both trees (about 10 minutes a frame here, so 4 hours for both; choose 3 frames if time is short: 718, 720, 723).

### Item 169 (`low`): mended with limits

- Where: `surface.ts` lines 477 to 490, the `uReflect.y` branch. The mirrored base is one flat colour (`uBaked`, line 486), almost black in spring; no shells, icicles or gold line; the glow (`bakedGlow` 0.2) is dimmer than the planar image at `high`; winter's cool edges of the dome are missing.
- Next: give the baked base two tones (the season's base colour above, its foot trim below, both already known to the stage) and raise `bakedGlow` toward the planar image's measured mean; compare at phone, tablet and hd.
- Proof: live stills at rest on the phone layout at `low` and `high`, four seasons (`q/livef.sh` pattern below). The tan band only shows on the phone layout (390 by 844), not at hd.

### Step 4, the mirror at rest (items 67, 79, 114, 115, 144, 146): not taken

- Where: `surface.ts` lines 358 to 369 (the planar mirror's blur: `roughSpread` 0.03 line 88, `mirrorMaxPx`, `mirrorTaps`, the `lod` of line 361) and the fade `fadeHeightMm` 170, `fadeFloor` 0.3 (lines 100 to 101).
- What the pictures show: in `references/approved/winter-rest.png` the gold rope rim and the icicles are crisp in the table right under the contact; ours shows almost none there (a dark contact shadow, a hint of gold at the frame's bottom), and our frame shows less table under the foot.
- Next, in this order: the blur must start at zero at the contact line and grow with the mirrored point's height (check that `tall` and `lod` go to 0 as `reach` goes to 0, and that the contact shadow does not cover the first millimetres of the image); then break the column of light; then clamp the fireflies; then the dust and the green edge.
- This moves all eight keys. Render each kept key beside yours at the final tier and beside the approved image, crop the table under the foot, and say per key what got better and worse. If one season gets worse, leave rest byte-identical.

### The dressing does not stir at the lift (not this job's files)

- Frost, petals and leaves should read the globe's height (`globe.heightMm` in the state, already in their shaders as `uFoot.w`) and the lean (`uLean.zw`) while the globe is in the air. Today `setJump` and `setSkitter` clamp at 0 in the air.

## Commands that drew the pictures

- Trees: the work tree at the branch; `kept` at `origin/main` as it stood at the start (`8e5798b`) for every "before"; `proof` detached at the commit to prove; `probe` for local trials that are never committed. Each tree needs `npm run -s build`; the simulation cache was made once with `npm run -s simcache` (3.5 minutes) in `kept` and in `proof`.
- Twelve frames, kept and mine: `node tools/seq.mjs --first 2808 --last 2819 --tier review --look no`, run again while it exits with 3 ("run the same command again to carry on"). Frames land in `out/work/seq/film-preview-review/film-00NNNN.png` (1149 px wide). The sheet is pairs of the crop (300, 400, 760, 540), kept above mine, three pairs a row.
- The fall trial: the same command for `--first 2808 --last 2808` in `probe`; crop (300, 420, 760, 540) enlarged twice.
- The landing: `node tools/seq.mjs --first 716 --last 727 --tier draft --look no` in both trees, crop of the foot line enlarged twice; and `node tools/seq.mjs --first 718 --last 718 --tier final --format hd --look no` in both trees, crop (520, 880, 1400, 1080) at native size.
- `low`: live stills at rest on the phone layout at `low` and `high` for each season, in `kept` and in the work tree, lower part of the frame.
- Keys: `npm run -s simcache`, then `npm run -s still -- --key winter-rest --tier final --force` and `sha256sum out/work/stills/winter-rest-hd-final.png`.
- Proofs: `npx tsc --noEmit`, `npx vitest run`, `npm run -s build`, `npm run -s determinism`, `npm run -s gate -- --phase 4 --only G11,G12`.

## Traps

- The draft tier lies about the oval. I read fall's oval as gone on one draft frame (2816) and wrote it in a caption; the review frames showed it unchanged. Judge the lift at review, on consecutive frames, kept beside yours.
- The oval is two things. In winter into spring it was the surface's mirror image of the underside; in fall it is the season's dressing. A layer probe (each term in its own colour) settled it in ten minutes after an hour of guessing.
- The shake keys do not show the lift: the `landed` state is 0.5 s after the landing and the settle is 0.4 s, so they prove nothing about the lift. Only film frames do.
- At hd the `low` level's tan band does not show; it shows on the phone layout.
- `pkill -f "q/chain.sh"` did not kill a script started as `./chain.sh`. It went on and ran a second render beside mine for 18 minutes; the determinism run in that time failed with an error at `Session.page`. Check with `pgrep -fa "chain|still.mjs|seq.mjs"` before every render, and name scripts by their full path.
- Costs here, one render at a time: a review preview frame in the storm 100 to 130 s; a draft frame 17 s in a run, 70 s alone; a live still 35 s; a final rest key 4.5 to 5 minutes; `winter-shake` at final 17 minutes with another render beside it; one final hd film frame 9 to 10 minutes; determinism 6 minutes; vitest 75 s; the gate for G11 and G12 30 s. Twelve final frames in two trees do not fit in a two hour job.
- Background jobs die with the command that starts them; start chains with `(set -m; cmd > log 2>&1 &)` and poll a line file.
- A second tree can share the first one's simulation cache by hard links only if the engine hash in `dist/build.json` is put in the folder names; a proof tree should make its own with `npm run -s simcache`.
- Line numbers in other owners' files move with merges; read them again on the tip before you quote them.
