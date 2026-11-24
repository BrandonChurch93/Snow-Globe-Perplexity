# 05 · Architecture

## Stack

- Vite, TypeScript strict, three.js on WebGL2, GSAP for easing. No UI framework. CSS Modules.
- Vitest for unit tests.
- A headless browser driver for the harness. Use the one that works with the browser already in this workspace, and pin that browser's version. It must not download a browser when the repo's packages are installed.
- `ffmpeg` and `ffprobe` for films, loops, sound and checks.
- Optional build-time tools under `pipeline/`: headless Blender and Python, for geometry, baking and distance fields. Nothing that ships depends on them being installed.
- three.js: on the day this kit was written, 2026-11-23, releases r182 and r183 were confirmed and newer ones existed. In Phase 0 take the newest stable release, read its migration notes for `WebGLRenderer`, pin it and record it in `kit/PROGRESS.md`. Pin every other version too.
- One render path: three.js `WebGLRenderer` on WebGL2, in every mode, on every machine. No WebGPU path and no path tracer. The critics judge pictures rendered in software here, visitors see the app on their own graphics cards, and the masters are rendered on Brandon's. All of them run the same shader code.

## Folders

```
config/showcase.json     every number, the seasons, cameras, shots, units, keys
src/
  main.ts
  config.ts              typed import of the config, validated at startup
  copy.ts                every word the interface shows
  core/                  renderer, accumulator, sampler, seeded random, tiers, quality, asset loader
  globe/                 glass, liquid model, refraction, bubble
  seasons/<season>/      that season's base, miniature, dressings, light, veil, arrival
  particles/             the simulation, the kinds, the drawing, the loop paths
  shake/                 the shake's path, the change, the bloom
  scene/                 surface, backdrop, cameras, light grid
  film/                  the timeline, shots, the opening, the card loop
  audio/                 the sound engine of the app
  ui/                    the controls
  post/                  tone curve, grade, bloom, grain, dither
  capture/               the frame interface
  probe/                 the probe page
  diagnostics/           the views listed in kit/04-LOOK.md
pipeline/                optional build-time scripts
parts/PARTS.json         the parts register
public/
  assets/                the web asset set and all geometry. This is what ships
  audio/                 what the app plays
  fonts/
assets-full/             the full asset set. Never part of the site build
assets-src/<part>/       the recipe for every generated or built asset: RECIPE.md, text only
audio/                   kept/, mix/, final/, RECIPE.md
tools/                   harness scripts, and the local render
tests/
references/              approved/, drafts/. cache/ is ignored by git
scorecards/              one folder per round, text only
cut/                     SHOTS.md, AUDIO-MAP.json, CUTLIST.json, CUES.md
deliver/                 the card still, the card loop and its web copy
out/                     stills/, clips/, the preview films, roughcut.mp4, committed through the harness. work/ is ignored by git
```

One owner per folder. `src/seasons/<season>/` is split so three agents can build three seasons at once.

## The config

- `src/config.ts` imports `config/showcase.json`, validates it and exports it typed.
- No other file contains a number, an id, a name or an approved image path that the config holds.
- Startup fails loudly if a key is missing, if a shot, a key or a still names a season or a camera that does not exist, if `budget.phaseHours` does not add up to `budget.runHours`, if `shake.liftBeats`, `shake.strokeBeats` and `shake.setDownBeats` do not add up to `film.beatsPerBar`, if `shake.swapWindow` does not lie inside the strokes, if a shake's `from` is not the season of the hold before it or its `to` not the season of the hold after it, if `film.fps` is not a whole multiple of `film.previewFps` and of `deliver.cardLoop.fps`, if `deliver.cardLoop.shakeStartSeconds` plus one bar at `film.defaultBpm` plus `shake.spinDownSeconds` is not less than `deliver.cardLoop.seconds`, or if an approved image is missing.
- A camera in `cameras` is a lens angle, a distance from its aim point, a turn around the globe, a height above the horizon, and the height of its aim point above the surface on the globe's axis.
- A handful of values are the Builder's to tune and write back: everything under `cameras`, inside the checks of `kit/02-SUBJECT.md` section 9; each count in `particles`, inside `particles.tuneMin` and `particles.tuneMax`; `scene.bokehLights`; `shake.strokes`, `shake.liftMm`, `shake.strokeMm` and `shake.tiltDeg`, each by up to a quarter either way; and what each level of `live.quality` draws. Log each change. Two more values may move, each in one direction only: the map sizes under `assetSets.web` may be lowered to fit `host`, and `critics.maxImageLongEdgePx` may be lowered in Phase 0. Nothing else in the config is yours to change.

