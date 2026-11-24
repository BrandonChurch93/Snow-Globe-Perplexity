# 08 · Build order

Work the phases in order. A phase ends when every line of its gate is met and logged with evidence. Then commit, push, publish, post the status and start the next phase without waiting. The one place the build waits for Brandon is the review stop at the end of Phase 5.

How a gate line is met:

- A line that asks for something to be published or pushed is met when it was done, or when the failure is logged. After Phase 0 neither one holds the build.
- A line that names a loop is met when its pass bar holds or its limit was reached. Reaching a limit means logging what is open.
- A line that names a machine check is met when the check is green, or when it has been logged as a severe open item after `quality.gateFixMaxAttempts` attempts. G13 is the exception: it is met only when it is green. A stand-in is ended with its fallback, as `kit/07-QUALITY-BAR.md` says, never logged.
- A line that names a deliverable check is met when it is green, or when it has been logged as a failed item after three tries.
- A line about sound is met when the sound exists, or when the log says why it does not. Sound never holds a gate.

Every loop below has a limit in `kit/07-QUALITY-BAR.md`. The clock rules and the budget report are in `AGENTS.md`. Post a status at least every `budget.statusMaxGapMinutes`, whatever step you are in.

## Before Phase 0, in every task

1. Check stop condition 1 in `AGENTS.md`: the reference images are approved.
2. Read `AGENTS.md` and `kit/00-README.md`.
3. Fetch and merge `repo.branch`. Read `kit/PROGRESS.md` and every file in `kit/addenda/`.
4. If `npm run clock` exists, run `npm run clock -- --start`.
5. Look at "Build", "Review", "Review round" and "Budget" in `kit/PROGRESS.md`, in this order:
   - "Build" says `complete`: follow stop condition 5 in `AGENTS.md`.
   - "Build" says `extension N in progress`: carry that extension on from the step after "Extension step", as "Extensions" below describes. Skip the rest of this list.
   - "Review round" says `round N in progress`: carry that review round on from the step after "Review round step", as "A review round" below describes, whatever the prompt says. Skip the rest of this list.
   - "Review" says `waiting`: read the prompt. With the line `The review is done.`, do "After the review" below. With the line `Review notes.`, do "A review round" below. With neither, show the block under "Last report block" again and build nothing.
   - "Budget" says `reported`: follow "The budget report" in `AGENTS.md`.
   - Otherwise tick the clock for the current phase. If it prints `budget report: due`, go straight to "The budget report" in `AGENTS.md`. Start nothing first.
6. Post the status that opens the task. In the very first task there is nothing to show yet: its opening status is the one in Phase 0 step 4, and steps 1 to 3 come before it. If those three steps take longer than `budget.statusMaxGapMinutes`, post two lines of text by hand.
7. If a phase is already in progress, continue it. Never redo a phase marked `done`. Check "Rounds" for a round that was interrupted, "Running jobs" for jobs to pick up or restart, and "Running agents" for branches to fetch and work to hand to new agents.

## Phase 0 · Ground truth

Read first: `AGENTS.md`, `kit/00-README.md`, `kit/05-ARCHITECTURE.md`, `kit/06-ASSETS.md`, `config/showcase.json`.

Steps:

1. Write `in progress` under "Build" in `kit/PROGRESS.md` and push it to `repo.url`. If the push fails, retry once. If it still fails, stop as `AGENTS.md` says.
2. Create `package.json` at the repo root before installing anything.
3. Build `npm run clock` and `npm run look`. Run `npm run clock -- --start` and tick. From here on, every status and every poll ticks the clock.
4. Prove the inline display. Show `references/approved/contact-sheet.jpg` in the task thread so that it is visible without opening or downloading a file. Record the method under "Tool record". If no method works, record that and follow the fallback rule in "Showing the work" in `AGENTS.md`. Measure whether `repo.url` is private. Post this as the first status, with one line that says where the sound files will live, as "Sound" in `AGENTS.md` asks.
5. Record the workspace: OS, cores, memory, disk, Node and npm versions, the browser and its exact version, and the WebGL2 limits and extensions under software rendering. Write them to `config/webgl-caps.json`, with the extensions every target browser has marked `portable`.
6. Confirm `ffmpeg` and `ffprobe` run. If either is missing, install a static build through npm.
7. Test, with an agent whose whole job is to wait two minutes and answer, whether you can tick the clock and post a status while an agent you started is still working. Record the result. If you cannot, follow the short agent rule in "Waits" in `AGENTS.md` for the whole build. Test whether a detached process outlives a scripted step. Test whether a sandbox agent can clone the repo, return a video file as an attachment and push a branch.
8. Measure the image limit: view a test image with fine numbered marks and find the longest edge that arrives without being downscaled. If it is smaller than `critics.maxImageLongEdgePx`, lower that key.
9. Record what you can call: the image models, the largest size each returns and how many reference images each accepts; whether a video model and an image-to-3D model can be called; app hosting and the largest site it accepts; the model families available for supporting agents, which of them can see images and which can hear sound.
10. Record the sound tools, as `kit/03-METHOD.md` section 12 says, with one test call for a sound effect and one for a short piece of music, and one question put to the audio evaluation tool about each result. If a call fails after `budget.toolRetryMax` tries, record that and go on.
11. List the skills of this workspace and record the names of the prompt screen skill and the audio map skill, as `kit/03-METHOD.md` section 13 says. Three tries at looking for each.
12. With supporting agents, read the output terms of each image model you will use and of the sound tool, and the hosting provider's current limits, and record them as `kit/06-ASSETS.md` and the hosting section of `kit/05-ARCHITECTURE.md` say.
13. Decide the three.js version as `kit/05-ARCHITECTURE.md` says. Pin every version.
14. Scaffold the app: config import and validation, seeded random, sampler, accumulator, the asset loader, the frame interface with the stand-in list, and `capture` mode. Put a spike scene in it to measure with: a clear sphere on a dark slab with a few plain shapes inside and the particle count of winter as plain points.
15. Build the harness commands `still`, `crops`, `compare`, `determinism`, `gate`, `caps`, `budget`, `status`, `keep` and `review`.
16. Measure the render budget on the spike scene: seconds per sample at each format, the fixed cost of starting a render, and the time one simulated second takes at winter's particle count. Render one still on this VM and on two sandbox VMs and log the PSNR of each pair. Write the table.
17. Publish the build with its review page. Record the URL in `kit/PROGRESS.md` and `README.md`.
18. Post a status with the spike still beside the approved winter image, shown inline.

Statuses are due from step 4 on, at the rhythm in `AGENTS.md`, whatever step you are in.

Gate:

- A push has succeeded.
- G1, G2, G3, G4, G8, G9 and G10 are met.
- The workspace record, the tool record with the sound tools and the two skills, the terms that were read, the hosting limits, the pinned versions and the render budget table are in `kit/PROGRESS.md`.
- The inline display method is recorded, or the log says none exists.
- Whether the repo is private is recorded.
- The polling test and the PSNR between VMs are logged.
- The clock has ticks, and statuses have been posted since step 4.
- The app is published, or the log says why it could not be.

## Phase 1 · The rough cut

Read first: `kit/01-FILM.md`, the rough cut section of `kit/05-ARCHITECTURE.md`, `config/showcase.json`.

Steps:

1. Build `npm run animatic` and make `out/roughcut.mp4`.
2. Look at one frame from every shot. Confirm the order and the lengths against `film.shots`.
3. Commit and push. Run `npm run review` and publish, so the rough cut plays at `<url>/review.html`.
4. Post a status with two frames of it shown inline and the review page link. Say that the rough cut is made from the approved images on a placeholder beat with no sound, that it exists so Brandon can judge the order and pace of the film, and that the build is continuing.
5. Continue without waiting.

Gate:

- D1 is met.
- The rough cut is pushed, on the review page, and a status was posted.

## Phase 2 · Engine and blockout

Read first: `kit/01-FILM.md`, `kit/02-SUBJECT.md`, sections 1, 7, 8, 10, 11, 14 and 15 of `kit/03-METHOD.md`, sections 4 to 9 of `kit/04-LOOK.md`, `kit/05-ARCHITECTURE.md`, and the checks, judged list, packs and R4 blockout sections of `kit/07-QUALITY-BAR.md`.

The whole globe works, the whole film plays and the loop closes before anything is finished. Everything in this phase is a stand-in except the cameras, the timing, the layout of the miniature, the order of events in a shake, and the controls' places.

Steps:

1. Build the shared engine on stand-ins: a clear sphere with the simplest refraction that works, the slab with any mirror image, sprite lights behind, the cameras in `cameras`, the sample and post chain, and the diagnostic views.
2. Give every part in `kit/03-METHOD.md` a stand-in that reports itself as one: each base a turned shape in its season's main colour, the miniature as boxes, a cone and a ball in the fixed layout, each particle kind as plain points in its colour, each dressing as a flat tint. Create `parts/PARTS.json` with every part as `stand-in`, and record the file hash of each as it stands now.
3. Build the liquid model and the particle simulation in their simplest working form: the solid turn and its decay, fixed steps, collisions with the stand-in shapes, coming to rest, being thrown back. Build `npm run simcache`.
4. Build the shake's path, the change number and the swap window. Make all four changes switch the stand-ins. Arrivals may be dissolves for now.
5. Build the film: the timeline on the default grid, `npm run cut`, `autopilot`, and a stand-in for film A's opening that has the right lengths. Build `loop` mode with closed paths for every particle and every period dividing the loop.
6. Build the app: `live` mode, the gestures, the controls, the levels of quality and how the app picks one, the menu on the `M` key, the probe page, reduced motion.
7. Build the sound side: `npm run sound`, `npm run mix`, the app's sound engine and its control. Spend the first takes of `lift`, `shake-winter`, `land-winter`, `amb-winter`, `glass-clink`, `ui-tick` and `ui-sound-on`, so the app and the blockout film carry sound from the start.
8. Build the remaining harness commands, including `npm run render:local`. Test `npm run audiomap` on a click track you make with `ffmpeg` at a known tempo.
9. Fit each camera roughly: the stand-in globe is framed as the approved winter image frames it, inside the checks of `kit/02-SUBJECT.md` section 9.
10. Write `cut/SHOTS.md`: the lens, the move, the start and end framing and the focus of every shot.
11. Measure the render budget again on this scene and update the table.
12. Write the judged list into `kit/PROGRESS.md`.
13. Run the first blockout round: machine checks, then R4 blockout. It is a floor round. If its pass bar does not hold, fix what it raised. Run a second round only if the count and the clock allow, up to `quality.blockoutMaxRounds`.
14. From the final build of this phase: render the blockout film at the `draft` tier in `formats.preview`, run `npm run render:local -- --proof` for film B, then `npm run keep -- --film`.
15. Publish and post the status with the whole film sheets, one sheet across a shake, and the link to the app, saying that the globe can be shaken there now.

Gate:

- G1 to G12 and G14 are met.
- R4 blockout scores at least `quality.blockoutPass` with no severe issue open, or its limit was reached.
- Every issue the blockout critic raised that is still open is under "Open items", marked as carried to the phase that will settle it.
- The judged list is in `kit/PROGRESS.md`.
- D2 and D3 are met. The blockout preview is committed.
- A visitor can shake the stand-in globe through all four seasons from the published URL, or from a local copy if publishing is not available here. The film plays in `autopilot`. The loop plays in `loop`.

## Phase 3 · The look lock

Read first: `kit/02-SUBJECT.md`, `kit/03-METHOD.md`, `kit/04-LOOK.md`, `kit/06-ASSETS.md`, `kit/07-QUALITY-BAR.md`, and "Faults seen in the kept images" and "Real photographs" in `references/drafts/round2/NOTES.md`.

Prove every shared technique on winter, and prove the shake, before anything is spread across the other seasons. The unit is `lookLockUnit` in the config: `winter`. Its two keys are `winter-rest` and `winter-shake`.

Steps:

1. Study before building. Fetch the six real photographs the reference run lists into `references/cache/` and look at them beside the approved winter images: the lens, the reflections, the depth of the snow. Search for footage and photographs of a snow globe being shaken, and make reference video if you choose to, as `kit/03-METHOD.md` section 10 allows. Study at most `assets.maxStudySources` sources in all, the six included. Write what you learned in ten lines under "Look lock".
2. Start supporting agents in parallel, one owner per folder:
   - The glass: the refraction, the shell, the through view, the bubble.
   - The liquid model.
   - The particle engine, with `flake` and `glitter`, coming to rest, the cover map and the veil.
   - The surface, the backdrop and the lens.
   - Winter's base, with its icicles.
   - Winter's miniature, with its distance field and its small lights.
   - Winter's frost on the glass and on the surface, its light rig, its light grid and its arrival.
   - The shake's path and everything that answers it: the mirror image, the shadow, the dressing.
   - Sound: the remaining takes of winter's cues, checked against the finished shake.
