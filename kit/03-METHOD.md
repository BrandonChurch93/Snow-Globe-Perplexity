# 03 · How each part is made

Each section gives the planned technique and a fallback. You choose the details. When a picture falls short, the ladder in `kit/04-LOOK.md` says which technique to move to next.

One rule above all the others: match the approved image first. A technique is right when its still, beside the approved image, could be the same photograph. Every section below is a way to get there, not a goal of its own.

## The parts register

`parts/PARTS.json` lists every part with its unit, its state, the files that make it up, the hash of those files as they were when the part was recorded as a stand-in, and the commit that set the state. Phase 2 creates it with every part as `stand-in`.

A stand-in also says so itself, apart from the register: every stand-in asset, shape, material or screen carries a flag in its own data or code, and the `standins` view in `kit/04-LOOK.md` draws whatever carries it in one loud colour. A part made by its method below does not carry the flag. Check G13 reads both.

| Part | One for | Unit |
| --- | --- | --- |
| `glass`, `liquid`, `surface`, `backdrop`, `lens`, `shake`, `particle-engine`, `light-engine` | The whole build | `winter` |
| `base-<season>`, `miniature-<season>`, `glass-dressing-<season>`, `surface-dressing-<season>`, `light-<season>`, `veil-<season>`, `arrival-<season>` | Each season | That season |
| `particle-<kind>` | Each kind in `particles` | The first season in `seasons` that uses it |
| `change-<from>-<to>` | Each shake in `film.shots` | `change` |
| `interface`, `sound-engine`, `quality-levels` | The app | `globe` |
| `opening`, `loop` | Film A's opening, the card loop | `film` |

States: `stand-in`, `built`, `fallback`, `general fallback`, `last resort`. A part in any state but `built` is an open item. A part marked `stand-in` in a finished unit turns check G13 red.

### The fallback chain

Every part ends in one of three steps, tried in this order, three tries each:

1. Its named fallback, from its section below.
2. The general fallback: plain geometry with generated maps. A shape a script can always make, with colour, roughness and height pictures made by the image tool from the approved image.
3. The last resort: the part's region of the approved image itself, projected onto the simplest shape that holds it, a card, a cylinder or a dome, and lit to sit in the scene. This can always be made, so the chain always ends.

A part that ends on step 2 or 3 is real, is judged in its round like anything else, and is logged as an open item with what was tried.

Some parts are motion, light or code and have no surface to project a picture onto: the liquid, the shake, a change, an arrival, the particle engine, the light engine, a season's light, a veil, the lens, the sound engine, the levels of quality, the interface, the loop and the opening. For these the named fallback is the last step. Each one below is written so that it can always be made.

## 1. Scale and scene

- Build at real size, in millimetres or a fixed multiple of them, from `globe`. Real size makes the lens, the depth of field and the light fall off behave.
- The surface is the ground plane. The globe's rest pose puts the foot of the base on it at the origin.
- One scene graph for every mode. A season is a set of parts switched together. The films, the app and the loop only differ in who moves the camera and the globe.

## 2. The glass and the liquid

A sphere full of water is a strong lens. That lens is most of what makes a snow globe look like one: the miniature swells, straight things near the edge bend, and the room behind appears small and upside down around it. Get this right before anything inside it.

Planned: draw the inside through the refraction, vertex by vertex.

- Light from a point inside the liquid reaches the camera by bending once at the sphere. The thin glass wall shifts it very little. The place on the sphere where that ray leaves lies in the plane through the camera, the point and the sphere's centre, so finding it is a search along one angle for where Snell's law holds with `globe.liquidIor`.
- Do that search in the vertex shader, with a fixed number of steps so it is deterministic, and place the vertex on the line from the camera through that exit point, at a depth that keeps the order of things along the ray.
- The miniature, the particles, the veil and the inner lights are all drawn this way in their own pass, clipped to the sphere's outline. Geometry has to be finely divided, because straight edges curve.
- Each sample of a computed frame has its own point on the lens, so the search runs from that point. Depth of field through the glass then comes out right by itself.
- Toward the rim the rays graze and less and less of the inside is seen. Fade the inside there by the glass's own reflectance, and show the reflected room.

The shell, drawn over that:

