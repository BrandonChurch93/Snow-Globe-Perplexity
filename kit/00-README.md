# 00 · Read me first

Read `AGENTS.md` at the repo root before this file.

## Reading order

| File | What it settles |
| --- | --- |
| `config/showcase.json` | Every number, the seasons, the cameras, the shots, the units, the keys |
| `kit/01-FILM.md` | The two films shot by shot, the soundtrack, the card loop and the card still |
| `kit/02-SUBJECT.md` | The globe: its parts, the four seasons, the shake, the app, and what every unit shows |
| `kit/03-METHOD.md` | How each part is made, and its fallback |
| `kit/04-LOOK.md` | The bar, the light, the lens, the grade, and the ladder of techniques to climb when a picture falls short |
| `kit/05-ARCHITECTURE.md` | Code structure, determinism, the simulation, modes, the harness, the clock, status, hosting, the local render |
| `kit/06-ASSETS.md` | The approved images, settled differences, generated and built assets, sounds, third-party sources |
| `kit/07-QUALITY-BAR.md` | Checks, critics, the pass bar, the table of limits |
| `kit/08-BUILD-ORDER.md` | The phases, the review stop, the budget report, and what ends the build |
| `kit/09-QA-GAUNTLET.md` | The final acceptance list |
| `kit/10-KICKOFF.md` | For Brandon. Not instructions for the Builder |
| `kit/PROGRESS.md` | The Builder's memory |
| `kit/addenda/` | Numbered changes made after the kit was written |
| `references/drafts/round2/NOTES.md` | The record of the reference run: how each approved image was made, its faults, and the real photographs that were studied. Read "Faults seen in the kept images" and "Real photographs" before Phase 3 |
| `planning/audio-notes.md` | An early planning note. The kit replaces it. Where they differ, the kit wins |

## When files disagree

| Topic | What wins |
| --- | --- |
| Any number, any id, any file path of an approved image | `config/showcase.json` |
| How a picture should look | The approved image for that key, then `kit/04-LOOK.md` |
| A point listed under `settled` for a key, or under `settledAll`, in the config | The kit. On that one point it beats the approved image |
| What a part is, what a season holds, how the shake goes, what a unit shows | `kit/02-SUBJECT.md` |
| How a part is made | `kit/03-METHOD.md`, unless the ladder in `kit/04-LOOK.md` has moved you to another technique |
| What the films show and in what order | `kit/01-FILM.md`. After the review, the approved soundtrack decides the timing and Brandon's notes decide the rest |
| Whether something passes, and how many rounds it gets | `kit/07-QUALITY-BAR.md` |
| Code structure, the simulation and determinism | `kit/05-ARCHITECTURE.md` |
| When to stop, and how time is counted | `AGENTS.md` |
| A measurement of this workspace | Your own Phase 0 record, then `AGENTS.md` |

- An addendum beats every file above on its own topic. A higher number beats a lower one. A note from Brandon in the thread counts the same way.
- If a conflict is still open, pick the reading that gets the still closer to its approved image and log the choice.

## Working protocol

1. Check stop condition 1 in `AGENTS.md`.
2. Read `kit/PROGRESS.md`, then every file in `kit/addenda/`.
3. Find the current phase in `kit/08-BUILD-ORDER.md`.
4. Re-read that phase's "Read first" files from disk.
5. Do the steps. Verify the gate with evidence, not with a feeling.
6. Log, commit, push, publish, post the status.
7. Go to the next phase without waiting, unless `AGENTS.md` says to stop.

## Vocabulary

