# Phase 6: the sound (`sound_finisher`)

You finish the sound of this build: the film's mix, the app's loops and the cues that have no kept take. You work for `/root`. Nobody here can hear, you included: every choice is made from numbers and from a listener's answers, as `kit/03-METHOD.md` section 12 says. Read that section first, then `audio/RECIPE.md`, `audio/QUESTIONS.md`, `out/work/audio/left.md`, and must-fixes 7 and 8 of `scorecards/phase-5/final-pass-review.md` (lines 43 to 54).

## Where you work, and what you may touch

- You share one machine (2 cores) and one checkout with `/root`: `/home/user/workspace/Snow-Globe-Perplexity`, on `main`. You do not clone.
- You never run a git command that writes: no `add`, `commit`, `checkout`, `stash`, `merge`, `pull`, `push`, `reset`, `restore`. `/root` commits your work. `git status`, `git diff` and `git log` are fine.
- You may change only: `audio/**`, `public/audio/**`, `out/work/audio/**`, `tools/mix.mjs`, `tools/sound.mjs`, `tools/soundcheck.mjs`, `tools/audiomap.mjs`, `tools/lib/audio.mjs`, `tests/audio.test.ts`, `tests/mix.test.ts`, `tests/audiomap.test.ts`, and new scratch files under `out/work/audio/`. Nothing under `src/` (the app's player, `src/audio/`, is `controls_finisher`'s), nothing under `config/`, `kit/`, `cut/`, `scorecards/`. If a mend needs a file outside your list, say which and why in a message to `/root` and carry on with the rest.
- You render no pictures and start no browser. Other work renders on this machine, so keep your own load light: one `ffmpeg` at a time.
- You start no agents.
- Never run a tool of this repo with `--help` unless it is `sound`, `sheet`, `seq` or `status` (the others take it as a plain run).
- No em dashes and no exclamation points in anything you write into the repo.

## The credits: Brandon's limit

Brandon's words: "11 labs has been topped up please do not use more than 10,000 tokens. If you use all 10,000 and you were still not finished with the audio give me a breakdown of what what's left." 6,765 are spent in 40 calls. 3,235 are left. This limit is absolute.

- Every call that makes sound goes through the guard, with no exception: `node out/work/bin/soundguard.mjs begin <cue> sfx <seconds>` (it prints `GO` or `STOP`; on `STOP` you make no call), then the call, then `node out/work/bin/soundguard.mjs end <the call's cost header> "<note>"`. `node out/work/bin/soundguard.mjs sum` prints what is spent and what is left. Read the comments at the top of that file before your first call. The account is used by other people at the same time; the guard knows.
- A call is made with `node audio/run/take.mjs <cue>`, which reads the text from `audio/prompts.json` and files the take with the harness. It needs the environment variable `ELEVENLABS_HANDLE`. Its value is the string assigned to `cred` near the top of `out/work/bin/soundguard.mjs`. Pass it on the command line of that one call (`ELEVENLABS_HANDLE=... node audio/run/take.mjs ...`). Never write the handle into any file under version control, into `kit/`, into a message to me or into your report. `out/work/` is not tracked.
- You buy no music at all. The four season tracks are kept, and `music-one-piece` is not to be bought again (825 credits a take, three takes had, none followed its plan).
- Takes are spent one at a time. Judge each before asking for the next (numbers first, then the listener).
- The harness refuses a fourth take of a cue in the round called `build`. The takes of this phase are filed under the round `after-review`: `npm run sound -- --cue ID --file F ... --round after-review`. `audio/run/take.mjs` passes no round today; give it one (an environment variable `SOUND_ROUND` or an argument), in your own file list. At most `audio.maxTakesPerCue` (3) new takes of one cue in this round. Check A8 of `npm run soundcheck` counts takes a round, as `kit/07-QUALITY-BAR.md` line 86 says ("none used more than that again in any one review round"); if it counts them over all rounds, mend the check to the kit's words and say so.
- What a call costs, recorded: effects 11 credits a second by the cost header (0.5 s is 6, 2 s is 22, 2.6 s is 29, 3 s is 33, 20 s is 220).
- If the guard says `STOP`, or the tool answers with an error twice in a row, stop buying, finish what needs no call, and report.

## The listener