## The state

- What the globe shows is a function of four things: the season, the time since that season's landing, the globe's own motion, and, during a shake, how far the change has gone.
- In the films those four come from the cut list and the frame index. In the app they come from the visitor and the app's clock. In the loop they come from the loop's own closed timeline.
- The URL may name a season: `?season=fall` opens the app in fall.

## Determinism

A computed picture is a pure function of what it shows, the format, the tier, the asset set and the config.

- No `Math.random`, `Date.now` or `performance.now` in anything that affects a pixel of a computed picture.
- All randomness comes from one seeded generator built from `seed`, with a named stream per system.
- Two kinds of motion exist, and both are deterministic:
  - Closed-form: the camera, the shake's path, every arrival, the lights' twinkle, the trickle, the beads on the glass, the fog's roll. Each is a function of time or of beat position. Nothing is stepped from an earlier frame.
  - Stepped: the liquid model and the particles. They advance in fixed steps of `sim.stepHz` from a known start, with no dependence on frame rate or wall clock. The same start and the same globe motion give the same state at step N, however the steps were grouped into frames.
- A film frame is a function of its index: time is the index divided by `film.fps`. The stepped state at that time is reached by replay from a checkpoint, as `kit/03-METHOD.md` section 8 says.
- A still is a function of a season, a state and a camera. Its stepped state is reached by replaying a shake into that season and waiting the state's seconds.
- Rendering picture B after picture A gives the same B as a fresh page load.
- This holds exactly on one machine with one browser version. Phase 0 measures how far it holds between machines: the same still rendered on the Builder's VM and on two sandbox VMs, with the PSNR of each pair logged.
- Frames from two VMs may share one shot only if that PSNR is at least `quality.crossMachineMinPsnr`. If it is lower, work is still split across VMs, but only where a difference cannot be seen: the film at its landings, judged stills one whole still per VM.
- Brandon's computer has a different browser build and a real graphics card. Its particles may take slightly different paths. That is expected and nobody compares them frame for frame.
- The live app is allowed wall-clock time for input. It still advances the simulation in the same fixed steps.

## Samples

- A computed picture is the average of `tiers.<tier>.samplesPerFrame` samples. Each sample is jittered inside the pixel and placed at its own point on the lens. A film or loop frame also places each sample at its own moment inside the shutter set by `film.shutterDegrees`.
- The shutter's length is counted at `film.fps`, also when a preview is rendered at `film.previewFps`.
- A sample at a moment between two steps takes the stepped state between them.
- Accumulate in linear floating point. Tone curve, grade, glow, grain and dither run once, after accumulation.
- Sample sequences are low discrepancy and seeded.

## Loading and memory

- The loader knows every file a season needs, in each asset set, from one generated index.
- In `capture`, everything a picture needs is in memory before it is rendered. The call resolves when the picture is done, however long loading took.
- In `live`, `defaultSeason` loads first, then the others behind it in the order of `seasons`.
- Once a texture is uploaded, its decoded source is released.
- A stand-in is never silent. `parts/PARTS.json` is the register of every part, as `kit/03-METHOD.md` defines it. `info().standIns` is every part whose state is `stand-in`, with its unit.
- Check G13 does not take the register's word alone. For every part it covers, as `kit/07-QUALITY-BAR.md` says which, it makes three tests, and it is red if any fails:
  1. The part's state in the register is not `stand-in`.
  2. The hash of the part's files differs from the hash recorded when it was a stand-in. This holds for every state, `fallback`, `general fallback` and `last resort` included, so changing a label changes nothing. Finishing a part always changes its files, if only because its stand-in flag is removed, so a part that is really finished always passes.
  3. The `standins` view shows no pixel flagged for that part in any judged still or frame, and the page reports no flagged code path for that part. Pixels and code paths flagged for other parts do not count against it.