3. Integrate. Fit the `hero` camera to `winter-rest`. Set the rig, the tone curve and the grade against it. These become the defaults for everything.
4. Play the test shake, winter into winter. Work on M4, M5 and the motion sheets for at most `quality.gateFixMaxAttempts` cycles of change and look. What is still red or weak after that goes to the round as it is. Publish, so Brandon can shake it.
5. Measure the render budget, the texture memory and the counts, and update the table.
6. Send `winter` to its first round as soon as nothing its stills show is a stand-in. Then run rounds with the measures and R1, R2, R3 and R4 on its judged stills and sheets until the pass bar holds, `quality.lookLockMaxRounds` is reached, or the clock ends the loop.
7. From the final build of this phase: `npm run compare` for the two keys, then `npm run keep`.
8. Write "Look lock" in `kit/PROGRESS.md`: every locked setting; each technique that worked and each that did not; and the recipe, as numbered steps with commands, for making one more base, one more season of the miniature, one more particle kind, one more dressing for the glass and one more arrival. Phase 4's agents work from those recipes.
9. Commit the built assets. Run `npm run review` and publish.
10. Run `npm run gate -- --phase 3`, check every line of the gate below and log the evidence. Mark `winter` `finished` in the "Units" table with the commit and what ended its loop, mark Phase 3 `done`, push, and post the status with the two comparison images and one sheet across the shake.

Gate:

- The machine checks are met, with G13 and G15 covering `winter`.
- The pass bar holds for `winter`, or its limit was reached.
- Two comparison images are committed.
- "Look lock" is written, with the five recipes.

## Phase 4 · The other seasons and the changes

Read first: `kit/02-SUBJECT.md`, `kit/03-METHOD.md`, `kit/04-LOOK.md`, `kit/06-ASSETS.md`, `kit/07-QUALITY-BAR.md`, the "Look lock" section of `kit/PROGRESS.md`, and every file in `kit/addenda/`.

Finish the units in `buildOrderAfterLookLock`. Build the three seasons in parallel with supporting agents, then the changes. Build agents take at most `sandbox.maxAgents` less `sandbox.criticSlots` of the slots, so critics, jurors and render agents can always start when a round is due. You integrate each unit, run its checks and its critics, and decide when it is finished.

Each agent owns its folders and nothing else. Change the split if the work calls for it, and log it.

| Unit | Agents | Each owns |
| --- | --- | --- |
| `spring`, `summer`, `fall` | For each season: one for the base, one for the miniature with its distance field and lights, one for the glass dressing, the surface dressing, the light, the veil and the arrival, and one for its new particle kinds | Its part of `src/seasons/<season>/`, `public/assets/<season>/`, `assets-full/<season>/`, `assets-src/<part>/`; a particle agent owns that kind's files under `src/particles/kinds/` |
| Sound, beside the units | One | `audio/`, `public/audio/` |
| `change` | You, with one agent for each change if it helps | `src/shake/` |

For each season:

1. Build every part by its recipe from "Look lock". Each agent tunes inside `assets.maxTuningLooksPerPart`, pushes its looks with every heartbeat, and stops when its part is built.
2. Integrate the season. Fit its rig to its at-rest approved image. Play a shake into it and tune its storm against its mid-shake approved image, inside `assets.maxTuningLooksPerPart` looks.
3. Send the unit to its first round as soon as nothing its stills show is a stand-in. Then run rounds with the unit's measures and R1, R2, R3 and R4 until the pass bar holds, `quality.maxRoundsPerUnit` is reached, or the clock ends the loop.
4. From the unit's final build: `npm run compare` for its two keys, then `npm run keep`.
5. Mark the unit `finished` in the "Units" table of `kit/PROGRESS.md` with the commit and what ended its loop.
6. Commit its built assets, push, run `npm run review`, publish and post the status for that unit with its two comparison images.

The sound agent, while the seasons are built:

1. Makes every remaining cue in `audio.sfx`, inside `audio.maxTakesPerCue`, each chosen as `kit/03-METHOD.md` section 12 says.
2. Makes the music for both entries of `audio.candidates`, inside the same take limit for each piece.
3. Posts, through you, a status with the waveform sheet whenever a batch is kept.

Then `change`, once the three seasons are finished or have reached their limits:

1. Build each change in `film.shots` properly: the switches ordered by what the storm hides, the particles changing kind in place, the veil's colour, the bloom, the base and the dressing changing under it, the rig crossing over.
2. Finish each season's arrival as `kit/02-SUBJECT.md` section 6 describes it, playing from a landing.
3. Work on M4, M5 and M6 for all four, for at most `quality.gateFixMaxAttempts` cycles of change and measure for each change. What is still red goes to the round as a severe issue.
4. Run rounds on `change` with R2 and R4 until the pass bar holds, `quality.maxRoundsPerUnit` is reached, or the clock ends the loop. The first is a floor round.
5. `npm run keep`, mark it `finished`, publish, and post the status with one sheet across each change.

