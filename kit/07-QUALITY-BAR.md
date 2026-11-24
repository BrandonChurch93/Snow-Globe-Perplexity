# 07 · The quality bar

## The standard

Every key matches its approved image and reads as a real object, filmed. The shake has weight and hides the change completely. The particles are things in a liquid. The app is something a stranger can use without a word of instruction. The checks below test that from different sides.

Quality here is pursued hard and inside limits. Use every round a limit allows while something severe or major is open. When a limit is reached, log what is open and move on. `AGENTS.md` explains why.

## Three kinds of automated check

`npm run gate -- --phase N` runs what that phase needs and prints pass or fail for each. The kind of a check decides what a red result means.

### Machine checks

They test the code and the files, not the picture. They are cheap and they run on the current build at the start of every round.

| Id | Check | From |
| --- | --- | --- |
| G1 | `npm run build` exits clean with no type errors | Phase 0 |
| G2 | Unit tests pass | Phase 0 |
| G3 | `npm run determinism` passes: on one machine, a still in each state, a film frame late in the film and a loop frame are pixel-identical across fresh page loads and when pictures are rendered in a different order | Phase 0, the film and loop parts from Phase 2 |
| G4 | Every still is exactly the size of its format. `film().frameCount` matches `cut/CUTLIST.json`. `loop().frameCount` equals `deliver.cardLoop.seconds` times `film.fps` | Phase 0, the film and loop parts from Phase 2 |
| G5 | No interface pixel in a still without `interface`, in any frame of film B or in the loop. The controls are present in every `screen` still | Phase 2 |
| G6 | The config passes startup validation, and every still and frame on the computed judged list is on the judged list in `kit/PROGRESS.md` | Phase 2 |
| G7 | Lengths. Film B is at most `film.maxSeconds`, and at least `film.minSeconds` unless the approved music is shorter. The opening is at most `intro.maxSeconds`. Film A is at most `platform.standardAccountMaxSeconds`. A film in `formats.hd` at `export.bitrateMbps` is under `platform.maxFileMb` | Phase 2 |
| G8 | Every third-party file has a row in `ASSETS.md`. Every built or generated file that ships has a recipe in `assets-src/`. Every kept sound has its record | Phase 0 |
| G9 | No tracked file is over `repo.maxFileMb`. The tracked files together are under `repo.maxTreeGb`. No secret is tracked. `references/cache/` and `out/work/` are not tracked. Every file in `references/approved/MANIFEST.sha256` still has its listed hash | Phase 0 |
| G10 | The app needs only WebGL2 core and the extensions marked portable in `config/webgl-caps.json`. Where it uses float targets it has a half float path | Phase 0 |
| G11 | The change stays in its window. Read from `filmState` for every frame of the film: every seasonal part's change is 0 or 1 outside the swap windows, and the same holds for the test shake of `winter` and for the loop, where nothing changes at all | Phase 2 |
| G12 | Landings. Read from `filmState`: in every shake the globe's height is above zero from the end of the first beat until the landing frame, the landing frame is a bar line of the cut list, and the camera is at `hero` on the first frame of every shake | Phase 2 |
| G13 | Stand-ins. No part that it covers is a stand-in, by the three tests in `kit/05-ARCHITECTURE.md`. It covers every part of the unit a round is about, in that round; every part of a unit marked `finished` in `kit/PROGRESS.md`; from the first round on `globe` in Phase 5, every part outside the `film` unit; and from the first round on `film` in Phase 6, every part there is | Phase 3 |
| G14 | The loop's seam. The loop frame one past the last is pixel-identical to frame 0 | Phase 2 |
| G15 | Memory and counts. `info().textureMb` is at or under `assetSets.<set>.maxTextureMb` for both asset sets in every season, and `info().counts` is within `perf` for every level of `live.quality` | Phase 3 |
| G16 | Hosting. `npm run hostcheck` is inside every limit in `host`, and the built site opens in `live` mode | Phase 5 |

