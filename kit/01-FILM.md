# 01 · The films, the soundtrack and the card

The globe in `kit/02-SUBJECT.md` is the product. This file covers what is filmed from it: film B, film A, their soundtrack, and the still and loop for the portfolio card.

## What the films are

- Film B is one video of the globe going through its four seasons and back to the first. It runs on the timeline in `film.shots`. Brandon uses it on his portfolio page and it is the body of the post on `platform.name`.
- Film A is film B with the prompt opening in front of it: a prompt is typed into the product this work is made for, the reasoning level is set, the prompt is sent, a build screen runs, and then the film plays.
- Both are rendered twice. In this workspace: preview films, so everything can be judged. On Brandon's computer: the masters, frame by frame at `formats.master` and `film.fps`, by the local render in `kit/05-ARCHITECTURE.md`. Frame rate in the live app does not matter to the films. Every film frame is computed.
- Every frame is drawn by the same scene the app draws. Nothing is a recording.

## The idea

One object, four worlds. Each shake throws the season away and a new one settles out of the storm. The film has to prove two things: the globe holds up as a real object when the camera is close, and the change is total, down to the base and the light on the table.

## The viewer

- Someone scrolling X on a phone with the sound off. The first `film.hookSeconds` seconds decide whether they stay.
- A second viewer matters as much: someone at Perplexity deciding whether this is worth posting. They are looking for the moment that makes people ask how it was made. That moment is the shake.

## Rules for the opening of film B

- Frame 0 is a finished picture from the `macro` camera: the lit cottage, the lamppost and the foot of the tree in falling snow, filling the frame. No edge of the glass is in frame. It reads as a real snowy night somewhere.
- The camera is already moving in frame 0, pulling back. No fade in, no title.
- By `film.revealBySeconds` the frosted edge of the glass has entered the frame and the viewer understands that the night is inside a globe. This is the hook.
- Inside the first `film.hookSeconds` seconds something clearly changes in the picture: the pull back has to be visible by then, not only begun.

## Shot by shot

Lengths are in bars, from `film.shots`. A hold shows one season. A shake changes it and is exactly one bar: `shake.liftBeats`, `shake.strokeBeats` and `shake.setDownBeats` add up to `film.beatsPerBar`. The landing that ends a shake is the first frame of the next shot and lies on its bar line.

| Shot | What happens |
| --- | --- |
| `open` | Winter. The opening above. The pull back reaches the `hero` camera by the end of the shot's second bar. Then the globe is simply there: snow falling and settling on the roof and the branches, the string lights warm, frost on the surface. The camera drifts a few degrees and does not stop |
| `shake-1` | The shake, winter to spring, as `kit/02-SUBJECT.md` section 6 describes it, seen from `hero` |
| `spring` | The landing. The storm of petals thins over the first bar and the blossom tree comes out of it. Then one slow move: the camera sinks toward the `base` camera, past the trickle of water and the mushrooms on the mossy stone, and rises again |
| `shake-2` | Spring to summer |
| `summer` | The landing, the golden haze clearing. Then one slow push toward the `interior` camera: lanterns in the tree, fireflies blinking, the sun flare sliding across the glass. Then back |
| `shake-3` | Summer to fall |
| `fall` | The landing, leaves and embers whirling down. Then one slow move down to the `low` camera: the carved faces on the iron base light up one after another, the green fog pools, the bats circle the top of the dome. Then back |
| `shake-4` | Fall to winter |
| `close` | Winter again. The storm of snow thins over the first bar. Then one slow, unbroken push from `hero` all the way to the `macro` camera, ending on the framing of frame 0. The last bar holds there |

- In every hold the camera is back at `hero` one beat before the next shake begins, and it never stops completely.
- The last frame's camera is frame 0's camera, so the film can repeat.
- The frame 0 state is winter at rest: the simulation is run for `states.restSeconds` after a landing before the film begins.

## The camera during a shake

- The camera does not shake. Only the globe moves. A locked camera is what makes the globe's motion read as weight.
- It may ease in by a few percent over the bar, and settle back after the landing.
- Focus stays on the glass.

## Timing

Before the review:

- The films run on the default grid. Every shake starts on a bar line and every landing is on the next one.
- The soundtrack candidates are made to this grid, so they already fit.

After the review:

- The audio map of the approved music replaces the grid. `kit/05-ARCHITECTURE.md` says how the map is made.
- Film B starts at the start of the music.
- The music has five sections, one for each hold, and each hold with the shake that ends it fills one section. A shake is always the last bar of its section. A landing is always the first downbeat of the next.
- If the map finds the five sections, use them. If it does not, split the music's bars into five runs in the proportions of the default grid, each at least three bars, with each boundary moved to a section boundary of the map when one lies within two bars.
- Length. If the music is between `film.minSeconds` and `film.maxSeconds`, the film is as long as the music. If it is longer, the film ends on the last bar line at or before `film.maxSeconds` and the sound fades over the last bar. If it is shorter than `film.minSeconds`, the film is as long as the music.
- Priorities when fitting, highest first: landings on downbeats; shakes exactly one bar; the order of the seasons; the camera back at `hero` before each shake.
- If no beat can be found in the music after three tries, keep the default grid at the tempo that fits the music's length in whole bars, and log it.
- The result is `cut/CUTLIST.json`: every shot, every shake, every landing and every camera key, by frame. `cut/CUES.md` is the same in words, for an editor.

## The soundtrack

Brandon wants to hear what the sound tool can do before he trusts it. So you make the soundtrack, he listens at the review stop, and nothing is cut to it until he approves. `kit/03-METHOD.md` section 12 says how each sound is made and chosen.

What he asked for, in his words: Christmas sounding music for winter, a Halloween track with eerie sound effects in it for fall, and something in the same spirit that fits for spring and summer. He is open to four tracks joined together.

### Music

All music is instrumental, at `film.defaultBpm`, in `film.beatsPerBar`.

| Season | Direction |
| --- | --- |
| Winter | Warm orchestral Christmas: sleigh bells, celesta, soft choir pads, low strings |
| Spring | Light and airy: harp, flute, plucked strings |
| Summer | Warm and unhurried: nylon guitar, soft marimba, a golden dusk |
| Fall | Halloween: a detuned music box and piano over low strings, with eerie sounds in the music itself |
| Winter again | The winter music returning fuller, and resolving on its last bar |

You make `audio.candidates` complete soundtracks. Brandon chooses.

- `one-piece`: one composition, planned as five sections with the lengths of the five holds and their shakes, so the tempo holds and one short melody can pass through all of them in each season's own instruments.
- `four-tracks`: one track for each season, made on its own and cut on bar lines. The outgoing track thins through the shake bar and is gone by the landing. The incoming one starts exactly on the landing. The winter track is used twice.

### Sound effects and ambience

The cues are listed in `audio.sfx` with their lengths.

| Cue | Plays | What it is |
| --- | --- | --- |
| `lift` | The first beat of a shake | Glass and a heavy base leaving a stone surface, soft |
| `shake-<season>` | Across the shake bar, for the season being shaken in | Liquid sloshing and churning inside glass, with that season's material in it: snow hiss and tiny bells for winter, soft petals and water for spring, a warm shimmer and dry seeds for summer, dry leaves and a hollow rattle for fall |
| `land-<season>` | On the landing | The set down, heavy and short, then the season arriving: ice crackling outward for winter, one drop and a breath of air for spring, a warm chime and a hiss of sand for summer, a wooden creak and a low eerie tone for fall |
| `amb-<season>` | Under each hold, looped, very quiet, crossfading through the shake | Winter: wind and distant bells. Spring: birds and light rain. Summer: crickets and warm air. Fall: wind, dry leaves and a low eerie tone |
| `glass-clink` | On the set down, under `land-<season>` | One small clean ring of glass |
| `music-box` | Under the first bar of `open` and the last bar of `close`, if it suits the music | A music box mechanism turning |
| `key-tap`, `ui-send`, `riser` | The prompt opening of film A | Soft key presses, one press of a button, a rising breath of air into frame 0 |
| `ui-tick`, `ui-sound-on` | The app only | A soft tick for a control, a small chime when sound comes on |

### The mix

- The music leads. Ambience sits far under it. A shake and a landing may rise to meet the music for their bar.
- The mix is made offline by the harness from the cut list, every cue on its frame. The same inputs give the same bytes.
- Level: `audio.filmLoudnessLufs` integrated, true peak no higher than `audio.truePeakDb`.
- No sound carries meaning. Every frame reads the same with the sound off.
- No voice, no words, no singing with words.