Clock rules 3 and 4 in `AGENTS.md` apply to every unit here. Once the clock prints `half point: reached`, a unit with no stand-in left goes to its round at once. Once it prints `box end: reached`, every part that is still a stand-in is finished with its fallback and its unit goes to its round. `change` then gets its floor round on whatever the seasons are.

Gate:

- The machine checks are met, with G13 and G15 covering all five units.
- Every unit is marked `finished`: its pass bar held, or its limit was reached.
- A comparison image is committed for every key.
- Every cue has a kept take or an open item, and the music of each candidate exists or the log says why not.

## Phase 5 · The whole globe, the soundtrack and the review

Read first: sections 12, 14 and 15 of `kit/03-METHOD.md`, section 7 of `kit/02-SUBJECT.md`, "The soundtrack" in `kit/01-FILM.md`, the hosting, probe and review page sections of `kit/05-ARCHITECTURE.md`, `kit/07-QUALITY-BAR.md`, and "Open items" in `kit/PROGRESS.md`.

Steps:

1. Remove every stand-in path that is left in the six units built so far. G13 covers every part outside the `film` unit now.
2. Go through the app once as a visitor would, on the wide layout, the phone and the tablet: the Shake control, the space bar, a stir, a drag around the globe, each season mark, the sound control, the keyboard, reduced motion, each season by its own link. Fix what is wrong in one pass. What is not fixed by the end of that pass is an open item.
3. Finish sound in the app: `npm run sound -- --pack`, the loops, the levels, the music changing on the landing. Run the sound checks.
4. Fit the web asset set to `host`. Set the loading order. Run `npm run hostcheck`. Write `vercel.json` and `.vercelignore`.
5. Run the first round on `globe`: machine checks, then R2, R4, R5 and R8. It is a floor round. Run more only while the count and the clock allow, up to `quality.globeMaxRounds`.
6. Work the open items from every unit, worst first, for up to `quality.polishMaxRounds` polish rounds. Every polish round is an extra round: start one only while the clock allows. In each round fix a batch, then run the measures and the critics that raised those issues on the stills they touch. After a change to a shared system, check each finished unit as "Freshness" in `kit/07-QUALITY-BAR.md` says.
7. If a second browser engine can be driven here, load the app in it and keep a still. Three tries, then log it.
8. Make the candidates: `npm run mix -- --candidate` for each entry of `audio.candidates` whose music exists, on the default grid. A cue with no kept take is left out of the mix and named in the `REVIEW` block.
9. Make the review cut: run `npm run simcache`, then render film B on the default grid with `npm run film -- --review`, split across sandbox agents, at the highest tier that fits `sandbox.reviewCutMaxHours`, and never below `draft`. Join that one picture with each candidate. If no candidate has music, make one review cut with the sound effects and ambience alone, or a silent one if there are none. Render the card loop in `formats.preview` at the `review` tier for the review page. Run `npm run keep -- --film`.
10. Render every key and every judged still of `globe` again from this build, with the stills split across sandbox agents, run `npm run compare` for the keys, and run `npm run keep`.
11. Run `npm run review` and publish.
12. Run `npm run gate -- --phase 5` and log the evidence. Tick the clock one last time for this phase. If it prints `budget report: due`, file the budget report and stop there: the review stop comes after the continuation.
13. Otherwise mark Phase 5 `done`, write `waiting` under "Review" and the filled-in `REVIEW` block under "Last report block", commit and push. From this moment no budget report is filed and the build's clock is not ticked again until the review is approved.
14. End the task with the `REVIEW` block, as "REVIEW" below describes.

Gate:

- The machine checks are met, including G15 and G16.
- The pass bar holds for `globe`, or its limit was reached. The polish rounds ran to their count or to the clock.
- D4 is met for each candidate whose music exists.
- The app, the probe, the film in `autopilot` and the loop open from the published URL, or the log says why not.
- "Review" says `waiting` and the block is stored.

## A review round

A task whose prompt contains the line `Review notes.` and that finds "Review" at `waiting` does this. So does a task that finds "Review round" at `round N in progress`, starting at the step after "Review round step".

After each step, write its number under "Review round step" in `kit/PROGRESS.md` and push.