## The frame interface

The page exposes one object on `window`:

```ts
interface Showcase {
  ready: Promise<void>
  info(): { fps: number; format: string; tier: string; assets: string; engineHash: string; seasonHashes: Record<string, string>; standIns: { name: string; unit: string }[]; counts: { triangles: number; drawCalls: number; particles: number }; textureMb: number; versions: Record<string, string> }
  setFormat(id: string): Promise<void>
  setAssets(id: string): Promise<void>
  setDiagnostic(view: string): void
  renderStill(spec: { season: string; state: string; camera: string; tier: string; change?: { shot: string; at: 'swap' | 'landing' }; interface?: boolean; live?: string }): Promise<void>
  film(): { frameCount: number; shots: { id: string; first: number; last: number }[]; swaps: { shot: string; first: number; last: number }[]; landings: number[]; barLines: number[] }
  filmState(frameIndex: number): { camera: number[]; shot: string; season: string; globe: { heightMm: number; tiltDeg: number[] }; change: Record<string, number>; cover: number | null }
  renderFilmFrame(frameIndex: number, tier: string): Promise<void>
  opening(): { frameCount: number }
  renderOpeningFrame(frameIndex: number): Promise<void>
  loop(): { frameCount: number }
  renderLoopFrame(frameIndex: number, tier: string): Promise<void>
}
```

- `state` is `landed`, `rest` or `settled`. With `change`, the still is that shake's frame in the middle of its swap window or on its landing.
- `live` names a level of `live.quality` and draws the still through the app's own path, with one sample.
- `filmState(i).change` gives, for every seasonal part, how far its change has gone. Checks G11 and G12 read `filmState` for every frame without rendering.
- `renderLoopFrame` accepts the index one past the last frame. Check G14 uses it.
- After a call resolves, a clean picture is on the canvas. For a picture with the interface, the harness captures the page region that holds canvas and interface together.
- If one picture at the `final` tier does not fit in `sandbox.chunkBudgetMinutes`, add calls that split its samples across steps, and prove with `npm run determinism` that a split picture is pixel-identical to an unsplit one.

## Modes

Set by URL: `?mode=`, with `season`, `format`, `tier`, `assets`, `quality`, `frame`, `first`, `last`, `shot` and `diag` as optional parameters.

| Mode | What it does |
| --- | --- |
| `live` | The globe, as a visitor uses it. The default, and what the hosted address opens |
| `autopilot` | Plays film B in real time on this machine, with its sound if there is any, for a quick look. `which=a` plays film A. `shot=<id>` plays one shot |
| `loop` | Plays the card loop in real time, repeating |
| `capture` | Renders nothing until asked through the frame interface. The harness and the local render use this |
| `probe` | Measures frame rate on this machine. See "The probe" |

- `assets` defaults to `web` in `live`, `autopilot`, `loop` and `probe`, and to `full` in `capture`.
- `autopilot` and `loop` play as fast as the machine can and may drop below the film's frame rate. They are for looking, not for recording.
- In `live`, a menu on the `M` key switches quality, season, state and diagnostic. It is for Brandon and is hidden from the tab order.

## Hashes and records

- The engine hash covers `src/`, `config/` and the package lock file.
- Every season has a hash over its files in `public/assets/` and `assets-full/`.
- Every harness output has a record beside it: the engine hash, the hashes of the seasons it shows, the format, the tier, the asset set, the diagnostic, the browser version and the machine.
- A command reuses an existing output only when its record matches the current state. Otherwise it renders again.
- Commits that touch only logs, scorecards, sound or kit files change no hash.