- The outer reflection: the lights of the rig as soft shapes, the backdrop's lights, the surface. A second, fainter reflection from the inner face of the wall gives the glass its thickness.
- The through view: for a ray that crosses the whole sphere and misses the miniature, bend it in and out analytically and look up the backdrop in that direction. This puts the small upside-down room behind the miniature.
- The season's dressing on the glass, section 6, sits on the shell and blurs or bends what is behind it.
- The air bubble at the crown: a small bright lens of its own, moved by the liquid model.

Named fallback: three.js physical transmission on the shell, with the inside drawn first to its own target and the refraction tuned until the miniature's size matches the approved image.

## 3. The surface and the backdrop

- The surface is a polished dark slab. Mirror the globe in it with a real planar reflection, softened with distance from the contact line. It also picks up the coloured glow from inside the globe.
- The contact shadow under the base is tight and dark, and opens when the globe lifts.
- The backdrop is darkness with small bright lights at several depths behind the globe. In a computed frame, do not paint blur discs: put real small emitters there and let the lens sampling turn them into discs. In the live app use sprites shaped like the lens's discs.
- A generated plate may sit behind the lights for the faint texture of a dark room. It must be smooth: the approved images carry a compression grid in their dark areas that the build must not copy.
- Named fallback for the surface and the backdrop: a pre-blurred mirror image of the globe baked for each season and camera, and sprite discs everywhere.
- Named fallback for the lens: no lens sampling. Blur the finished picture by depth, and the backdrop most.

## 4. The miniature

The cottage, the trunk, the lamppost, the fence, the path, the pond's outline and the island are one set of geometry shared by all four seasons. Each season adds its own cover, growth, props and lights.

Planned: modeled geometry, textured from pictures made to match the approved image.

- Model each thing as real geometry with real thickness: stones standing proud of the wall, roof tiles that overlap, a trunk with roots. A script builds it, in code or in headless Blender, so it can be built again.
- The camera never goes behind the globe. The orbit is limited to `live.orbitYawDeg`. Spend the detail on what those views can see.
- Texture from generated pictures: for each thing in each season, make material sheets and extra views with the image tool, with the season's approved image passed in as the reference, and project or bake them onto the geometry. Use the approved image itself as a projection for the faces the hero camera sees, corrected for the fact that it was seen through the liquid.
- Give every surface height as well as colour: a height or normal picture made with the colour picture, so stone, bark, snow and moss catch the light.
- The tree's crown is the hardest thing in the miniature and differs most by season: snow-laden boughs, blossom, full leaf, bare twigs with ember lights. Build the crown of each season as its own part on the shared trunk: many small cards or clusters with real depth, not one painted shape.
- Small lights are real lights in the picture: the string lights, the lanterns, the windows, the lamp, the pumpkins, the embers. Section 9 says how they light what is near them.
- Water: the pond mirrors what is above it. Frozen in winter, with ripples in spring, still in summer, dark with green fog on it in fall.
- Build a signed distance field of each season's miniature for the particles to collide with, section 8.

If an image-to-3D model can be called in this workspace, it may be tried once on the cottage and once on each base, with three failures in all ending the idea. Its output is a starting shape, never a finished part.

Named fallback: relief. Cut the season's approved image into its things, give each a depth by modeling a simple proxy under it, and draw each as a displaced relief that holds up inside the orbit limit.

## 5. The bases

The bases are outside the glass and are seen closer and clearer than anything else. They are the objects a viewer will judge as real or not.

- Planned: the same route as the miniature, with more geometry. A base is a turned shape plus sculpted detail: the carved relief and brass rings of winter, the roots and stone of spring, the wind-carved stone and set-in shells of summer, the woven thorns of fall. Build the big forms as geometry and the fine grain as displacement.
- Winter's icicles are clear ice with their own refraction and bright rims. They hang at different lengths and grow in the arrival.
- Spring's trickle is moving water on the stone: a thin bright thread with a flowing highlight, darkening the stone it wets, pooling on the surface.
- Summer's sand is grains at the edges, not a texture: it spills and scatters.
- Fall's carved faces are openings with light inside them, flickering. The thorns are black iron with a hammered sheen and must not cross a face. The wax is translucent and soft.
- Every base meets the sphere at a collar. The line where glass meets base is where fake globes give themselves away: put a real seat there, with a thin dark line of shadow and a reflection of the base in the lower glass.
- Named fallback: the turned shape with the approved image projected onto it and a height picture made from it.

