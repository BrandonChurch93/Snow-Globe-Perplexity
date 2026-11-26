# Handover: the master tool (agent/p6-master, agent/p6-master2, agent/p6-master3)

## Job 3 (agent/p6-master3, 2ed4a60f): what the first run on a larger machine mended

Written by master_tool_builder on 26 Nov, 10:20 UTC. Tool and tests only; the engine's hash did not move by it. The short road for a farm machine is `tools/farm/README.md` on that branch.

- `--procs`: the parent sweeps the frame folders once, then a worker reads and drops the folders of its own chunks only. `frames.json` and each chunk's record are written under another name and renamed. A key file that cannot be read marks its folder as stale.
- The first line of every run is `limits: ... GiB of memory, ... CPUs`, read from the cgroup (`memory.max`, `cpu.max` of the path in `/proc/self/cgroup` and of every folder above it; the v1 names too), else from the machine. Each chunk's record carries it as `limits`. `--procs` at `uhd` is refused over what the memory holds (4.1 GB a process, 2 GB kept: 24 GiB hold 5, 7.6 GiB hold 1). More processes than the CPUs gain from get one plain line and run. `--encode` takes its x264 threads from the same limit.
- `--local` is the installed Chrome in a window with a graphics card. It is refused where no display is.
- A stopped process: `render process N stopped at chunk FIRST-LAST, frame F: why`, the PNGs stay, and the last line is `To go on from there:` with the command as it was typed.
- `--stand-in DIR [--stand-in-fail N]` draws ramps without a browser into DIR, for the tool's own tests only (it needs one of `--samples`, `--format`, `--chunk`; its records say `stand-in` and `test`).

Run for real on this VM (hd, 1 sample, lavapipe, build 4708b960e00eb5d2): `--procs 2` over two fresh chunks, both finished, 4 min 45 s; then two more with the graphics process of one browser killed by hand at frame 215: the parent named chunk 000210-000239 and frame 215, 5 PNGs stayed, the other process finished its chunk, and the printed command rendered the 25 missing frames and no other.

Not run: more than 2 real processes; a real cgroup with a cpu.max (this VM has only memory.max); a real cgroup v1 machine; `--local` on a machine with a display.


## Job 2 (agent/p6-master2): intermediates by attachment, one encode of each master

Written by master_tool_builder on 26 Nov, 09:25 UTC. Measured on one sandbox VM: 4 cores, 7.9 GB, no graphics card, ffmpeg 8.0.1, x264 core 165, lavapipe. Where this section and the older one below disagree, this one stands: `--join` is gone, a master is made by `--encode`.

### A render agent, from nothing

```
sudo apt-get update && sudo apt-get install -y mesa-vulkan-drivers ffmpeg
git clone --depth 400 https://github.com/BrandonChurch93/Snow-Globe-Perplexity && cd Snow-Globe-Perplexity
git checkout <the ONE commit /root names for the master>
npm ci
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright-core install chromium
npm run build
npm run master -- --calibrate
npm run master -- --what film-b --first 600 --last 899 --ship agent/p6-chunks-vm07
```

- The first line of `--calibrate` must be the same on every machine. Here lavapipe printed `calibration ba63d3b2ceb11deb5db2ee01024ba807d9354f4447e9d849af15add72629607d` on main c2a3064f and on this branch's build 4708b960e00eb5d2.
- When the range ends the tool prints `to send to the joining agent by attachment: N files ...` and one line a message. Send exactly those files, in those groups of at most 10, as attachments to the joining agent. A chunk is one `.mp4` (25 to 27 MB) and its `.json`; the loop's first chunk also sends `frame-000000.png`.
- `--ship BRANCH` carries the record and the look only. The picture is never pushed.
- Run the same command again after any stop. PNGs of a chunk exist only until its intermediate has passed its check.
- All machines must be on one commit: the build hash takes in `src/` and `config/`, and `--encode` refuses chunks of two builds.

### The joining agent

One flat folder for every attachment, any order, any names for the pictures and parts. Then:

```
npm ci
npm run master -- --collect out/work/collected --files /path/to/the/attachments
npm run master -- --encode film-b --from out/work/collected
npm run master -- --encode loop --from out/work/collected
mkdir -p out/work/opening/master
git fetch origin agent/p6-opening-master
for f in manifest.json opening.bin; do git show FETCH_HEAD:out/opening-master/$f > out/work/opening/master/$f; done
npm run master -- --what opening
npm run master -- --encode film-a --from out/work/collected
npm run master -- --split out/deliver/snow-globe-film-4k60.mp4
npm run master -- --split out/deliver/snow-globe-film-with-prompt-4k60.mp4
npm run master -- --split out/deliver/snow-globe-portfolio-loop-4k60.mp4
```

- `--collect` may be run as often as files arrive; it says what is there, what is missing, and which chunk still waits for a part. Exit code 1 while something is incomplete or flat.
- Film B first: the loop reads film B's record for the quality it must reach. The sound must be in `audio/final/film-b.wav` and `film-a.wav`, or named with `--sound FILE`.
- Each `--encode` ends with one table. Every row `pass` (two rows only say `measured`): the file is in `out/deliver/`. Any `FAIL`: it is `.unproven.mp4` and not a master.
- Where the parts of a master arrive: `npm run master -- --unsplit FOLDER`.
- Tuning without touching `config/` (which would change the build hash): `--target-mb`, `--preset`, `--keyint`, `--min-keyint`, `--x264`, `--final-min-psnr`; for the loop `--crf`, `--min-crf`, `--loop-x264`, `--seam-db`; on a render machine `--crf`, `--part-mb`.

### What was run with real pictures

The 20 frames of part A (film B 60 to 69, a hold, and 660 to 669, a change; `uhd`, 24 samples, lavapipe, drawn by main c2a3064f) went through the whole path on this branch's build. Their `frames.json` was written by hand to carry this build's hash, so the tool took them as its own; nothing was rendered again. All of it ran with `--chunk 10`, so every chunk is marked `test`.

- Intermediates at crf 6: 9.03 MB (least 48.95 dB, mean 49.78) and 8.97 MB (least 50.67, mean 51.82); the second was split into 3 parts with `--part-mb 4`.
- Collect: the records, one whole chunk and two of three parts copied to a flat folder with a stranger file. First run: `NOT COMPLETE ... part 2 of 3`. Third part added, second run: put together, sha256 as recorded.
- Encode, `--encode film-b --test --gaps --target-mb 2.76 --sound` (a 0.33 s test tone, no final mix is on this machine): two passes at 64 914 kbps, 2.54 MB, every row pass, least 40.46 dB at frame 9, mean 43.06 dB against the decoded intermediates, 13 s to encode.
- Split into 3 parts with `--part-mb 1`, unsplit from a folder where every file had another name: the same sha256, and `cmp` says identical. With one part missing: `NOT PUT TOGETHER`, exit code 1.
- The loop's path, on the 10 hold frames renamed 0 to 9 by hand (not loop frames): intermediate, screenshot `frame-000000.png` (14.4 MB) by the flat folder, `--encode loop --test` at crf 18: every row pass, least 46.31 dB, frame 0 47.56 dB and the last 46.44 dB against their intermediates; against the PNGs themselves frame 0 is 46.70 dB and the last 45.58 dB (measured by hand, the PNGs do not exist on a joining machine).
- `--what opening` against the real 4K pack of `origin/agent/p6-opening-master` (e44b7e51): 867 frames, 29 chunks, 5.75 MB in all, 0.09 to 0.31 MB a chunk, least 56.9 dB.

### Not run

- No chunk of 30 frames at `uhd` and 24 samples was rendered and encoded as one. The 25 to 27 MB a chunk is a projection from 10 frames each of a hold and a change.
- `--encode film-a` (the opening's chunks then film B's) was not run: there are no film B chunks on the chunk lines here. `--encode` of a real master, with 300 frames between key frames, was not run; the 20-frame test has one key frame.
- The loop's step down (crf 18 to 16 when its least frame is under film B's best second) did not fire in the test and is covered by unit tests only.
- `--procs 2`, `--local`: never run.
- The final encode is not byte for byte repeatable (four runs, four files within 0.2 percent of one size). The intermediates are.
- `tools/briefs/p6/master.md` still describes job 1's design (`--join`, `minChunkPsnr`). I did not touch it.