### The review cut

For the review stop, film B is rendered once on the default grid in `formats.preview`, and that one picture is joined with each candidate soundtrack. Brandon watches the candidates against the picture on the review page, with every cue also there to hear on its own. `kit/08-BUILD-ORDER.md` says what he may ask for and how many takes that buys.

## The prompt opening of film A

- It is made with the skill this workspace has for it: the product's prompt screen, a prompt typed out, then a build screen. `kit/03-METHOD.md` section 13 says how to find it and what to do if it is not there.
- The prompt typed is `intro.prompt`, at `intro.charsPerSecond`. A viewer must be able to read it as it appears.
- Before the prompt is sent, the reasoning level control is opened and `intro.reasoning` is chosen. This is seen, not implied.
- After a pause of `intro.pauseBeforeSendSeconds` the send control is pressed.
- The build screen follows: the product's label, the prompt, the title `intro.buildTitle`, and the lines in `intro.steps` arriving one at a time, `intro.stepSeconds` apart. A viewer must be able to read each one and feel that something is being built.
- It holds for `intro.holdSeconds`, then cuts hard to frame 0 of film B.
- The whole opening is at most `intro.maxSeconds`. If it would be longer, shorten the pauses, never the typing speed.
- The music starts on frame 0 of the body, not before. The opening carries only `key-tap`, `ui-send` and `riser`.
- Film A is the opening followed by film B, unchanged. Nothing in film B is re-timed for it.

## The card

Every project on Brandon's portfolio has a card. The card shows a still. When a visitor hovers it, a short loop plays from that still and ends exactly where it began.

- The loop is `deliver.cardLoop.seconds` seconds at `deliver.cardLoop.fps`, from the `deliver.cardLoop.camera` camera in `deliver.cardLoop.format`, with no interface and no text. It has no sound.
- It shows one season. `deliver.cardLoop.season` is `auto`: the season is chosen once by the pick in `kit/07-QUALITY-BAR.md`, from the four finished at-rest stills, and written to `kit/PROGRESS.md`. A season name in that key skips the pick. Until the pick has been run the loop shows `defaultSeason`.
- What happens: the globe stands at rest, particles drifting. At `deliver.cardLoop.shakeStartSeconds` it is shaken, with the same lift, strokes and set down as in the film. The loop's shake always lasts one bar at `film.defaultBpm`, whatever tempo the approved music has. The season does not change. The storm fills the glass, thins, and everything comes to rest exactly as it began.
- It is seamless. The frame after the last frame is the first frame, to the pixel. `kit/03-METHOD.md` section 8 says how the particles are made to return. Check G14 in `kit/07-QUALITY-BAR.md` renders that frame and compares.
- It is one interesting shot, not a summary of the film.
- The globe and its base stay inside a centred 4:3 crop and a centred square crop, so the card can crop it either way.
- Files, under `deliver/`: the loop as `export.files.cardLoop`, a lighter copy `deliver.cardLoop.webWidth` pixels wide at `deliver.cardLoop.webBitrateMbps` as `export.files.cardLoopWeb`, and frame 0 as `export.files.cardStill`.
- In this workspace the loop is rendered at the `final` tier, split across sandbox agents, inside `sandbox.cardLoopMaxHours`. If the render budget says `final` cannot fit, render at the highest tier that does, never below `review`, and log an open item. The local render can make it again at `formats.master`.

## Not in these films

- People, hands, a voiceover, captions or subtitles.
- Any text or logo in film B. The only words on screen are in the prompt opening of film A.
- More than one place. The globe never leaves its surface except in the shake.
- A vertical version. One is made only if Brandon asks.
- Camera shake, whip pans, glitch effects, speed ramps or slow motion.
- An end card.

## What the Builder may tune

- Every camera number, every move and the easing, inside the rules above.
- How far each detail move goes, and what it lingers on.
- The exact prompts for the music and the sounds, inside the directions above.
- The wording of `intro.steps`, if the skill for the opening expects a different number of lines.

Not open to tuning: the order of the seasons, the rules for the opening, a shake being one bar with its landing on a bar line, the locked camera during a shake, the text of `intro.prompt` and `intro.reasoning`, and anything Brandon says at the review.