## 6. What the season puts on the glass

| Season | What | How |
| --- | --- | --- |
| Winter | Fern frost growing in from the rim | A grown pattern, made once by a script or generated as a picture, revealed from the rim inward by a threshold that the arrival animates. It has height: it sparkles at its edges and blurs what is behind it |
| Spring | Dew beads and rain trails on the outside | Drops as small lenses that show the inside small and upside down. A few slide, leave a trail and merge, on paths that are functions of time |
| Summer | A sun flare on the shoulder, and the pool of light on the surface | The flare is the reflection of one strong warm light. The pool is that light focused by the globe: a soft bright patch with a few broad curved bands that shift when the globe moves. Not thin veins |
| Fall | One fine crack, and green fog pooled in the bottom of the dome | The crack is a thin line with a bright edge that spreads in the arrival. The fog is a lit volume, denser at the bottom, stirred by the liquid model |

Named fallback for each: a still picture of the dressing on the shell, with its arrival done as a dissolve.

What a season lays on the surface, frost, petals, sand or leaves, is made the same way as the base's fine detail: real small things near the camera, a picture further off. Its named fallback is one flat picture of the dressing laid on the slab.

## 7. The liquid

The liquid is a small model, not a fluid solver. It has to give the right motion to thousands of particles for almost nothing, and be the same every time.

- Keep a handful of numbers as its state: how fast and about which axis it turns compared with the glass, how hard it is sloshing along each direction, and how much turbulence it holds.
- Drive them from the globe's own motion: a turn of the glass drags the liquid round slowly; a stroke throws slosh into it; every reversal turns slosh into turbulence; everything decays, the turn over about `shake.spinDownSeconds`.
- From that state give every point in the sphere a velocity: a solid turn, a slosh flow that circulates inside the sphere, and curl noise scaled by the turbulence. Every part of it stays inside the sphere and slides along the wall.
- Step it at `sim.stepHz` with fixed steps. It is a pure function of the seed and of the globe's motion so far.
- The veil's density and the bubble's wobble read the same state.
- Named fallback: the solid turn and the decay alone, with the turbulence as plain noise.

## 8. The particles

- Simulate them on the processor in typed arrays, with fixed steps at `sim.stepHz`, so that the same seed and the same globe motion give the same particles on every machine. Draw them as instances.
- Each particle has a place, a velocity, a turn, a size, a kind, and a state: in the liquid, at rest on something, or snagged.
- Each step: the liquid drags it toward the liquid's own velocity, its kind adds what that kind does in still liquid (the table in `kit/02-SUBJECT.md` section 4), and it is kept out of solids.
- Collisions: read the season's signed distance field. A particle that would enter a solid is moved back to the surface and loses the speed into it. The glass is the sphere itself.
- Coming to rest: a particle that is slow, touching something, on a slope its kind can lie on, stops and stays. The share of particles found inside a solid is at most `sim.maxInsideFraction`.
- Building up: what has come to rest is still drawn, lying where it stopped, in its lying pose. Where many lie together the cover grows: thicken the snow on the roof and the boughs, the petals on the pond, the leaves by the fence, by a cover map over the miniature's upward faces.
- Thrown back: when the liquid's speed over a resting particle passes a threshold, it lifts off again. A shake clears nearly everything.
- Fireflies steer themselves and are also carried by the liquid. Embers live and die on a cycle from the seeded stream. Bats are a few simple shapes on wandering circles under the crown.
- The veil is a lit volume inside the sphere, not particles. Its density follows the liquid's turbulence. It does most of the hiding in the swap window, so make it able to hide the miniature almost completely at the height of a storm and to vanish at rest.
- Drawing: each kind is its own small shape with its own material. A flake is a soft irregular cluster, not a disc. A petal is cupped and lets light through. A leaf is curled and veined. A seed is a fine parachute of hairs. A firefly is a point of light with a small glow that lights what is near it. Use shapes with thickness or several crossed cards. A flat round sprite is the thing to avoid.
- Order and softness: draw with hashed coverage and let the frame's samples resolve it, so nothing has to be sorted.
- Motion blur: a sample at a moment between two steps takes each particle's place between them. In a storm the particles streak. The miniature behind them does not.
- Counts are in `particles`. You may move a count between `particles.tuneMin` and `particles.tuneMax` times its value. The live app draws a fixed share of them, the first ones by index.
- Named fallback for a particle kind: two crossed cards carrying a generated picture of that kind, with the same motion.
- Named fallback for a veil: a tinted fog filling the sphere evenly, its strength following the liquid's turbulence.

