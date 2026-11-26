# Job: the masters' tool (`master_tool_builder`)

Branch `agent/p6-master`, looks branch `agent/p6-master-looks`. Read `COMMON.md` first; where this file says otherwise, this file wins.
You are a tool agent: you build a render tool and measure with it. You judge no look and you change no picture.

## Why
Brandon asked for the final films from this build at 3840 x 2160 and 60 frames a second: the film with the opening (film A), the film without it (film B), a screenshot for his portfolio, and a 6 to 9 second loop that starts on that screenshot. What exists does not make them:
- `npm run film` (`tools/film.mjs`) renders previews at `film.previewFps`.
- `npm run render:local` (`tools/render-local.mjs`) renders masters as ProRes chunks of 120 frames on a machine with a graphics card. It has no way to render a range, and it refuses the software renderer unless `deliver.sandboxMaster` is true.
- No graphics card is in reach. One sample at 3840 x 2160 costs about 20 s on a sandbox VM (4 cores), so film B (3,600 frames) is hundreds of machine hours. It will be rendered after the freeze by up to 14 sandbox VMs at once, each given a range, each pushing finished chunks to its own branch as it goes, and joined on `/root`'s VM (2 cores, 3 GB of free disk, no graphics card).

So the tool must be made for that: ranges, small chunks, nothing lost when a VM stops, chunks that travel by git, a join that proves the file.

## What is asked

### 1. The tool: `npm run master`
Read `tools/film.mjs`, `tools/render-local.mjs`, `tools/loop.mjs`, `tools/lib/frames.mjs`, `tools/lib/encode.mjs`, `tools/keep.mjs` and their sections in `tools/README.md` first. Build on `tools/lib/frames.mjs` and `tools/lib/encode.mjs` as they do, and share code instead of copying it. Whether this is a new `tools/master.mjs` or `render-local` taught to do it is yours to decide; either way `npm run render:local` keeps working as it does today on a machine with a graphics card, and the frames come from one code path.

