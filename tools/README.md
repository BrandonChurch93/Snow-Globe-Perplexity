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