### Replaying the simulation

A film frame late in the film needs everything that happened before it.

- `npm run simcache` runs the simulation once along the film's timeline and saves its whole state every `sim.checkpointSeconds` under `out/work/`. A frame starts from the checkpoint before it.
- The cache is keyed by the engine hash and the cut list. It is never committed.
- A still in a named state, `landed`, `rest` or `settled`, is reached the same way: a shake into that season from that season's own rest, then the state's seconds from `states`.

### The card loop

A simulated storm never returns to where it began, so `loop` mode does not use the free simulation. Every particle follows a closed path:

- Its home is where it is in the at-rest picture. A particle in the liquid sinks or drifts on a path that repeats with a period that divides the loop's length, such as `scene.ambientPeriodSeconds`, and one that leaves at the bottom returns at the top, fading at both ends so the wrap is never seen. A particle at rest stays at rest.
- The shake adds a displacement on top of home: a turn about the vortex axis whose rate depends on the distance from the axis, a lift, and a scatter. Each is multiplied by an envelope that is zero until `deliver.cardLoop.shakeStartSeconds` and zero again before the loop ends.
- Every particle's total turn is a whole number of turns, chosen for that particle. So each one arrives exactly at its home.
- Take the envelope and the turn rates from one run of the liquid model through the same shake, so the loop's storm matches the film's as closely as a closed path can.
- Push every path out of solids with the distance field, by a fixed rule.
- Everything else in the loop is periodic too, with periods that divide the loop: the lights' twinkle, the smoke, the frost, the veil.

Named fallback for the loop: the free simulation for the storm, crossfaded over the last quarter of the loop into the home paths, with each particle paired to the nearest home.

Named fallback for the particle engine: the same simulation with collisions against simple shapes, a box for the cottage, a cone and a sphere for the tree, in place of the distance field.

## 9. Light

- Each season has its own rig outside the globe: a key, a rim and a little fill, in the season's colour, placed to match the highlights and shadows of its approved image. Light the glass with broad soft sources so its reflections are soft curved shapes.
- Inside the globe the small lights matter more than the rig. Bake them for each season into a coarse grid of light through the sphere's volume. The miniature, the particles and the veil all read it, so a flake drifting past the string lights turns warm and the fog glows green near the cottage.
- Lights that flicker or twinkle scale their part of the grid with a function of time.
- The glow from inside reaches out: onto the surface, onto the base's upper edge, into the lens as a soft bloom.
- Shadows inside are soft and short. The tree shadows the ground. The cottage shadows its own wall under the eaves.
- Named fallback for the light engine and for a season's light: the rig, plus a point light at each cluster of small lights with no grid.

## 10. The shake

Read `kit/02-SUBJECT.md` section 6 first. The method has to produce weight.