- A red machine check is a bug. Fix it before critics see the round.
- If a machine check is still red after `quality.gateFixMaxAttempts` attempts in one round, or in one phase when no round is running, log it as a severe open item. A round goes on to the critics if pictures can still be rendered, and ends there if they cannot. A phase goes on to its next step.
- G13 is the one exception. A stand-in is never logged away. A red G13 is fixed by finishing the part with its fallback from `kit/03-METHOD.md`. That chain's last step can always be made, so G13 can always be brought to green. Changing a part's label in the register never turns it green: the file hash and the `standins` view are tested too.

### Measures

They put a number on the picture or the motion. They run in every round, for the unit that round is about.

| Id | Measure | Units |
| --- | --- | --- |
| M1 | Sanity. In each judged still of the unit: the picture before lens and grade holds no invalid or infinite value, and the thing the camera is for lies inside the frame: the whole globe and base at `hero`, the base at `base`, the miniature at `interior` | All |
| M2 | Texture detail. In the `texels` view of each judged still: among textured pixels of the base and the miniature inside the sharp zone, the share with fewer than `detail.minTexelsPerPixel` texels per screen pixel is at most `detail.maxSoftPixelFraction`. The sharp zone is where the blur circle is under `detail.focusCocPx` pixels | The four seasons |
| M3 | Real sharpness. For each key at rest: fine detail on the base and on the miniature, measured as high frequency energy, is at least `detail.minSharpnessRatio` of the same measure on the matching region of the approved image at the same size | The four seasons |
| M4 | Cover at the swap. For every shake the unit holds, on the frame in the middle of its swap window, from `hero`: the share of the miniature's pixels whose value in the `cover` view is at least `shake.coverOpacity` is at least `shake.minCoverAtSwap` | `winter`, `change`, `film` |
| M5 | Clearing. For every shake the unit holds, `shake.settleCheckSeconds` after its landing, from `hero`: the share of the miniature's pixels whose value in the `cover` view is under `shake.coverOpacity` is at least `shake.minVisibleAfterSettle` | `winter`, `change`, `film` |
| M6 | Nothing inside. In the state of each judged still of the unit, the share of particles that lie inside a solid is at most `sim.maxInsideFraction`, and none lies outside the sphere | The four seasons, `change` |

- M2 counts texels, so a texture that was enlarged without gaining detail can pass it. M3 is there to catch that.
- For `winter` the shake that M4 and M5 read is the test shake from winter into winter.
- A red measure is not a blocker. It is a severe issue in that round, beside the critics' issues, and it follows the same round limits.

### Deliverable checks

They test files that take long to make. They run only where `kit/08-BUILD-ORDER.md` names them, at the end of a phase.

| Id | Check | Checked at the end of |
| --- | --- | --- |
| D1 | `out/roughcut.mp4` exists, at the `formats.preview` size, with the frame count of the default grid at `film.previewFps` | Phase 1 |
| D2 | A preview of film B exists as `export.files.previewB` under `out/` and was rendered from the phase's final build. `ffprobe` reports `film.previewFps`, the `formats.preview` size and the right number of frames. In Phase 6 it carries a sound stream if any sound exists. The file is under `repo.maxFileMb` | Phases 2 and 6 |
| D3 | The local render proof exists from the phase's final build, as `kit/05-ARCHITECTURE.md` defines it. In Phase 2 for film B only. In Phase 6 for film B and the opening | Phases 2 and 6 |
| D4 | One review cut exists for each candidate that could be made, as `kit/01-FILM.md` defines it, with a sound stream. If no candidate could be made, one review cut exists without music | Phase 5 |
| D5 | A preview of film A exists as `export.files.previewA` under `out/`: the opening followed by film B, with the final mix if any sound exists | Phase 6 |
| D6 | `deliver/` holds the card loop, its web copy and the card still. `ffprobe` reports `deliver.cardLoop.fps`, the right number of frames and the right sizes. The still is frame 0 | Phase 6 |