### Sheets

`sheet-d-hold.png`, `sheet-d-change.png`: the dark backdrop under four final encodes at the same size. See `captions.txt`.

## Job 1 (agent/p6-master), as it was handed over

Written by master_tool_builder on 26 Nov. Everything here was measured on one sandbox VM: 4 cores, 7.9 GB, no graphics card, Node 20.20.2, ffmpeg 8.0.1, x264 core 165, the pinned Chromium. The first half of the session drew with SwiftShader, the second with Mesa lavapipe 26.0.8 (decision 139). The numbers say which.

## What is on the branch

- `tools/master.mjs`: the command (`npm run master`): `--what` (render a range), `--calibrate`, `--collect`, `--join`, `--hd`. `tools/lib/master.mjs`: the chunk lines, the join plan, the cover report, PSNR, the flat and mean checks. `tools/lib/mastergit.mjs`: shipping and collecting through clones of their own.
- `tools/lib/encode.mjs`, `tools/lib/frames.mjs`, `tools/lib/page.mjs`: additions only (`masterVideoArgs`, `encodeMasterChunk`, `toolVersions`, `decodedHashes`, `decodedPictures`, `frameLevels`, `probeStreams`, `startsFast`, `scaleEvery`; `join` takes a sound bit rate and a channel count; `pngOk` is exported; `FLAT_FRAMES`, `flatValue`, `refuseFlat`, and the lost-context and crash checks in `Session.grab` and `grabStage`).
- `src/config.ts`: `tierSamples` takes `samples-N` (1 to 999) beside the tier names. That is the one change under `src/`.
- `config/showcase.json`: `deliver.master` as the job file gives it and `deliver.sandboxMaster: true`, with their checks and a test.
- `tests/master.test.ts`: 32 tests. `tools/README.md`: the last section. `package.json`: the `master` line.

## What a render machine runs, from nothing

```
sudo apt-get update && sudo apt-get install -y mesa-vulkan-drivers ffmpeg
git clone --depth 400 https://github.com/BrandonChurch93/Snow-Globe-Perplexity && cd Snow-Globe-Perplexity
git checkout <the commit of the master>
npm ci
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright-core install chromium
npm run build
npm run master -- --calibrate
npm run master -- --what film-b --first 600 --last 899 --ship agent/p6-chunks-vm07
```

The first line of `--calibrate` must be the same on every machine. Here, for winter at rest, lavapipe printed `1ffe828c205c8bd32a92f2dff79fcc1b43719b63430c584b3a9fc86c24116c74` on two builds (main f00a7aab and 4d04864e). The first `apt-get install` here said the package had no candidate; after `apt-get update` it installed.

The joining machine: `npm run master -- --collect DIR`, `npm run master -- --join film-b --from DIR` (then `film-a`, `loop`), `npm run master -- --hd film-b`, `npm run film -- --which b --from-hd --tier final`, `npm run keep -- --film`.

## Things found on the way that change the plan

1. Lavapipe is far faster than SwiftShader on this VM and uses all four cores. Film frame 60 alone: `hd` 8 samples 15.6 s against 142 s; `uhd` 24 samples 128.7 s (5.4 s a sample) against about 70 s a sample. A second process on the same VM can gain nothing and costs 3 GB.
2. `deliver.master.minChunkPsnr` 40 cannot be met over RGB (a 4:2:0 encode holds RGB down), so the check measures BT.709 luma. One `uhd` chunk was made, at 4 samples under lavapipe (frames 0 to 29): 6.77 MB, 28.9 s a frame, encoded in 21 s; its decoded frames were 40.9 dB (first), 38.6 (middle) and 33.1 (last) from their PNGs in luma, so it was kept only with `--min-psnr`. Grain that changes every frame cannot be predicted, and the frames after the key frame pay for it. Whether a chunk at 12 samples holds 40 to its last frame is not measured: one render agent should make one chunk before the others start. If it fails, the choice is between more samples, a lower floor for the frames after the key frame, or other encoder settings.
3. ffmpeg 8 left the colour primaries and the transfer of every chunk unknown although the encoder was given them. The join's table caught it. The tags are now set on the frames and in the x264 parameters, and a chunk is checked for all four when it is made. The older encodes in `tools/lib/encode.mjs` pass the same options and were not looked at.
4. A machine out of memory draws black frames without an error (found by render_speed_prober). The guards are in the README section. Checked at `preview`, `draft`, lavapipe: film B frames 0, 1, 3598 and 3599 and the loop's frames 0, 24, 48 and so on to 456, and 479 are none of them flat (darkest 0, brightest 255 in every one), so `FLAT_FRAMES` names no exception. `npm run determinism` passed with the guards in (3 pictures, 4 page loads, 174 s) and a still with `--diag standins` is still written, all black.