## The harness

Scripts in `tools/`, run through npm.

| Command | Output |
| --- | --- |
| `npm run build` | The static site in `dist/`, from `src/` and `public/` only |
| `npm run caps` | The WebGL2 limits and extensions of this machine, written to `config/webgl-caps.json` |
| `npm run budget` | Seconds per sample and per picture at each format and tier on the current scene, the time of one simulated second, and the time the films and the loop would take |
| `npm run clock` | The clock. See below |
| `npm run animatic` | The rough cut: `out/roughcut.mp4`. See below |
| `npm run simcache` | The simulation's checkpoints along the film, under `out/work/` |
| `npm run still -- --season S --state T --camera C --tier R --format F --assets A --diag V` | One still in `out/work/stills/`. `--key ID` and `--id ID` render a key or a judged still by name. `--interface` captures it with the controls on. `--live LEVEL` draws it through the app's path |
| `npm run crops -- --key ID` | Grids of native-size crops, each with a long edge of at most `critics.maxImageLongEdgePx`: the glass at its shoulder and its rim, the cottage, the tree's crown, the pond, particles near and far, the base, the collar, the foot and its mirror image, the dressing |
| `npm run compare -- --key ID` | A comparison image `compare-<key>.jpg`: the approved image beside the key's still, both cropped to the globe, the base and the surface around them at the same size, and under them matching native-size crops |
| `npm run measure -- --unit ID` | Every measure for that unit, as `kit/07-QUALITY-BAR.md` defines them |
| `npm run sheet -- --shot ID --tier T` | A contact sheet of `critics.contactSheetFrames` frames across a shot. `--film` gives sheets across the whole film. `--loop` gives one across the card loop. `--opening` gives one across film A's opening. `--seasons` puts the four at-rest keys' stills on one sheet. `--motion NAME` gives consecutive frames of a shake's lift, strokes, set down or first second after landing, of an arrival, or of a camera move |
| `npm run seq -- --first N --last M --tier T` | Every film frame from N to M as separate pictures |
| `npm run sound -- --cue ID --file F` | Measures a take the Builder got from the sound tool and files it. `--keep` runs the chain in `kit/03-METHOD.md` section 12 and writes the kept take with its record. `--pack` builds what the app ships. `--sheet` draws the kept sounds as waveforms on one picture |
| `npm run audiomap -- --file F` | The map of a piece of music. For the approved music it writes `cut/AUDIO-MAP.json`. See below |
| `npm run cut` | `cut/CUTLIST.json` and `cut/CUES.md` from `film.shots` and the audio map or the default grid |
| `npm run mix -- --candidate NAME` | One soundtrack laid on the cut list. `--final` mixes the approved one for film B and for film A |
| `npm run film -- --which b --tier T --format F` | A film as `out/work/film-<which>-F-T.mp4`, with its sound if there is any. Takes `--first` and `--last`. `--shot ID` renders one shot's chunk. `--join` joins the chunks that exist. `--from-hd` makes the `formats.preview` copy by scaling down a `formats.hd` film of the same build. `--review` makes the review cut |
| `npm run loop -- --tier T --format F` | The card loop, its web copy and the card still under `out/work/loop/`. Takes `--first` and `--last` to render a range, and `--join` to join the ranges that exist, so the loop can be split across sandbox agents |
| `npm run stress` | For two holds and two shakes, half a second of film at `formats.hd`, encoded at `export.bitrateMbps` and again at `quality.compressionStressMbps`, with stills from both |
| `npm run pack -- --phase N --round R --unit ID` | The critic packs for a round |
| `npm run look -- --add FILE --caption TEXT --by NAME` | Adds a picture to the look log |
| `npm run status -- --phase N --unit ID` | The status pictures and the gallery |
| `npm run keep` | Copies into `out/stills/` the judged stills, comparison images and sheets of the unit or phase just finished, each with its record. `--film` also copies the newest preview films into `out/`. `--deliver` copies the loop, its web copy and the card still to `deliver/` |
| `npm run review` | Builds the review page |
| `npm run hostcheck` | Builds from a clean copy and reports the size of `dist/`, the largest file, what loads before the first complete picture, and the build time. See "Hosting" |
| `npm run determinism` | Renders the same pictures on fresh page loads and in a different order, and compares them |
| `npm run gate -- --phase N` | The machine checks, and the deliverable checks that phase names, with a pass or fail line for each |
| `npm run render:local` | The local render. See below |