- Do not keyframe it by hand and do not use a sine. Model a hand.
- Plan the grip's path: a lift, then `shake.strokes` targets on alternating sides of a tilted line, each with its own distance and its own moment, drawn from the seeded stream inside ranges around `shake.strokeMm`, the hand speeding up as it goes, then a path down to the surface.
- Let the globe follow the grip through a stiff spring with a limit on how fast its acceleration can change. A real arm cannot reverse instantly, and a heavy object overshoots a little.
- Couple the rocking to the motion: a held globe pivots about the wrist, so it tips into each stroke and whips back at each reversal, up to `shake.tiltDeg`, around two axes, with the second a little out of step with the first.
- Solve the set down backward from the landing: it must touch the surface on the landing frame, moving down, and not before. On contact it settles as a heavy base does, with a small overshoot in tilt that dies inside `shake.landSettleSeconds`. It does not bounce into the air.
- Write the path in beats, not seconds, so the same shake fits any tempo. The distances stay in millimetres.
- The result is a table from beat position to the globe's place and tilt, computed once from the seed. The liquid model, the particles, the mirror image, the shadow and the dressing all read that table.
- Each of the four shakes in the film uses the same plan with a different seed stream, so no two are identical.
- Study motion before you write it. Search for footage and photographs of a snow globe being shaken. You may also generate a few seconds of reference video of one being shaken, from the approved winter image, inside `assets.maxTakesPerAsset` takes. It is for study only. It is never shipped and never shown to a critic.
- Named fallback: a hand-keyed path with the same lift, strokes and set down, eased, with the tilt lagging the motion.

## 11. The change and the arrivals

- Every seasonal part reads one number: how far the change has gone, from 0 at the start of the swap window to 1 at its end. Outside the window it is 0 or 1. Check G11 reads it.
- Inside the glass the parts switch when the `cover` view says they are hidden. Order the switches by what is hidden first: the far side of the miniature, then the near side.
- Particles change kind in place, as "The change" in `kit/02-SUBJECT.md` section 6 says. Give each old particle a new one by index, so the pairing is fixed.
- Outside the glass: the bloom. For a few frames at the fastest stroke the inner light of the new season rises far above its resting level and floods the base and the surface, while the globe is streaked by its own motion. The base and the dressing dissolve across those frames. Tune the bloom so that no clean frame shows a base that is half one season and half another.
- The arrivals in `kit/02-SUBJECT.md` section 6 are functions of the time since the landing: a frost front's radius, a count of lit faces, a crack's length. Nothing is stepped from an earlier frame, so any frame can be rendered alone.
- Named fallback for a change: a plain dissolve of every seasonal part across the swap window, under the same bloom.
- Named fallback for an arrival: its finished state faded in evenly over the first `shake.settleCheckSeconds` after the landing.

## 12. Sound

You have no ears. Every choice about sound is made from numbers and from a listener's answers, and then by Brandon.

### The tool

- Phase 0 finds what can make sound here: the ElevenLabs connector first, for sound effects and for music. Record each endpoint, the model it uses by default, the lengths it accepts, what a call costs and how long it takes, with one test call each.
- Use the default model of each endpoint. A newer one that is marked as a preview or beta is not used.
- If music can be asked for as a plan of timed sections, use that for the `one-piece` candidate. Section lengths come from the default grid: a section's bars times `film.beatsPerBar` beats at `film.defaultBpm`.
- If no tool can make music, make the sound effects and ambience, and say in the first line of the `REVIEW` block that the music has to come from Brandon.

### Takes

- A cue gets at most `audio.maxTakesPerCue` takes. The best is kept. A cue with no acceptable take after that is an open item, and its moment is silent.
- Spend takes one at a time. Judge each before asking for the next.
- A review round buys each cue Brandon names up to `audio.maxTakesPerCue` new takes, with his words added to its prompt.

### How a take is chosen

Two things stand in for ears:

- Numbers, from `ffmpeg`: where the sound starts and ends, its peak, its loudness, how its energy is spread from low to high, how quiet its tail is, and for music the tempo and the bar lines from `npm run audiomap`.
- A listener: the audio evaluation tool, or a fresh agent that can hear, given the file and the same fixed questions for every take. What is heard. How many separate events. Whether there is a voice, a word or singing. Whether there is music in a sound effect, or a sound effect that was not asked for in music. Whether it fits the one line that describes the cue. For music: the instruments, the mood, and whether the mood fits the season's line in `kit/01-FILM.md`.

A sound effect is kept when the numbers fit its length and the listener's answers fit its line. A piece of music is kept when the listener hears no voice or words, hears the right mood in each section, and the map puts each section boundary within one bar of the plan. The cut follows the map afterwards, so a take does not have to hold the tempo exactly.

For a family check, the listener hears a new take after two kept ones and says whether the three belong together.

### One family