Rendering, `npm run master -- --what film-b|loop --first N --last M`:
- Frames of the 60 a second timeline (`film.fps`), at `formats[deliver.master.format]`, with `deliver.master.samples[what]` samples a frame, through the film page as every other film render (motion blur by the film's shutter, the same salts, the same checkpoints from `npm run simcache`).
- Chunks of `deliver.master.chunkFrames` frames, aligned to the timeline (chunk k is frames k*C to k*C+C-1, the last one shorter), so that every VM cuts at the same places. A range that is not on those lines is refused with the nearest ranges that are.
- Nothing is lost. A finished frame is a PNG on disk, written under another name and renamed, and stays until its chunk is encoded and verified. A second run with the same arguments renders only what is missing. Before a chunk's first frame the tool checks `sandbox.minFreeDiskGb`.
- A finished chunk is `out/master/<what>/<what>-<first 6 digits>-<last 6 digits>.mp4` and a `.json` beside it. H.264 from `deliver.master.video` (encoder pinned as `tools/lib/encode.mjs` pins it): closed GOP, the first frame an IDR, one GOP a chunk or a fixed GOP that divides the chunk, no scene-cut keyframes, yuv420p, bt709 tags and a correct matrix, constant frame rate, no sound. Chunks join by stream copy without a decode error or a pts step at any seam.
- The `.json` holds: `what`, `first`, `last`, the engine build hash, the commit, the samples, the format and size, the frame rate, the renderer string the page reports, ffmpeg's and x264's versions and the exact arguments, the sha256 of the mp4, the sha256 of each frame's pixels, the seconds each frame took, the machine's line (cores, memory), and `test: true` when `--samples` or `--format` was given.
- After encoding, the chunk is verified before its PNGs go: it decodes with no error to exactly its number of frames, and its first, middle and last decoded frames reach `deliver.master.minChunkPsnr` against their PNGs. The numbers go into the `.json`. One JPEG of the middle frame (1200 px wide) is kept as the chunk's look.
- `--ship BRANCH`: after each verified chunk the mp4, the `.json` and the look are added to the orphan branch BRANCH (a second worktree or clone, never the code branch) and pushed. A refused push is tried 3 times, then the render goes on and the push is tried again after the next chunk. A chunk is never deleted before it is on the remote.
- `--procs P`: P render processes side by side, each with its own browser and its own chunk, when your measurement (below) shows that a 4 core VM gains from it. Default 1.
- `--samples S` and `--format F` exist for tests only. The join refuses a chunk marked `test`.
- A heartbeat line to stdout after every frame: chunk, frame, seconds for the frame, frames left in the range, hours left at the running average.

The opening, `npm run master -- --what opening`: encodes the opening's 3840 x 2160 pictures into chunks with the same settings and the same checks, without the engine. The pictures are made by `npm run opening -- --master` into `out/work/opening/master/` (the tool of `opening_builder`, branch `agent/p6-opening`, not merged yet; its brief is `tools/briefs/p6/opening.md`). Film A is the opening's frames, then a hard cut, then film B's frame 0. If the pack's layout cannot be read from that branch yet, write the reader against one small function and ask `/root/opening_builder` once, in one short message, for the layout (file names, how a frame index maps to a file, the frame count).

The screenshot: frame 0 of the loop, the very PNG the loop's first chunk was encoded from, is kept as `out/master/loop/frame-000000.png`. It ships with that chunk (PNG, under 20 MB; if it is over, say so and stop).

Joining, `npm run master -- --collect DIR` and `npm run master -- --join film-b|film-a|loop --from DIR`:
- `--collect DIR` fetches the tip of every remote branch that matches `deliver.master.chunkBranches` (depth 1, into a clone of its own under DIR, never into the repo's own `.git`), lays the chunks out under DIR and prints what is there and what is missing, by range.
- `--join` reads chunks from `out/master/` and from DIR. It refuses with a plain list when: a frame is covered by nothing; two chunks cover a frame and their frame hashes differ (it prints the PSNR between them; equal hashes are fine and are counted as proof that two machines draw the same picture); the build hash, the samples, the format or the encoder arguments differ between chunks; a chunk is marked `test`; a chunk's mp4 does not match its sha256.
- It then joins by stream copy, adds the sound (film B: the final mix of film B; film A: the final mix of film A; the loop: no sound track at all), sets faststart and writes `out/deliver/<deliver.master.names[...]>` and a `.json` beside it.
- It proves the file by decoding all of it: the frame count is the plan's; 3840 x 2160; every pts step is 1/60 s; yuv420p; bt709 tags; H.264 High; the sound is AAC, 48 kHz, stereo, `deliver.master.audioKbps`, and its length is within one frame of the picture's; the frames at every chunk seam are bit for bit the chunk's own decoded frames; the size is under `platform`'s limit. It prints one table and writes it into the `.json`.
- The loop also gets its seam measured (the last frame against the first, with the measure `npm run loop` uses for G14), and `--join loop` copies the screenshot to `out/deliver/<deliver.master.names.still>`, decodes the mp4's first frame and writes its PSNR against the PNG (it must reach `deliver.master.minChunkPsnr`).
- Film A's join takes the opening's chunks and film B's chunks. It checks that the opening's frame count is `openingPlan()`'s.
- The join must run on 2 cores with 3 GB of free disk: stream copy only, no second copy of the chunks, no temporary file larger than the result.

### 2. Config, `config/showcase.json`, only these keys
Add under `deliver`: `"master": { "format": "uhd", "chunkFrames": 30, "samples": { "film-b": 12, "loop": 12 }, "video": { "codec": "libx264", "preset": "slow", "crf": 15, "maxrateMbps": 50, "bufsizeMbps": 75, "profile": "high", "level": "5.2", "pixFmt": "yuv420p" }, "audioKbps": 320, "minChunkPsnr": 40, "chunkBranches": "agent/p6-chunks-*", "names": { "film-a": "snow-globe-film-with-prompt-4k60.mp4", "film-b": "snow-globe-film-4k60.mp4", "loop": "snow-globe-portfolio-loop-4k60.mp4", "still": "snow-globe-portfolio-screenshot-4k.png" } }` and set `deliver.sandboxMaster` to `true`. The sample counts are placeholders: `/root` sets them from your measurement. If the page can only be asked for a named tier, make the smallest change that lets a tool ask for a number of samples, and say which file it touched. Change the config's schema, its types and its tests with it. You may add one line to `package.json` (`"master": "node tools/master.mjs"` or what your design needs) and nothing else there.

### 3. Tests and words
`tests/master.test.ts` (no browser): the chunk lines for any range, the refusal of a range off the lines, what a second run still has to render, every refusal of the join from made-up `.json` files, the names. A section in `tools/README.md` that a render agent can follow without reading the code: the one command it runs, what it sees, how it resumes.

### 4. Measurements, with numbers and looks
Start these in the background as soon as your clone is built, before the tool exists; they use `npm run still` and `npm run seq` as they are. One render process at a time except where the measurement is about two.
- a. Seconds for one sample at `uhd`, per season, at `rest` and at `landed` (the tool prints "N samples in X s"). A table.
- b. One render against two at once in two clones (the same still): seconds each, and what the VM gets through in an hour either way. Three at once only if two gained.
- c. How many samples the master needs. At `uhd`, for three film frames (the thickest frame of the first shake's storm; a frame at rest with the camera moving; a frame in the middle of a season change) render 4, 8, 12, 16 and 24 samples. Against 24: PSNR and SSIM of the whole frame and of the globe's own rectangle. For 8, 12 and 24 also render the next frame, and give the mean absolute difference between the two neighbours inside a patch where nothing moves (it measures the flicker of the sample pattern from frame to frame). One sheet a frame of crops at their own size (a 640 x 640 patch of particles against the dark, and one of the glass's rim), 8, 12, 16 and 24 side by side, names under the pictures. Push the sheets to the looks branch as PNG crops, not resized.
- d. The pipeline from end to end, small: two neighbouring chunks at `--format hd --samples 2`, shipped to a branch `agent/p6-chunks-test`, collected into a fresh folder, joined with any sound of the right length, and the proof table printed. Then one real chunk at `uhd` with the placeholder samples, for the seconds a frame and the megabytes a chunk at rest and in a storm, and one look at the darkest gradient of a decoded frame against its PNG, levels stretched 8 times: say whether the encode shows steps the PNG does not.

## Yours
`tools/master.mjs`, `tools/lib/master.mjs` (or what your design names them), `tools/render-local.mjs`, `tests/master.test.ts`, the section of `tools/README.md`, the keys above in `config/showcase.json` with their schema, types and tests, one line in `package.json`. `tools/lib/frames.mjs` and `tools/lib/encode.mjs` only by adding to them; nothing that an existing tool does may change, and `npx vitest run` proves it. Nothing under `src/` except the one change section 2 allows.

## Done means
- `npm run master` renders, resumes after a `kill -9` in the middle of a chunk without rendering a finished frame again, ships, collects and joins, and the join's proof table is all passes on the small pipeline of 4d.
- `npx tsc --noEmit` and `npx vitest run` pass; `npm run determinism` passes; `npm run render:local -- --proof --rehearse` does what it did.
- Time: 3 hours from your start. Push the tool with its tests inside 100 minutes, the measurements as they finish. One line to `/root` when the tool is pushed.
- Final report to `/root`, ONE message of at most 35 lines: branch and commit; the command a render agent runs; tables a, b and c as numbers; what 4d printed; megabytes a chunk; what you would set the samples to and why, in two lines; what does not work yet; what you did not test. Attach the three crop sheets.