Rules:

- The browser runs headless with software WebGL in this workspace.
- Stills kept in `out/stills/` are stored compressed at high quality, so the repo stays small.
- Judged stills, comparison images, the loop and the films are rendered with the `full` asset set. If it cannot be loaded under software rendering, log it, render with the largest sizes that load, and say so in the record.
- Any command that can exceed `sandbox.chunkBudgetMinutes` does its work in chunks and can be run again to continue.
- At most `sandbox.maxRenderProcesses` render processes run at once in one VM. Sandbox agents in their own VMs render ranges in parallel.
- Every harness output is written under `out/work/`, which git ignores.

### Films, chunks and disk

- A film is rendered one shot at a time, a hold together with the shake that ends it where the cross-machine rule asks for it. Each chunk is encoded with the film's final settings and a closed group of pictures, so chunks join without being encoded again. The sound is added when the chunks are joined.
- In this workspace films are rendered at `film.previewFps`: every frame whose index is a multiple of `film.fps` divided by `film.previewFps`.
- Encoding: `export.videoCodec` in an `export.container` file, at `export.bitrateMbps` in `formats.hd` and at `previewFilm.bitrateMbps` in `formats.preview`. Sound is encoded as `export.audioCodec` at `export.audioKbps`.
- Film A is its opening's chunk joined in front of film B's chunks. Film B is never rendered twice for it.
- The card loop's frames are indexed at `film.fps`, like a film's. In this workspace it is rendered at `deliver.cardLoop.fps`: every frame whose index is a multiple of `film.fps` divided by that rate. The frame one past the last is then still frame 0.
- Frames are deleted as soon as their chunk is encoded. No command ever holds more than `sandbox.maxFramesOnDisk` frames on disk.
- Every render command checks free disk first. Under `sandbox.minFreeDiskGb` it deletes old output under `out/work/` and checks again before it refuses to start.
- A sandbox agent returns its chunks to the Builder as attachments. If attachments cannot carry video, the agent pushes its chunks, with their records, to its own branch under `out/chunks/`. The Builder fetches that branch and copies the chunks out without merging it. If neither works, the Builder renders the range itself.
- Every running long job is written under "Running jobs" in `kit/PROGRESS.md` when it starts: the command, the range, the log file, the VM and the time the render budget says it should take. It is removed when the job is done.

### The clock

`npm run clock` keeps `kit/CLOCK.json`. It is the first harness command built, and it is committed with every status.