| Word | Meaning |
| --- | --- |
| The globe | The whole object: glass sphere, liquid, miniature and base |
| The glass | The sphere wall, with whatever the season puts on it: frost, dew, a flare, a crack |
| The liquid | What fills the sphere. It carries the particles and lags behind the glass when the globe moves |
| The miniature | The scene inside: island, cottage, tree, pond, lamppost, fence, path, and the season's own props |
| The base | The sculpted stand the sphere sits in. Each season has its own |
| The surface | The dark polished slab the globe stands on |
| The dressing | What a season lays on the surface around the base: frost, petals, sand, leaves |
| The backdrop | Darkness and soft out-of-focus lights in the season's colour |
| Season | One of the four entries of `seasons` in the config. A season sets every part above at once |
| Part | One thing that is built and can be a stand-in: a base, a miniature, a particle kind, the glass, the shake. `kit/03-METHOD.md` lists them |
| Particle kind | One sort of thing in the liquid: flake, glitter, petal, mote, firefly, seed, leaf, ember, bat |
| Veil | The fine haze of the season that thickens while the liquid churns: snow dust, petal mist, golden haze, green fog |
| The shake | The move that changes the season: lift, strokes, set down. One bar long |
| Stroke | One back or forth move of the globe during the shake |
| Swap window | The part of the shake, set by `shake.swapWindow`, inside which every part changes season, hidden by the storm, the blur and the light |
| Landing | The frame the globe is back on the surface. It lies on a bar line |
| Storm | The state of the liquid from the first stroke until the particles have thinned again |
| Cover | The share of the miniature hidden by particles and veil, read from the `cover` view |
| Landed | A state: `states.landedSeconds` after a landing, the liquid still turning. The mid-shake approved images show it |
| Rest | A state: `states.restSeconds` after a landing. The particles drift and fall gently. The at-rest approved images show it |
| Settled | A state: `states.settledSeconds` after a landing. As much has come to rest on the miniature as will |
| Stir | In the app: a short flick that sets the liquid turning without changing the season |
| Unit | A piece of the build that gets its own critic rounds, from `units` in the config |
| Key | One entry of `keys` in the config: a still with an approved image as its target |
| Approved image | One of the eight images in `references/approved/` |
| Settled difference | A point where the build differs from an approved image on purpose. `kit/06-ASSETS.md` has the rule |
| Still | One picture of one season in one state from one camera. Not a film frame |
| Judged still | A still on the fixed list the critics score |
| Frame | One output image of a film or of the card loop. Index 0 is the first |
| Shot | One entry of `film.shots`: a hold on one season, or a shake between two |
| Bar | One bar of music. Shot lengths are counted in bars |
| Default grid | The beat the film is cut to before the soundtrack is approved: `film.defaultBpm` beats a minute, `film.beatsPerBar` beats a bar |
| Film B | The film itself, with no opening |
| Film A | Film B with the prompt opening in front of it |
| Prompt opening | The typed prompt and the build screen that open film A |
| Soundtrack | Music, ambience and sound effects mixed for the film |
| Candidate | One complete soundtrack offered to Brandon at the review. There are `audio.candidates` |
| Cue | One sound: a sound effect, an ambience or a piece of music |
| Take | One generation of a cue or of a picture |
| Audio map | The beats, bars and sections found in the approved music, in `cut/AUDIO-MAP.json` |
| Review cut | The film on the default grid with a candidate soundtrack, made for the review |
| Card loop | The seamless clip for the portfolio card |
| Stand-in | A placeholder for a part not built yet. Every system reports whether it is one |
| Fallback | The technique from `kit/03-METHOD.md` that always works for a part, used when the planned one has not produced a finished part in time |
| Tier | A render quality level for computed pictures, from `tiers` in the config |
| Quality | A level of the live app on a visitor's machine, from `live.quality` in the config. Not a tier |
| Sample | One jittered sub-render. A computed picture is the average of its samples |
| Step | One step of the simulation, `sim.stepHz` of them a second |
| Asset set | A size class of textures from `assetSets` in the config: `web` is what ships, `full` is what the films and the judged stills use |
| Harness | The scripts in `tools/` that render pictures in a headless browser |
| Local render | The films and the loop rendered frame by frame on Brandon's computer, at `formats.master` |
| Look | Any picture someone rendered in order to look at it. The harness logs every one |
| Status | A short message with pictures in the task thread |
| Comparison image | A key's still beside its approved image, made by `npm run compare` |
| Machine check | An automated check on the code and the files. Red means a bug |
| Measure | An automated number on the picture or the motion. Red means a severe issue for the round, not a blocker |
| Deliverable check | An automated check on a file that takes long to make, run only at the end of the phases that name it |
| Gate | What has to be true before a phase ends. Listed at the end of each phase in `kit/08-BUILD-ORDER.md` |
| Critic | A fresh agent that scores files against a rubric |
| Listener | A fresh agent, or the audio evaluation tool, that answers fixed questions about a sound file |
| Round | One pass of build, checks, pack, critics, fixes |
| Floor round | A round that always happens: the first round of each unit, one blockout round, one round on the whole globe, one film round, the record round |
| Extra round | Any other round. It starts only while its count and the clock allow |
| Review round | A bounded piece of work Brandon asks for while the review is open, with the line `Review notes.` |
| Open item | An issue still unresolved when a limit was reached |
| Probe | The page that measures frame rate on a real machine. Brandon may run it at the review stop |