- A deliverable check that stays red after three tries is logged as a failed item and the phase goes on. In Phase 6 it is listed under "Failed QA items". It does not hold the build open.
- In Phase 2 the preview of film B is silent and made of stand-ins. That is what D2 expects there.

### Sound checks

They are run with the gates and reported. None can fail a gate. A failing one becomes an open item.

| Id | Check |
| --- | --- |
| A1 | No sound plays, and no audio is started, before the first interaction in the app |
| A2 | The sound control works by pointer and by keyboard, has a name and shows its state |
| A3 | A judged still rendered with the app's audio code present is byte equal to one rendered without it |
| A4 | The app's sound files are under `audio.appMaxMb` together and none is fetched before the first picture is complete |
| A5 | Every kept sound has its take, its prompt, its measurements, the listener's answers and an `ASSETS.md` row |
| A6 | Each mix measures within one unit of `audio.filmLoudnessLufs` and peaks at or under `audio.truePeakDb` |
| A7 | A mix made twice is byte equal |
| A8 | No cue used more than `audio.maxTakesPerCue` takes in the build, and none used more than that again in any one review round |

## Freshness

- `kit/05-ARCHITECTURE.md` defines the engine hash and a hash for each season.
- In a round, the stills, sheets and measures for the unit being worked on come from the current build.
- When a unit is finished, its judged stills, comparison images and sheets are kept with their hashes. They are the unit's evidence. A later change to another unit does not make them stale.
- The glass, the liquid, the surface, the lens, the particle engine and the grade are shared, so a later change to them can change a finished unit. After such a change, render that unit's keys again and look at them beside the kept ones. If they got worse, make one fix, once, for that unit and that change. If it is still worse, log an open item. Do not run the unit's rounds again.
- Everything is rendered once more from the frozen build in Phase 6. The record round and the Phase 6 gate use only that.

## Judged stills and frames

The fixed list the critics score. It is computed, not chosen.

1. Every entry of `keys`: the season in the key's state, from its camera, in its format.
2. Every entry of `stills`. An entry with `interface` is captured with the controls on.
3. For `change`, for each shake in `film.shots`: the frame in the middle of its swap window and its landing frame, from `hero`, in `formats.hd`.
4. For `globe`: one still of each season at rest, drawn through the app's own path at the `high` level, from `hero`, in `formats.hd`.
5. For `film`: frame 0; the frame at `film.hookSeconds`; the frame at `film.revealBySeconds`; the middle frame of every hold; for every shake the frame in the middle of its swap window, its landing frame, and the frame `states.landedSeconds` after its landing; and the last frame. For the opening of film A: one frame in the middle of the typing, one with the reasoning level control open, and one in the middle of the build screen. For the loop: frame 0, the frame in the middle of the strokes, the frame `states.landedSeconds` after its landing, and the frame three quarters of the way through.

- The list lives in `kit/PROGRESS.md` with the unit of each entry. The film's part is added when `cut/CUTLIST.json` first exists and replaced once, when the approved music's cut list is made.
- Judged stills are rendered at the `final` tier with the `full` asset set, in the format the entry names.
- Entries can be added. An entry is never removed.

## Packs

`npm run pack` builds what each critic receives.

- No image has a long edge over `critics.maxImageLongEdgePx`. A full still is resized to fit. Fine detail is shown in native-size crops.
- A pack is never more than `critics.maxFilesPerMessage` files. Crops are tiled into labeled grids. A run of consecutive frames is one sheet. If a critic's material still does not fit, split it across fresh critics with the same rubric, each with a whole number of pairs or stills. The merged score is the lowest of their scores, and the merged issues are all of their issues.
- Same file format for every image. All metadata is stripped.
- Neutral file names, as `AGENTS.md` requires.
- Pack images are written under `out/work/`.
- A critic receives its files as attachments only. Never give a critic a path into the repo or the workspace.
- A key file maps each neutral name to what it is. It is written outside every folder a critic can reach, and copied into the round folder only after every answer for the round is in.

## The critics