- `npm run clock -- --start` marks the start of a task. It adds no time, and the next tick counts from it. A tick made on a different machine boot from the last one is treated the same way, so a forgotten `--start` cannot count the time between two tasks.
- `npm run clock -- --phase N` is a tick. It adds the whole time since the previous tick or start to phase N.
- `npm run clock -- --review-round N` ticks review round N. The first tick of a round opens it with `budget.reviewRoundHours`. Its time is kept apart from both allowances. It prints the time used in the round out of the time allowed, and `extra rounds: yes` or `no`, which is no once those hours are used. It never prints `budget report: due`.
- `npm run clock -- --review` records that the review was approved. From then on the allowance in force is `budget.afterReviewHours`, counted from zero, and Phase 6 has all of it as its box. A second call changes nothing.
- `npm run clock -- --continue N` records continuation N, where N is "Continuations" in `kit/PROGRESS.md` plus one. The Builder writes the new count back. Before the review it gives each of Phases 0 to 5 that is not `done` a new box: `budget.continueHours` split in proportion to those phases' boxes in `budget.phaseHours`. After the review it gives Phase 6 all of `budget.continueHours`. From then on the lines below are measured from the start of the continuation against the new boxes.
- `npm run clock -- --extension N` ticks an extension after completion. Its time is kept apart from the build's. It prints the time used in the extension out of `budget.extendHours`, and `extra rounds: yes` or `no`, which is no once those hours are used. It never prints `budget report: due`.
- A tick with `--phase N` prints, in plain words:
  - Time used in this phase and under the allowance in force, and the time allowed.
  - `extra rounds: yes` or `no`. It is no once the time used under the allowance has reached the sum of the boxes up to and including this phase. In Phases 5 and 6 it is also no once the time left before the budget report is under `budget.reserveHours` for that phase.
  - `half point: reached` once this phase has itself used half of its own box.
  - `box end: reached` once this phase has itself used all of its own box.
  - `budget report: due` once the time used has reached the time allowed.
  - Minutes since the last status, and `status overdue` once that passes `budget.statusMaxGapMinutes`.
- The Builder reads those lines and follows the clock rules in `AGENTS.md`. The script decides nothing by itself.

### Looks and status

- A look is any picture someone rendered in order to look at it. `still`, `crops`, `compare`, `sheet` and `seq` each append a line to `out/work/looks/index.jsonl`: the file, a short caption, the time and who made it. A pipeline script that renders a preview adds it with `npm run look`.
- A build or render agent pushes its newest looks to its looks branch, `agent/<folder>-looks`, with every heartbeat. That branch is fetched and never merged. A short-lived agent attaches its looks to its report. The Builder adds both to the log with `npm run look`.
- A long render job writes a look at least every `budget.statusMaxGapMinutes`, so a status has something new to show while the job runs.
- `npm run status -- --phase N --unit ID` does this:
  1. Runs a clock tick for phase N. With `--review-round N` or `--extension N` in place of `--phase N` it ticks that instead.
  2. Chooses up to `status.maxPictures` pictures. First, for the unit in hand, one of its keys beside its approved image, reusing a still whose record matches the current build and otherwise rendering one at the `review` tier. Then the newest looks not already shown, the Builder's and the ones fetched from agent branches. With no `--unit` it uses the newest whole-globe still and the newest sheets. With `--sounds` the first picture is the waveform sheet of the kept sounds.
  - It never waits for the render slot. If a render job is running in this VM it renders nothing and uses the newest frames that job has written and the newest looks.
  - It never comes back empty. If nothing has been rendered yet, it uses `references/approved/contact-sheet.jpg`.
  3. Resizes each to at most `status.pictureLongEdgePx` on the long edge.
  4. Writes them to `out/stills/status/`, replacing the last set, with `STATUS.md` holding the captions and the time.
  5. Writes whatever file the inline display method from Phase 0 needs under `out/work/status/`.
  6. Prints the lines of the status message, including the time used out of the time allowed.
  - With `--no-render` it renders nothing and uses only pictures that already exist. With `--no-tick` it does not tick the clock. The pictures above a `REVIEW` block use both. The pictures above a `BUDGET REPORT` block use `--no-render`.
- The Builder then shows the gallery in the thread and posts the lines, as "Showing the work" in `AGENTS.md` says.

## The rough cut

`npm run animatic` exists so Brandon can judge the film's pacing before anything is built.

- It needs no 3D. It is made from the approved images with `ffmpeg` or a small script.
- It follows `film.shots` on the default grid, frame for frame at `film.previewFps`, in `formats.preview`.
- A hold shows its season's at-rest image with a slow push. A shake shows the outgoing season's at-rest image streaked sideways, crossing to the incoming season's mid-shake image, which holds for the first beats after the landing. `open` starts on a tight crop of the winter image's miniature and widens, and `close` does the reverse.
- A small label in one corner names the shot. This is the only place a label appears over a picture, and only in the rough cut.

