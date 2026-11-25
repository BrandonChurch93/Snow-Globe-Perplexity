# The sound of the Snow Globe: the log of every cue, and how to make what is not made

Written by the sound agent of Phase 4 on 2026-11-25 (UTC), on the branch `agent/p4-sound`.

## Where it stands

**Phase 4 made no sound. The sound tool is out of credits.**

- `GET /v1/user/subscription` at 02:51:42 UTC and again at 02:55:12 UTC: tier `creator`, 130996 of 131000 credits used, 4 left, `can_extend_character_limit` false. The period resets on 2026-12-23 at 20:08 UTC.
- The first take of the phase, `shake-spring`, at 02:52:33 UTC: HTTP 401, `quota_exceeded`, "You have 4 credits remaining, while 29 credits are required for this request".
- The music endpoint, asked once at 02:58:33 UTC with the first take of `music-spring`: HTTP 401, `insufficient_credits`.
- No take was filed or counted, and the counter did not move. The shortest sound effect the endpoint makes, 0.5 s, costs 6.
- The raw answers are in `audio/evidence/`.
- `AGENTS.md`, "Sound": a sound that cannot be made is an open item, its moment plays without it, and the build goes on. Nothing here blocks a gate.

What Phase 4 did instead, at no cost: every remaining cue's text, written from the list `learned` in `audio/prompts.json`; the plan of the `one-piece` candidate, made by the plan endpoint; the four track prompts; the questions for music; three small scripts that make, file and prepare a take; the mixes and the checks on the four sounds that exist.

To go on, the account needs credits. Section "What it will cost" gives the sum.

## If you are the next sound agent

You have never seen this build. This is what you need, in order.

1. Read: `AGENTS.md`, the part "Sound"; `kit/03-METHOD.md` section 12; `kit/01-FILM.md`, "The soundtrack"; `audio/QUESTIONS.md`; in `audio/prompts.json` every line of `learned`, then `takes`; `node tools/sound.mjs --help`.
2. What the build is: one glass snow globe with a miniature inside that goes through four seasons; a shake changes the season. The app plays effects and ambience, and a film of it, 60 s, is cut to music. A shake is the liquid and what floats in it thrown about inside sealed glass. A landing is the globe set down on stone and the season arriving. An ambience is one steady bed for the season.
3. Nobody here has ears. A take is judged by its numbers and by a listener's answers, and Brandon, the owner, decides at the review. Never report something unheard as heard.
4. The rules that bind every take:
   - At most 3 takes for a cue and for a piece of music (`audio.maxTakesPerCue`), one at a time, each judged before the next is asked for. The harness refuses a fourth.
   - `shake-winter`, `land-winter`, `amb-winter` and `lift` are out of takes. Do not make takes for them. `glass-clink`, `ui-tick` and `ui-sound-on` are kept: leave them.
   - Every sound effect prompt is the cue's text, a comma, then the family line, word for word. Every music prompt ends with the music family line, word for word. The scripts below do this and refuse a music prompt that does not.
   - The default model of each endpoint, never one marked preview or beta.
   - A take that does not fit its line is not kept. Its moment stays silent and the cue is an open item.
   - No sound file is ever committed. Commit the text records by naming their paths.
5. The order: spring's three cues, summer's, fall's, then `music-box`, `key-tap`, `ui-send`, `riser`, then the music of `one-piece`, then the four tracks, then the mixes and the checks. After each batch that is kept: the sheet, the pack, a push, and the kept files to whoever builds the app.
6. Start with "Before the first take" below. Every command in this file is run from the root of the repo.

## Every cue