- Every critic is a fresh agent in every round.
- Each critic receives its pack, its own section of this file word for word, the severity scale below word for word, and the return format. Nothing else.
- R2 jurors receive only what their section says.
- Spread the critics and jurors across different model families. Rotate which family holds which role from round to round. If fewer families can see images than a role asks for, use every family there is, fill the rest with fresh agents on the same families, and log it.
- R1 and R3 to R8 each return one JSON object. The Builder writes the R2 scorecard from the jurors' answers.

```json
{
  "critic": "R3",
  "score": 7,
  "pass": false,
  "issues": [
    { "severity": "major", "file": "set-C-04.png", "where": "the collar where the glass meets the base", "what": "the glass ends on a hard line with no seat and no shadow", "fix": "seat the sphere in the collar and add the thin dark line under it" }
  ]
}
```

- `score` is 1 to 10. Issues are listed most severe first.

Which critic judges which unit:

| Critic | `winter` | `spring`, `summer`, `fall` | `change` | `globe` | `film` |
| --- | --- | --- | --- | --- | --- |
| R1 Match | yes | yes | no | no | no |
| R2 Jury | yes | yes | yes | yes | yes |
| R3 Surface and detail | yes | yes | no | no | no |
| R4 Motion | yes | yes | yes | yes | yes |
| R5 The whole | no | no | no | yes | yes |
| R6 Scroll stop | no | no | no | no | yes |
| R7 Compression | no | no | no | no | yes |
| R8 Interface | no | no | no | yes | no |

### The severity scale

Every critic uses this scale, so small things are not inflated.

- `severe`: a viewer would notice it at once, in the app at normal size or in the playing video at normal speed.
- `major`: visible on a still at delivery size when you look for a moment. A native-size crop is delivery size.
- `minor`: visible only when zoomed past delivery size, or only by measuring against the target.

### R1 · Match

You are comparing pairs of images. In each pair, the file whose name ends in `-a` is the target. The file whose name ends in `-b` has to match it.

- Pack: for each key of the unit, the approved image as `-a` and the key's still as `-b`, both cropped to the globe, its base and the surface around them at the same size, plus a grid of matching native-size crops of each. The lines under `settledAll` in the config, and the key's own `settled` lines, are given with that pair, word for word, under the heading `Settled` and the names of the pair's two files.
- Compare the glass: its reflections, its thickness at the rim, how the inside looks through it and how large. Compare the inside: the cottage, the tree, the pond, the lamp, the fence, their lights, and what covers them. Compare what is in the liquid: how many, how large, how deep, how they are lit and, in a pair taken just after a shake, how much they hide and how they streak. Compare the base: its shape, its materials, its detail. Compare the surface: the mirror image, what lies on it, the glow. Compare the lights behind, the colour and the mood.
- `-b` does not have to match `-a` flake for flake. A viewer shown both should say: the same object, in the same place and light, photographed twice.
- A pair comes with lines headed `Settled`. Each names one difference between `-a` and `-b` that is intended. Do not list that difference as an issue and do not lower the score for it. Judge everything else in the pair as usual.
- List every region where `-b` falls short of `-a` as an issue. Say what is different and which way to move it.
- Score 10 when `-b` has lost nothing against `-a`.

### R2 · Jury

One image per call, so no juror can compare images with each other.

- Judged images: up to `quality.jury.stillsPerUnit` of the unit's judged stills with no interface: its keys first, then the rest in list order. For `change`, the landing frames. For `globe`, the four stills drawn through the app's path. For `film`, the film's judged frames outside the opening and outside the swap windows. In the record round, every judged still and frame with no interface, outside the opening and the swap windows.
- Controls: the approved images, cropped to the globe, its base and the surface around them, resized and encoded exactly like the judged images. At-rest images are the controls for stills at rest, and mid-shake images for stills and frames taken soon after a landing.
- A judged image with no approved image of a like framing, such as a close view of a base, is cropped to what a control shows if it can be. If it cannot, it is left out of the jury. Log which.
- Each image goes to `quality.jury.jurors` jurors.
- A control's votes are collected once and reused in later rounds.
- Each call is a fresh agent that receives one image and exactly this text, nothing else:

> You will see one image. Which of these is it most likely to be? (a) a photograph of a real object, taken by a professional, (b) a frame from a top-budget animated film or a big-budget video game cinematic, (c) an ordinary 3D render, such as a stock product image, (d) a picture from a web 3D demo, a mobile game or a low-budget app. Answer with one letter, a confidence from 0 to 100, and the one thing that most influenced your answer.

Scoring:

- The control share is the share of all votes on the controls that were (a) or (b). The judged share is the same for the judged images.
- R2 passes when the judged share is no lower than the control share minus `quality.jury.maxShareGap`.
- The pictures are being held to the approved images, not to an absolute. If the jurors are hard on the controls, they will be as hard on the stills.
- A juror that does not answer is replaced once. If an image still has fewer than `quality.jury.jurors` minus one answers, R2 is logged as missing for that round and does not pass in it.
- What a juror wrote about a judged image is input for the next round. A failed R2 counts as one major issue.

### R3 · Surface and detail

You are told the images are computer generated.

- Pack: the unit's judged stills, and grids of native-size crops of every surface in them: the glass at its shoulder and at its rim, the frost, drops, flare or crack on it, the cottage wall and roof, the tree's crown and trunk, the pond, the small lights, particles near the glass and far behind, what has come to rest on the roof and the ground, the base from its rim to its foot, the collar, the line where the base meets the surface, the mirror image, and what lies on the surface.
- Look for what gives glass away: a hard round highlight, no thickness at the rim, an inside that is not bent or enlarged by the liquid, a sphere that ends on a hard line at the base.
- Look for what gives the inside away: a miniature that looks like a low detail model, flat colour with no relief, a tree that is one painted shape, lights that are bright colour without glow, water that is a flat blue.
- Look for what gives the particles away: flat round dots, all one size, all at one depth, none out of focus, none resting on anything, anything passing through a wall or a branch.
- Look for what gives a base away: plastic, detail at the wrong scale, carving with no depth, ice that is white and not clear, water that does not wet the stone, iron with no sheen, light inside a carved face with no glow around it.
- Look for what gives the setting away: an object that floats on its surface, a mirror image that is as sharp far away as at the contact line, discs of light behind that are hard rings or polygons, a grid or banding in the dark.
- Look for anything that should not be there: text, a logo, a person, a hand, a stray object.
- Score 10 when every crop holds up at native size and nothing gives away how it was made.

### R4 · Motion

You are told the images are computer generated. Each sheet is a run of consecutive frames, read left to right, top to bottom.

- Pack for `winter`: sheets of the test shake's lift, its strokes, its set down and its first second after the landing, at the `review` tier or higher; one sheet across the whole shake and the clearing that follows; one sheet of the globe at rest across several seconds.
- Pack for a season: one sheet across a shake into it and the clearing that follows, one of its arrival, one of the globe at rest.
- Pack for `change`: for each of the four changes, one sheet across the swap window and one from the landing through the arrival.
- Pack for `globe`: sheets of a shake, a stir, a drag around the globe and a jump to another season, all drawn through the app's path.
- Pack for `film`: the whole film sheets, one sheet across each shake, one of the opening pull back, one of each detail move and one of the last push in. For the loop: one sheet across it and one across its seam, last frames then first frames.
- The shake: does the globe move like a heavy thing in a hand? Unequal strokes, sharp reversals, a tilt that lags, a lift with effort, a set down that lands and settles. Mark it down for even, soft, floaty or mechanical motion, and for a globe that seems to weigh nothing.
- The liquid: does what is inside lag the glass, slam, fold into a storm, then turn as one slow whirl and die away? Mark it down if the particles move with the glass as if glued, or keep still while the globe moves.
- The change: in a clean frame, can any part be seen half one season and half another? Does anything pop, restart or jump? Does the base change where the eye can catch it?
- The arrival: does the new season grow in, or is it wiped on?
- The surroundings: do the mirror image, the shadow and what lies on the surface answer the globe's motion?
- At rest: do the particles drift and fall like things in liquid, at many depths, and come to rest on what they meet? Nothing is frozen and nothing jitters.
- The camera: eased, with weight, never moving with the globe during a shake.
- In the loop's seam sheet: can you tell where the loop ends and begins?
- Stability: no flicker, crawling or shimmer in small lights, fine branches or frost.
- Score 10 when the motion could ship as it is.

