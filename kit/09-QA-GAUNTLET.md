# 09 · QA gauntlet

The final acceptance list. Run every item on the frozen build in Phase 6 and write its evidence under "QA results" in `kit/PROGRESS.md`: a command and its output, a file, or a still.

The gauntlet runs at most `quality.gauntletMaxPasses` times. An item that still fails after the last pass is listed under "Failed QA items" with what was tried, and the build completes. `kit/08-BUILD-ORDER.md` Phase 6 steps 18 and 19 say what a fix may change.

## The globe in the app

1. The published address opens the globe in `live` mode in `defaultSeason`, at rest, with nothing else on the page but the controls.
2. The Shake control, the space bar and each season mark all play the shake, and each lands in the right season. After the last season comes the first.
3. A second shake cannot be started while one is playing.
4. A quick drag stirs the liquid and does not change the season. A slow drag turns the camera inside `live.orbitYawDeg`, `live.orbitPitchMinDeg` and `live.orbitPitchMaxDeg`, and it eases back when let go.
5. Each season opens directly from its own link.
6. Every control can be reached and used by keyboard, has a name, and shows its focus. With reduced motion set, a season changes with no shake.
7. The three `screen` formats show every control clear of the globe. Evidence: the four `screen` stills.
8. No sound starts before the first interaction. The sound control mutes and unmutes. With the sound files removed, the app runs silent and hides the control. Evidence: sound checks A1, A2 and A4.
9. The app picks a level of `live.quality` by itself and can be forced to each level from the `M` menu. `?mode=probe` runs to its end and gives its block of text.

## The picture

10. Every key has a comparison image under `out/stills/`, rendered from the frozen build at the `final` tier.
11. Every judged still and frame on the list in `kit/PROGRESS.md` exists with a record that matches the frozen build.
12. Measures M1 to M6 were run on the frozen build and their numbers are in the record round's scorecard.
13. No frame of film B, of the loop, or of a still without `interface` holds an interface pixel, text or a logo. Evidence: G5, and one look at the whole film sheets.
14. No stand-in is loaded in any season, in any frame of either film or in the loop. Evidence: G13 is green with every part covered, `info().standIns` is empty in each season and for the opening and the loop, and the `standins` view of every judged still and frame shows no flagged pixel.
15. No person, hand, face, readable text, brand or logo appears in any judged still. Evidence: one look at every judged still, and the R3 answers of the record round.
16. The dark backdrop is smooth in every at-rest still. Evidence: an enlarged crop of the backdrop from each, with no block grid and no banding.

## The shake

17. Every shake in the film is one bar long, and every landing is on a bar line of the cut list. Evidence: G12.
18. No seasonal part changes outside a swap window. Evidence: G11.
19. M4 and M5 are green for all four shakes in the final cut. Their numbers are in the `BUILD COMPLETE` block.
20. One sheet of consecutive frames across each shake of the final film is under `out/stills/`.
21. The camera does not move with the globe in any shake. Evidence: `filmState` across each shake shows the camera changing by no more than its slow ease.

## The films, the sound and the card

22. Film B's preview exists as `export.files.previewB`, has the frame count of the cut list at `film.previewFps`, and carries sound if any sound exists. Evidence: `ffprobe`.
23. Film A's preview exists as `export.files.previewA`: the opening, then film B unchanged. The opening shows the prompt in `intro.prompt` typed at a readable speed, the reasoning level set to `intro.reasoning`, the send, and the build screen with every line of `intro.steps`. Evidence: `ffprobe`, and the sheet across the opening.
24. Frame 0 of film B shows no edge of the glass. The frame at `film.revealBySeconds` does. Evidence: both frames.
25. The last frame's camera is frame 0's camera. Evidence: `filmState` of both.
26. The cut follows the approved music: `cut/AUDIO-MAP.json` exists, or the log says the default grid was kept and why. `cut/CUES.md` lists every bar line, shake, landing and camera move by time and frame.
27. The final mix measures within one unit of `audio.filmLoudnessLufs` and peaks at or under `audio.truePeakDb`. Made twice, it is byte equal. Evidence: A6 and A7.
28. Every kept sound has its record and its row in `ASSETS.md`, and no cue went over its take limit. Evidence: A5 and A8.
29. `deliver/` holds the card loop, its web copy and the card still. The still is the loop's frame 0. Evidence: D6.
30. The loop's frame one past the last is pixel-identical to frame 0. Evidence: G14 on the frozen build.
31. The globe and its base stay inside a centred 4:3 crop and a centred square crop in every loop frame.
32. `npm run render:local -- --proof` ran on the frozen build and both of its files pass `ffprobe`. Evidence: D3.

## Hosting and the machine

33. `npm run hostcheck` on the frozen build is inside every limit in `host`. Evidence: G16.
34. A clean clone builds with nothing but the repo's packages, and `dist/` holds no file from `assets-full/`, `audio/`, `references/`, `out/`, `pipeline/` or `scorecards/`.
35. `vercel.json` and `.vercelignore` exist and name the build command, the output folder and the ignored folders.
36. The app needs only what `config/webgl-caps.json` marks portable. Evidence: G10.
37. Texture memory and counts are inside their limits for every season and every level. Evidence: G15.
38. `npm run determinism` passes on the frozen build. Evidence: G3.

## The repo

39. `README.md` holds: what this is, the app's address, how to use it, the commands for the local render starting with the test, the steps to deploy, where the sound files are, and the credits.
40. `ASSETS.md` lists every third-party file with its source and license, the terms read for the image tools and the sound tool, and a row for every kept sound.
41. No tracked file is over `repo.maxFileMb`, no secret is tracked, and `references/approved/` still matches its manifest. Evidence: G9.
42. Every phase is marked `done`, every unit `finished` with what ended its loop, and "Open items", "Declined issues", "Review items not done" and "For Brandon to decide" are up to date in `kit/PROGRESS.md`.
