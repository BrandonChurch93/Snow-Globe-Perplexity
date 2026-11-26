# The harness and the page

What the tools in this folder can rely on. The page is opened through `tools/lib/page.mjs` (`Session`), and everything is asked for through `window.showcase`, the frame interface of `kit/05-ARCHITECTURE.md`. `src/capture/showcase.ts` holds its types.

## Extra calls under `window.showcase.dev`

| Call | Gives |
| --- | --- |
| `parts()` | `{name, color}` for every part: the flat colour that part has in the `ids` and `standins` views, as `0xRRGGBB` |
| `pose(camera)` | `[px, py, pz, ax, ay, az, fovDeg]` in millimetres: the same seven numbers `filmState(i).camera` holds |
| `framing(camera)` | The framing numbers of `kit/02-SUBJECT.md` section 9 for the current format |
| `stillFraming()` | The same numbers for the camera that drew the last `renderStill`. A screen still (`interface` or `live`, from `hero`) is drawn from the app's own framing, which stands back from `hero` to leave room for the controls and for a shake, so its numbers are not `framing('hero')`. `renderStill` in `tools/lib/page.mjs` writes these into the record |
| `judged()` | The computed judged list: `{id, unit, kind, format, what, ...}`. `kind` is `key`, `still`, `change`, `live`, `film`, `opening` or `loop` |
| `testShake()` | Frame numbers of the test shake, winter into winter, at `film.fps`: `{frameCount, first, liftEnd, strokesEnd, landing, swap: {first, last}}` |
| `testShakeState(i)`, `loopState(i)` | The same object as `filmState(i)`, for the test shake and for the card loop |
| `renderTestShakeFrame(i, tier)` | Frame `i` of the test shake, from `hero` |
| `renderShakeMoment(shot, at, tier)` | One moment of a shake, always from `hero`. `shot` is a shake's id in `film.shots`, or `test`. `at` is `swap` (the middle of the swap window), `landing`, `landed` (`states.landedSeconds` later) or `settle` (`shake.settleCheckSeconds` after the landing) |
| `loopPlan()` | `{frameCount, shake: {first, liftEnd, strokesEnd, landing}}` at `film.fps` |
| `openingPlan()` | The opening of film A by frame: `{fps, frameCount, seconds, typing, reasoning, send, build, steps, keyTaps}` |
| `sanity()` | After a picture: `{invalid, pixels}`, the count of invalid or infinite values in the picture before lens and grade |
| `inside()` | After a picture: `{inside, outside, total}`, particles inside a solid and outside the sphere in that picture's state |
| `simcache(what)` | Runs the simulation along `film`, `stills` or `loop` and stores its checkpoints. Gives `{checkpoints, simulatedSeconds, ms}` |
| `timings()`, `caps()`, `simulate(from, seconds)` | Timing of the last pictures, the WebGL limits in use, the cost of simulated time |

## Diagnostic views

Set with `setDiagnostic(view)` before a render call, `none` to clear. A diagnostic picture is drawn with one sample and no lens, tone curve, grain or dither, so its values can be read back exactly.

| View | Encoding |
| --- | --- |
| `ids` | Each pixel is the flat colour of its part, from `dev.parts()` |
| `standins` | A pixel of a stand-in is that part's colour. Everything else is black |
| `cover` | Red: how much of the miniature is hidden at that pixel, 0 to 1. Blue: 1 where the pixel shows the miniature, 0 elsewhere |
| `texels` | Red: texels per screen pixel divided by 4, clamped. Green: the blur circle in pixels divided by 8, clamped. Blue: 1 where the pixel is a textured pixel of a base or of the miniature |
| `change` | Red: how far the part at that pixel is through its change |

## Signals the page gives

