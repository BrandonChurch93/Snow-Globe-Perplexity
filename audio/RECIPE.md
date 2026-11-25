# The sound of the Snow Globe: the log of every cue, and how to make what is not made

Written by the sound agent of Phase 5 on 2026-11-25 (UTC), on the branch `agent/p5-sound-takes`. It replaces the Phase 4 text, which described a build with no credits.

## Where it stands

**14 sounds are kept. 10 effect cues and the one-piece music are open, each out of its three takes. No further call that makes sound may be made without a review round.**

- Kept in Phase 5: `shake-spring` (take 2), `amb-spring` (take 2), `amb-summer` (take 1), `music-box` (take 1), `ui-send` (take 1), `riser` (take 3), `music-winter` (take 1), `music-spring` (take 2), `music-summer` (take 2), `music-fall` (take 1). Kept before: `lift`, `glass-clink`, `ui-tick`, `ui-sound-on`.
- Open: `shake-winter`, `land-winter`, `amb-winter` (from Phase 2 and 3), `land-spring`, `shake-summer`, `land-summer`, `shake-fall`, `land-fall`, `amb-fall`, `key-tap`, `music-one-piece`.
- The `four-tracks` candidate has all four of its tracks and is mixed. The `one-piece` candidate has no music and cannot be mixed.
- Credits: Brandon's limit for this phase was 10,000. The guard's count at the end: **6,765 spent, 3,235 left** (effects 1,914 by their cost headers over 31 calls; music 4,851 by the account's Music usage line over 9 calls). 40 calls, none refused, none without a guard line before and after it.
- Free work done after the paid passes: layers of each open cue's own takes (none was heard as its whole line, none kept), the `four-tracks` mix, the pack, the sound checks.

## The credit guard

Every call that makes sound went between `node out/work/bin/soundguard.mjs begin <cue> <sfx|music> <seconds>` and `... end <cost header or 0> <note>` (the guard and its ledger `out/work/audio/ledger.jsonl` live in the workspace of the main build and are not in the repo). An effect is booked at its `character-cost` header. The music endpoint sends no cost header, so the guard reads the account's usage report, product Music, before and after the call and books the rise. `sum` prints what is spent and left.

The last line of `sum`, 18:26 UTC: `{"limit":10000,"spent":6765,"left":3235,"calls":40,"open":null,"counter":{"used":13750,"limit":131000},"effects":1914,"music":4851,"accountMusicLine":4851,"othersInsideMyCalls":220,"ratesSeen":{"sfx":12,"music":13.8}}`.

**Someone else used the same account during this phase.** The account's usage report at 18:26 UTC: API 13,491, Website 350; by product Music 4,851, Sound Effects 7,294, TTS 1,346, Voice Generation 350. This agent made no speech and no voice call, and its effects sum to 1,914: so 5,380 credits of Sound Effects, all of TTS and Voice Generation are not this build's. One of those foreign effect calls (220 credits, a 20 s effect) fell inside the guard window of `riser` take 2 (header 13, counter rise 233); the guard books 13. This was reported to `/root` at 17:40, 17:47, 17:51, 18:10, 18:13 and 18:26 UTC and is for Brandon to look into; it is why the account counter (13,750 used) is far above this build's 6,765.

## If you are the next sound agent

You have never seen this build. This is what you need, in order.

1. Read: `AGENTS.md`, the part "Sound"; `kit/03-METHOD.md` section 12; `kit/01-FILM.md`, "The soundtrack"; `audio/QUESTIONS.md`; in `audio/prompts.json` every line of `learned`, then `takes`, `music.takes` and `layers`; `node tools/sound.mjs --help`.
2. What the build is: one glass snow globe with a miniature inside that goes through four seasons; a shake changes the season. The app plays effects and ambience, and a film of it, 60 s, is cut to music. A shake is the liquid and what floats in it thrown about inside sealed glass. A landing is the globe set down on stone and the season arriving. An ambience is one steady bed for the season.
3. Nobody here has ears. A take is judged by its numbers and by a listener's answers, and Brandon, the owner, decides at the review. Never report something unheard as heard.
4. The rules that bind every take:
   - At most 3 takes for a cue and for a piece of music (`audio.maxTakesPerCue`), one at a time, each judged before the next is asked for. The harness refuses a fourth in the same round. **Every open cue is out of takes in the round `build`**: a new take needs a review round and Brandon's word on credits.
   - Every sound effect prompt is the cue's text, a comma, then the family line, word for word. Every music prompt ends with the music family line, word for word.
   - The default model of each endpoint, never one marked preview or beta.
   - A take that does not fit its line is not kept. Its moment stays silent and the cue is an open item.
   - No sound file is ever committed. Commit the text records by naming their paths.
5. Start with "What a review round should try first" below. Every command in this file is run from the root of the repo.

## Every cue

| Cue | Class | Length | State | Takes | What each take was heard as |
| --- | --- | --- | --- | --- | --- |
| `lift` | touch | 0.5 s | kept, take 3 | 3 | Phase 3. One brief harsh scrape of a heavy thing leaving stone |
| `glass-clink` | touch | 0.3 s | kept, take 2 | 2 | Phase 2. One high clean ring; the family checks call it synthetic |
| `ui-tick` | interface | 0.08 s | kept, take 2 | 2 | Phase 3. One dull dry click |
| `ui-sound-on` | interface | 0.4 s | kept, take 1 | 1 | Phase 2. A bright chime of two quick tones |
| `shake-winter` | impact | 2.6 s | open | 3 | 1 a spoon stirring liquid and ice in a glass; 2 ice cubes or dice shaken in a container with liquid; 3 small sleigh bells in open air |
| `land-winter` | impact | 1.5 s | open | 3 | 1 a faint thud, almost silent (numbers; not heard); 2 one light bright clink on glass; 3 a small hollow thing dropped on wood that bounces |
| `amb-winter` | ambience | 20 s | open | 3 | 1 and 2 a rumble under 200 Hz and nothing else (numbers; not heard); 3 a gust, a whoosh, then sleigh bells loud and close |
| `shake-spring` | impact | 2.6 s | **kept, take 2** | 2 | 1 one plunge into open water, a bucket or basin; 2 open call: liquid poured and splashing, wet and sloshing, one event; fit call: water sloshing and churning hard inside a glass container. Small and enclosed; heard as a pour more than a shake |
| `land-spring` | impact | 1.5 s | open | 3 | 1 one sharp mechanical click; 2 a brittle crunch or a wet splat; 3 a splash into a bucket of water |
| `amb-spring` | ambience | 20 s | **kept, take 2** | 2 | 1 food sizzling in a pan with a bird; 2 open call: water flowing like a small stream or fountain with a bird chirping over it; fit call: bird calls and a patter of light rain. Even within 5 dB. The water is heard as a stream, not as rain |
| `shake-summer` | impact | 2.6 s | open | 3 | 1 open splashes as from a bucket, no seeds; 2 a dry rattle of beads, no liquid; 3 liquid shaken in a container, no seeds |
| `land-summer` | impact | 1.5 s | open | 3 | 1 a hiss like a match flaring; 2 a rising hiss like a zipper; 3 a short whoosh |
| `amb-summer` | ambience | 20 s | **kept, take 1** | 1 | a fast high chirping of a cricket, steady; one of three calls heard a squeak like a rusty swing first. One voice of crickets, not a field |
| `shake-fall` | impact | 2.6 s | open | 3 | 1 three knocks on wood (0.9 s); 2 a splash in a hollow vessel, once with a clatter (fits weakly); 3 a dry rattle like dice in a cup |
| `land-fall` | impact | 1.5 s | open | 3 | 1 one heavy low impact like hollow wood struck; 2 a sub rumble, 93 percent under 60 Hz, twice answered "no file"; 3 a door creaking and latching, once taken for a cat |
| `amb-fall` | ambience | 20 s | open | 3 | 1 someone walking through dry leaves; 2 a steady strong wind roar, very even (fits weakly); 3 four heavy breaths through a regulator |
| `music-box` | interface | 2 s | **kept, take 1** | 1 | a mechanical ratchet, "winding a music box" |
| `key-tap` | interface | 0.1 s | open | 3 | 1 a hard sharp click like a mouse button; 2 the same, brighter; 3 a low dull thud like a knock on wood |
| `ui-send` | interface | 0.3 s | **kept, take 1** | 1 | a click in two of three calls, a "ding" in one (a line at 1500 Hz) |
| `riser` | touch | 1.2 s | **kept, take 3** | 3 | 1 a whoosh loudest in its middle; 2 a flat hiss ending in a pop, heard as a mouth; 3 rising air, -60 to -20 dB over 0.95 s. All its energy is under 250 Hz: check it on a small speaker at the review. The fit call said no ("not a human inhalation"); the open calls and the numbers decided |
| `music-winter` | music | 28.8 s | **kept, take 1** | 1 | sleigh bells, celesta or piano, a warm pad; festive; no voice; 100.008 bpm, first bar at 0.0135 s. No low strings were named by the listener |
| `music-spring` | music | 28.8 s | **kept, take 2** | 2 | 1 reflective, dreamy, blind choice "warm and unhurried" twice (fits weakly); 2 harp and a soft melody, calm, blind choice "light and airy" twice; no voice; 99.999 bpm, first bar at 0.0053 s; ends on a cut |
| `music-summer` | music | 28.8 s | **kept, take 2** | 2 | 1 a music-box lullaby; 2 fingerpicked acoustic guitar, warm, calm, blind choice "warm and unhurried"; no voice; 100.001 bpm, first bar at 0.0123 s. No marimba was heard |
| `music-fall` | music | 28.8 s | **kept, take 1** | 1 | a detuned music box, eerie, haunting, blind choice "dark and eerie"; no voice; 100.006 bpm, first bar at 0.0033 s |
| `music-one-piece` | music | 60 s | open | 3 | 1 one solo music box in one mood, level boundaries 4.81 / 28.81 / 55.21 s; 2 a music box, strings joining 16 to 47 s, one festive mood, boundaries 3.61 / 20.41 / 39.61 / 56.41 s; 3 sleigh bells, celesta, strings, one festive mood, every 12 s section heard alone called "warm and unhurried", boundaries 4.81 / 31.21 / 55.21 s. No voice in any |

The text, the settings, the cost, the verdict and the listener's words of every take are in `audio/prompts.json` under `takes` and `music.takes`; the measurements are in `audio/RECORDS.json`.

## What is left, for Brandon

Every cue and piece without a kept take. All have had 3 takes. Prices as recorded in this phase: effects 11 credits a second by the cost header (0.5 s = 6, 1.2 s = 13, 2 s = 22, 2.4 s = 26, 2.6 s = 29, 3 s = 33, 20 s = 220); music 13.75 a second by the account's Music line (28.8 s = 396, 60 s = 825).

| id | Takes | Why not kept | One more take | The 3 takes of a review round |
| --- | --- | --- | --- | --- |
| `shake-winter` | 3 | no take holds liquid, snow hiss and bells together | 29 | 87 |
| `land-winter` | 3 | none is heavy, none has ice crackling | 33 | 99 |
| `amb-winter` | 3 | no even bed of wind; bells loud and close | 220 | 660 |
| `land-spring` | 3 | no heavy set-down followed by one drop and a breath of air | 33 | 99 |
| `shake-summer` | 3 | each take holds one part of the line only | 29 | 87 |
| `land-summer` | 3 | no set-down and no chime in any take | 33 | 99 |
| `shake-fall` | 3 | each take holds one part; leaves in none | 29 | 87 |
| `land-fall` | 3 | impact and creak in different takes; the low eerie tone in none | 33 (at 3 s) | 99 |
| `amb-fall` | 3 | wind and leaves in different takes; the low eerie tone in none | 220 | 660 |
| `key-tap` | 3 | two hard clicks and one thud that is no key; the line is a soft key press | 6 | 18 |
| `music-one-piece` | 3 | no voice, but one mood for 60 s in three different plans | 825 | 2,475 |

One more take of each: 1,490 credits (effects 665, music 825). Three of each: 4,470 (effects 1,995, music 2,475). The advice two sections down splits several cues into two layers, which doubles their takes: with that, plan for about 2,000 for the effects.

## The layers (free, decision 111 of `/root`)

A cue out of takes may be laid together from its own takes at no cost, heard and judged exactly as a take, and kept only if it is heard as the whole line. Done with ffmpeg (`volume`, `atrim`, `adelay`, `amix`) on the filed takes; each result went through the level chain of its class (`node audio/run/listen.mjs <cue> --file <layer>`) and to the listener: the open questions twice, the fit question once. Tried at 18:15 to 18:25 UTC for all ten open cues. **None was heard as its whole line. None is kept.** Levels, filters and every answer are in `audio/prompts.json` under `layers`.

| Cue | Layer of takes | Heard as | Missing |
| --- | --- | --- | --- |
| `shake-winter` | 2 + 3 | liquid and ice in a cocktail shaker; the bells are heard as ice | hiss of snow, bells |
| `land-winter` | 3 + 2 | a glass or mug set down on a hard surface, short | ice crackling (in no take). The nearest of the ten |
| `amb-winter` | 3 + 2, two levels | wind, then sleigh bells loud and close | distance: wind and bells are in one take |
| `land-spring` | 2 + 3 | a splash into water | set-down, breath of air |
| `shake-summer` | 3 + 2, three levels | ice cubes clinking in a glass of liquid; with the seeds louder, dice and no liquid | seeds are heard as ice |
| `land-summer` | 3 + 1 | one bright synthetic chime "like a video game coin" in both open calls | set-down, sand (only the fit call heard them) |
| `shake-fall` | 2 + 3, three levels | liquid in one call, dice in the next; once liquid and ice together | leaves; both parts at once |
| `land-fall` | 1 + 3 (+ 2), three ways | a door creak and a latch, or a knock on wood | glass on stone, the tone |
| `amb-fall` | 2 + 1, two levels | wind and rustling dry leaves, an even bed | the low eerie tone (in no take) |
| `key-tap` | 3 + 1, two levels | a sharp hard click, or an electronic boop | softness |

What this taught: under a liquid, any small hard rattle is heard as ice cubes; a sound mostly under 250 Hz is not heard beside anything in the middle of the range; a part that is in no take cannot be laid in.

## What a review round should try first on each open cue

- `shake-winter`, `shake-summer`, `shake-fall`: nine shakes with two or three materials gave one material each. The one shake that was kept, `shake-spring`, is water alone. First try: reuse the kept `shake-spring` water as the bed of all four shakes and buy only the season's dry layer as its own cue, at a level well under the water, asked as a soft, fine sound so that it is not heard as ice: winter "a fine hiss of dry powder snow blown against glass with a few tiny high bells far off", summer "fine dry sand and a few small seeds trickling inside a paper envelope", fall "dry leaves crumpled and rustled in a hand". One take of 2.6 s is 29.
- `land-winter`, `land-spring`, `land-summer`, `land-fall`: twelve landings; a second material in the text (water, sand, ice) took the whole take every time. The set-down itself was heard twice: `land-fall` take 1 (a glass ball dropped on a thick wooden floor: heavy, low) and the free layer of `land-winter` takes 3 + 2 (a glass or mug set down on a hard surface). First try: one dry set-down for all four seasons, with its body between 100 and 400 Hz so a phone plays it (not "deep", "dark" or "low", which gave a sub rumble), then the season's tail as a second short cue laid after it: ice crackling; one water drop; one small warm chime (the hit of `land-summer` take 3 already is a chime); one short wooden creak (the second half of `land-fall` take 3).
- `amb-winter`: one steady bed with no instrument named, as the two kept ambiences were asked: "wind blowing steadily across open snow: one even full hiss of blown snow that stays the same from the first moment to the last". No bells in the text: an instrument named in an ambience comes up close. 220.
- `amb-fall`: wind (take 2) and leaves (take 1) laid together are already heard as wind and rustling dry leaves, an even bed. Only the tone is missing. Either Brandon accepts the line without the tone and that layer is kept at no cost (out/work/audio/layers-tried/amb-fall-layer-2-1-try2.wav in the sound clone), or one take buys the tone alone: name a thing that sounds by itself ("one low note of a bowed metal bowl held and wavering, far away"), not air that someone blows, which gave breathing. 220.
- `key-tap`: the object decides the sound: a key gives a hard click whatever the adjectives say, a rubber pad gives no key. Try a soft object that is still a key: "one key of a laptop with flat silent keys pressed gently once: a small low padded tap". 6.
- `music-one-piece`: three composition plans with five sections of 12 s each gave one arrangement in one mood, with only strings coming and going. The plan's local styles do not turn this model inside 60 s. Do not buy a fourth plan of the same kind (825). If one piece is still wanted, the nearest thing at no cost is the `four-tracks` mix with its cuts smoothed, since the four kept tracks share 100 beats a minute and a grid; or one take with sections of 24 s or more, outside this film's grid.
- The `four-tracks` mix: the listener hears "abrupt cuts that instantly jump from one track to another" at each change. The first thing a review should hear is whether those cuts on the bar line work under the shakes, or want a short crossfade.

## Before the first take

```
git clone https://github.com/BrandonChurch93/Snow-Globe-Perplexity && cd Snow-Globe-Perplexity && npm ci
```

- The 14 kept files `audio/kept/*.wav` are not in the repo: copy them into `audio/kept/` from the workspace. Without them `--pack`, `--sheet`, the mix and the family check have nothing to work with.
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

## The texts of the kept effects

Each was sent as: the text, a comma, the family line; `prompt_influence` 0.6 (ambience 0.5), `loop` false. The texts of every take that was not kept, and what each change of text was for, are in `audio/prompts.json` (`takes`, `cues.<id>.note`, `learned`).

| Cue | Take | Asked | Text |
| --- | --- | --- | --- |
| `shake-spring` | 2 | 2.6 s | Water sloshing back and forth inside a small sealed jar, half full, that is shaken six times in a steady rhythm from the first moment to the last: six quick wet sloshes and gurgles of water slapping the inside of its walls, tight and enclosed, full and loud |
| `amb-spring` | 2 | 20 s | Steady rain falling in a garden at dawn, drumming on broad leaves and on wet ground, with many small songbirds singing in the trees all the time: one even full bed of rain and birdsong that stays the same from the first moment to the last, with no gusts and no thunder |
| `amb-summer` | 1 | 20 s | A field of crickets chirping steadily on a warm summer night: one even full chorus of many crickets that stays the same from the first moment to the last |
| `music-box` | 1 | 2 s | The clockwork mechanism of a small wind-up toy turning with no tune: a steady fine ticking and whirring of tiny brass gears, even and dry |
| `ui-send` | 1 | 0.5 s | One firm press of a single large rubber button: one short low rounded click with a small thump, dry |
| `riser` | 3 | 2.4 s | A slow soft rush of wind passing by: one long smooth whoosh of air that swells slowly and evenly from nothing to full and then dies away as slowly |

What the 31 effect takes taught, in short (the full list is `learned`):

- A prompt with two or three parts gives one of them. Shakes, landings and the fall ambience all did this. Ask for one thing, and lay a second thing in as its own cue.
- The named object decides the sound; the adjectives do not. A keyboard key is a hard click however soft it is asked.
- "Low", "dark" and "deep" together give a rumble under 60 Hz that small speakers do not play.
- "Sucked", "blowing across a bottle" and a long creak come back close to a mouth or a voice.
- Leaves named first and close are footsteps in leaves.
- "One even ... bed that stays the same from the first moment to the last" gives an even ambience.
- The tool does not make a sound that ends at its loudest. A rise is the first half of a longer swell, asked at twice the cue's length and cut by the chain.

## How a take is judged

1. The numbers, printed when the take is filed. For a sound effect: does the sound fit the length of its cue, how many events, is there a body where the line needs one (a thud needs energy under 250 Hz, a hiss above 4 kHz), is the tail quiet. A take can be rejected by the numbers alone (almost silent, or all of it under 60 Hz).
2. The listening copy, which is the take after the level chain of its class, exactly as keeping would make it:

```
node audio/run/listen.mjs shake-spring          # the newest take; add a number for another take
```

It writes `out/work/audio/listen/<cue>-take-<n>.wav`. A copy under a quarter of a second gets silence around it.

3. The listener, the audio evaluation tool (`evaluate_audio`), with the fixed questions of `audio/QUESTIONS.md`: first the open questions, in a call that does not show the cue's line; then the fit questions in a second call, with the cue's line from `audio/lines.json`. About one call in four answers nothing or that no file came: ask that one again, once. A voice heard in a sound effect counts only if a second call hears it too. The listener invents things on a very quiet clip and agrees easily with a line it is shown, which is why the order matters.
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

`POST https://api.elevenlabs.io/v1/music?output_format=pcm_48000`, the default model (`music_v1`, no `model_id`). `pcm_48000` works: the answer is raw 16 bit stereo PCM. The endpoint sends no cost header; the price was read from the account's usage report, product Music: **13.75 credits a second** (396 for 28.8 s, 825 for 60 s), the same in all nine calls.

The music family line, word for word: `instrumental, no vocals, no spoken words, clean ending`.

The grid: a bar is 4 beats at 100 beats a minute, 2.4 s. The film is 25 bars, 60 s, in five sections of 5 bars, 12 s each. Section boundaries at 12, 24, 36 and 48 s.

### `four-tracks`: one track for each season (all four kept)

The body is `{ "prompt": "<the prompt>", "music_length_ms": 28800, "force_instrumental": true }`, sent by `node audio/run/music.mjs music-<season>`. The prompts of the kept takes:

| Piece | Take | Prompt |
| --- | --- | --- |
| `music-winter` | 1 | A warm orchestral Christmas piece at exactly 100 beats per minute in 4/4, twelve bars long: sleigh bells keeping the beat, a celesta carrying one short simple melody, soft warm pads and low strings under it. It starts on the first downbeat with no pickup and no lead-in, grows fuller with full strings through its last five bars and resolves on its last bar, instrumental, no vocals, no spoken words, clean ending |
| `music-spring` | 2 | A bright, cheerful and lively spring piece at exactly 100 beats per minute in 4/4, twelve bars long, in a major key: a flute high up carrying one short lilting, playful melody, a harp in quick flowing arpeggios, pizzicato strings bouncing on every beat, light and airy, fresh and sunny like a spring morning. It starts on the first downbeat with no pickup and no lead-in and holds one even feel, instrumental, no vocals, no spoken words, clean ending |
| `music-summer` | 2 | A warm, laid-back and unhurried piece at exactly 100 beats per minute in 4/4, twelve bars long, in a major key: a fingerpicked nylon string classical guitar in front carrying one short simple sunny melody with soft strummed chords, a mellow low marimba and a light shaker marking the beat, relaxed like a golden dusk at the end of a summer day. It starts on the first downbeat with no pickup and no lead-in and holds one even feel, instrumental, no vocals, no spoken words, clean ending |
| `music-fall` | 1 | A Halloween piece at exactly 100 beats per minute in 4/4, twelve bars long: a detuned music box and a piano carrying one short simple melody over low strings, with eerie sounds in the music itself, creaks, a far bell and wind across the strings. It starts on the first downbeat with no pickup and no lead-in and holds one even feel, instrumental, no vocals, no spoken words, clean ending |

- Winter: the kit's "soft choir pads" was changed to "soft warm pads" before the first take, because a piece is kept only if no voice is heard. No voice was heard in any of the nine music takes.
- Every piece came at 100 beats a minute (99.995 to 100.008) with its first bar line within 0.02 s of the start. "exactly 100 beats per minute in 4/4" and "starts on the first downbeat with no pickup" hold.
- The first takes of spring and summer were both heard as gentle and wintry. What turned them: the lead instrument named first and placed ("a flute high up", "a guitar in front"), the key, and mood words of the season.

### `one-piece`: one composition from a plan of timed sections (open)

The body is `{ "composition_plan": <the plan>, "respect_sections_durations": true }`; the plan is `audio/plans/one-piece.json`, whose `note` records its four versions. All three takes came back as one festive arrangement; see the table and the advice above.

### How a piece of music is judged

1. The numbers when it is filed: its length, its loudness, silence in front (a track must start at once).
2. The map of the take: `npm run audiomap -- --file out/work/audio/takes/<piece>/take-<n>.wav --name <piece>-take-<n>`: tempo, bars, first bar line, sections by level. For `one-piece`, each boundary must lie within one bar, 2.4 s, of 12, 24, 36 and 48 s. For a track, the tempo near 100 and the first bar line near 0.
3. The listener on the copy from `node audio/run/listen.mjs <piece>`: the open questions, then the fit call with the line of `audio/lines.json`.
4. **The blind mood choice**, added in this phase because the fit call agrees easily and the question "which season" is answered "winter" for almost anything (it said winter for the Halloween piece): "Choose the ONE phrase that fits the mood best: (a) festive and grand; (b) light and airy; (c) warm and unhurried; (d) dark and eerie; (e) sad and heavy". Asked twice, without the line. A season track is kept only when the choice is its own mood.
5. Kept when the listener hears no voice or words, the right mood, and the map fits. Then `npm run audiomap -- --file audio/kept/<piece>.wav --name <piece>`: the mix and the pack read the map named after the piece.

**A fault in the maps of the kept files, not mended by this agent.** `npm run audiomap` on `audio/kept/music-spring.wav` and `audio/kept/music-summer.wav` put the first bar line at 0.3065 s (confidence 0.14) and 0.3102 s, half a beat late, while the same takes before keeping mapped at 0.0053 s and 0.0123 s. Winter and fall map at 0.0134 and 0.0033 s. `/root` measured the true beats at 0.005 s (spring) and 0.012 s (summer) and mends the tool (decision 116). Until those two maps are made again, the mix places spring and summer half a beat off, and the pack cuts their loops on those lines.

## Ways of listening that this phase added

- **Very short sounds.** A sound of 0.1 to 0.3 s alone in silence is not heard: the listener answers that no file came. The listening copy for `key-tap` and `ui-send` plays the cut sound four times, half a second apart, 12 dB louder, and both questions say so. For a sound of about 1 s (`riser`) a copy with the sound three times was used.
- **Sub-heavy sounds.** A sound with most of its energy under 60 Hz is answered with "no file" or invented things. Judge it by its numbers and say so.
- About one listener call in four returns nothing or "no file"; it is asked again once. A voice in a sound effect counts only if a second call hears it.
- The fit call agrees easily with the line it is shown. The open answers decide.

## The family checks

Each kept effect after the second was put in one file with `glass-clink` and `lift`, one second apart, and the two family questions were asked (`node audio/run/family.mjs`). Six checks: `shake-spring`, `amb-spring`, `amb-summer`, `music-box`, `ui-send`, `riser`. **All six answered "no, they do not belong together".** What stood apart: in three of them `glass-clink`, called a synthesized, electronic chime or beep beside recordings of physical things; in two the ambience, as a long outdoor recording beside short effects, which is what an ambience is; in one `music-box`, as dry and mechanical beside liquid. The answers are in `audio/prompts.json` under `familyChecks`. No kept take was dropped for it: the question compares unlike classes, and the one sound it names again and again is `glass-clink` from Phase 2. A review round should hear `glass-clink` first: it plays at every landing. No family check was run for the music (the check is built for effects).

## What the app and the films do while cues are missing

- The mix lays what is kept and names the rest: in `four-tracks` the shakes of summer, fall and winter and every landing's season part are silent; each landing plays `glass-clink` alone; there is no ambience in fall and winter.
- The app plays a sound only if `public/audio/index.json` names it. The pack holds a sprite of 8 short sounds, the loops of `amb-spring` and `amb-summer`, and four music loops. This was read from the pack, not heard in a browser by this agent.
- For film A's prompt opening `ui-send` and `riser` now exist and `key-tap` does not: the typing is silent. Film A was not mixed by this agent.

## Commands run in Phase 5 and what they printed

- 31 effect calls and 9 music calls through `out/work/bin/take.sh` (guard begin, `node audio/run/take.mjs <cue>` or `node audio/run/music.mjs <piece>`, guard end): all HTTP 200. The numbers each printed are in `audio/RECORDS.json`.
- `npm run audiomap` on each music take and each kept piece: tempo 99.995 to 100.008, see the cue table and the fault above.
- `npm run mix -- --candidate four-tracks`, 18:24 UTC: "audio/mix/four-tracks.wav · film B, 60 s"; placed 13 cues and ambience beds, music four tracks; skipped, no kept file: `land-spring`, `shake-summer`, `land-summer`, `shake-fall`, `land-fall`, `shake-winter`, `land-winter`, `amb-winter`, `amb-fall`; 2.442 dB of gain, the limiter took off at most 3.08 dB, 3 passes; -14 LUFS, true peak -1.1 dB, range 5.1 LU; sha256 `3cbe969d95dc…fe3d`. Made with the maps described above, so it must be made again after the maps of spring and summer are mended.
- The listener on that mix (free): music alone changes at 15, 30, 41 and 51 s; in the full mix at 15, 30 and 45 s; a festive music box, playful plucked strings, a calm guitar, a dark piano with low strings, the music box again; no voice; every change "an abrupt cut"; effects heard: winding at 0 to 4 s and 56 to 60 s, water at 15 to 30 s, wind at 30 to 45 s. The times it names are loose (the cuts are at 12, 24, 36 and 48 s by the cut list).
- `npm run mix -- --candidate one-piece`: not run, the candidate has no music.
- `npm run sound -- --pack`, 18:25 UTC: 7 files at 192 kbps, 2.88 MB, under 8 MB; sprite of 8 sounds (`lift`, `shake-spring`, `glass-clink`, `music-box`, `ui-tick`, `ui-sound-on`, `ui-send`, `riser`); loops: `amb-spring` 18.9 s, seam -9.8 dB of the signal; `amb-summer` 18.9 s, -26.89 dB; `music-fall` 19.6006 s, -22.36 dB; `music-spring` 19.6008 s, -36.34 dB; `music-summer` 19.5996 s, -33.9 dB; `music-winter` 19.5962 s, -17.82 dB. The seams of `amb-spring` and `music-winter` are the weakest: hear them at the review.
- `npm run sound -- --sheet`: 14 sounds, 1200 x 810.
- `npm run soundcheck`, 18:25 UTC: 4 pass, 0 open, 4 not run. A1 to A4 not run: "dist/ does not match the source. Run npm run build." (the app was not built in the sound clone). A5 pass: all 14 kept sounds have take, prompt, measurements, answers and a row. A6 pass: `four-tracks.wav` -14 LUFS, peak -1.1 dB. A7 pass: 1 mix made twice more, each byte equal to the file. A8 pass: 57 takes over 25 cues, at most 3 for one cue in one round, limit 3.
- A harness matter, not mended: `audio/lines.json` holds no line for the three winter cues (their lines are on their takes in `audio/RECORDS.json`), so the listening helper was given the line by hand for the winter layers.

## Where things are

- Committed: `audio/prompts.json` (texts, takes, costs, verdicts, the listener's words, `learned`, `familyChecks`, `layers`), `audio/RECORDS.json`, `audio/plans/one-piece.json`, `audio/kept/<id>.json` and `<id>.wav.json`, `audio/mix/four-tracks.json`, this file.
- Not committed (the repo is public): the kept sounds `audio/kept/*.wav`, the takes `out/work/audio/takes/`, the listening copies `out/work/audio/listen/`, the layers `out/work/audio/layers-tried/`, the maps `out/work/audio/maps/`, the mix `audio/mix/four-tracks.wav`, the pack `public/audio/`. They are in the sound clone `/home/user/workspace/sg-sound`; the kept sounds and the packs were copied to the main workspace after each batch.
