# Recipes: the app's packed sounds

The files under `public/audio/` are written by one command from the kept sounds. They are not committed, because the repo is public and the sound tool's terms forbid generated sound as separate files (see `ASSETS.md`, Generated sounds). Each kept sound has its own row in `ASSETS.md` and its record beside the file under `audio/kept/`, with its prompt and settings in `audio/prompts.json`.

## public/audio/
Made by: `tools/sound.mjs --pack` (Node 20.20.2), which calls ffmpeg 8.0.1 to place every kept short sound in one MP3 with silence between them and to write the loops, and writes `index.json` with each sound's start, length and playback gain
From: every file in `audio/kept/` with the record beside it (`<cue>.wav` and `<cue>.wav.json`), and the cue list in `config/showcase.json` under `audio.sfx`
Prompt or command: `npm run sound -- --pack`
Takes: one pack, written again whenever a sound is kept. The takes of each sound are in `audio/RECORDS.json`
Why this one: the app loads one small file for all its short sounds, inside `audio.appMaxMb`
Date: 2026-11-24
