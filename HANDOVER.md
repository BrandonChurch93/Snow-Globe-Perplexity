# Handover: the master tool (agent/p6-master)

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

## What was run by hand

- At `preview`, SwiftShader: a range of two chunks, killed with `kill -9` during frame 7 and run again (`53 frames to render (7 more are on disk as PNGs)`), shipped to `agent/p6-chunks-test`, collected into a fresh folder, joined from that folder alone with a 1.0 s sound. The second pass of this, after the colour tags were mended, passed every row of the table.
- `--hd film-b --test` on that joined file: 30 frames at 30 a second, half the size, 20 Mbps; frame k of it is 39 to 42 dB from frame 2k of the master scaled the same way, and 17 to 19 dB from frame 2k + 1.
- `--calibrate` under both renderers. `--what opening` against a made-up pack of 960 x 540 through a stand-in reader (not the real `openingpack.mjs`).
- Refusals seen: a range off the chunk lines, a join of chunks whose encoder arguments differ, `--min-psnr` without a test, a range without a calibration.

## Not run

- `--procs 2` and `--local` were never run. `--join film-a` and `--join loop` were never run to the end.
- No `uhd` chunk at 12 samples, no real master, no join of `uhd` chunks. The new flat-frame refusal in `--collect` and `--join` was run only on the test chunks. A lost WebGL context was not provoked: that guard is read, not seen to fire.
- `npm run render:local -- --proof --rehearse` was started under SwiftShader, ran normally for 14 of 60 frames and was stopped for time.
- The storm and season-change sample frames (644 and 666) exist only at 2 samples: tables and sheets for them were not made. The sample table for the frame at rest is in the report, at `uhd` under lavapipe and at `hd` under SwiftShader.
- The hd card loop and the card still from the 4K loop: not built. `npm run loop` joins its own chunks in `out/work/loop/<format>-<tier>/` and writes `out/work/loop/card-loop.mp4`, `card-loop-web.mp4` and the card still, which `npm run keep -- --deliver` copies by name. To come from the 4K loop it needs a flag that takes `out/deliver/snow-globe-loop-4k60.mp4` as the source of `card-loop.mp4` (every second frame, scaled, as `--hd` does) and the loop's frame 0 PNG, which `--join loop` already writes beside the master, as the card still.

## Not mine to mend

- `.gitignore` does not name `out/master/` or `out/deliver/`.
- `Session.open` waits for the clone's render lock without a word. The master says so itself before it waits.