- One line ends every sound effect prompt, word for word, so the effects belong together: close and detailed, glass, water and small natural things, a dark quiet room, no music, no melody, no voice.
- One line ends every music prompt: instrumental, no vocals, no spoken words, clean ending.
- One chain for every sound effect, run by the harness: trim the silence, a short fade in, a fade out, a low cut, then the level of its class. Ambience is quietest, then the interface sounds, then the lift and the clink, then the landings and the shakes.
- Ambience and the app's music loops are made to loop: a crossfade from the end into the start, checked by number at the seam.
- Variation without chance: a repeated sound, the key taps, steps through a short fixed list of small pitch offsets.

### The two candidates and the mix

- `npm run mix -- --candidate <name>` lays the music, the ambience and the effects on the cut list and writes one stereo file at `audio.sampleRate`, levelled to `audio.filmLoudnessLufs` with peaks under `audio.truePeakDb`.
- Run twice, it gives the same bytes.
- For `four-tracks`, cut each track on its own bar lines, found by the map of that track.

### Files

| What | Where |
| --- | --- |
| Every take, as the tool returned it | `out/work/audio/takes/`, never committed |
| The kept take of each cue, and beside it its prompt, settings, measurements and the listener's answers | `audio/kept/<id>.<ext>` and `audio/kept/<id>.json` |
| The log of every cue: takes made, which was kept and why, what it cost | `audio/RECIPE.md` |
| The candidates' mixes | `audio/mix/<candidate>.wav` |
| After the review: the approved music and the final mixes for film B and film A | `audio/final/` |
| What the app ships: one packed file of the short sounds with its index, the ambience loops, the music loops | `public/audio/` |

The text files are always committed. Whether the sound files are committed follows "Sound" in `AGENTS.md`.

The app's sound engine uses the browser's audio graph, so levels, loops and crossfades are exact. Its named fallback is plain audio elements, one for each sound, with no crossfades.

## 13. The prompt opening

- In Phase 0, list the skills of this workspace and find the one that draws the product's prompt screen, types a prompt and shows a build screen. Record its name and what it produces under "Tool record". Find the skill that maps an audio track the same way.
- Use the skill to make the opening from `intro` in the config, as `kit/01-FILM.md` describes it.
- The opening has to be rendered frame by frame like everything else, because the local render steps a clock. If what the skill produces runs on timers, replace its timers with the film's clock. That is the one change you make to it.
- If the reasoning level control is not part of what the skill draws, add it in the skill's own style.
- Named fallback, if no such skill is found after three tries at looking: build the two screens yourself as a plain page in the product's general look, a dark page with one input, a small label and a list of steps, and say in the `BUILD COMPLETE` block that the opening was made without the team's skill.
- The audio map skill is a convenience. `npm run audiomap` must work without it.

## 14. The live picture

- The app draws the same scene with one sample a frame.
- Motion blur in the app: stretch each particle along its own velocity. In a storm they streak, as in the films.
- The backdrop's discs are sprites. The surface mirrors the globe as its level of `live.quality` says.
- The simulation runs off the main thread where it can, with the same code and the same steps.
- Anti-aliasing: multisampling, and a pixel ratio up to the level's cap.
- Named fallback for the levels of quality: one fixed level, the `low` one, for every visitor.
- The picture must never stall while assets load. The default season loads first and the others load behind it. A shake into a season that is not ready holds the storm for it, for at most `live.loadWaitSeconds`, and then lands in the season it left.

## 15. The interface

- Plain HTML and CSS Modules over the canvas. No UI framework.
- Its numbers and words live in `src/copy.ts` and the config.
- The controls are drawn to belong to the object's world: thin, quiet, a little warm. Never pure black or pure white.
- It is never drawn into a computed frame except in the four `screen` stills.
- Named fallback: plain unstyled buttons in the same places, with the same names.

## 16. Where image generation helps

- Material sheets, extra views and height pictures for the miniature and the bases, always with the season's approved image passed in.
- The frost pattern, the crack, the cobweb, the backdrop plate.
- Reference video of a globe being shaken, for study only, section 10.
- Every generated picture counts against `assets.maxTakesPerAsset` for its asset, and its prompt is committed beside it.
- The reference run found that the image model follows a rough guide closely and thins a storm by about half. Its notes say how its guides were made. Use the same trick when a picture has to match a layout.