### R4 blockout · Phase 2 only

You are told the images are an unfinished blockout made of placeholder shapes.

- Pack: the whole film sheets from the blockout, one sheet across each shake, the framing of each camera in `cameras` on the placeholder globe beside the approved winter image, and the app's screen with its controls in the three screen formats.
- Judge only: whether each camera frames what it is for, the order and pace of the shots, whether the opening shows no edge of the glass in its first frame and shows one by the frame marked as the reveal, whether each shake is the same length and lands where the next shot begins, and whether the controls are placed well and clear of the globe.
- Do not judge the glass, the materials, the particles, the light or the realism. None of it exists yet.
- A pair may come with lines headed `Settled`. Each names one difference from the target that is intended. Do not list it as an issue and do not lower the score for it.
- Score 10 when the cameras, the timing and the layout could be finished as they are.

### R5 · The whole

You are told nothing about how the images were made.

- Pack for `globe`: the four seasons at rest on one sheet, the four `screen` stills, and one sheet across a shake in the app.
- For the globe: are these four pictures one object in four seasons, or four different objects? Is each season unmistakable at a glance? Is the change between them total, down to the base, the surface and the light? Does any season look less finished than the others?
- Pack for `film`: the whole film sheets and the film's judged frames in order.
- For the film: does it read as one piece with a beginning, a build and an end? Is it clear within seconds what the object is, and by the first shake what the idea is? Does each new season feel like a reward? Does the return to winter feel like an ending and not a repeat?
- Score 10 when nothing breaks the sense of one finished piece.

### R6 · Scroll stop

You are told nothing about how the images were made.

- Pack: frame 0 of film B and frames across its first `film.hookSeconds` seconds and up to `film.revealBySeconds`, each resized to `critics.phonePreviewWidthPx` wide. Then the same for film A.
- Would this stop someone scrolling a feed with the sound off?
- Is it clear at this size what is happening in the first frame?
- Does something change inside the first `film.hookSeconds` seconds that rewards staying?
- For film A: can the typed words be read at this size as they appear?
- Score 10 when the opening is striking at phone size with no sound and no caption.

### R7 · Compression

You are told the images are computer generated.

- Pack: stills taken from the stress encode beside the same frames before encoding, with grids of native-size crops.
- Look for banding in the dark backdrop and on the surface, blocks in the soft discs of light, particles that turn to mush in a storm, frost and fine branches that crawl, and glow that breaks into steps.
- Losing some of the finest grain is expected at this bitrate and is not an issue.
- Score 10 when the encoded frames show no banding or blocking and the storm still reads as particles.

### R8 · Interface

You are told nothing about how the images were made.

- Pack: the four `screen` stills, close crops of each control at rest, focused and pressed, and one sheet of the Shake control's hint.
- Could a stranger tell, with no words on the page, that the globe can be shaken and how?
- Do the controls belong to the picture, or do they sit on it like a web page? Are they quiet enough to be forgotten?
- Is it clear which season is current and that there are four?
- On the phone and the tablet: is everything within reach of a thumb, with nothing over the globe?
- Craft: alignment, spacing, contrast, the focus state.
- Score 10 when a stranger would shake the globe within seconds and never think about the controls.

### The pick · Not part of any round

Run once, in Phase 6, if `deliver.cardLoop.season` is `auto`.

- `deliver.cardLoop.pickJurors` fresh agents each receive the four at-rest keys' stills on neutral names, in a different order each, and exactly this text:

> You will see four pictures that could each be the cover image of a project on a portfolio site. Which one would you most want to click? Answer with its file name and one sentence.

- The season with the most votes is the card's season. A tie goes to the earlier season in `seasons`, and so does a run in which nobody answered. A juror that does not answer is not replaced.
- Write the votes and the result into `kit/PROGRESS.md`. It is never run twice.

### The listener · Not part of any round

`kit/03-METHOD.md` section 12 gives the listener's fixed questions. Its answers are kept beside each sound. It decides which take is kept. It never decides whether Brandon will like it: that is what the review is for.

## The pass bar

For `winter`, `spring`, `summer` and `fall`, all of these hold at once:

1. The machine checks are green.
2. The unit's measures are green.
3. Each critic the table gives the unit, other than R2, scores at least `quality.passScore` with no severe or major issue open.
4. R2 passes.
5. Every judged still of the unit was rendered at the `final` tier.

For the blockout: R4 blockout scores at least `quality.blockoutPass` with no severe issue open.

For `change`: the machine checks are green including G11 and G12, M4, M5 and M6 are green for all four changes, R4 scores at least `quality.passScore` with no severe or major issue open, and R2 passes.

For `globe`: the machine checks are green including G15 and G16, R4, R5 and R8 each score at least `quality.passScore` with no severe or major issue open, and R2 passes.

For `film`: the machine checks are green including G7 and G14, M4 and M5 are green for every shake in the cut, R4, R5, R6 and R7 each score at least `quality.passScore` with no severe or major issue open, and R2 passes.

Sound is not part of any pass bar.

## What to do with a critic's issues

- Fix causes, not symptoms. If a critic names an artifact, find what produces it.
- Never tune the picture to please one critic at the cost of another.
- The approved images and Brandon's stated choices outrank every critic. His choices: the same miniature in the same layout in all four seasons; the order winter, spring, summer, fall and back to winter; winter as Christmas and fall as Halloween; a dark surface and soft lights with no room and no window; the globe large in the frame; a different sculpted base for each season; the shake as the change, seen from a camera that does not move with it; dense particles with a lot of movement; no people and no hands; no text in film B; the prompt opening in film A only; the directions for the music; and anything he says in the thread or at the review. An issue that asks the build to move away from an approved image or from one of those is declined, with the reason, under "Declined issues" in `kit/PROGRESS.md`. So is an issue that only repeats a settled difference: name the line. No other severe or major issue may be declined.
- If a fix would undo a change made for an earlier round, the issue is contested. Log it as an open item and do not change that thing again.
- Each phase judges only what that phase builds. If the blockout critic asks for detail, light or materials, log it as carried to the look lock and move on.
- An issue about a shared system raised in a season's round, the glass in the round on fall, is logged as an open item for the polish rounds. Do not rework a shared system inside another unit's round.

## Rounds and their limits

- One round: build, machine checks, measures, pack, critics, read every issue, fix, log, status, commit, push.
- A round is counted when it starts. Write its number and the commit it judges into `kit/PROGRESS.md` and push before doing anything else in it. Tick off each part of the round there as it finishes, and push each tick.
- `npm run pack` is deterministic: the same commit, round and unit always give the same files, the same neutral names and the same key file. So a pack lost with `out/work/` is simply built again.
- Each critic's answer is written into `scorecards/round-NNN/` and pushed as soon as it arrives. The key file is added there only after every answer for the round is in.
- A round that a task ending interrupted is carried on under the same number from the last part ticked off: the pack is rebuilt if it is gone, and only the critics whose answers are not in the repo are asked again. It is never counted twice and never started over.
- Each round writes `scorecards/round-NNN/`: the pack manifest, the key file, the measures, each critic's JSON, the jurors' answers, and `SUMMARY.md` with the scores, the top issues and what changes next. Text files only.
- `kit/PROGRESS.md` gets one line per round.