1. N is "Review rounds" plus one. Write `round N in progress` under "Review round". Copy Brandon's notes under "Notes from Brandon" as numbered items of review round N, in his words. Push. Tick with `npm run clock -- --review-round N`. Every status in the round ticks the same way, and statuses fall due at the same rhythm as in a phase.
2. Sort the items: a sound to change, a preference between the candidates, a level in the mix, a change to how something looks or moves, a change to how the app feels, or a decision on something listed under "For Brandon to decide". Post a status that lists the items as you understood them and the order you will work them in. It is not a question.
3. Work the sound items. Each cue or piece of music he names gets up to `audio.maxTakesPerCue` new takes, with his words added to its prompt, chosen as before. Mix the candidates again.
4. Work the picture and app items, the ones he stressed first. A change to a finished unit gets rounds on that unit inside `quality.maxRoundsPerUnit` for this request. None is a floor round: each starts only while the round's clock prints `extra rounds: yes`.
5. When the items are done, or the clock prints `extra rounds: no`: finish the one fix in hand and list what is left under "Review items not done".
6. If any picture in the film changed, make the review cut again, once. If only sound changed, join the existing picture with the new mixes. Run `npm run review` and publish.
7. Add one to "Review rounds". Write `none` under "Review round" and clear "Review round step". Write the `REVIEW` block again under "Last report block", with one line added at its top: what review round N changed and what it did not. Commit, push, and end the task with that block.

A review round never approves the review, never starts Phase 6 and never files a budget report. "Review" stays `waiting`.

## After the review

A task whose prompt contains the line `The review is done.` and that finds "Review" at `waiting` does this before anything else:

1. Save what Brandon sent, before anything else. If items from this approval are already under "Notes from Brandon", an earlier task got this far: do not log them again, and go to step 2. Otherwise his notes go under "Notes from Brandon" as numbered review items, in his words. Whatever he pasted from the probe goes under "Probe results". Find his choice of soundtrack: a candidate named in the prompt, or an audio file of his own attached to the task or under `audio/supplied/` on `repo.branch`. Save an attached file there. Commit and push.
2. Only then run `npm run clock -- --review`, write `approved` under "Review" and `running` under "Budget", and push.
3. Settle the music. His own file wins over a candidate. A named candidate is used as he heard it last. If he named none and sent no file, use the first entry of `audio.candidates` whose music exists, and log that the choice was yours. If no music exists at all, the films are cut on the default grid and carry the sound effects and ambience alone.
4. Sort the remaining review items: a change to a unit, a change to the film, a change to the app, or a decision on something listed under "For Brandon to decide".
5. If the probe shows a level of `live.quality` falling short of its `minFps` on one of his machines, lower what that level draws, by the ladder in `kit/04-LOOK.md`, and log the new numbers.
6. Post a status that says, in its first line, which soundtrack the films will be cut to and where it came from. Then list the review items as you understood them and the order you will work them in. It is not a question. Carry on with Phase 6.

A task that starts with "Review" at `approved` and review items already logged carries on from Phase 6. It does not need the notes again.

A review item is never a reason for a second stop. One that cannot be done inside the limits is logged and listed in the `BUILD COMPLETE` block.

## Phase 6 · The films and delivery

Read first: `kit/01-FILM.md`, sections 8, 12 and 13 of `kit/03-METHOD.md`, the audio map, local render and hosting sections of `kit/05-ARCHITECTURE.md`, `kit/07-QUALITY-BAR.md`, `kit/09-QA-GAUNTLET.md`, and "Notes from Brandon" and "Open items" in `kit/PROGRESS.md`.

Steps:

1. Work the review items, the ones Brandon stressed first. A change to a finished unit gets rounds on that unit inside `quality.maxRoundsPerUnit` per request. None is a floor round: each starts only while the clock allows. When the clock prints `extra rounds: no`, finish the fix in hand and list what is left under "Review items not done".
2. Map the approved music: `npm run audiomap`, then `npm run cut`. If there is no music, the cut stays on the default grid. Replace the film's part of the judged list. Run `npm run simcache` for the new cut.
3. Fit the film to the new cut list: every camera move, every shake, every arrival. Render the whole film sheets and look at every shot.
4. Mix the final soundtrack: `npm run mix -- --final`, for film B and for film A.
5. Make the opening of film A, as `kit/01-FILM.md` and `kit/03-METHOD.md` section 13 say. Mark the `opening` part by how it was made. Render a sheet across it and check that each typed word can be read on the frame it appears.
6. Finish the card: run the pick if `deliver.cardLoop.season` is `auto`, set the loop to that season, and check its seam with G14.
7. Run the first round on `film`: machine checks, the measures, `npm run stress`, then R2, R4, R5, R6 and R7. It is a floor round. Run more only while the count and the clock allow, up to `quality.filmMaxRounds`.
8. Freeze the build. From here on, nothing under `src/`, `public/`, `assets-full/` or `config/` changes except to fix a machine check or a failed QA item.
9. Render every judged still, every judged frame and every comparison image from the frozen build, with the work split across sandbox agents.
10. Run the record round, as `kit/07-QUALITY-BAR.md` defines it. Write the scores into `kit/PROGRESS.md` as the final scores.
11. Render the preview films: film B in `formats.hd` at `film.previewFps` with the final mix, one chunk per shot, split across sandbox agents, at the highest tier whose wall-clock time the render budget says fits in `sandbox.previewFilmMaxHours`, and never below `draft`. Film A is the opening's chunk joined in front of it. Make their `formats.preview` copies with `npm run film -- --from-hd`, then run `npm run keep -- --film`. Put the `formats.hd` films on the review page and attach them to the final message. If `deliver.sandboxMaster` is true, also render the masters here at the `final` tier and share them in the final message.
12. Render the card loop with `npm run loop`, as `kit/01-FILM.md` says, and run `npm run keep -- --deliver`.
13. Run `npm run render:local -- --proof`.
14. Run `npm run hostcheck` on the frozen build.
15. Write `cut/CUES.md`.
16. Write `README.md`: what this is, the app URL here, how to use it, how to render film B, film A and the loop on a Mac with `npm run render:local`, starting with the test, how to deploy it to `host.name`, where the comparison images and scorecards are, where the sound files are and what to do if a clean clone has none, and the list of third-party credits from `ASSETS.md`.
17. Run `npm run review` and publish the final build.
18. Run every item in `kit/09-QA-GAUNTLET.md` and record the evidence. If an item fails, fix it, do step 19, and only then run the gauntlet again, for at most `quality.gauntletMaxPasses` passes in all. A second pass and a second record run are extra: they happen only while their counts and the clock allow. When they are not allowed, make only fixes that change no pixel, and list every other failing item under "Failed QA items" with the fix it would need. The scores in the `BUILD COMPLETE` block must always be the scores of the build that is delivered. Item 14 is the one exception: a stand-in found there is always finished with its fallback chain and the stills it touches are rendered again, as floor work. If no record run is left for it, the `BUILD COMPLETE` block names that part and says the final scores were taken before it changed.
19. If a fix in step 18 changed anything under `src/`, `public/`, `assets-full/` or `config/`: render the judged stills and frames it touched again, run `npm run compare` for their keys, run `npm run keep`, and run the record round again, for at most `quality.recordRoundMaxRuns` runs in all. If the fix changed what a film or the loop shows, render the affected chunks again, once, join them, make the `formats.preview` copies again, and run `npm run keep -- --film --deliver`, `npm run review` and publish.
20. Write `complete` under "Build" and the filled-in `BUILD COMPLETE` block under "Last report block" in `kit/PROGRESS.md`. Commit and push.

Gate:

- The machine checks are met, including G7, G14 and G16.
- The pass bar holds for `film`, or its limit was reached.
- D2, D3, D5 and D6 are met.
- Every item in `kit/09-QA-GAUNTLET.md` has its evidence in `kit/PROGRESS.md`. An item that still fails after the last pass is listed under "Failed QA items" with what was tried.

## REVIEW

At the end of Phase 5, and at the end of every review round, end the task with exactly this block, filled in. Above it, show inline up to `status.maxPictures` pictures: the four seasons at rest on one sheet, one sheet across a shake, and the waveform sheet of the sounds. If the repo is public, attach the archive of every kept sound, as "Sound" in `AGENTS.md` says.

```
REVIEW
This is the one stop. The globe is built and you can shake it. The film is cut to a placeholder beat. Nothing is cut to the sound until you approve it.
Shake it: <url>
Review page, where everything plays: <url>/review.html
Listen first: the Listen part of the review page. Each soundtrack plays against the film, and every sound is there on its own.
Soundtracks: <for each candidate: its name, how it was made, its length. Or the reason one could not be made>
Sounds with no usable take: <list, or "none">
Watch the cut: <url>?mode=autopilot
The card loop: <url>?mode=loop
Measure speed on your own machines, if you like: <url>?mode=probe
Time used: <hours> of <hours allowed>
Units: <for each of the six built so far: passed, or the limit that ended it>
Open items: <count, and the worst five with their unit>
Parts finished with a fallback: <list, or "none">
For Brandon to decide: <list, with what the sound tool's terms say about music first, or "none">
Sound files: <"committed to the repo" or "held back because the repo is public: the archive is attached">
What happens next is yours:
- To change the sound or anything you see, as many times as you like: send the review notes prompt from kit/10-KICKOFF.md.
- When the sound and the globe are right: send the approval prompt from kit/10-KICKOFF.md, naming the soundtrack. The films are then cut to it and nothing stops again.
```