| Cue | Class | Length | State | Takes used | Note |
| --- | --- | --- | --- | --- | --- |
| `lift` | touch | 0.5 s | kept, take 3 | 3 of 3 | Phase 3. One brief harsh scrape of a heavy thing leaving stone |
| `glass-clink` | touch | 0.3 s | kept, take 2 | 2 of 3 | Phase 2. One high clean ring |
| `ui-tick` | interface | 0.08 s | kept, take 2 | 2 of 3 | Phase 3. One dull dry click, all under 1 kHz |
| `ui-sound-on` | interface | 0.4 s | kept, take 1 | 1 of 3 | Phase 2. A bright chime of two quick tones, a little synthetic |
| `shake-winter` | impact | 2.6 s | open, out of takes | 3 of 3 | A spoon in a glass; ice cubes in a container; sleigh bells in open air |
| `land-winter` | impact | 1.5 s | open, out of takes | 3 of 3 | Almost silent; one light clink; two hollow knocks |
| `amb-winter` | ambience | 20 s | open, out of takes | 3 of 3 | Two rumbles under 60 Hz; a gust, a whoosh and bells up close |
| `shake-spring` | impact | 2.6 s | not made: no credits | 0 | |
| `land-spring` | impact | 1.5 s | not made: no credits | 0 | |
| `amb-spring` | ambience | 20 s | not made: no credits | 0 | |
| `shake-summer` | impact | 2.6 s | not made: no credits | 0 | |
| `land-summer` | impact | 1.5 s | not made: no credits | 0 | |
| `amb-summer` | ambience | 20 s | not made: no credits | 0 | |
| `shake-fall` | impact | 2.6 s | not made: no credits | 0 | |
| `land-fall` | impact | 1.5 s | not made: no credits | 0 | |
| `amb-fall` | ambience | 20 s | not made: no credits | 0 | |
| `music-box` | interface | 2 s | not made: no credits | 0 | |
| `key-tap` | interface | 0.1 s | not made: no credits | 0 | |
| `ui-send` | interface | 0.3 s | not made: no credits | 0 | |
| `riser` | touch | 1.2 s | not made: no credits | 0 | |
| `music-one-piece` | music | 60 s | not made: no credits | 0 | The candidate `one-piece` |
| `music-winter`, `music-spring`, `music-summer`, `music-fall` | music | 28.8 s each | not made: no credits | 0 | The candidate `four-tracks` |

The text, the settings, the verdict and the listener's words of every take that exists are in `audio/prompts.json` under `takes`; the measurements are in `audio/RECORDS.json`.

Credits spent on sound by the cost headers, all before Phase 4: 820 on the seventeen takes whose headers are in `audio/RECORDS.json`, 79 on the three takes of 06:37 to 06:44 UTC on November 24, and two test calls whose headers were not kept (about 66). Phase 4: 0.

Family checks: none was run in Phase 4, because no take was made.

## What the app and the films do while these are missing

- The mix lays what is kept and names the rest. `npm run mix -- --candidate one-piece` at 02:56 UTC: 8 cues placed (four times `lift`, four times `glass-clink`), music none, and skipped with "no kept file": `music-box`, every `shake-`, `land-` and `amb-` cue, `music-one-piece`. `--candidate four-tracks` gives the same bytes, because neither has music.
- **Those two mixes are not soundtracks and were not kept** (see the last section). The master brings whatever it is given to -14 LUFS. With eight short sounds and nothing else it added 10.6 dB of gain, so each scrape and each clink is that much louder than its class level, in silence. Until music exists, the films are silent, as `AGENTS.md` says: "build everything silent".
- The app plays a sound only if `public/audio/index.json` names it. The pack of 02:56 UTC holds four sounds in one file (`lift`, `glass-clink`, `ui-tick`, `ui-sound-on`, 0.06 MB) and no loop. So in the app a shake plays the lift and the clink, the controls tick, and there is no ambience and no music. This is read from `src/audio/index.ts` (a sound without an entry returns before anything plays) and from the pack; it was not heard in a browser by this agent.
- In film A the prompt opening is silent: `key-tap`, `ui-send` and `riser` do not exist.

## Before the first take

```
git clone https://github.com/BrandonChurch93/Snow-Globe-Perplexity && cd Snow-Globe-Perplexity && npm ci
```

