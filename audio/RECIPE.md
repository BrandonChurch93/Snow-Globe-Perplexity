# The sound of the Snow Globe: the log of every cue, and how to make what is not made

Written by the sound agent of Phase 5 on 2026-11-25 (UTC), on the branch `agent/p5-sound-takes`. It replaces the Phase 4 text, which described a build with no credits.

## Where it stands

**After decisions 141, 142 and 144 of `/root` (2026-11-26, 06:58 to 07:44 UTC): the same 16 sounds are kept and the same eight effect cues are open, but four of the eight no longer leave a silence. A sound that is not a kept take is laid for `key-tap` (the typing of film A's opening) and for `shake-summer`, `shake-fall` and `shake-winter` (the kept water of `shake-spring`).** Nothing was bought: 7,200 spent, 2,800 left. The season part of the four landings is still silent and the one-piece music is still open. See "Decisions 141, 142 and 144: sounds laid without being kept". The paragraphs that follow are older states, the newer first.

**After the round `after-review` of Phase 6 (2026-11-26): 16 sounds are kept. `amb-fall` and `amb-winter` are kept as laid sounds. Eight effect cues (`shake-winter`, `shake-summer`, `shake-fall`, `land-winter`, `land-spring`, `land-summer`, `land-fall`, `key-tap`) and the one-piece music are open.** The round cost 435 credits in 12 calls; the guard's sum after it is 7,200 spent of Brandon's 10,000 and 2,800 left; no music was bought. What each take and each laid sound gave is under "Phase 6: the round `after-review`". The lines that follow here are the state at the end of Phase 5.

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

The table is the state at the end of Phase 5. Since then `amb-fall` and `amb-winter` are kept as laid sounds (the round `after-review`), and `key-tap`, `shake-summer`, `shake-fall` and `shake-winter` are still open but have a sound laid by decision 141, which is not a take and not kept.

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
- `key-tap` after Phase 6: buy nothing first. Let a person hear `out/work/audio/listen/set21-opening-20s.wav`: to the listener it is typing, on a hard clicking keyboard, played quietly, and not "soft". If a softer key is wanted, the three takes of this round do not hold one (the presses of take 9, asked for as soft typing, are a metronome or a winding gear in turn): that needs one new take of a few seconds of slow typing on a soft thing that is still a key, and its presses in turn. A fade in over the click, a lower cut and a slower attack were tried on these presses and did not make them soft to the listener (`r38.json`): do not try those again. If it is right as it is, give the cue a set of presses: the ten presses of take 21 named under "Open, and the closest each came", kept as the cue's sounds, and `mixFilm` laying press 3k mod 10 for the k-th tap with its time and level lists and without the pitch list.
- `key-tap` and the shakes of summer, fall and winter after decisions 141 and 142: buy nothing first. Let a person hear the listening copies named under "Listening copies for a person". If the laid typing and the one water in all four shakes are right for the film, the cues can stay as they are, open in the records. If a season's own material is wanted in its shake, the advice of the first line of this list still stands, and the laid water is the bed it asks for.
- `music-one-piece`: three composition plans with five sections of 12 s each gave one arrangement in one mood, with only strings coming and going. The plan's local styles do not turn this model inside 60 s. Do not buy a fourth plan of the same kind (825). If one piece is still wanted, the nearest thing at no cost is the `four-tracks` mix with its cuts smoothed, since the four kept tracks share 100 beats a minute and a grid; or one take with sections of 24 s or more, outside this film's grid.
- The `four-tracks` mix: the listener hears "abrupt cuts that instantly jump from one track to another" at each change. The first thing a review should hear is whether those cuts on the bar line work under the shakes, or want a short crossfade.

## Phase 6: the round `after-review` (decision 134)

Written by the sound finisher of Phase 6 from 05:15 UTC, 2026-11-26. The plan below was written before the first paid take of the round; what each take and each laid sound gave is written under it as it came.

The rule of the round: one thing a call, in plain words. The parts are laid together by `npm run sound -- --lay audio/layers/<cue>.json`: a recipe of fixed numbers, the same bytes every time, no call, not a take. A laid sound is filed as the next number among its cue's takes (`layer: true`, not counted in the round), heard with the same questions as a take, and kept only if its numbers fit the cue's length and the listener's open answers fit the line. A made layer (shaped noise or one tone) lies at least 12 dB under the main layer; the tool refuses less. The first layer of a recipe is the main one and is never a made one.

A call of this round: `node out/work/bin/soundguard.mjs begin <cue> sfx <seconds>`, then `ELEVENLABS_HANDLE=... node audio/run/take.mjs <cue> after-review`, then `node out/work/bin/soundguard.mjs end <cost header> "<note>"`. A cue's entry in `audio/prompts.json` may carry its own `tail` in place of the family line: a dry part (seeds, leaves, a thud) is asked for without the words glass and water, which the family line holds.

### The plan, written before buying

| cue | the part a paid take is to give | what is laid with it |
|---|---|---|
| `shake-winter` | none at first: the free layer is tried before any call | the liquid of the kept `shake-spring` at +40 cents; the cue's own take 3, the small sleigh bells; a made hiss of noise, 5 to 11 kHz, as the snow |
| `shake-summer` | the dry seeds alone: a paper packet of small dry seeds shaken six times, 2.6 s | the liquid of the kept `shake-spring` at -50 cents, under the seeds; if the line's warm shimmer is missed, a second part is asked for alone |
| `shake-fall` | the dry leaves alone: dry autumn leaves crumpled and rustled in a hand, 2.6 s | the liquid of the kept `shake-spring` at -110 cents; the cue's own take 3, the hollow dry rattle, set back |
| `land-winter` | (1) the set-down alone, for all four landings: one heavy thing set down on stone, one short heavy thud, 1.5 s. (2) the ice alone: ice crackling as frost spreads, 2 s | the set-down, then the ice from 0.12 s |
| `land-spring` | one drop of water alone, 1 s; then, if the breath is missed, one short soft gust of air alone, 1 s | the set-down of `land-winter`'s new take at -30 cents, then the drop, then the air |
| `land-summer` | none at first | the same set-down at -60 cents; the kept `ui-sound-on`, a small soft chime, lower by 500 cents as the warm chime; the cue's own take 1 or 2 as the hiss of sand |
| `land-fall` | none at first | the same set-down at -120 cents; the creak out of the cue's own take 3 (its first 1.2 s, before the latch); one made low tone that wavers, 12 dB under |
| `key-tap` | one key of a laptop pressed once, small, soft and padded, 0.5 s | nothing: the chain cuts it to 0.1 s |
| `amb-winter` | the wind alone: wind across open snow, one even bed from the first moment to the last, 20 s | the bells of the cue's own take 3, low-passed and far behind the wind |
| `amb-fall` | none at first | the cue's own take 2 (wind) and take 1 (leaves), with one made low tone that wavers slowly, 12 dB under |

The four shakes differ by a fixed pitch offset of the shared liquid (spring 0, winter +40, summer -50, fall -110 cents) and by their season's part; the four landings by a fixed offset of the shared set-down (winter 0, spring -30, summer -60, fall -120 cents) and by their tails.

### What came, in the order it was made

Changes to the plan, each written before its call unless it says otherwise:

- `key-tap`, first take of the round (05:22 UTC): one key was not asked for a fourth time, since the three takes of the earlier round asked for one key and each gave a hard click or a thud. Asked instead: soft typing on a laptop keyboard, 1 s, of which the chain cuts the first press. This change was written into `audio/prompts.json` before the call and into this file after it, at 05:27.
- `key-tap`, second take of the round (written 05:27): plain typing on a computer keyboard, 1 s, without the words soft, gentle or padded. The first take's presses hold 95 percent of their energy between 60 and 250 Hz, which a phone does not play. One press is cut out of the take by a recipe, a layer of one with `from` and `to`, where the chain alone would take the first.
- `shake-winter` (written 05:27): the snow alone, fine dry snow hissing as it is blown across ice, 2.6 s. It takes the place of the made hiss in number 10, which the listener did not hear; the liquid of the kept `shake-spring` at +40 cents and the bells of the cue's own take 3 stay.
- `land-winter`, third take of the round (written 05:27): the ice once more, as single cracks: thick ice on a frozen pond cracking, a few sharp separate cracks, 2 s. It is laid after the set-down of takes 3 and 2.
- `amb-winter`: as the plan says.
- `key-tap`, third take of the round (written 05:48): typing on a thin laptop keyboard, light quiet taps of flat keys, 1 s. The presses of the second take are heard as a key of a keyboard but as sharp, not soft, in 7 answers of 11; flat keys are asked for in place of the words soft, gentle and padded, which gave thuds. One press is cut out by a recipe, as before.

#### The paid takes: 12 calls, 435 credits

The guard's sum after the last call: 7,200 of Brandon's 10,000 spent, 2,800 left. The numbers are the take's own, before the chain. The words are the listener's open answer to the take alone. Every reply of the round is kept word for word in `audio/evidence/after-review/r1.json` to `r38.json` (a key is a short name of the cue, the number of the take or the laid sound, then `open` or `fit`), and the first replies stand with their take in `audio/RECORDS.json`. The replies are stored as they came, with the listener's own punctuation.

| UTC | cue, take | credits | asked for, alone | numbers | heard as | what became of it |
|---|---|---|---|---|---|---|
| 05:08 | `shake-summer` 4 | 29 | a paper packet of small dry seeds shaken six times | 2.56 s, -28.2 LUFS | "small, hard objects like dice or beads being shaken together in a container" | laid over the liquid in numbers 5 to 12 |
| 05:09 | `shake-fall` 4 | 29 | dry autumn leaves crumpled and rustled in a hand | 2.56 s, -34.3 LUFS | "small hard objects like dice or plastic pieces being poured or shaken" | no leaves: not used |
| 05:12 | `shake-fall` 7 | 29 | a pile of dry leaves swept back and forth | 2.56 s, -28.5 LUFS | "dead leaves being stepped on or crumpled" | laid with the liquid in numbers 8 to 11 |
| 05:15 | `land-winter` 4 | 11 | a heavy stone mortar set down on marble, one thud | 1 s, -26.6 LUFS | "a deck of cards being quickly riffled or shuffled" | no set-down: not used |
| 05:18 | `land-winter` 5 | 22 | ice crackling as frost spreads across a pane | 2 s, -26.7 LUFS | "stiff plastic packaging, cellophane, or thin paper being crumpled" | laid after the set-down in numbers 6 and 8 to 10 |
| 05:20 | `land-spring` 4 | 11 | one drop of water into a still pool | 1 s, -32.3 LUFS | "liquid being poured into a container, accompanied by the clinking of ice or glass" | no single drop: not used |
| 05:22 | `key-tap` 9 | 11 | soft typing on a laptop keyboard | 1 s, -25.2 LUFS, 62 percent between 60 and 250 Hz | whole: thuds; its first press: "a short, sharp click ... an electronic metronome tick, a computer mouse click" | not used |
| 05:28 | `key-tap` 10 | 11 | typing on a computer keyboard | 1 s, -33.2 LUFS, centre 1755 Hz | "the rapid, percussive clicking and clacking of someone typing on a computer keyboard" | single presses cut out as numbers 11 to 20 |
| 05:30 | `land-winter` 13 | 22 | thick ice on a pond, a few sharp separate cracks | 2 s, -27.1 LUFS | "a plastic zip tie being pulled tight or a small geared mechanism turning quickly" | no ice: not used |
| 05:32 | `amb-winter` 4 | 220 | cold wind across an open snowfield, one even bed | 20 s, -12.8 LUFS, centre 1069 Hz, 80 percent between 900 and 1300 Hz, -14 to -37 dB from second to second | "the continuous, whistling howl of a strong wind ... a harsh, gusty winter storm" | laid with the bells in numbers 5 to 9; it is not in the kept sound |
| 05:40 | `shake-winter` 12 | 29 | fine dry snow blowing across ice, an airy hiss | 2.56 s, -10.2 LUFS, centre 8022 Hz | not asked alone: judged by its numbers, then in the laid sounds | laid as the snow in numbers 13 to 18 |
| 05:48 | `key-tap` 21 | 11 | typing on a thin laptop keyboard, light taps of flat keys | 1 s, -24.7 LUFS, 12 presses in 0.86 s | whole, 12 dB louder, asked once: "a rubber squeaky toy being squeezed" | single presses under 2.5 kHz cut out as numbers 22 to 24 |

Takes left in the round: `shake-winter` 2, `shake-summer` 2, `shake-fall` 1, `land-winter` 0, `land-spring` 2, `land-summer` 3, `land-fall` 3, `key-tap` 0, `amb-winter` 2, `amb-fall` 3. They were not bought: for no open cue was there a next text that the answers above made likely to work, and what is left of the credits stays Brandon's.

#### Kept: two laid sounds

- **`amb-fall`, number 6** (`audio/layers/amb-fall.json`): the cue's own take 2, the wind, with a low cut at 70 Hz; its own take 1, the leaves, 5 dB under; one made tone at 220 Hz that wavers, 12 dB under. No call. Open: "the continuous rustling and crackling of dry leaves blowing in the wind". Fit: "Yes ... wind rustling through dry leaves, accompanied by a faint, low-pitched drone". Numbers 4 and 5 are earlier forms of the same recipe, with the tone at 185 Hz (4 without the low cut); the listener was asked about number 6.
- **`amb-winter`, number 12** (`audio/layers/amb-winter-h.json`): the wind is the even bed that also lies in the kept `amb-fall` (that cue's take 2, from 0.3 to 19 s), 250 cents lower, between 100 Hz and 1.5 kHz; over it the bells of this cue's own take 3 (6.5 to 11 s and 11.5 to 16 s, placed at 2 s and at 12 s), only their band from 1.5 to 2.5 kHz, 26 dB under the wind, each with three quieter copies 70, 160 and 290 ms later, as a far place gives them. No call. Open: "a continuous howling wind, resembling a harsh winter storm or blizzard ... intermittent, bright metallic sounds of jingle bells"; asked again: "a continuous howling wind accompanied by the intermittent jingling of sleigh bells". Fit, asked three times, yes each time: "the audio consists entirely of a soft, continuous wind and the repeating sound of distant bells"; the third adds that the bells "sound relatively close". Family with `amb-spring` and `amb-summer`: "No ... completely different outdoor environments", the third stands apart for its bells. The line begins with wind, as the line of `amb-fall` does: that is why another cue's take lies here (decision 134: a layer may be a kept take of another cue when the line names the same thing). Take 2 of `amb-fall` is not kept by itself, it is the main layer of the kept `amb-fall`; that this counts is the sound finisher's reading of decision 134, and it is `/root`'s to confirm or to turn down. The wind that was bought for this cue (take 4) is too loud and too uneven for a quiet bed: numbers 5 to 9 with it were answered "the wind is loud and howling" and bells that are close; numbers 10 and 11 (the bells 16 dB under) and 13 (32 dB under) were answered no.

#### Open, and the closest each came

- **`key-tap`**, all three takes of the round spent. The closest is **number 23** (`audio/layers/key-tap-s.json`): one press of take 21, 0.490 to 0.585 s, without what lies over 2.5 kHz. Alone, open, asked 7 times: a short dry click or tap of hard plastic or of a small switch 5, "electronic chime or beep" 1, "synthetic popping sound" 1. Alone, fit to "A soft key press": yes 5 of 6 ("a brief, quiet, and slightly muffled clicking sound typical of a gently pressed computer key"); the one no heard "a sharp, metallic chime or bell". As the 84 taps of film A's opening, through `mixFilm` itself: in the cut list's even steps "a spinning prize wheel or a playing card flapping against bicycle spokes" (3 of 3; the same with the two other presses tried, numbers 15 and 22); with the fixed time and level lists that `mixFilm` now holds, at the level of one press alone, "typing on a computer keyboard" (3 of 3), but fit to the film's own words "Soft key presses" no twice ("loud, sharp, and clicky"), and one of two answers about the first 20 s of film A calls the typing "incredibly fast, abrasive, and jarring" before the music box; 9 dB lower the fit is yes 4 of 5 ("light, rapid tapping sounds typical of typing on a quiet computer keyboard") and the open answers are "an old film projector, a fast ratchet, or a spinning prize wheel" (3 of 3; one of them names rapid typing as a third thing). It is typing where it is loud and soft where it is a ratchet. Not sure, so not kept, and film A's typing stays silent. Number 15 (`audio/layers/key-tap-e.json`, the first press of take 10) is the sharper sister: fit yes 4 of 11. A person should hear number 23 before anything more is bought; the command that keeps it is `npm run sound -- --cue key-tap --keep --take 23 --why "..."`. What was tried last, at no cost and outside the tool (`out/work/audio/p6/typing-set.py 21 -37 21`, replies in `audio/evidence/after-review/r33.json` to `r38.json`): ten presses of take 21 laid in turn on film A's 84 taps (press 3k mod 10 for tap k; the ten are those a level search finds, with onsets at 0.090, 0.170, 0.240, 0.310, 0.415, 0.505, 0.590, 0.650, 0.765 and 0.855 s; each from 8 ms before its onset to 8 ms before the next, at most 95 ms; under 2.5 kHz; 2 ms in, 30 ms out; all levelled to the press at 0.505 s; the time and level lists of `mixFilm`, no pitch list; the run at -37.0 dB RMS, as `mixFilm` lays number 23). Open, asked 6 times: "someone typing on a computer keyboard" 6 of 6. Beside it in the same calls, one press at nine pitches at the same level: typing 1 of 3 ("a Geiger counter", "mechanical clicking or ticking"). The first 20 s of film A with it, asked twice: both heard typing on a keyboard, then a mouse click, and nothing unpleasant or too loud ("someone types on a keyboard and makes a final mouse click"); one found the change from the typing to the music box "slightly out of place because the two sounds are unrelated". Fit to "Soft key presses": yes 3 of 6; each no says "loud" and "sharp" and clacky or clicky, of a run whose peaks lie at -20 dBFS. With each press under 1.4 kHz it is a ratchet again (0 of 3 typing). Three more versions, asked in one batch (`r36.json`): the run 6 dB lower, at -43.0 dB RMS with its peak at -26.0 dBFS: typing 3 of 3, fit to soft 0 of 3; each press under 2.0 kHz: typing 2 of 2, fit 0 of 3; each press at the level it has in the take, where five of the ten lie 12 to 17 dB under the other five (the run at -42.0 dB RMS, peak -20.1 dBFS): typing 2 of 2, fit 1 of 3 ("relatively gentle, muffled tapping noises"). Every no, 11 of 11, calls the run "loud", at whichever level it lies: the listener judges the kind of key, not the level. The presses of the two other takes of the round in turn, each run at -37.0 dB RMS (`r37.json`): the 7 of take 9, the take asked for as soft typing: typing 1 of 3 ("a fast stopwatch or a winding gear", "a quick metronome or a small winding mechanism"), fit to soft 0 of 3; the 5 of take 10: typing 2 of 2, fit 1 of 3. So the way to film A's typing is the presses of take 21 in turn: in its four versions that keep what lies under 2 kHz they are typing in 13 of 13 open answers. They are not soft: 4 of 15 fit answers, and no take of the round holds a softer key. What they give is the typing of a hard, clicking keyboard, played quietly. That is not the film's line, so nothing is kept; whether it is right for film A all the same is a person's call. None of those versions had a softened attack: each press began 8 ms before its onset and its 2 ms of fade in lay before the click, so the click kept its edge; all had a low-pass (2.5 kHz, once 2.0 kHz, once 1.4 kHz), one was only quieter, one differed only in keeping the take's own levels. The last job of `/root` (06:50) asked for the soft set: the ten presses in turn, each band limited, with a fade in over the click, a short tail, the pitch list `VARIED` as well as the two lists of `HAND`, the run at -37.0 dB RMS, one setting and at most two more (`out/work/audio/p6/typing-soft.py`, replies in `r38.json`; the rule was written into that file before the answers came: every open answer typing, fit to soft yes at least 5 of 6). Setting A: under 2.5 kHz, begun 2 ms before the onset and faded in over 8 ms, at most 80 ms long, 40 ms of fade out: typing 3 of 3, fit to soft 0 of 3. Setting B, the lower cut, 1.8 kHz: typing 1 of 2 ("a stick being dragged across a washboard or a wooden ratchet spinning"), fit 0 of 3. Setting C, the softer attack, 16 ms of fade in: typing 1 of 2 ("a deck of cards being riffle-shuffled"), fit 1 of 3. All three fail, so `key-tap` stays open and the tool was not changed. Over every version of this take's presses the listener's no comes in the same words, "loud", "sharp" and clacky or clicky, whatever the cut, the attack and the level: at 14 presses a second it may be the speed that it calls hard. Only a person can settle that. In the mix as it would play, the run lies at -37.0 dB RMS with its peaks at -19.5 dBFS; `ui-send` after it peaks at -8.1 dBFS (-34.7 dB RMS over its 0.3 s) and the `riser` at -7.4 dBFS (-21.7 dB RMS over its 1.2 s). It is not in the tool: the harness keeps one file a cue and caps it at the cue's 0.1 s, so `mixFilm` has no set of presses to lay. The listening copies are `out/work/audio/listen/set21-typing.wav`, `set21-typing-send.wav` and `set21-opening-20s.wav`; beside them `filmA-typing-final.wav` is number 23 alone as `mixFilm` lays it. The other versions are there as their first 7.5 s: `set21q-typing.wav` (6 dB lower), `set21m-typing.wav` (under 2.0 kHz), `set21n-typing.wav` (the take's own levels), `set9-typing.wav`, `set10-typing.wav`; of the last job `softA-typing.wav`, `softA-opening-20s.wav`, `softB-typing.wav`, `softC-typing.wav`.
- **`shake-winter`**: the closest is number 16 (`audio/layers/shake-winter-m.json`): the liquid of the kept `shake-spring` at +40 cents, the bells of the cue's own take 3, and the bought hiss 10 dB under. Open: "a quick splash of liquid followed by a bright, metallic jingling sound". Fit: "you can clearly hear liquid sloshing and tiny bells ringing, there is no audible 'hiss of snow'". With the hiss 8, 6, 3 or 0 dB under it is heard as a carbonated drink over ice, a spray can, or a match being struck. Number 10 (`shake-winter-b.json`) is the same without the bought hiss.
- **`shake-summer`** and **`shake-fall`**: the dry part under the liquid is not heard (numbers 5 and 10 of summer; 6, 8 and 10 of fall: liquid only), over the liquid it is heard alone (summer 7 and 12: dice or beads; summer 11: a prize wheel or a wooden ratchet; fall 11: stones spilling), and between the two as ice in a glass (summer 8), a spray can (summer 9) or a gas stove being lit (fall 9). Numbers 6 of `shake-summer` and 5 of `shake-fall` are void: they were cut off at full scale by the laying tool before it was mended, and were not heard.
- **`land-winter`**: the set-down alone exists: number 7 (`audio/layers/land-winter-s.json`, the cue's own old takes 3 and 2) is heard as "a glass or ceramic object striking a hard surface", the first half of the line, and the fit call said yes to it. No ice was heard as ice. With the crackle of take 5 after it: "a match being struck" (number 8, 10 dB under), "a carbonated liquid being poured into a glass, likely over ice" (number 9, only over 3 kHz); numbers 6 and 10 to 12 no better. The fit call said yes to numbers 8 and 9; the open answers decide.
- **`land-summer`**: numbers 5 and 6, the set-down with the cue's own hiss and the lowered `ui-sound-on`: "a gas lighter or blowtorch being ignited", "a wooden tool rubbing against a hard, resonant surface like a bowl". No paid take was spent.
- **`land-fall`**: number 5: open "a brief mechanical sliding or whirring noise followed immediately by a clear bell ring", like a cash register or a lift's chime, while the fit call said "fits perfectly"; number 6: a creaking lid or door being latched, fit no. No paid take was spent.
- **`land-spring`**: the one bought drop was heard as liquid poured over ice. Nothing was laid.
- The set-down that the plan wanted to lay under all four landings exists as number 7 of `land-winter`. No season's tail was heard as what its line names, so no landing is kept and each landing still plays `glass-clink` alone.

#### What the round taught

- One thing a call still does not mean the thing comes: a set-down came as cards being riffled, leaves as dice, one drop as pouring, single ice cracks as a zip tie. Of 12 takes 3 were heard as the part they were asked for (the leaves of `shake-fall` 7, the typing of `key-tap` 10, and a wind, though not an even one, for `amb-winter` 4). Two more are that part by their numbers and were not named so by the listener (the hiss of `shake-winter` 12, which was not asked alone, and the typing of `key-tap` 21, heard whole as a squeaky toy).
- A dry part and a liquid laid together are heard as the louder of the two, or together as ice in a glass. The listener did not once name seeds, leaves or snow inside a liquid.
- A sound of 0.1 s is described differently from call to call (the same file: a click, a chime, a pop, silence). Each press was therefore asked several times and judged by the count, and at last by what film A's opening makes of it.
- One press repeated 14 times a second in even steps is heard as a ratchet whatever the press. `mixFilm` now moves each repeat of `key-tap` by a fixed few milliseconds (at most 20) and turns it down by a fixed little, and lays the run 9 dB under the level of one press alone. This does nothing while `key-tap` has no kept sound.
- Some replies to laid sounds that were dropped were "no file" answers that were not asked again, since the other reply had already ruled the sound out. No kept sound rests on such a reply.
- A bed that fits its line alone is not yet right under its music. The listener was given each season as the app plays it (the ambience loop and the music loop at the gains of `public/audio/index.json`, 30 s). At the gains the pack had (ambience 6 dB under the music by loudness; the film has it 14 dB under) it called the ambience too loud, competing or overpowering in 8 of 12 answers: winter 3 of 4 ("The loud wind feels out of place because its harsh, howling noise clashes with the gentle and soothing nature of the lullaby"), spring 1 of 2, summer 2 of 2 ("arguably too loud and distracting because it competes with and almost overpowers the quiet guitar music"), fall 2 of 4 ("The heavy rain is too loud and competes heavily with the music box"). With the ambience 4 dB lower: 2 of 7. With it 8 dB lower: 1 of 11 (a "scraping noise of the gears" in fall), and two more found something slightly out of place in winter ("background static ... like tape hiss", "a low, rhythmic thumping"); spring and summer were named and called well balanced 4 times of 4. So the pack now gives the ambience the music's trim of 8 dB (`APP_TRIM_DB` in `tools/lib/audio.mjs`; only the `gain` numbers of the four ambience loops in `index.json` change, the files stay the same bytes). To turn it back: `ambience: 0` in that table, then `npm run sound -- --pack`.
- What that listening also showed, and what is not mended: under their music the two new beds are not named as what they are. At the pack's old gains winter was "howling wind" (4 of 5) and fall "heavy rain" (3 of 4, once "a heartbeat heard through an ultrasound monitor"); 8 dB lower winter was not heard at all twice, static once, a low thumping once, and fall was rain or white noise, a hiss, a clicking of gears. `amb-spring` (rain) and `amb-summer` (crickets) were named as what they are at every level. A human should hear winter in the app first: it is the first thing a visitor hears.

## Decisions 141, 142 and 144: sounds laid without being kept

Written by the sound finisher of Phase 6 on 2026-11-26, 06:58 to 08:20 UTC. No call that makes sound was made and no credit was spent: the guard's sum at 07:55 UTC reads 7,200 spent, 2,800 left, 52 calls, none open. Nobody has heard any of this. Every judgement below is by measurement or by a listening agent (`evaluate_audio`), whose times are loose. The replies are `r39.json` to `r48.json` in `audio/evidence/after-review/`.

What a laid sound is. A kept take fits its cue's line; these four sounds do not, and are not kept. By decision 141 of `kit/PROGRESS.md` the nearest right sound plays where the cue would otherwise leave the film or the app silent. The cue stays open in `audio/prompts.json` and in the tables above, and the sound is named as laid wherever it is counted (the mix's record, the pack's printout, checks A5 and A8). A laid sound has a record `audio/laid/<cue>.json` (state `laid by decision 141`, `kept: false`, why, a recipe of fixed numbers, the measurements, the counts and the listener's words) and a file `audio/laid/<cue>.wav` beside it, which is not committed. `npm run sound -- --laid` builds every file again from its record, the same bytes each time; `npm run sound -- --laid <cue>` builds one. The mix and the pack look in `audio/kept/` first: when a cue gets a kept take, that take plays and the record in `audio/laid/` can be deleted.

### The typing of film A (`key-tap`, decisions 141 and 144)

- The sound: the ten presses of after-review take 21 (light taps on the flat keys of a thin laptop keyboard), each cut from 8 ms before its onset, without what lies over 2.5 kHz. They are laid in turn: tap k of the film takes press 3k mod 10. The list of pitches `VARIED` is left out: with it one listening of the first 20 s heard "a rapid mechanical clicking sound", without it "rapid keyboard typing and a mouse click".
- Where: one tap for each of the 84 `key-tap` cues of the cut list (frames 150 to 506 at 60 a second, 2.5 to 8.43 s of film A) and nowhere else. `mixFilm` counts them into the mix's record under `typing`: 84 taps for 84 keys, none without a key, no key without a tap. The two presses of the menu (frames 65 and 112) have no cue in the kit and stay silent by the word of `/root` (07:44 UTC).
- When: each tap is moved from the time of its own frame by the fixed time list `HAND` of `tools/lib/audio.mjs`, at most 20 ms either way. The typing was laid three ways on the cut of 07:29 UTC and each way was heard three times (`r43.json`): exactly on the frame, typing 2 of 3 and once "a rapid mechanical clicking noise" that "feels a bit jarring"; kept inside its own frame (0 to 15.67 ms late), typing 2 of 3 and once "a rapid mechanical clicking"; moved by the list as it is, keyboard typing 3 of 3 with nothing said against it. Decision 144: the list stays. `HAND_LIMIT_MS` is 20 and `mixFilm` throws if a tap would begin further than that from its key. On film A the largest offset is 20 ms: the earliest tap begins 20 ms before its key and the latest 20 ms after (1.2 frames at 60 a second); 38 taps begin before their key, 39 after it and 7 on it.
- Level: the run of typing lies at -37.0 dB RMS in the finished film (2.5 to 8.5 s; peak -20.0 dBFS), the level of the trial of `r33.json` and `r34.json`, which was heard as typing 6 of 6. `pressDb` in the record (-38.126) is the level of a press before the master, found by mixing film A and reading the run (`out/work/audio/p6/d141/tune.mjs`). Find it again if the cut's taps change or the master's gain moves by more than a few tenths of a dB.
- Why it is not kept: the cue's line is "A soft key press" and 3 of 6 listenings said the presses are not soft (firm, crisp or loud).
- Film A's opening by measurement, on `audio/mix/four-tracks-film-a.wav`: digital silence from 0 to 2.5 s; the typing to 8.5 s; silence; the kept `ui-send` at 9.3 s (frame 558), peak -8.0 dBFS; digital silence from 10.0 to 13.24 s; the kept `riser` from 13.25 to 14.45 s, peak -7.3 dBFS; the music from 14.45 s. From there film A is film B 14.45 s later: the two differ by -58.4 dB RMS, which is the difference of the master's gain (2.078 against 2.005 dB).
- Not followed up: in the nine listenings of `r43.json` the music box that follows the typing was called eerie, creepy, warped or distorted in three, and "much louder than the typing" in one. What plays there is the kept `riser`, the kept `music-box` and the winter music, none of which this job changed. For a human ear.

### The shakes of summer, fall and winter (decisions 141 and 142)

Every shake's line begins "Liquid sloshing and churning inside glass". The one kept shake, `shake-spring`, is that water alone. Its file is borrowed for the three shakes without a kept take (`recipe.borrow` in the record: the kept sound, turned by so many cents, its length changing with the pitch). The season's own material (snow and bells, seeds, leaves) is left out, so each line is half met.

The rules of decision 142, as `/root` gave them. (a) A borrowed shake is laid when liquid is heard in at least 3 of 4 listenings in its place, at the level it is laid at, and no listening calls it unpleasant. (b) Winter is tried at +20 cents, then at 0 cents, and stays silent if neither holds: "Two shakes that sound alike are no fault: one globe holds one water." (c) Every shake of the film, the kept one too, comes down 3 dB and rises over its first 30 ms; a shake still called too loud or abrupt against the music in 2 or more of 4 listenings comes down 3 dB more, once, and stays there. A listening is 4.8 s of film B's mix, from 1.2 s before the shake to 1.2 s after its bar, with the five questions of `r41.json`. The counting was fixed before the answers were read: liquid is heard when answers 1 to 3 name liquid or water; too loud or abrupt when answer 4 calls the effect too loud, overpowering, abrupt or jarring; unpleasant when the sound itself is called harsh, distorted or unpleasant.

| Shake (film B) | What plays | Liquid heard | Too loud or abrupt | In the film |
| --- | --- | --- | --- | --- |
| first, spring, 9.6 s | the kept `shake-spring` | 4 of 4 | 4 of 4 before; 1 of 4 at 3 dB down ("The loud mechanical noise", "jarring") | 3 dB down, 30 ms rise |
| second, summer, 21.6 s | laid: the water at -50 cents | 3 of 4 before; 4 of 4 at 3 dB down | 1 of 4 ("noticeably louder than the background music") | 3 dB down, 30 ms rise |
| third, fall, 33.6 s | laid: the water at 0 cents | 4 of 4 at 3 dB down; 4 of 4 at 6 dB down | 2 of 4 at 3 dB down; 2 of 4 at 6 dB down | 6 dB down, 30 ms rise |
| fourth, winter, 45.6 s | laid: the water at 0 cents | 3 of 4 (once "a fast, dry rattling noise", pills in a bottle) | 1 of 4 ("a bit too loud and isolated") | 3 dB down, 30 ms rise |

- Not laid: winter at +40 cents (liquid 2 of 4, twice a ratchet or the winding of a toy) and at +20 cents (liquid 1 of 4: a ratchet, a rattle of dice or pills, a film projector); fall at -110 cents (liquid 3 of 4 at the first level, 2 of 4 at 3 dB down, where two heard a dry rattle of pills or beads). By the word of `/root` at 07:44 UTC the rule of (a) counts at the level the sound is laid at, so fall was given winter's take and settings. The dropped records are in `out/work/audio/p6/d141/not-laid/`.
- So the first, third and fourth shakes are one sound, and the second is the same water half a semitone lower.
- Fall still draws remarks on its level at 6 dB down: "a bit too loud and close-miked compared to the quiet ambient background", "very loud compared to the music that follows". The rule says once, so it stays there. The music is thin in that bar. For a human ear.
- One listening of winter at 0 cents got no answer (an error of the call) and was asked again (`r42.json`). The count of 3 of 4 is of the four answers that came.
- The level and the rise are `SHAKE` in `tools/lib/audio.mjs` (`downDb: 3, riseMs: 30, moreDb: 3, more: ['shake-fall']`) and belong to the film's mix only. The app's pack plays the four shakes from its sprite at the gains of `public/audio/index.json` (about 1.24) while its music and ambience are trimmed 8 dB: the question of (c) was not asked of the app.
- By measurement in film B, each shake's bar of 2.4 s against the bar before it: spring -20.2 dB RMS against -15.6; summer -19.4 against -14.5; fall -20.3 against -17.5; winter -20.4 against -16.5. The peaks in those bars are -3.5, -2.9, -2.4 and -2.2 dBFS.

### The music loops of the app

The app plays a loop round by crossing its end over its start: one bar (2.4 s) for music and 1.5 s for ambience, at most a quarter of the loop (`APP_SEAM` and `appSeam` in `tools/lib/audio.mjs`). The pack gave the music 8 bars, wrapped onto themselves by a short cross inside the file, as for a player that loops without a gap. The app crosses one bar, so bar 1 came in over bar 8 and the music came round every 7 bars (16.8 s). `musicLoop` now gives bars 1 to 8 and, after them, the track's own next bar: bar 1 comes in under what follows bar 8, on the beat, and 8 bars are heard. Nothing is wrapped or crossed in the file itself. `heardLoop` and `heardSeam` give one round as the app plays it and its numbers, and the pack's printout names them.

- By measurement, read back from the packed files (`out/work/audio/p6/d141/heard.mjs`): `music-fall` is heard every 19.1999 s and the level through the cross is +0.57 dB against the round's mean; `music-spring` 19.2021 s, +0.17 dB; `music-summer` 19.1996 s, +1.5 dB; `music-winter` 19.2006 s, -1.22 dB. A quarter of the cross (0.6 s) departs most in summer (+3.21 dB) and in spring (-2.97 dB). The ambience loops are heard every 18.5, 17, 17 and 16.935 s (winter, spring, summer, fall), -0.22, -1.45, -1.07 and -0.94 dB through their cross.
- By a listening agent (`r46.json` to `r48.json`): each seam as 16 s of the loop played round, the cross from 7.0 to 9.4 s of the clip, two listenings a season, and a control of 16 s of the same loop with no seam in it. Asked what it hears and whether anything is unpleasant, unnatural or out of place, the listener named no skip, stutter, jump or doubling in any of the 8 listenings of a seam nor in the 4 controls. In spring both listenings name "a slight shift in the chord progression around 00:08" and "a noticeable shift in the chord progression around 0:08", which is where the cross lies; neither calls it a fault. One call gave no answer and was asked again.
- What that listening is not: the first prompt asked whether anything stumbles, skips or jumps, and the listener named a skip in all 12 clips, at 4 to 11 s, the four controls included. Those answers (`r46.json`) test nothing and are not counted. Two different bars of music sound together for 2.4 s in each cross: whether that is musical is for a human ear.
- The sprite now also holds the three laid shakes: 11 sounds. The pack is 9 files at 192 kbps, 4,378,752 bytes (4.18 MB) under the cap of 8 MB.

### Listening copies for a person

In `out/work/audio/listen/` (not committed), cut from the final files by `out/work/audio/p6/d141/listen-copies.mjs`: `now-filmA-opening-20s.wav`; `now-shake-1-spring-in-place.wav`, `now-shake-2-summer-in-place.wav`, `now-shake-3-fall-in-place.wav` and `now-shake-4-winter-in-place.wav` (4.8 s of film B each, the shake at 1.2 s); `now-loop-music-<season>-seam.wav` and `now-loop-amb-<season>-seam.wav` (16 s, the app's cross begins at 7 s).

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

`key-tap` is repeated in the film with a fixed list of small pitch offsets, in cents: 0, -45, 30, -20, 55, -65, 15, 40, -30. Since Phase 6 each repeat is also moved off its place by a fixed list of milliseconds (0, 14, -9, 18, -16, 6, -20, 11, -4, 20, -13, 8, -18), turned down by a fixed list of dB (0, 2.5, 1, 4, 0.5, 3, 1.5), and the whole run lies 9 dB under the level of one press alone (`HAND` in `tools/lib/audio.mjs`): in even steps the run was heard as a ratchet, at the level of one press as loud typing. The lists are fixed, so the film is the same bytes every time.

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
- Added in Phase 6, for `key-tap` (scratch tools under `out/work/audio/p6/`, not in the repo): the press four times half a second apart at its own level (`x4.mjs`); as typing in a hand's uneven steps of 0.10 to 0.36 s (`typing-hand.mjs`); and, the one that decides, the 84 taps of film A's opening at the cut list's own times through `mixFilm` (`filmA-opening.mjs`), heard alone and as the first 20 s of the film. Four even repeats are heard as a clock, so that copy says little about the press.

## The family checks

Each kept effect after the second was put in one file with `glass-clink` and `lift`, one second apart, and the two family questions were asked (`node audio/run/family.mjs`). Six checks: `shake-spring`, `amb-spring`, `amb-summer`, `music-box`, `ui-send`, `riser`. **All six answered "no, they do not belong together".** What stood apart: in three of them `glass-clink`, called a synthesized, electronic chime or beep beside recordings of physical things; in two the ambience, as a long outdoor recording beside short effects, which is what an ambience is; in one `music-box`, as dry and mechanical beside liquid. The answers are in `audio/prompts.json` under `familyChecks`. No kept take was dropped for it: the question compares unlike classes, and the one sound it names again and again is `glass-clink` from Phase 2. A review round should hear `glass-clink` first: it plays at every landing. No family check was run for the music (the check is built for effects).

## What the app and the films do while cues are missing

- The mix lays what is kept and names the rest: in `four-tracks` the shakes of summer, fall and winter and every landing's season part are silent; each landing plays `glass-clink` alone; there is no ambience in fall and winter.
- The app plays a sound only if `public/audio/index.json` names it. The pack holds a sprite of 8 short sounds, the loops of `amb-spring` and `amb-summer`, and four music loops. This was read from the pack, not heard in a browser by this agent.
- For film A's prompt opening `ui-send` and `riser` now exist and `key-tap` does not: the typing is silent. Film A was not mixed by this agent.
- After Phase 6: fall and winter have their ambience in the mix and in the pack (`amb-fall`, `amb-winter`). In the app every ambience now plays 8 dB lower than before against its music (see "What the round taught"). The shakes of summer, fall and winter and every landing's season part are still silent, and film A's typing is still silent.
- After decisions 141, 142 and 144: film A's typing sounds (84 taps, one for each key of the cut list), and all four shakes slosh in the films and in the app (the three without a kept take play the kept water of `shake-spring`). Still silent: the season part of every landing, which plays `glass-clink` alone, and the two presses of the menu in film A's opening. The app's music loops come round every 8 bars, on the beat. This was read from the mixes and the pack and heard by a listening agent, not in a browser and not by a person.

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

## Commands run in Phase 6 and what they printed

All on 2026-11-26 (UTC), in the one checkout on `main`, after the last kept sound. The numbers marked scratch come from `out/work/audio/p6/mixnum.py` and `loopnum.mjs`, which are not in the repo.

- `npm run sound -- --pack`, 06:10, again 06:17 (the same bytes twice, all 10 files), and 06:24 after the ambience trim (only `index.json` changed): "9 files at 192 kbps, 3.78 MB together, under audio.appMaxMb of 8 MB" (3,968,064 bytes). Sprite of 8 sounds (`lift`, `shake-spring`, `glass-clink`, `music-box`, `ui-tick`, `ui-sound-on`, `ui-send`, `riser`), unchanged. Loops, with what the tool prints of each seam ("the two sides of the seam differ by ... dB of the signal"): `amb-winter` 20.4 s written, -36.4 dB; `amb-spring` 18.9 s, -6.8 dB; `amb-summer` 18.9 s, -32.08 dB; `amb-fall` 18.835 s, -14.63 dB; `music-fall` 19.5995 s, -34.3 dB; `music-spring` 19.5996 s, -34.65 dB; `music-summer` 19.6001 s, -31.22 dB; `music-winter` 19.6034 s, -31.76 dB. New: `amb-winter.mp3` (490,752 bytes) and `amb-fall.mp3` (453,312 bytes). The seven files that were in the pack before are the same bytes as before. The player asks for `amb-<season>` already (`src/audio/index.ts`), so `index.json` needed no new name and no new field.
- The gains in `index.json` after the trim: `amb-winter` 0.06771, `amb-spring` 0.24507, `amb-summer` 0.0722, `amb-fall` 0.09405 (each 8 dB under what it was: 0.17008, 0.61558, 0.18136, 0.23625); the music loops as before (0.32308 to 0.48201).
- The seams of the eight packed loops, decoded (scratch): the last second against the first second, the last 50 ms against the first 50 ms, the jump at the seam over a typical step. `amb-winter` -0.08 dB, 0.57 dB, 0.13; `amb-spring` 0.06, 0.18, 1.02; `amb-summer` -0.04, 0.05, 0.04; `amb-fall` -0.79, -0.11, 0.82; `music-fall` -0.97, 0.36, 0.19; `music-spring` 1.93, -1.72, 0.30; `music-summer` -0.50, -2.69, 0.10; `music-winter` -1.92, -0.55, 0.33. All inside 3 dB; `music-summer` is the nearest to it.
- `npm run mix -- --candidate four-tracks`, 06:11 and 06:12, the same bytes twice (sha256 `574e5caf6490...c92a`): "film B, 60 s"; placed 16 cues and ambience beds (all four seasons now have their bed); skipped, no kept file: `land-spring`, `shake-summer`, `land-summer`, `shake-fall`, `land-fall`, `shake-winter`, `land-winter`; 1.961 dB of gain, the limiter took off at most 1.18 dB, 2 passes; -14 LUFS, true peak -1.1 dB, range 3.6 LU; as AAC at 256 kbit/s true peak -1.29 dB, "the encoder overshoots nowhere"; landings, first 50 ms: -12.38, -11.87, -12.38, -12.38 dB; left over right 0.05 dB.
- `npm run mix -- --candidate four-tracks --which a`, 06:12, the same bytes twice (sha256 `96a8da27df1f...c740`): "film A, 74.5 s, of which the opening is 14.5 s"; placed 18 cues and ambience beds; skipped as film B and `key-tap`; 2.001 dB of gain, the limiter at most 1.22 dB, 2 passes; -14 LUFS, true peak -1.1 dB, range 3.8 LU; as AAC true peak -1.3 dB, "the wav gives way in 1 place of 5 ms where the encoder overshoots (0.11 dB at 43.905 s)"; landings -12.35, -11.81, -12.35, -12.35 dB; left over right 0.06 dB.
- `npm run mix -- --candidate blockout`, 06:13 (the soundcheck asked for it, its inputs were newer): sha256 `79609a5eeacf...ef0e`, -14 LUFS, true peak -1.1 dB.
- The numbers of the review on film B's mix with the new beds (scratch): (a) exact zero at the end 0 samples, the last 0.2 s at -40.8 dB; (b) the last 0.2 s before the four landings -33.0, -39.3, -32.6, -30.0 dB (before the beds of fall and winter: -33.0, -39.2, -50.6, -41.1), no run of exact zero anywhere; (c) the first 50 ms of the landings -12.38, -11.87, -12.38, -12.38 dB, 0.51 dB apart; (d) the first second -17.5 dB against holds of -16.1 to -16.8 dB; (e) left minus right +0.05 dB over the film, the wav at -1.1 dBTP, its AAC copy at -1.3 dBTP, -14.0 LUFS. Film A: the same numbers 14.5 s later (landings 0.54 dB apart, left minus right +0.06 dB, AAC copy -1.3 dBTP); its opening is exact zero from 0 to 8.85 s and from 9.15 to 13.3 s, because `key-tap` has no kept sound.
- The listener on that film B mix (free, two calls, `audio/evidence/after-review/r28.json`): one heard "crickets chirping from 00:30 to 00:45, and howling wind from 00:45 to 01:00" and "nothing sounds unpleasant, too loud, or out of place"; the other heard "a running blender from 0:09 to 0:23" and called it "unpleasant and too loud", then crickets and "howling wind from 0:37 to 0:48". The blender lies where `shake-spring` and the spring section are, which this round did not change; the times the listener names are loose.
- Film A's first 20 s, 12 answers over the round (`r25`, `r26`, `r33`, `r35`). The two kept sounds that follow the typing, `ui-send` at 8.85 s and `riser` at 13.3 s (the times the listener names are loose), were called loud, jarring or harsh in 6 of the 12: "a loud buzzer or alarm" and "a loud alarm buzzer", where the other answers have the bell or ding of `ui-send`; "a loud, sudden screeching or metallic scraping noise" after the ding, where the riser lies; "a single sharp clack" that is "jarring"; "the sudden ding", "harsh and abrupt"; "the sudden click", "quite loud and jarring". With the ten presses in turn before it the send was "a final mouse click" and nothing was called unpleasant (2 of 2). Neither sound nor its level was changed in this round: they peak at -8.1 and -7.4 dBFS after nine seconds of silence. For a human ear.
- `npm run sound -- --sheet`, 06:13: "out/work/audio/sheet.jpg · 16 sounds, 1200 x 946".
- `npm run soundcheck`, 06:14: "3 pass, 1 open, 4 not run". A1 to A4 not run: "dist/ does not match the source. Run npm run build." A5 open: "2 of 16 kept sounds lack something: amb-winter (ASSETS.md row), amb-fall (ASSETS.md row)" (the rows are `/root`'s to add, the file is not the sound finisher's). A6 pass: "blockout.wav -14 LUFS, peak -1.1 dB, four-tracks-film-a.wav -14 LUFS, peak -1.1 dB, four-tracks.wav -14 LUFS, peak -1.1 dB". A7 pass: "3 mixes made twice more, each byte equal to the file". A8 pass: "69 takes over 25 cues, at most 3 for one cue in one round, limit 3; 71 layers laid from them, not counted". A third run at 06:29 found the app built (by `/root`, at 06:16) and so began A1 to A4, which start a headless browser; the sound finisher may start none, so that run was stopped after under three minutes, without a result. Then `npm run soundcheck -- --only A5,A6,A7,A8`, 06:32, after the last change to the tool: "3 pass, 1 open, 0 not run", the four lines word for word as at 06:14. A1 to A4 are `/root`'s to run, after `npm run build`: the build of 06:16 holds the pack as it was before the ambience trim.
- The two rows A5 asks for, for `/root` to add to the table under "Generated sounds" in `ASSETS.md` (the file is not the sound finisher's). The takes the layers come from are ElevenLabs sound effects, as in the other rows; the fourth column is the cue's number of bought takes:

```
| `amb-fall` | `audio/kept/amb-fall.wav` | Laid by the harness (decisions 111 and 134) from two ElevenLabs sound effect takes of this cue (takes 2 and 1; POST /v1/sound-generation, the default model, PCM at 48 kHz) and one made tone of 220 Hz; no call of its own | 3 | 2026-11-26 |
| `amb-winter` | `audio/kept/amb-winter.wav` | Laid by the harness (decisions 111 and 134) from two ElevenLabs sound effect takes (take 2 of `amb-fall` and take 3 of this cue; POST /v1/sound-generation, the default model, PCM at 48 kHz); no call of its own | 4 | 2026-11-26 |
```

- `node out/work/bin/soundguard.mjs sum`, 06:16 and again 06:36: spent 7,200, left 2,800, 52 calls (effects 2,349, music 4,851).
- `npx vitest run tests/mix.test.ts tests/audio.test.ts tests/audiomap.test.ts`, 06:06: 3 files, 79 tests passed. Again at 06:26, after the last change to the tool (the ambience trim): 3 files, 79 tests passed, 145 s. And at 06:34, after the last soundcheck: "Test Files 3 passed (3)", "Tests 79 passed (79)", 141 s. No tool and no test was changed after that; the key-tap trials of r33 to r37 ran outside the tool.
- The three mixes once more at 06:28, after that change: the same three sha256 as above.

## Commands run for decisions 141, 142 and 144 and what they printed

All on 2026-11-26 (UTC), in the one checkout on `main`, after the last change to a tool, a test or a record of a laid sound.

- `npm run sound -- --laid`, 07:49: the four files of `audio/laid/` built from their records. `key-tap.wav` sha256 `d39cd9e6a38b...`, `shake-summer.wav` `db5026b473ef...`, `shake-fall.wav` and `shake-winter.wav` both `78bfd501f9b0...` (one sound, the same bytes).
- `npm run mix -- --final`, 07:49: `audio/final/film-b.wav` (60 s, sha256 `3edd8ff57940...bf23`) and `audio/final/film-a.wav` (74.45 s, of which the opening is 14.45 s, sha256 `883ee8bd67c2...5515`), with the music stem `audio/final/music.wav`. `--final` writes both films and takes no `--which`.
- `npm run mix -- --candidate four-tracks`, `npm run mix -- --candidate four-tracks --which a` and `npm run mix -- --candidate blockout`, 07:49 to 07:50: `audio/mix/four-tracks.wav` and `audio/mix/four-tracks-film-a.wav` are the same bytes as the two final files; `audio/mix/blockout.wav` sha256 `6217368dcbd1...40c8`.
- What the mix printed of each film. Film B: 19 cues and ambience beds placed; skipped, no kept file: `land-spring`, `land-summer`, `land-fall`, `land-winter`; laid by decision 141, not kept, the cue open: `shake-summer`, `shake-fall`, `shake-winter` (1 time each); 2.005 dB of gain, the limiter took off at most 1.22 dB, 2 passes; -14 LUFS, true peak -1.3 dB under a limit of -1; as AAC at 256 kbit/s true peak -1.33 dB, the wav gives way in 1 place (0.34 dB at 26.995 s); landings, first 50 ms: -12.35, -11.81, -12.35, -12.35 dB. Film A: 105 placed, of which 84 are `key-tap`; skipped as film B; laid as film B and `key-tap` (84 times, 10 presses in turn); "typing: 84 taps for 84 keys, none without a key; each begins within 20 ms of its own key (the earliest -20 ms, the latest 20 ms)"; 2.078 dB of gain, the limiter at most 1.29 dB, 2 passes; -14 LUFS, true peak -1.3 dB; as AAC true peak -1.37 dB, the wav gives way in 1 place (0.15 dB at 41.445 s); landings -12.3, -11.71, -12.3, -12.3 dB. Blockout: -14.1 LUFS, true peak -1.1 dB.
- `npm run sound -- --pack`, 07:50: 9 files at 192 kbps, 4,378,752 bytes (4.18 MB), under `audio.appMaxMb` of 8 MB; a sprite of 11 sounds (the 8 kept ones and `shake-winter`, `shake-summer`, `shake-fall`, laid by decision 141); the loops as under "The music loops of the app". The gains of the three laid shakes in `index.json`: 1.23737, 1.23508, 1.23737, beside 1.23737 for `shake-spring`.
- `npx vitest run tests/mix.test.ts tests/audio.test.ts tests/audiomap.test.ts --no-file-parallelism`, 07:50 to 07:53: "Test Files 3 passed (3)", "Tests 86 passed (86)" (mix 40, audio 16, audiomap 30), 170 s. The tests of the laid sounds, of the typing's count and limit and of the loops are in `tests/mix.test.ts`.
- `node tools/soundcheck.mjs --only A5,A6,A7,A8`, 07:53 to 07:55: "4 pass, 0 open, 0 not run". A5 pass: "all 16 kept sounds have take, prompt (a laid one its layers and recipe), measurements, answers and a row · 4 more laid by decision 141, not kept and not counted, each cue open: shake-winter, shake-summer, shake-fall, key-tap, each with its state, recipe, file, measurements and answers". A6 pass: "blockout.wav -14.1 LUFS, peak -1.1 dB, four-tracks-film-a.wav -14 LUFS, peak -1.3 dB, four-tracks.wav -14 LUFS, peak -1.3 dB, film-a.wav -14 LUFS, peak -1.3 dB, film-b.wav -14 LUFS, peak -1.3 dB". A7 pass: "5 mixes made twice more, each byte equal to the file". A8 pass: "69 takes over 25 cues, at most 3 for one cue in one round, limit 3; 71 layers laid from them, not counted; 4 sounds laid by decision 141 (key-tap, shake-fall, shake-summer, shake-winter), no call, not takes and not kept". A1 to A4 were not run by the sound finisher: they start a browser and are `/root`'s to run after the next build of `dist/`.
- `node out/work/bin/soundguard.mjs sum`, 07:55: spent 7,200, left 2,800, 52 calls, none open (effects 2,349, music 4,851). The account's own counter read 17,074 used; with this build's last paid call, at 05:48, it came to 16,430 (16,419 before the call and the 11 of its cost header). The sound finisher made no call in between and the guard's ledger holds none, so 644 credits of the account were used outside this build's guard in that time, as happened in Phase 5. By whom is not known here.
- Not done here: nothing was heard in a browser or by a person; A1 to A4 were not run; the app was not built.

## Where things are

- Committed: `audio/prompts.json` (texts, takes, costs, verdicts, the listener's words, `learned`, `familyChecks`, `layers`), `audio/RECORDS.json`, `audio/plans/one-piece.json`, `audio/kept/<id>.json` and `<id>.wav.json`, `audio/mix/four-tracks.json`, this file.
- Not committed (the repo is public): the kept sounds `audio/kept/*.wav`, the takes `out/work/audio/takes/`, the listening copies `out/work/audio/listen/`, the layers `out/work/audio/layers-tried/`, the maps `out/work/audio/maps/`, the mix `audio/mix/four-tracks.wav`, the pack `public/audio/`. They are in the sound clone `/home/user/workspace/sg-sound`; the kept sounds and the packs were copied to the main workspace after each batch.
- Phase 6 had no clone: what it made that is not committed (`audio/kept/amb-fall.wav`, `audio/kept/amb-winter.wav`, the mixes `audio/mix/*.wav`, the pack `public/audio/`, the takes and layers 5 to 24 under `out/work/audio/takes/`, the sheet `out/work/audio/sheet.jpg`, the listener's replies `out/work/audio/p6/ans/`) lies in the main workspace only. The replies are also committed, under `audio/evidence/after-review/`. `out/work/audio/kept-sounds.zip` is the set of Phase 5 and does not hold the two new beds.
- After decisions 141, 142 and 144. Committed (text): `audio/laid/<cue>.json`, `audio/final/film-a.json` and `film-b.json`, the records of the mixes in `audio/mix/`, the replies `audio/evidence/after-review/r39.json` to `r48.json`. Not committed: `audio/laid/*.wav` (built again by `npm run sound -- --laid`), `audio/final/*.wav` and `audio/mix/*.wav` (built again by `npm run mix`), the pack `public/audio/`, the listening copies `out/work/audio/listen/now-*.wav`, the scratch of this job in `out/work/audio/p6/d141/`.