- `document.documentElement.dataset.firstPicture` is `1` once the first complete picture of the default season is on screen in `live`.
- `document.documentElement.dataset.audio` is `none` until the first interaction, `started` once an audio context exists.
- The stage is `#app`: `canvas#view`, then `div#opening`, then `div#ui`. `Session.grabStage(page)` captures that region with the interface. `grab` captures the canvas alone.
- Controls carry `data-control`: `shake`, `season` (with `data-season`), `sound`. The menu on the `M` key is `[data-menu]`.
- `document.documentElement.dataset.detail` is `loading` from the first picture until every whole picture has replaced its first file, then `ready`.

## Files

| File | What |
| --- | --- |
| `cut/CUTLIST.json` | Written by `npm run cut`. Frames at `film.fps`. `shots`, `shakes` (`first`, `liftEnd`, `strokesEnd`, `landing`, `swap`), `landings`, `barLines`, `cameraKeys`, `cues` (`{cue, frame, at}` with `at` in seconds from frame 0 of film B), `ambience` (`{cue, from, to, fadeIn, fadeOut}` in seconds), `opening` (the plan of film A's opening with its own `cues`), `loop` |
| `out/work/film/<which>-<format>-<tier>/` | A film's chunks, each with its record |
| `out/work/film-<which>-<format>-<tier>.mp4` | A joined film |
| `out/work/review-<candidate>.mp4` | A review cut |
| `out/work/local/proof.json` | The local render proof: the engine hash, and for each result its file and what `ffprobe` reports |
| `out/work/loop/` | The card loop's ranges, the loop, its web copy and the card still |
| `out/work/sheets/` | Contact sheets |
| `out/work/audio/takes/` | Every take as the sound tool returned it |
| `audio/kept/<id>.wav` and `<id>.json` | A kept sound and its record |
| `audio/mix/<candidate>.wav`, `audio/final/film-b.wav`, `audio/final/film-a.wav` | Mixes |
| `public/audio/index.json` and the files it names | What the app ships. Shape: `AudioIndex` in `src/core/bridge.ts` |

The repo is public, so no generated sound file is committed: `.gitignore` holds every sound file under `audio/` and all of `public/audio/`. Their records and recipes are text and are committed.

## Notes added at the merges

- `out/work/seq/<source>-<format>-<tier>/` holds single frames, one PNG and one record each. `sheet` and `seq` share it and reuse each other's frames. It is held to `sandbox.maxFramesOnDisk` by pruning the oldest.
- `sheet`: `--mark N=WORD[,N=WORD]` with `--shot` or `--film` puts film frame N on the sheet of its shot and adds WORD to its label. The blockout pack uses it to show the reveal frame of the opening.
- `measure`: `--unit ID [--only M1,M4] [--tier T] [--force]`. The default tier is `final`. A diagnostic view whose encoding is off fails its measure with a note instead of giving a number.
- `pack`: `--phase N --round R --unit ID [--tier T] [--only R1,R3] [--record]`. Phase 2 builds only the blockout pack. Beside each pack folder, never in it, is `<role>.message.md` with the critic's section, the severity scale and the return format. The key is `out/work/packs/keys/round-RRR.json`.
- `pack --only R8` also makes, through `tools/lib/controls.mjs`, the close crops of every control at rest, focused and pressed for the first `screen` still of each layout and one sheet of the Shake control's hint, cut from the page that holds the still (`dev.interfaceState` for rest, focus and the hint held at exact times; the browser's forced `:active` for pressed, with `:hover` on the wide layout). The crops are cut with reduced motion asked for, so no transition runs, and a crop is kept only when two shots in a row are the same. The four season marks are labeled mark 1 to mark 4 by their place on the screen, and which is which is told only in the key. They are kept with records in `out/work/controls/`.
- `gate`: `--phase N [--only ID,ID] [--unit ID] [--fresh]`. `--unit` names the unit of the round for G13. `--fresh` draws the G5 and G13 pictures again.
- `hostcheck`: `[--wait SECONDS] [--keep]`. Writes `out/work/hostcheck/result.json` and `live.png`. The default wait is 120 s. `--keep` keeps the temp folder.
- `sound`: see `node tools/sound.mjs --help`. The ledger of every take is `audio/RECORDS.json`. `mix`: `--candidate NAME | --final [--which a] [--music FILE] [--skip CUE] [--gain cue=dB]`.
- `audiomap`: `--file F [--approved] [--name N] [--force]`. A map marked `grid` found no clear pulse: the cut must not trust its beats.
- `film`: `--which b|a [--tier T] [--format F] [--shot ID | --first N --last N] [--join] [--mix FILE] [--review] [--candidate NAME] [--from-hd] [--look no]`. A ranged run only renders unless `--join` is added. A join that does not cover the whole film is named `-partial` and is never kept or shown as the film. `loop`: the same range flags; writes the loop, its web copy and the card still under `out/work/loop/`.
- `stress`: `[--tier T] [--shot ID]`. Writes `out/work/stress/stress.json` with, for each moment, the frame before encoding, the encodes at `export.bitrateMbps` and `quality.compressionStressMbps`, and stills taken back out of each.
- `render-local`: `--what film-b|film-a|loop --test | --go`, or `--proof`. `--rehearse` runs `--test` or `--go` small (preview, draft, software graphics) into `out/work/local/rehearsal/`. It refuses a master when the installed Chrome is missing or draws with software, unless `deliver.sandboxMaster` is true.
- `Session.open` closes its server and drops the render lock when the browser cannot start.
- `texpack`: `[--group shared,winter] [--fresh] [--table]`. The only way a file reaches `public/assets/`; the rules are in `tools/lib/webset.mjs` and in `assets-src/web-pack/RECIPE.md`. A picture becomes `name.webp` (WebP near-lossless, no channel of any pixel off by more than 2 of 255, checked as it is written) and, when it is opaque and 1024 px or more, `name.first.webp` at half the size; a picture with a side under 128 px stays `.png`. A `.glb` gets a lighter list of triangles for `medium` and `low` and is packed with `EXT_meshopt_compression`. Files the full set no longer names are removed. `--table` prints every file with its sizes, coding, largest change and triangles per level; `out/work/texpack/report.json` holds the same. `--fresh` ignores the cache in `out/work/texpack/cache/`.
- `firstlook`: `[--camera hero,macro] [--season S] [--state S] [--tier T] [--stills | --live] [--wait SECONDS]`. Stills: the same still from the web set held at its first files and whole, and how far apart they are. Live: what the built page fetched before and after the first complete picture, whether every whole file arrived, and the longest wait between two frames. Writes `out/work/firstlook/`.
- `node tools/visit.mjs --url http://localhost:4173/ --layout hd|phone|tablet [--quality low|none] [--only 1,2,7] [--name NAME] [--wait SECONDS]`: the visitor's pass through the served app on one layout (Phase 5, step 2), with real pointer, touch and key events: first paint, the Shake control, the space bar, a stir, a drag around the globe, each season mark, the sound control, the keyboard and the `M` menu, reduced motion, each season by its link, the look and places of the controls. Writes a screenshot and a line of facts after every action to `out/work/visit/<name>/` (`facts.jsonl`, `result.json`); lines with `ok: false` are what it found. Serve `dist/` first (`npx vite preview --port 4173 --strictPort`). Without a GPU run one layout at a time: a full walk has nine changes of season and takes 15 to 40 minutes.
- `still --live low|medium|high` draws through the app's path at that level, and the meshes of the web set are drawn from that level's list of triangles. Without `--live` a still draws the full meshes.
- The page takes `detail=first` in its address to stay at the first files (what `firstlook` compares). The asset index is fetched with `cache: 'no-cache'` and every asset by `name?v=<hash>`, so a file that changed is never served from an old cache.
- `sheet --app shake|stir|drag|jump [--level high] [--from SEASON] [--to SEASON] [--part ID] [--stride K | --fit]`: a script of the live app (`src/app/replay.ts`) as sheets of frames drawn through the app's own painter with `showcase.dev.renderAppFrame`, at a level of `live.quality` (`high` unless asked, the judged level of the globe) and in `formats.preview` unless `--format` is given. The frames are chosen in `tools/lib/appsheets.mjs`. A shake: one sheet across the whole script, three from the press to the landing, one of the first second after the landing. A jump: two from the press to the landing and one of the first second after it. A stir and a drag: one sheet each from the pointer going down to the end, the stir's close together at first and then further apart. `--part whole|bar|landing|turn` draws one part, `--stride K` or `--fit` the whole script in consecutive frames. Each tile is labelled with its frame, its time and the season (the camera's yaw in a drag); the sheet's record holds the plan, the marks with their frames and the legend the pack gives a critic. Frames are kept in `out/work/seq/app-<script>-<seasons>-<level>-<format>/` and drawn in rising order, because the page replays the script from its start for an earlier frame. The `globe` packs of R4 and R5 call it, one command per script, so the scripts can be drawn in different VMs: a sheet whose record matches the engine, the layout and the plan is kept even when its frames are not on disk, so only `out/work/sheets/app-<script>-*` has to be carried to the VM that builds the pack. `--plain`, with `--app` or `--seasons`, makes a second sheet with `plain` in its name whose labels and legend name no season (frame and time, or the tile's place 1 to 4), for the R5 critic who has to name the seasons from the pictures; the record's spec keeps the truth and the pack writes it to the key file only.
- `strict`: `[--keys ID,ID] [--modes pow,all+smooth,all+smooth+noguard] [--format F] [--tier T] [--fresh]`. The strict rule for shader arithmetic (`tools/lib/strict.mjs`, decision 133). The software renderer answers with an ordinary number where GLSL leaves the answer open (pow with a base below zero, the square root of a number below zero, normalize of a vector of no length); some graphics cards answer with no number, which can blank a part or the whole glass. `strict` renders each judged key plainly and with every open case answering no number, and counts the pixels that differ. It passes when no pixel moves by more than one level and at most 0.01 percent of pixels move (a wrapped call is compiled a little differently, which can move a last digit). Writes `out/work/strict/report.json`. Run it after any change to a shader; `tests/glsl-safe.test.ts` holds the part of the rule that can be read from the source.

## The master, in ranges across many VMs (`npm run master`)

The final 3840 x 2160, 60 frames a second films are rendered as chunks of `deliver.master.chunkFrames` frames. Chunk k is frames k x 30 to k x 30 + 29 of its timeline on every VM, the last one shorter. Three timelines: `film-b` (film B), `loop` (the portfolio loop) and `opening` (the opening of film A, encoded from its pack, without the engine).

A render agent needs a built clone of `main`, `npm ci`, ffmpeg, the pinned browser, and `git config user.name` and `user.email` set in the clone. On a VM whose system the browser installer does not know, `PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright-core install chromium` installs it. Then it runs one command, with the range `/root` gave it and a branch of its own that matches `deliver.master.chunkBranches`:

```
sudo apt-get install -y mesa-vulkan-drivers
npm ci
PLAYWRIGHT_HOST_PLATFORM_OVERRIDE=ubuntu24.04-x64 npx playwright-core install chromium
npm run build
npm run master -- --calibrate
npm run master -- --what film-b --first 600 --last 899 --ship agent/p6-chunks-vm07
```

`--calibrate` draws one fixed picture (the winter still at rest from the hero camera, `hd`, the review tier) and prints `calibration <sha256 of its PNG>`. It is kept in `out/work/master/calibration.json` for this machine (name, processor), this build and this renderer. No range of the film or the loop starts without it, every chunk's record carries it and the name of its renderer (`tools/lib/browser.mjs`), and a machine that prints another line than the others is not given a range: its frames could not be joined to theirs.

What it sees: one line that says how many chunks are finished and how many frames are left, then one heartbeat line a frame (chunk, frame, seconds for the frame, frames left in the range, hours left at the running average), then for each chunk `finished film-b-000600-000629: 30 frames, ... MB, PSNR against the PNGs ...` and `shipped film-b-000600-000629 to agent/p6-chunks-vm07`. The last line says the range is finished and on the branch. Any other ending is an error with its reason, and the exit code is not 0.

How it resumes: run the same command again, as often as needed. A finished frame is a PNG under `out/work/master/<what>/frames-<first>-<last>/` (written under another name and renamed, with its seconds and the sha256 of its pixels beside it) and is never rendered twice. A finished chunk is `out/master/<what>/<what>-<first>-<last>.mp4` with its `.json` and its look `.jpg`; it is taken as finished only when its record is from this build, this renderer, this calibration, these samples, this format and these encoder arguments, and the mp4 still has the sha256 the record names. A chunk that was finished but not pushed is pushed first. PNGs go only after their chunk is encoded and verified (it decodes without an error to its number of frames, 1/60 s apart, and its first, middle and last decoded frames reach `deliver.master.minChunkPsnr` against their PNGs, measured on BT.709 luma: a 4:2:0 encode cannot be held to that number over RGB, where the halved colour alone holds a film frame near 39 dB. The record keeps both numbers, `verify.psnr` and `verify.psnrRgb`). Chunks are never deleted by the tool. Before each chunk the tool checks `sandbox.minFreeDiskGb`, and stops without dropping anything when it is under.

- A range that is not on the chunk lines is refused, with the nearest ranges that are. No range means the whole timeline.
- `--ship BRANCH` commits each verified chunk (mp4, record, look, and for the loop's first chunk `frame-000000.png`, the screenshot) to the orphan branch BRANCH through a clone of its own under `out/work/master/ship/`, never through the repo's `.git`, and pushes without force. A refused push is tried 3 times with the remote merged in, then the render goes on and the push is tried again after the next chunk.
- `--procs P` runs P render processes side by side, each with its own browser, chunk i of the range in process i mod P. The checkpoints are made first (`npm run simcache`), so that no two processes write the same one. The default is 1.
- `--samples S` and `--format F` are for tests only. Their chunks are marked `test`, live under `out/master/test/` and `test/` on the branch, and no master is joined from them. `--min-psnr N` lowers the floor of the check for such a run only (a small picture at 2 samples is mostly noise and reaches about 35 dB); a master cannot be given it.
- `--what opening` reads `out/work/opening/master/` through `openPack` of `tools/lib/openingpack.mjs` (made by `npm run opening -- --master`) and needs no browser. `--pack DIR` names another folder.
- The page takes a counted tier, `samples-N`, wherever it takes a tier name (`tierSamples` in `src/config.ts`); the master asks for `samples-<deliver.master.samples[what]>`.

Joining, on one machine with 2 cores and 3 GB of free disk:

```
npm run master -- --collect out/work/collected
npm run master -- --join film-b --from out/work/collected
npm run master -- --join film-a --from out/work/collected
npm run master -- --join loop --from out/work/collected
```

`--collect DIR` fetches the tip of every remote branch that matches `deliver.master.chunkBranches` (depth 1, each into a clone of its own that is dropped once its files are laid out as `DIR/<branch>/<what>/`), and prints what is there and what is missing, by range. Run it again to fetch only the branches that moved.

`--join` reads the chunks in `out/master/` and in DIR and refuses, with a plain list, when a frame is covered by nothing; when two chunks cover a frame and the hashes of their pixels differ (it prints the PSNR between them); when the build hash, the samples, the renderer or the calibration picture differ between chunks of one timeline, or a chunk of the film or the loop names no calibration, or the format, the frame rate or the encoder arguments between any; when a chunk is marked `test`, is off the chunk lines, was rendered for another frame count than `cut/CUTLIST.json` holds, or its mp4 does not match its sha256. Equal hashes from two machines are counted and printed as proof that both draw the same picture. It then joins by stream copy, adds `audio/final/film-b.wav` or `film-a.wav` as AAC at `deliver.master.audioKbps` (`--sound FILE` names another file; the loop has no sound track), sets faststart, decodes the whole result and prints one table: frames, size, pts steps, frame rate, pixel format, colour tags, codec, sound, every frame against its chunk's own decoded frames, faststart, file size, and for the loop its seam and its screenshot. All passes: the file is `out/deliver/<deliver.master.names[...]>` with a `.json` beside it that holds the table. Any FAIL: the file is kept as `.unproven.mp4`, is not a master, and the exit code is 1. `--join ... --test` joins test chunks only, any unbroken run of them, into `out/work/master/test/`.

No black frames: a machine that runs out of memory loses its graphics process, and the page then hands back a black picture without an error. Three guards stand against it. The shared read-back (`Session.grab` and `grabStage` in `tools/lib/page.mjs`, which `seq`, `still`, `film`, `loop` and `master` all use) refuses a picture when the WebGL context was lost at any time since the page opened, or the page or the browser crashed or went away; `Run.frame` and `renderStill` refuse a picture that is one flat value over the whole frame (a diagnostic view may be flat, a frame of the film or the loop never is: `FLAT_FRAMES` in `tools/lib/frames.mjs` would name one by its frame number, and names none). The tool then ends with an error and writes no file and no record. The master decodes every chunk after encoding and deletes it, unshipped, when a frame is flat or its mean luma is more than 1 code value from its PNG's; `--collect` and `--join` decode every chunk they take and name the chunk and the machine of a flat frame, and the join's table has the row `flat frames`, which must be 0. `--procs` above 1 is refused for `uhd` on a machine under 12 GB (`free -g`): one `uhd` render holds about 3 GB.

The hd films come from the master, not from a second render: `npm run master -- --hd film-b` (or `film-a`) takes every second frame of the joined, proven `out/deliver` master (`film.fps` over `film.previewFps`), scales it to 1920 x 1080 with the lanczos filter the other tools use, encodes it with the hd film's own settings, copies the master's sound track, and writes `out/work/film-b-hd-final.mp4` with a record that says `scaledFrom` (the master's file, sha256 and size). From there `npm run film -- --which b --from-hd --tier final` and `npm run keep -- --film` do what they did. The card loop is not done this way yet: `npm run loop` joins its own hd chunks and has no flag that takes the 4K loop as its source.

What it costs, measured on a sandbox VM with 4 cores, 8 GB and no graphics card:

- Drawn by lavapipe (the default since decision 139), film frame 60 at `uhd` (at rest, the globe close) took 128.7 s alone at 24 samples: 5.4 s a sample. In a chunk at 4 samples a frame took 28 s, so about 7 s a frame goes on reading the picture back, the PNG and its hashes. At 12 samples that is about 72 s a frame, 36 minutes a chunk and 72 machine hours for film B; at 16 samples about 93 s a frame. The first frame after a page opens costs 15 to 30 s more. At `hd` the same frame took 15.6 s at 8 samples. `--calibrate` takes 50 to 60 s.
- Lavapipe uses all four cores for one render, so a second process on the same VM gains nothing, and one `uhd` render holds about 3 GB. One render a machine.
- Drawn by SwiftShader, before the change, the same `uhd` frame cost about 70 s a sample and the `hd` frame 18 s a sample; a `uhd` still from the hero camera cost 48 to 83 s a sample at rest and 89 to 136 landed, by season; two renders at once gave 1.24 times the frames an hour of one.
- One `uhd` chunk was made, at 4 samples (frames 0 to 29, lavapipe): 6.77 MB, encoded in 21 s, and its decoded frames were 40.9 dB (first), 38.6 (middle) and 33.1 (last) from their PNGs in luma. Grain that changes every frame cannot be predicted from the frame before, and at 4 samples there is a great deal of it, so the frames after the key frame fall under `deliver.master.minChunkPsnr` 40 (that chunk was kept only with `--min-psnr`). Whether a chunk at 12 samples holds 40 to its last frame was not measured: the first real chunk tells, and a chunk that fails is not shipped and keeps its frames. 120 chunks of 6.8 MB would be 812 MB, over `platform.maxFileMb`; less grain makes smaller chunks, and the join's table has the row.
- In the darkest gradients the encode shows steps of one code value that the PNG's dither hides (seen with the levels stretched 8 times).