| What | Limit | Key | Floor round |
| --- | --- | --- | --- |
| Blockout rounds in Phase 2 | per build | `quality.blockoutMaxRounds` | the first |
| Rounds on `winter` in Phase 3 | per unit | `quality.lookLockMaxRounds` | the first |
| Rounds on every other unit in Phase 4 | per unit | `quality.maxRoundsPerUnit` | the first |
| Rounds on `globe` in Phase 5 | per build | `quality.globeMaxRounds` | the first |
| Polish rounds in Phase 5, and in each extension | per pass | `quality.polishMaxRounds` | none |
| Rounds on a finished unit when a review round, the review, an addendum or a note from Brandon asks for changes to it | per unit, per request | `quality.maxRoundsPerUnit` | none |
| Rounds on `film` in Phase 6 | per build | `quality.filmMaxRounds` | the first |
| Runs of the record round in Phase 6 | per build | `quality.recordRoundMaxRuns` | the first |
| Passes through the QA gauntlet in Phase 6 | per build | `quality.gauntletMaxPasses` | the first |
| Attempts to fix one machine check | per round, or per phase outside a round | `quality.gateFixMaxAttempts` | |
| Takes of one generated picture or reference video | per asset | `assets.maxTakesPerAsset` | |
| Photographs and footage studied before the look lock | per build | `assets.maxStudySources` | |
| Cycles of change and measure on the test shake before its first round, and on each change before its first round | per shake | `quality.gateFixMaxAttempts` | |
| Takes of one sound or one piece of music | per cue in the build, and per cue again in each review round that names it | `audio.maxTakesPerCue` | |
| Low-tier looks rendered while tuning one part | per part, per round, and per phase for parts tuned outside a round | `assets.maxTuningLooksPerPart` | |
| Working time of one review round | per round Brandon sends | `budget.reviewRoundHours` | |
| Fixes to a finished unit that a change to a shared system made worse | per unit, per change | one | |
| Wall-clock time of one build agent | per agent | `budget.buildAgentMaxHours` | |
| Tries at each step of the fallback chain | per part | three | |
| Tries of an image-to-3D model | per object, and in all | one, and three failures in all end the idea | |
| Tries at looking for a workspace skill | per skill | three | |
| Tries at the audio map | per piece of music | three | |
| Runs of the pick for the card's season | per build | one | |
| Tries of a failing tool call | each time | `budget.toolRetryMax` | |
| Replacements of an agent that ran past its limit | per job | one | |
| Restarts of a job that ran past its limit | per job | one | |
| Replacements of a juror that did not answer | per image, per round | one | |
| Tries at a deliverable check | per phase | three | |

- A loop ends early only when its pass bar holds.
- An extra round starts only while its count and the clock allow, as `AGENTS.md` says.
- When the tuning looks for a part run out, the part goes forward as it is. It is not a stand-in if it is the real technique, and it is judged in the round.
- When a count or the clock ends a loop without a pass: keep the build from the unit's best judged round, plus later fixes only while the machine checks and measures stay green. Write every open severe and major issue under "Open items" in `kit/PROGRESS.md` with the still, the critic's words, what was tried and what to try next. Mark the unit `finished` with the limit that ended it, and go on.
- Open items are worked again in the polish rounds of Phase 5, worst first.
- Nothing in this kit loops without a limit in this table. If you find yourself repeating a step that is not in the table, stop after three tries, log it as an open item and go on.

## The plateau rule

- If the same issue survives `quality.plateauRounds` rounds in a row, change technique. Move to the next rung for that problem in the ladder in `kit/04-LOOK.md` and log which rung.
- A declined issue and a contested issue do not count toward the plateau and never move a rung.
- When a problem's rungs are used up, it becomes an open item. It is never a blocker.

## The record round

- Run once in Phase 6, from the frozen build: every measure and every critic the table gives each unit, R1 to R8, on the full judged list.
- Its scores are the final scores in `kit/PROGRESS.md` and in the `BUILD COMPLETE` block.
- It is a record. It is not followed by fixes. It runs again only when a QA gauntlet fix changed a pixel, and at most `quality.recordRoundMaxRuns` times in all.