## The audio map

`npm run audiomap` reads a piece of music and writes its map.

- It holds: the length, the tempo, the time of every beat, which beats are bar lines, the sections with their start, end and average loudness, and the start of the loudest section.
- Decode with `ffmpeg`. Find onsets and beats with a Python library if one installs here, and otherwise with your own spectral flux tracker. If the workspace's audio map skill was found in Phase 0, run it too and prefer where both agree.
- Check it two ways that need no ears: the beat spacing is steady inside each section, and two methods agree on the tempo. If they do not agree after three tries, write a grid at the tempo that fits the music's length in whole bars, mark the map `grid`, and log it.
- Phase 2 tests it on a click track made with `ffmpeg` at a known tempo.
- `npm run cut` then fits `film.shots` to the map by the rules in `kit/01-FILM.md`.

## The local render

The masters are not made here. Brandon's computer has a real graphics card, and a film that is computed frame by frame does not care how fast the machine is. `npm run render:local` is the tool for it. It is run on his computer after the build, from a fresh clone, by an agent working for him.

- It needs Node, an installed Chrome and `ffmpeg`. It uses the installed Chrome with its graphics card on, in a visible window, and never downloads a browser.
- `npm run render:local -- --what film-b --test` first renders one judged still and writes it beside the kept still of the same key with their PSNR, so a machine that draws the scene differently is seen before a long render. Then it renders the first `export.local.testSeconds` seconds, assembles them with sound, opens the result and stops.
- `npm run render:local -- --what film-b --go` renders the whole film: every frame at `film.fps` in `formats.master`, at the `final` tier with the `full` asset set, through `capture` mode. Frames are written and assembled in chunks, so a run that is interrupted carries on where it stopped. The chunks are joined with the final mix into an `export.local.container` file with `export.local.videoCodec`, named from `export.files`.
- `--what film-a` renders the opening and joins it in front of film B's chunks, reusing them if they exist. `--what loop` renders the card loop at `film.fps` and writes the card still from its frame 0.
- If `audio/final/` holds no mix, it renders silent and says so in its last line.
- It checks before it starts that the frame count equals the film's length times `film.fps`, and after it ends that the file holds that many frames.
- `npm run render:local -- --proof` is the proof made in this workspace: the same code path with software graphics, in `formats.preview` at the `draft` tier, for `export.proofSeconds` seconds of film B across a landing and the same of film A's opening, with `ffprobe` on both results.
- No master is rendered in this workspace unless `deliver.sandboxMaster` is true.
- `README.md` gives the exact commands, written for someone opening the repo for the first time on a Mac.

What is rendered here are the preview films: film B and film A in `formats.hd` at `film.previewFps`, with the final mix, at the highest tier whose wall-clock time fits `sandbox.previewFilmMaxHours` with the shots split across sandbox agents, and never below `draft`. A film in `formats.hd` is too large to commit. It goes on the review page and is attached to the final message. `out/` holds its copy in `formats.preview`, named from `export.files`, and that copy is what is committed.

## The probe

`?mode=probe` measures what this workspace cannot: frame rate on a real graphics card.

- It runs each level of `live.quality` for `perf.probeSeconds`: first at rest, then through a shake.
- It shows, for each level: median frames per second at rest and in the storm, and the slowest one percent. Then the graphics card's name as the browser reports it, the screen size and the level the app would pick.
- It ends with one block of plain text and a Copy button, so Brandon can paste the numbers into the thread.
- It works on a phone and a tablet.

## Hosting

Two places host this, for two purposes.

- This workspace's app hosting, while the build runs: publish `dist/` with the review page so Brandon can open every link from the thread. Use `slug` for the address and `name` for the site's name.
- Brandon's own hosting, named in `host.name`, after the build: the public portfolio piece. The repo must deploy there as it stands, and the address must open the globe in `live` mode with nothing else on the page.

For the second:

- `npm run build` on a clean clone, with nothing installed but the repo's packages, produces the whole site in `dist/`. No Blender, no Python, no browser download, no network call except the package registry.
- The site is static, with relative URLs, and works from any host at any base path. No server code, no environment variables, no runtime network calls except its own files.
- `dist/` holds the web asset set and `public/audio/` only. `assets-full/`, `audio/`, `references/`, `out/`, `pipeline/` and `scorecards/` are never copied into it.
- `vercel.json` at the root names the build command and the output folder, and sets long cache lifetimes for hashed files. `.vercelignore` lists the folders above.
- Limits, from `host`: `dist/` is at most `maxShippedMb` in all, no file is over `maxFileMb`, everything fetched before the first complete picture of `defaultSeason` is at most `firstLoadMaxMb`, and a clean build takes at most `maxBuildMinutes`. `npm run hostcheck` measures all four. Check G16 reads its result.
- The asset sizes in `assetSets.web` are the starting point for fitting those limits. If the web set does not fit, lower its texture sizes for the largest parts first, and log it.
- In Phase 0, read the hosting provider's current limits page and record what its static file limit counts. If that changes what `host.maxShippedMb` should be, log it as a note for Brandon. Do not change the key.
- The app runs in current Chrome, Safari, Firefox and Edge, and in Safari on a phone and a tablet. If a second browser engine can be driven in this workspace, load the app in it and keep a still. If not, log that it was not tested here.

### The review page

Brandon reviews on a tablet. He needs one link where everything plays.

- `npm run review` writes `dist/review.html` and copies into `dist/review/` whatever exists of: the pictures in `out/stills/status/`, `out/roughcut.mp4`, the review cuts, the preview films, the newest `formats.hd` films under `out/work/` if there are any, the card loop and card still, every comparison image and sheet in `out/stills/`, the candidates' mixes, and every kept sound.
- The page has seven parts, in this order: Latest (the newest status pictures with their captions and the time), Open it (links to the app, each season by its own link, the probe, the films in `autopilot` and the loop), Listen, Films, The card, Comparisons, Motion.
- Listen holds: for each candidate, its review cut as a video with sound; then every cue with a player, its name, its length and the prompt that made it; and the music of each season on its own.
- Motion holds the sheets of the shake, the arrivals and the camera moves.
- Each video plays in the page and each image is shown at full width. The page carries the date, the current phase and the time used from `kit/PROGRESS.md`.
- It is plain HTML with no framework. It is not part of the app, not part of any hash, and never part of a build for `host.name`.
- Run it before every publish here.
- If this workspace's hosting does not accept the size, leave out the largest videos and say so on the page.

## Tests

- Config validation, including every failure case above.
- Framing: the three checks of `kit/02-SUBJECT.md` section 9.
- Seeded random: same seed, same stream, same values.
- The simulation: the same start and the same globe motion give the same state at step N whether the steps were run one at a time or in groups; no particle ends outside the sphere; the share inside a solid is at most `sim.maxInsideFraction` after a shake and a settle.
- The liquid model: at rest it stays at rest; after a shake it decays; every velocity it gives lies inside the sphere and slides along the wall.
- The shake: the path starts and ends at rest height, touches the surface on the landing and not before, and its three parts have the lengths the config gives.
- Film: the shots fill the film with no gap or overlap, every shake is one bar, every landing is on a bar line of the grid or the map, every part's change lies inside its swap window, the camera is at `hero` at the start of every shake, and the judged frame list follows its rule.
- The loop: every period divides the loop length, and every particle's path closes.
- The clock: `--start` adds nothing, a tick on a new machine boot adds nothing, every other gap is counted in full, `--review` starts the second allowance and a second `--review` changes nothing, a review round's time touches neither allowance, the reserve switches `extra rounds` at the right moment, `--continue` gives the unfinished phases new boxes, and each printed line switches at the right moment.
- Sampler: sequences are deterministic and cover the pixel, the shutter and the lens.
- The mix: the same inputs give the same bytes.