The audio evaluation tool is the listener (`evaluate_audio`, a tool of yours; if you do not have it, say so in a message to `/root` at once and go on with the work that needs no listener). Use it exactly as `audio/QUESTIONS.md` says: the open questions first in a call that does not show the cue's line, the fit questions in a second call, the family question when a new take joins two kept ones. The copy the listener hears is made by `node audio/run/listen.mjs <cue> [take]` (the take after the level chain of its class). Keep every answer with its take (`npm run sound -- --answers FILE --cue ID --take N`). A sound is kept only when the numbers fit its length and the listener's answers fit its line. When you are not sure, it is not kept.

## The jobs, in this order

### 1. The film's mix (no call, no credit)

`npm run mix -- --candidate four-tracks` writes `audio/mix/four-tracks.wav` from `cut/CUTLIST.json`, the kept takes and the four season tracks. The fresh review measured these faults in its sound stream. Measure each yourself first, with `ffmpeg` and your own numbers, on `audio/mix/four-tracks.wav`; then mend the mix (the code in `tools/mix.mjs` and `mixFilm` of `tools/lib/audio.mjs`), and measure again.

- (a) From 59.556 s to the end is exact digital zero, 0.455 s. The last bar should ring to the last frame: no exact zero before the last sample, and a fade that ends on it.
- (b) The shake bars into fall and into winter run down to nothing: the last 0.2 s before landings 3 and 4 measure -53 and -71 dB, with 27 ms of exact zero at 47.969 to 47.996 s, where landings 1 and 2 hold -35 to -40 dB. The kit lets the music thin out there, but it puts a shake sound and crossfading ambience under every shake bar (`kit/01-FILM.md`; read what it says of the shake bars and the ambience). Part of this is the missing cues of job 3; part is the mix.
- (c) Landings 3 and 4 start 8 to 10 dB lower than 1 and 2 (-20 and -18 dB against -11 and -10 dB in the first 50 ms). The four landings should match within 2 dB.
- (d) The first 2.6 s measure -28 dB RMS, about 10 dB under the holds (-17 to -18.5 dB), with regular ticks 0.26 s apart and no music until about 2.7 s. The kit's rule: the music starts on frame 0 of the film's body. Find why it does not (the track's own quiet start, an offset in the cut, a fade), and mend it at its cause.
- (e) True peak -0.8 dBTP against the kit's ceiling `audio.truePeakDb` (-1). The film is encoded to AAC at 256 kb/s afterwards, and the encoder can overshoot: measure the true peak of the wav and of an AAC copy (`ffmpeg -i x.wav -c:a aac -b:a 256k`), and leave enough room in the wav that the encoded stream stays at or under -1. The left channel is 1.4 dB hotter than the right over the whole film: find which source is off centre and centre the mix (the music's own stereo picture may stay wide, but the two channels should measure within 0.5 dB over the film).
- The mix must still give the same bytes when run twice, stay at `audio.filmLoudnessLufs` (-14 LUFS integrated), and pass `tests/mix.test.ts` and `tests/audio.test.ts` (`npx vitest run tests/mix.test.ts tests/audio.test.ts tests/audiomap.test.ts`). Add a test for each mend that numbers can hold (no run of exact zeros longer than a few milliseconds inside the film, the four landings' first 50 ms within 2 dB, the channels within 0.5 dB, the first second within 6 dB of the holds).
- `/root` will run `npm run cut` again later in this phase and mix again for the final films (`npm run mix -- --final`), also with the film's opening for film A. So mend the tool, not one output file: nothing may hang on today's cut list's exact times.

### 2. The app's loops (no call, no credit)

`public/audio/` holds what the app plays (`npm run sound -- --pack` writes it). Two music loops change level at the seam: `music-winter` ends at -17.8 dB (its last second) and starts again at -32.0 dB (its first second), a 14 dB dip every 19.2 s; `music-summer` ends at -35.1 dB and starts again at -15.7 dB (50 ms each side). The kit: "Ambience and the app's music loops are made to loop: a crossfade from the end into the start, checked by number at the seam." Shape each loop so its last bar hands back to its first at the same level: choose the loop's bars inside the track where the two ends match (the map of each track, `npm run audiomap`, gives its bar lines; `audio.appLoopBars` is 8), and crossfade at equal power. Check all four music loops and both ambience loops by number: the level of the last second against the first second within 3 dB, the last 50 ms against the first 50 ms within 3 dB, no sample jump that could click. Hold that in a test. Winter is the first thing a visitor hears, so its loop comes first.

### 3. The cues with no kept take

Ten effects have none: `shake-winter`, `shake-summer`, `shake-fall`, `land-winter`, `land-spring`, `land-summer`, `land-fall`, `amb-winter`, `amb-fall`, `key-tap`. `out/work/audio/left.md` says what each of their three takes was heard as. The lesson of those thirty takes: one call gives one sound. A text that names two or three things (liquid and seeds and a chime) came back with one of them every time. So:

- Ask for one thing a call, in plain words, and lay the parts together afterwards in the harness. A take that holds one part cleanly is a good take for that part.
- Laying takes together costs nothing and is not a take (decision 111 in `kit/PROGRESS.md`): the laid sound is heard and judged the same way as a take, by the same listener, before it is kept, and its record names it as a layer and of which takes. Decision 134 widens this for this phase, and these are its terms:
  - A layer may also be a kept take of another cue when the line names the same thing. Every shake's line begins "Liquid sloshing and churning inside glass": the kept `shake-spring` holds that, so its liquid may lie under another season's own part (a fixed small pitch offset per season keeps the four from being one sound). Every landing's line begins "A heavy glass globe set down on stone, heavy and short": one good heavy set-down may lie under all four, each with its own tail. This also keeps the family together.
  - A plain made layer is allowed only as quiet support, at least 12 dB under the main layer, made by the harness with fixed numbers so that it is the same bytes every time: shaped noise for a hiss of snow or sand, one low steady tone for "a low eerie tone". Nothing made stands in for a whole cue. The record says what was made and how.
- Order of worth. First what a visitor and the film's viewer hear most: the three shakes (the film has a shake bar into each season; only spring's has its sound), the four landings (no landing has its own sound), `key-tap` (film A's opening types a prompt of 84 characters at 14 a second, one tap a character, each through the fixed list of small pitch offsets; without it the opening is silent until its send sound; Brandon has asked before, on another film, for typing sounds that match each typed character). Then `amb-winter` (winter is the first season a visitor sees and it has no ambience) and `amb-fall`; at 220 credits a take these two are where most of the credit goes, so first try what is free (for `amb-fall`: its take 2, the wind, with its take 1, the leaves, was heard as wind and rustling dry leaves with no low tone; a quiet made tone under it may complete the line).
- Before a paid take of a cue, write down in `audio/RECIPE.md` what part it is to give and what will be laid with it. After it, the numbers and the listener's answers. Keep with `npm run sound -- --cue ID --keep ...` when both fit.
- A cue that still has no acceptable sound after its three new takes stays open and its moment stays silent. Do not keep a sound you would not stand behind to fill a gap: a wrong sound is worse than none (a door latch at a landing, a splash where a set-down is meant).
- Do not spend the last credits for their own sake. What is left stays Brandon's.

### 4. The app's set and the last checks

- `npm run sound -- --pack` writes `public/audio/` (the sprite, the loops, `index.json`). The whole set stays under `audio.appMaxMb` (8 MB). Say which cues are now in it. The app's player reads `public/audio/index.json`; if a new cue needs a new name or field there, do not change `src/audio/`: tell `/root` what the player has to know, word for word.
- `npm run soundcheck` (A1 to A8): copy its table.
- `npm run mix -- --candidate four-tracks` once more with the new cues, and the measurements of job 1 again.
- `npm run sound -- --sheet` makes the picture of the kept sounds (a waveform a sound with its name and length); say where it is.

## Reports

Send `/root` at most three messages (`message_agent`, target `/root`), each of at most 40 lines:

1. When jobs 1 and 2 are done and before your first paid call: the measurements before and after for (a) to (e) and for the loops, the files you changed, the tests that hold them, so `/root` can commit that state.
2. Only if something outside your list blocks you.
3. At the end: every cue's state (kept: from which takes and layers, what the listener heard in its own words, the numbers; or open: why), the credits spent in this phase and left by `soundguard.mjs sum`, the mix's measurements, the loops' seams, the soundcheck table, the files changed, and plainly what was not done and what nobody has heard. No handle in it.

Hard limit: 3 hours from your start (`date -u` at your first step). At the limit, stop where you are, leave the tree in a state that passes its tests, and report.