## BUILD COMPLETE

When the Phase 6 gate is met, end the task with exactly this block, filled in, and show inline above it the four seasons at rest on one sheet, the card still, one sheet across a shake from the final film, and one frame of the opening of film A:

```
BUILD COMPLETE
The app: <url>
Review page: <url>/review.html
Watch film B: <url>?mode=autopilot
Watch film A: <url>?mode=autopilot&which=a
Preview films: out/, and the larger ones attached
Soundtrack: <which candidate or whose file, its length, and how the cut follows it>
The opening of film A: <made with the team's skill, by name, or made without it>
Card: deliver/, season <name>, chosen by <the pick, with its votes, or the config>
Masters: render them on a Mac with the commands in README.md, starting with the test
Deploy: the steps are in README.md
Side by side: out/stills/
Scorecards: scorecards/
Time used: <hours before the review> of <hours allowed>, <hours in review rounds>, <hours after> of <hours allowed>
Rounds run: <number>
Units: <for each of the seven: passed, or the limit that ended it>
Final scores: R1 <lowest key and its score>, R2 <pass or fail, with the failing units>, R3 <lowest>, R4 <lowest, and the shake's own score>, R5 <globe>, <film>, R6 <n>, R7 <n>, R8 <n>
Measures: M4 <lowest cover at a swap>, M5 <lowest clearing>
Size: <megabytes shipped> of <limit>, first load <megabytes> of <limit>
Open items: <list with the unit and still of each, or "none">
Review items not done: <list, or "none">
Declined issues: <list with the reason for each, or "none">
Failed QA items: <list, or "none">
Parts finished with a fallback: <list with the step of the chain that ended each, or "none">
For Brandon to decide: <list, or "none">
What I would improve next: <one to three lines>
```

## BUDGET REPORT

When "The budget report" in `AGENTS.md` applies, end the task with exactly this block, filled in, and show up to `status.maxPictures` pictures of where the build is inline above it: the newest whole-globe stills and the newest comparison images.

```
BUDGET REPORT
Time used: <hours> of <hours allowed>
Review page: <url>/review.html
Open what exists: <url>
Phase: <current phase and step>
Phases done: <list>
Units: <for each: finished and how, in progress and its last scores, or not started>
Still to do: <every remaining phase and step, in order, with the floor work marked>
Open items so far: <count, and the worst three>
Credits used so far: <the figure, if this workspace shows one, or "not shown here">
What I would do next: <one to three lines>
To continue: send the continue prompt from kit/10-KICKOFF.md
```

## Extensions

An extension is one more polish pass Brandon asks for after completion. It starts when a task's prompt contains the line `Extension.` and "Build" says `complete`. It carries on when a task starts and "Build" says `extension N in progress`.

After each step below, write its number under "Extension step" in `kit/PROGRESS.md` and push. A task that carries an extension on starts at the step after that number and never repeats a finished one.

1. Write `extension N in progress` under "Build" in `kit/PROGRESS.md`, where N is one more than "Extensions". Copy any notes Brandon put in the prompt under "Notes from Brandon", in his words. Push. Tick the clock with `--extension N`. Statuses in an extension tick with `--extension N` too.
2. Unfreeze. Apply the notes logged in step 1. A sound he names gets up to `audio.maxTakesPerCue` new takes. Then run up to `quality.polishMaxRounds` polish rounds, worst open item first, as Phase 5 step 6 describes. Start a round only while the extension's clock prints `extra rounds: yes`.
3. Freeze the build.
4. Render every judged still, judged frame and comparison image from the frozen build.
5. Run the record round once.
6. Do Phase 6 steps 4 and 11 to 17 once: the final mix, the preview films, the loop, the proof, the host check, the cues, the README, the review page and the publish.
7. Run the QA gauntlet once. An item that fails is fixed if the fix changes no pixel. Otherwise it is listed under "Failed QA items". There is no second pass and no second record round in an extension.
8. Add one to "Extensions", clear "Extension step", write `complete` under "Build" and the new block under "Last report block", commit, push, and end with the `BUILD COMPLETE` block.

An extension has no budget report and no review stop. When its clock prints `extra rounds: no`, finish the one fix in hand and go to step 3.