## Measurement c, uhd, lavapipe, against 24 samples

Whole frame PSNR / SSIM, then the globe's rectangle. Seconds are for the frame alone.

- Rest, frame 60: 4: 32.25 / 0.9309, 31.94 / 0.9178; 8: 36.10 / 0.9579, 35.78 / 0.9521; 12: 37.80 / 0.9687, 37.51 / 0.9654; 16: 40.21 / 0.9798, 39.82 / 0.9776. 24 samples took 128.7 s.
- Storm, frame 644: 4: 35.10 / 0.9579, 34.15 / 0.9300; 8: 38.95 / 0.9768, 38.29 / 0.9642; 12: 40.60 / 0.9823, 39.36 / 0.9724; 16: 42.92 / 0.9878, 41.77 / 0.9811. 16 samples took 87.3 s, 12: 67.0, 8: 43.1, 4: 23.4.
- Season change, frame 666: 4: 32.81 / 0.9217, 30.29 / 0.7885; 8: 37.69 / 0.9568, 34.63 / 0.8836; 12: 38.41 / 0.9656, 35.43 / 0.9146; 16: 39.74 / 0.9726, 36.99 / 0.9365. 16 samples took 137.1 s, 12: 105.3, 8: 68.8, 4: 36.9: this frame costs 8.6 s a sample, 1.6 times the others.

## What was run by hand

- At `preview`, SwiftShader: a range of two chunks, killed with `kill -9` during frame 7 and run again (`53 frames to render (7 more are on disk as PNGs)`), shipped to `agent/p6-chunks-test`, collected into a fresh folder, joined from that folder alone with a 1.0 s sound. The second pass of this, after the colour tags were mended, passed every row of the table.
- `--hd film-b --test` on that joined file: 30 frames at 30 a second, half the size, 20 Mbps; frame k of it is 39 to 42 dB from frame 2k of the master scaled the same way, and 17 to 19 dB from frame 2k + 1.
- `--calibrate` under both renderers. `--what opening` against a made-up pack of 960 x 540 through a stand-in reader (not the real `openingpack.mjs`).
- Refusals seen: a range off the chunk lines, a join of chunks whose encoder arguments differ, `--min-psnr` without a test, a range without a calibration.

## Not run

- `--procs 2` and `--local` were never run. `--join film-a` and `--join loop` were never run to the end.
- No `uhd` chunk at 12 samples, no real master, no join of `uhd` chunks. The new flat-frame refusal in `--collect` and `--join` was run only on the test chunks. A lost WebGL context was not provoked: that guard is read, not seen to fire.
- `npm run render:local -- --proof --rehearse` was started under SwiftShader, ran normally for 14 of 60 frames and was stopped for time.
- No neighbour-frame (flicker) measurement under lavapipe, and none at all for the storm and the change.
- The hd card loop and the card still from the 4K loop: not built. `npm run loop` joins its own chunks in `out/work/loop/<format>-<tier>/` and writes `out/work/loop/card-loop.mp4`, `card-loop-web.mp4` and the card still, which `npm run keep -- --deliver` copies by name. To come from the 4K loop it needs a flag that takes `out/deliver/snow-globe-loop-4k60.mp4` as the source of `card-loop.mp4` (every second frame, scaled, as `--hd` does) and the loop's frame 0 PNG, which `--join loop` already writes beside the master, as the card still.

## Not mine to mend

- `.gitignore` does not name `out/master/` or `out/deliver/`.
- `Session.open` waits for the clone's render lock without a word. The master says so itself before it waits.
