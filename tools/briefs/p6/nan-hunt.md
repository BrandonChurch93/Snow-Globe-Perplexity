# The hunt: values that are no number in the 4K frames

Read `tools/briefs/p6/COMMON.md` first (the repo's rules, the strict rule for shader arithmetic, how to work), then this file to the end. You are the engineer of this job and you work on a farm machine, where a 4K frame at 24 samples takes about 80 s. Your branch is `agent/p6-nan`, started from `origin/main`. Your limit is 90 minutes from your start message; the first message to `/root` (step 2 below) is due inside 25 minutes.

## What was found
MEASURED by `farm_machine_2` at 13:03 UTC on Nov 26, on `bbc967b4` (engine `7bed76e87f414806`; no file under `src/` or `config/` has changed since), standard driver, calibration `ba63d3b2ceb11deb5db2ee01024ba807d9354f4447e9d849af15add72629607d`, through `npm run master -- --what film-b --first 0 --last 29 --procs 2 --ship ...` (3840 x 2160, 24 samples):

`[0] NOT A NUMBER: film-b frame 4 holds 3 values that are no number in its mean, before the lens and the grade. Its chunk is marked NOT A NUMBER and no master is encoded from it. [...] Do not draw it again hoping: the same frame draws the same values.`

The same line for frames 6 and 8. Frames 0 to 3, 5, 7 and 9 printed none. These are the first frames of the shot `open`: winter, the macro camera on the cottage, the lamp post and the foot of the tree. The kept pictures are on that machine under `/tmp/sg/m1/out/work/master/film-b/not-a-number/` (ask `/root/farm_machine_2` for a file if you need one; it is asked to send `/root` the place of the speck).

Every judged still passes M1 at `hd` (no invalid or infinite value before lens and grade), and the strict run passes. So this shows only with more pixels, other lens points or these frames.

## What is known about the path
- `window.showcase.dev.sanity()` is `Accumulator.invalid()` in `src/core/accumulator.ts`: it reads the mean and counts every value of the four channels that is not finite. Infinite counts as much as no number. 3 values is most likely one pixel's red, green and blue.
- The sample target is a half float whatever the mean is (`sampleType`, line 323). A half float holds at most 65504: a sample brighter than that is written as infinite. The mean's pass then gives `m + (s - m) * w`, which is infinite at that sample and no number at the next one. So one over-bright sample in 24 is enough, with no open case anywhere.
- The two classes to tell apart: (a) an open case of the arithmetic (the list in `COMMON.md`), which the strict rule says is mended at its cause; (b) an overflow: a term that can grow without bound (a highlight on a smooth surface under a strong light, a division that comes near zero, a sum of bright sprites), which is a firefly: it would also flash for one frame and glare through the lens, in the films and in the live app on a visitor's graphics card.

## What to find, in this order
1. Reproduce frame 4 at `uhd`, 24 samples, with the film's own path (the picture function of `tools/master.mjs`, around line 250: `run.frame(track, page, index)` then `dev.sanity()`), without drawing a chunk. Say the count you get.
2. Where and what: the pixel (x, y from the top left), the channels, and whether each value is plus infinite, minus infinite or no number; which of the 24 samples first carries it (read the sample target after each sample, not only the mean) and what its value is in the samples before and after; and what is drawn there: the part by the `ids` view at that pixel in the same frame at the same size, and the material and shader that part uses. The same for frames 6 and 8. Send this to `/root` as ONE short message as soon as you have it, with a crop of 400 x 400 native pixels around the place from the graded picture and from the `ids` view. Then go on without waiting for an answer.
3. Why: the term in that shader that gives the value, with the numbers that feed it at that pixel and sample (print them through a diagnostic build if you must; never commit a diagnostic print).
4. How bright the picture is meant to get: the largest finite value in any sample over frames 0 to 9 at `uhd` without that pixel, and at the brightest things of each season at rest (the flare on the glass, the lanterns, the lamp), so that a bound can be set far above everything intended.

## The mend
- Class (a): at the cause, as the strict rule says. Then `npm run strict -- --keys <keys the shader can touch>` must print `pass`.
- Class (b): bound the term at its cause where it has a physical bound (say what the bound stands for). And one guard where a sample is first read, in the mean's pass and in the live path's first read of the scene's target, that brings a value that is plus infinite or above the bound down to the bound and leaves a value that is no number as it is, so that M1 and the masters' count still catch an open case. The bound is one number in `config/showcase.json` (you may add that one key; say its name), at least four times the largest value step 4 found, and under 65504. Do not write a guard that turns no number into a number.
- The picture must not move where no such value was: prove it on two judged stills (`winter-rest` and `summer-rest`, `hero`, `hd`, `draft`): the file hashes before and after are equal, or say exactly which pixels differ and why.
- Files: `src/core/accumulator.ts`, `src/capture/showcase.ts` (the `dev` interface only), `config/showcase.json` (the one key), tests of your own under `tests/`, and a tool of your own under `tools/` (below). The shader or material at the cause: send `/root` one line naming the file before you edit it and go on; undo it only if `/root` says another builder owns it.

## The tool for the wide look
Three frames of the first ten is too many to be the only place. Write `tools/sanity-scan.mjs` (and its line in `tools/README.md`): `node tools/sanity-scan.mjs --what film-b|opening|loop --first A --last B --step S --samples N [--format uhd]` draws each frame it is given with N samples and prints one line for every frame that holds a value that is not finite: the frame, the count, the first place, the kind, the part at that place; and a last line with the frames drawn, the frames with such a value and the seconds per frame. It exits 0 when it could draw, whatever it found. Also let `dev.sanity()` give the first place and kind beside the count, so that the masters' own line can name it later (do not edit `tools/master.mjs`; that is `master_tool_builder`'s file, send `/root` the lines you would want there).

`/root` hands the scan to the other farm machines as soon as your branch holds it, before and after the mend. So push the tool first, then the mend.

## Proof and report
- After the mend: frames 0 to 9 of film B at `uhd`, 24 samples, each with count 0, and the graded pictures of frames 4 and 5 beside each other at the place of the speck (crops, before and after).
- `npx tsc --noEmit`, `npx vitest run`, `npm run determinism`, the strict run on the keys you touched, the engine hash before and after.
- Merge `origin/main` into your branch before every push; never rebase, never force; every commit by naming paths, with the author and the trailer `COMMON.md` gives.
- Report to `/root` as ONE message of at most 30 lines: the cause in two sentences; the class; what you changed and where; the proofs with their numbers; what the scan found on the frames you ran it on; what you did not see; your branch's head. At most 4 pictures.