- The four kept files (`audio/kept/lift.wav`, `glass-clink.wav`, `ui-tick.wav`, `ui-sound-on.wav`) are not in the repo: copy them into `audio/kept/` from the workspace or from the archive attached to the thread. Without them `--pack`, `--sheet` and the family check have nothing to work with.
- The calls go through the credential proxy. The handle is the one `list_credentials` shows for `api.elevenlabs.io`; the scripts read it from `ELEVENLABS_HANDLE` and fall back to the handle this build used.
- Read the counter first: `pplx credentials run $ELEVENLABS_HANDLE -- curl -sS https://api.elevenlabs.io/v1/user/subscription`. `character_limit` minus `character_count` is what is left.
- Read every line of `learned` in `audio/prompts.json`.

## A sound effect: the call

`POST https://api.elevenlabs.io/v1/sound-generation?output_format=pcm_48000`, header `Content-Type: application/json`, the default model (no `model_id` in the body). The body:

```json
{ "text": "<the cue's text>, <the family line>", "duration_seconds": 2.6, "prompt_influence": 0.6, "loop": false }
```

- The family line, word for word: `close and detailed, glass, water and small natural things, a dark quiet room, no music, no melody, no voice`.
- The answer is raw 16 bit PCM at 48 kHz (stereo in the Phase 0 test call). Its header `character-cost` is the cost: keep it.
- One command does the call, keeps the header, turns the PCM into a WAV and files the take with `npm run sound` (text and settings from `audio/prompts.json`, the cue's line from `audio/lines.json`):

```
node audio/run/take.mjs shake-spring
```

It prints the status, the cost, and the numbers of the take: its length, the silence in front and at the end, peak, loudness, tail, the count of separate events, and how the energy is spread from low to high. A refused call files nothing and counts nothing.

## The texts, in the order they are made

Each is sent as: the text, a comma, the family line.

| # | Cue | Asked | Influence | Text |
| --- | --- | --- | --- | --- |
| 1 | `shake-spring` | 2.6 s | 0.6 | Water sloshing and churning hard back and forth inside a sealed half full bottle that is shaken six times: heavy wet sloshes and gulps of water slapping its walls, full and loud |
| 2 | `land-spring` | 2 s | 0.6 | A heavy stone mortar set down hard into a shallow puddle on a marble countertop: one deep heavy thud with a wet splash of drops and a short rush of air pushed out from under it |
| 3 | `amb-spring` | 20 s | 0.5 | Steady light rain falling on leaves and wet ground in a garden: one even full patter with no gusts and no thunder, and a few small songbirds chirping far away now and then |
| 4 | `shake-summer` | 2.6 s | 0.6 | Water, sand and dry seeds sloshing and churning hard inside a sealed jar that is shaken back and forth six times: heavy wet sloshes with the seeds rattling and the sand hissing against its walls, full and loud |
| 5 | `land-summer` | 2 s | 0.6 | A heavy brass bowl full of dry sand set down hard on a marble countertop: one deep heavy thud with a warm ringing of the brass and the sand hissing as it settles |
| 6 | `amb-summer` | 20 s | 0.5 | A field of crickets chirping steadily on a warm summer night: one even full chorus, with a slow warm breeze moving through dry grass far away |
| 7 | `shake-fall` | 2.6 s | 0.6 | Water and small dry wooden beads sloshing and rattling hard inside a sealed hollow wooden flask that is shaken back and forth six times: heavy wet sloshes, a hollow knocking rattle and a dry papery rustle of leaves, full and loud |
| 8 | `land-fall` | 2 s | 0.6 | A heavy iron cauldron set down hard on an old wooden table: one deep heavy thud, the wood creaking long under the weight, and a low dark hum ringing on in the iron |
| 9 | `amb-fall` | 20 s | 0.5 | Autumn wind blowing steadily through bare trees with dry leaves rustling and skittering along the ground the whole time, and a low hollow drone of wind in a chimney far away |
| 10 | `music-box` | 2 s | 0.6 | The clockwork mechanism of a small wind-up toy turning with no tune: a steady fine ticking and whirring of tiny brass gears, even and dry |
| 11 | `key-tap` | 0.5 s | 0.6 | One single key of a computer keyboard pressed once: one short muted low plastic clack, dull and dry |
| 12 | `ui-send` | 0.5 s | 0.6 | One firm press of a single large rubber button: one short low rounded click with a small thump, dry |
| 13 | `riser` | 1.2 s | 0.6 | A rush of air rising quickly: one whoosh of wind that swells from nothing to full and stops short at its loudest |

`loop` is false for every one: the chain makes the loops (the measured reason is in `learned`).

Why each text is as it is. None of these has been tried: they are first texts, built on what the winter takes taught.

- No word for quiet, soft, faint or gentle anywhere: those came back almost silent. The chain sets the level.
- No text opens with glass, and none names a hand, strokes or stirring: those gave a clink and a spoon.
- Each text is one real event that holds everything in the cue's line, never two events in a row.
- The shakes: one sealed vessel with the season's material in it. Spring is water alone, because petals make no sound. Summer puts sand and seeds in the jar: the second winter shake, asked that way, came back as liquid with small hard things rattling in it, which was wrong for snow and is right for seeds. Fall is a hollow wooden flask, for the hollow rattle.
- The landings: one heavy thing named by its material, set down on a named surface, as the kept `lift` was. Each object carries its season: a mortar set into a puddle (the drop and the air), a brass bowl of sand (the warm chime and the hiss), an iron cauldron on old wood (the creak and the low tone). They are asked at 2 s so the tail has room; the chain cuts each to 1.5 s. In the film `glass-clink` plays under each landing and brings the glass.
- The landing of fall has no moan, groan or howl in its text, and the ambience of fall names its low tone as wind in a chimney: such words can bring a voice or music.
- The ambiences: one steady bed, with the far detail named as far away and sparse, and no instrument named.
- `music-box` asks for the mechanism only. The words music box would bring a tune, and the family line forbids one.
- `riser` is asked at the cue's own length, so the swell ends where the cue ends, and leaves out the word breath, because the listener is asked about breath.

If a first take fails, change the text by what the listener heard, write the new text into `audio/prompts.json` (`cues.<id>.text`), add a line to `learned`, and only then ask again. Three takes at most.

## How a take is judged

1. The numbers, printed when the take is filed. For a sound effect: does the sound fit the length of its cue, how many events, is there a body where the line needs one (a thud needs energy under 250 Hz, a hiss above 4 kHz), is the tail quiet. A take can be rejected by the numbers alone (almost silent, or all of it under 60 Hz).
2. The listening copy, which is the take after the level chain of its class, exactly as keeping would make it:

```
node audio/run/listen.mjs shake-spring          # the newest take; add a number for another take
```

It writes `out/work/audio/listen/<cue>-take-<n>.wav`. A copy under a quarter of a second gets silence around it.

3. The listener, the audio evaluation tool (`evaluate_audio`), with the fixed questions of `audio/QUESTIONS.md`: first the open questions, in a call that does not show the cue's line; then the fit questions in a second call, with the cue's line from `audio/lines.json`. About one call in five answers that no file came: ask that one again, once. A voice heard in a sound effect counts only if a second call hears it too. The listener invents things on a very quiet clip and agrees easily with a line it is shown, which is why the order matters.
4. File what was heard: write a JSON file with `verdict`, `why` and `listener` (`line`, `open`, `fit`), as the takes in `audio/prompts.json` have it, and

```
npm run sound -- --answers <that file> --cue shake-spring --take 1
```

Add the same to `takes` in `audio/prompts.json`.

5. Keep it if the numbers fit the length and the answers fit the line:

```
npm run sound -- --cue shake-spring --keep --take 1 --why "<one sentence>"
```

A cue with no acceptable take after three is an open item and its moment stays silent. Do not keep a take that does not fit its line.

6. The family check, for every kept take after the second: three sounds in one file, one second apart, and the two family questions of `audio/QUESTIONS.md`:

```
node audio/run/family.mjs audio/kept/glass-clink.wav audio/kept/lift.wav audio/kept/shake-spring.wav
```

## The chain

Run by `npm run sound -- --keep`, the same for every sound of a class (`tools/lib/audio.mjs`): a constant offset is taken out, a low cut, the silence is trimmed, the take is cut to its cue's length (if its first part is weak, the cut starts where the main sound starts), a fade in and a fade out, then the level of its class with the peak held under -1 dB.

| Class | Cues | Level | Low cut | Trim under | Fade in, out |
| --- | --- | --- | --- | --- | --- |
| ambience | `amb-*` | -30 LUFS | 70 Hz | -60 dB | none: made to loop, 1.5 s of its end crossfaded into its start, the seam checked by number |
| interface | `ui-tick`, `ui-sound-on`, `key-tap`, `ui-send`, `music-box` | -26 LUFS | 120 Hz | -48 dB | 2 ms, 30 ms |
| touch | `lift`, `glass-clink`, `riser` | -22 LUFS | 45 Hz | -48 dB | 3 ms, 80 ms |
| impact | `shake-*`, `land-*` | -18 LUFS | 30 Hz | -50 dB | 3 ms, 180 ms |
| music | `music-*` | -16 LUFS | none | -60 dB | 2 ms, 30 ms; not cut to a length |

`key-tap` is repeated in the film with a fixed list of small pitch offsets, in cents: 0, -45, 30, -20, 55, -65, 15, 40, -30.

## The music: the calls

`POST https://api.elevenlabs.io/v1/music?output_format=pcm_48000`, the default model (no `model_id`). The music endpoint sends no cost header, so the script reads the account's counter before and after and records the difference. In Phase 0 ten seconds cost 138.

The music family line, word for word: `instrumental, no vocals, no spoken words, clean ending`.

The grid: a bar is 4 beats at 100 beats a minute, 2.4 s. The film is 25 bars, 60 s, in five sections of 5 bars, 12 s each: a hold of 4 bars and its shake, and the close of 5 bars. Section boundaries at 12, 24, 36 and 48 s.

### `one-piece`: one composition from a plan of timed sections

The body is `{ "composition_plan": <the plan>, "respect_sections_durations": true }`. The plan is `audio/plans/one-piece.json`. It was made at 02:54 UTC by `POST /v1/music/plan` from the prompt recorded in that file with `music_length_ms` 60000; the call cost nothing (the counter read 130996 before and after). The five sections came back at 12000 ms each: Winter, Spring, Summer, Fall, Winter Return. One change was made to it: the music family line is the last of its `positive_global_styles`.

```
node audio/run/music.mjs music-one-piece
```

### `four-tracks`: one track for each season

The body is `{ "prompt": "<the prompt>", "music_length_ms": 28800, "force_instrumental": true }`. A track is 12 bars: the mix takes its first 5 bars for the season's section, the second winter section takes the last 5 bars of the winter track (so the winter track is asked to grow fuller and resolve there), and the app's loop takes 8 bars.

| Piece | Prompt |
| --- | --- |
| `music-winter` | A warm orchestral Christmas piece at exactly 100 beats per minute in 4/4, twelve bars long: sleigh bells keeping the beat, a celesta carrying one short simple melody, soft choir pads and low strings under it. It starts on the first downbeat with no pickup and no lead-in, grows fuller with full strings through its last five bars and resolves on its last bar, instrumental, no vocals, no spoken words, clean ending |
| `music-spring` | A light and airy piece at exactly 100 beats per minute in 4/4, twelve bars long: a harp in flowing arpeggios, a flute carrying one short simple melody, plucked strings marking the beat, fresh and bright. It starts on the first downbeat with no pickup and no lead-in and holds one even feel, instrumental, no vocals, no spoken words, clean ending |
| `music-summer` | A warm and unhurried piece at exactly 100 beats per minute in 4/4, twelve bars long: a nylon string guitar carrying one short simple melody, a soft marimba marking the beat, a golden dusk. It starts on the first downbeat with no pickup and no lead-in and holds one even feel, instrumental, no vocals, no spoken words, clean ending |
| `music-fall` | A Halloween piece at exactly 100 beats per minute in 4/4, twelve bars long: a detuned music box and a piano carrying one short simple melody over low strings, with eerie sounds in the music itself, creaks, a far bell and wind across the strings. It starts on the first downbeat with no pickup and no lead-in and holds one even feel, instrumental, no vocals, no spoken words, clean ending |

```
node audio/run/music.mjs music-winter        # then music-spring, music-summer, music-fall
```

Two things in these calls are not tested, because every call was refused:

- `pcm_48000` on the music endpoint. The Phase 0 test call used `mp3_44100_192`. If the format is refused, run with `MUSIC_FORMAT=mp3_44100_192`.
- The winter direction of the kit names soft choir pads. If the listener hears a voice in a winter take, the next take leaves the choir out and names a warm string pad.

### How a piece of music is judged

1. The numbers when it is filed: its length, its loudness, silence in front (a track must start at once).
2. The map of the take:

```
npm run audiomap -- --file out/work/audio/takes/music-one-piece/take-1.wav --name music-one-piece-take-1
```

It prints the tempo, the bars, the first bar line and the sections it finds. For `one-piece`, each section boundary of the map must lie within one bar, 2.4 s, of 12, 24, 36 and 48 s. For a track, the tempo should be near 100 and the first bar line near 0. A map marked `grid` found no clear pulse: its beats cannot be trusted.

3. The listener, with the music questions of `audio/QUESTIONS.md`, on the copy from `node audio/run/listen.mjs music-one-piece`: open first, then the fit call with the lines of `audio/lines.json`.
4. It is kept when the listener hears no voice or words, hears the right mood in each section, and the map puts each boundary within one bar of the plan:

```
npm run sound -- --answers <file> --cue music-one-piece --take 1
npm run sound -- --cue music-one-piece --keep --take 1 --why "<one sentence>"
npm run audiomap -- --file audio/kept/music-one-piece.wav --name music-one-piece
```

The last line matters: the mix and the pack read the map named after the piece, made from the kept file.

## After each batch, and at the end

```
npm run sound -- --sheet        # out/work/audio/sheet.jpg: every kept sound as a waveform
npm run sound -- --pack         # public/audio/: the short sounds in one file, the ambience loops, the music loops of the season tracks
npm run sound -- --list         # every cue, its takes, what is kept
npm run mix -- --candidate one-piece
npm run mix -- --candidate four-tracks
npm run build && npm run soundcheck
```

Commit the text records by name (`audio/prompts.json`, `audio/RECORDS.json`, `audio/RECIPE.md`, `audio/kept/<id>.json`, `audio/kept/<id>.wav.json`, `audio/mix/<candidate>.json`). No sound file is committed: the repo is public. Each kept sound gets its row in `ASSETS.md`; the keep command prints it.

## What it will cost

By the cost headers so far: a sound effect costs about 11 credits a second (6 for 0.5 s, 11 for 1 s, 17 for 1.5 s, 29 for 2.6 s, 33 for 3 s, 220 for 20 s). Music cost 13.8 a second in the one call measured.

| What | One take | Three takes |
| --- | --- | --- |
| Three shakes | 87 | 261 |
| Three landings at 2 s | about 66 | about 200 |
| Three ambiences | 660 | 1980 |
| `music-box`, `key-tap`, `ui-send`, `riser` | about 48 | about 145 |
| `one-piece`, 60 s | about 830 | about 2500 |
| Four tracks of 28.8 s | about 1600 | about 4800 |
| Together | about 3300 | about 9900 |

A review round for the three open winter cues would add up to about 800.

## What a review round should try first on each open cue

- `shake-winter`: two layers, as `learned` says. Ask for the water alone with the text of `shake-spring`, and for the bells as a second cue (a strap of small sleigh bells shaken six times), and let the chain lay them together. One prompt did not give both in three takes.
- `land-winter`: the pattern of the new landings: one heavy thing named by its material that carries the ice. For example a heavy stone mortar set down hard on a sheet of thin ice over marble: one deep heavy thud with the ice cracking and crackling outward under it.
- `amb-winter`: one steady bed with no instrument named: wind blowing steadily across open snow, an even full hiss of blown snow, and no bells in the text. If bells are wanted, they are a second cue laid far under it.
- The thirteen cues and five pieces not made: their first texts are above; none has a take to learn from yet.

## Commands run in Phase 4 and what they printed

- `npm ci`: found 0 vulnerabilities.
- `node audio/run/take.mjs shake-spring` (then named `out/work/audio/gen.mjs`), 02:52:33 UTC: HTTP 401 `quota_exceeded`; nothing filed.
- `POST /v1/music/plan`, 02:54 UTC: HTTP 200 in 2.96 s; five sections of 12000 ms.
- `node audio/run/music.mjs music-spring`, 02:58:33 UTC: HTTP 401 `insufficient_credits`; the counter moved by 0; nothing filed.
- `npm run mix -- --candidate one-piece`, 02:56 UTC: film B, 60 s, 8 cues placed, music none, 10.568 dB of gain, the limiter took off at most 1.66 dB, measured -14 LUFS, true peak -1.1 dB, range 3.8 LU, sha256 `0bea7fb6edbc…88c7`. `--candidate four-tracks`: the same numbers and the same sha256.
- `npm run sound -- --pack`: `public/audio/sprite.mp3`, 0.06 MB, 4 sounds, 192 kbps, under 8 MB. `--sheet`: 4 sounds, 1200 x 650.
- `npm run soundcheck`: see the last section.
- `npx vitest run tests/audiomap.test.ts tests/mix.test.ts`, 03:02 UTC: 2 files, 38 tests passed. The whole test suite was not run by this agent: nothing outside `audio/` was changed.
- `node audio/run/listen.mjs lift --file audio/kept/lift.wav`, `node audio/run/listen.mjs ui-tick --file audio/kept/ui-tick.wav` and `node audio/run/family.mjs` on three kept files: each wrote its file (the tick copy is 1.58 s with its silence, the family file 4.20 s). These scripts were tested on kept files only; `take.mjs` and `music.mjs` have run only into the refusals above, so their path after an HTTP 200 has not run.

## The sound checks

`npm run soundcheck` at 02:56 UTC, before the app was built in this clone: 4 pass, 0 open, 4 not run.

- A1 to A4 not run: "dist/ does not match the source. Run npm run build."
- A5 pass: all 4 kept sounds have take, prompt, measurements, answers and a row.
- A6 pass: `four-tracks.wav` -14 LUFS, peak -1.1 dB; `one-piece.wav` -14 LUFS, peak -1.1 dB.
- A7 pass: 2 mixes made twice more, each byte equal to the file.
- A8 pass: 17 takes over 7 cues, at most 3 for one cue in one round, limit 3.

`npm run build` (built in 1.79 s), then `npm run soundcheck` again, finished 03:01 UTC: 7 pass, 1 open, 0 not run.

- A1 pass: before any interaction no audio context was made and nothing played.
- A2 open: "the control could not be used: locator.click: Timeout 5000ms exceeded." This is the open item already in `kit/PROGRESS.md` under "Sound": on this VM the live app draws too slowly for the test's click on the sound control. It is not about the sounds.
- A3 pass: `winter-rest` at draft is byte equal with the audio code loaded and without it (`f6a5bfd6b05a`), and capture loads no audio by itself.
- A4 pass: 1 file, 0.06 MB, under 8 MB, not asked for before the first picture.
- A5 to A8 pass, as in the first run.

The two mixes were made to be measured and were then removed from this clone, with their records and their lines in `audio/RECORDS.json`: a file named after a candidate that holds no music is not a candidate. So `audio/mix/` holds what it held before Phase 4, and A6 and A7 above were measured on files that no longer exist. The pack and the sheet were written in this clone only (`public/audio/` and `out/work/` are not committed) and hold the same four sounds as before.
