# 04 · The look

## 1. The bar

In Brandon's words:

- Hyper-realistic means the viewer believes they are looking at something real, even when the subject could not exist. A globe that changes season when shaken cannot exist. The viewer has to believe it anyway.
- The standard is a top-budget film or a AAA game cinematic. He named GTA 6 and Avengers: Doomsday.
- Never cartoon, painterly, stylized, flat, plastic, or a web 3D demo.
- A complete scene, not an object floating in a void.
- The approved images are the bar made concrete. When words and an approved image disagree, the image wins, except on a settled difference.
- The first two seconds stop a scroll on a phone with the sound off.
- Graphics and fidelity matter most on this project. Frame rate in the films does not matter, because the masters are rendered frame by frame. Spend the frame.
- This one should have a lot of movement, especially the particles inside the globe.
- The shake has to look incredible.

What that means for a still: put it beside its approved image at the same size. A person who is told one is a photograph of a real collector's piece and one is not should have to guess.

## 2. What sells a real globe

Study the six real photographs listed in `references/drafts/round2/NOTES.md` before the look lock. These are the tells, most important first.

1. The lens. The miniature is larger through the liquid than the base says it should be, and it swims a little as the camera moves. Things near the edge of the glass bend. Without this it is a glass ball with a model behind it.
2. Reflections on the glass. Soft, curved shapes of real lights, brightest at the upper shoulders, with a second fainter set from the inner face. A hard round highlight reads as a 3D render.
3. Depth in the liquid. Particles in front of the miniature, among it and far behind it, the near ones large and out of focus, the far ones small. One flat layer of particles reads as a filter.
4. Weight at the foot. The collar seats the glass. The base touches the slab along a tight dark line. The slab mirrors the base and takes its colour.
5. Small real lights. Lights inside the miniature that are bright enough to bloom a little, that warm the snow beside them, that show as soft discs when a flake passes in front.
6. Material scale. Stone that is rough at the size of a miniature, not at the size of a house. Snow that sits in soft heaps. Frost with feathered edges. Iron with a hammered sheen. Things made by hand at small size have slightly thick edges and soft paint.
7. Imperfection. The air bubble. A little dust on the slab. Frost that is not even. Icicles of different lengths. One lantern dimmer than the rest.

## 3. The light

- One mood for the whole piece: a dark room, a product photographer's light. The globe is the brightest thing in the frame, and its inside is the brightest part of it.
- Each season has its own rig, matched to its approved image: where the highlights sit on the glass, which side of the base is lit, the colour of the lights behind.
- Contrast is high and the blacks are deep, and nothing important is lost in them. The base must read against the slab in every season. Fall needs its rim of light for this.
- The inside lights are warm in winter, soft and pale in spring, gold in summer, orange with green and purple in fall.

## 4. The lens

- A macro lens at a close distance: a narrow angle of view, from `cameras`, and a shallow depth of field. At the `hero` camera the glass and the front of the miniature are sharp, the back of the base is just going soft, and the lights behind are large soft discs.
- At the `macro` camera the depth of field is very thin: the cottage door is sharp, near flakes are large blurs.
- The discs behind the globe are round in the centre of the frame and slightly squeezed toward the corners, with a soft edge. Not hexagons, not rings.
- A trace of colour fringing at high contrast edges and a slight darkening toward the corners. Both barely visible.
- Motion blur from a shutter of `film.shutterDegrees` degrees.

## 5. Exposure, tone and colour

- Work in linear light. Apply one filmic tone curve after the samples are averaged. Highlights roll off: the small lights bloom to white at their centres and keep their colour around them.
- One grade for the whole film, set in the look lock against `winter-rest`, with a small shift per season: cool for winter, a little pink for spring, warm for summer, a little green in the shadows for fall.
- The slab is near black, not black. The darkest part of any frame still has tone.

## 6. Glow

- Bloom only from things that would bloom in a lens: the small lights, the flare, the icicles' brightest rims, the faces on the fall base. Soft and small.
- In the swap window the bloom of the new season's light is allowed to flood the frame for a few frames. That is the one place it is strong.
- The veil is lit by the inside lights, so a storm glows from within.

## 7. Grain and banding

- A fine film grain, added after the tone curve, the same in every season. It hides banding in the dark backdrop.
- Dither before writing eight bit pictures.
- The backdrop is smooth. The compression grid in the approved images is a fault of those files and is never copied.

## 8. Samples

- A computed frame is the average of its tier's samples, from `tiers`. Each sample has its own place in the pixel, its own point on the lens and its own moment in the shutter.
- The `final` tier must be enough for clean discs behind the globe and clean streaks in a storm. If it is not, the discs and the veil need a better technique, not a lower bar. `tiers.final` is never lowered.

## 9. Diagnostic views

`setDiagnostic` in the frame interface switches these on. Use them to find causes.

| View | Shows |
| --- | --- |
| `ids` | Which part each pixel belongs to, as flat colours |
| `standins` | Every stand-in in one loud colour |
| `albedo` | Colour with no light |
| `normals` | Surface direction |
| `depth` | Distance, with the refraction applied |
| `texels` | Texels per screen pixel, for measure M2 |
| `cover` | How much of the miniature is hidden by particles and veil at each pixel, for measure M4 |
| `flow` | The liquid's velocity on a slice through the sphere |
| `lightgrid` | The inside light on a slice through the sphere |
| `refraction` | The miniature with and without the lens, side by side |
| `change` | How far each seasonal part is through its change, for check G11 |

## 10. The ladder

When a picture falls short, move one rung at a time for that problem. The plateau rule in `kit/07-QUALITY-BAR.md` says when. Log each move. When a problem's rungs are used up it becomes an open item.

### A still does not match its approved image

1. Fit the camera, then the rig, against the comparison image: the size of the globe, where the highlights sit, which side is lit.
2. Fix the largest wrong thing first: a silhouette, a colour, a missing light.
3. Project the approved image onto the part and correct from the difference.
4. Make new material pictures for that part with the approved image as the reference.

### The glass reads as a plain ball, or the miniature looks stuck on behind it

1. Check the `refraction` view: the miniature must be larger with the lens than without it.
2. Add the through view of the room, small and upside down, behind the miniature.
3. Add the second reflection and the thickness at the rim.
4. Move to the named fallback in `kit/03-METHOD.md` section 2 and tune its strength against the approved image.

### The particles look like confetti or a filter

1. Spread them through the whole depth of the liquid and let the lens blur the near ones.
2. Give each kind its real shape and thickness.
3. Light them from the inside lights.
4. Vary size, turn and brightness more. Add the few very large near ones.
5. Raise the count toward `particles.tuneMax`.

### The storm does not hide the change

1. Raise the veil's density at the height of the storm.
2. Throw more of the resting particles into the liquid on the first stroke.
3. Lengthen the streaks: more particles close to the glass at the swap.
4. Move the switches inside the window to when the `cover` view is highest.
5. Strengthen the bloom.

### The shake looks keyed, light or mechanical

1. Sharpen the reversals and make the strokes unequal.
2. Add the lag: the liquid, the bubble and the tilt each trail the motion by a different amount.
3. Add weight to the lift and the set down: slower at the start, a firm stop, the settle.
4. Make the surroundings react: the mirror image, the shadow, the dressing.
5. Study the reference footage again and match its timing stroke by stroke.

### A base looks like plastic or a toy

1. Fix scale: detail too large makes a toy.
2. Add height: real relief on carving, stone, roots, thorns.
3. Fix the material: roughness that varies, edges that catch light, a little dust.
4. Seat it: the collar, the contact line, the mirror image.
5. Rebuild the big forms from the approved image's silhouette.

### The miniature looks like a low detail model

1. Add geometry where the silhouette is: roof edge, chimney, branches.
2. Give every surface height.
3. Rebuild the tree's crown with more and smaller pieces.
4. Move to the relief fallback for that thing.

### The small lights do not glow

1. Raise them until their centres clip and bloom.
2. Let them light what is near them through the grid.
3. Give each a small visible source: a bulb, a flame, a window pane.

### The surface or the mirror image looks wrong

1. Check the mirror image against the approved image: how sharp at the contact line, how fast it softens.
2. Add the coloured glow from the globe on the slab.
3. Add fine dust and the faintest unevenness to the polish.

### The discs behind the globe look fake

1. Use real emitters and more samples.
2. Vary their size, brightness and distance.
3. Soften their edges and squeeze the ones near the corners.

### An arrival looks like a wipe

1. Make its front irregular: frost grows in feathers, not in a circle.
2. Give it a cause that is seen: the water starts at the base, the fog pours from one place.
3. Slow it down and let it finish under the settling storm.

### The picture shimmers or crawls

1. Check that every sample moves in the pixel.
2. Filter small bright things: glitter, embers, string lights.
3. Give thin things a minimum width on screen: twigs, fence rails, the crack.

### The app would be slow on a visitor's machine

1. Lower the level's particle share, then its pixel ratio.
2. Switch the surface's mirror image to the baked one at the `low` level.
3. Simplify the veil at the lower levels.
4. Never change the computed frames for this.

### Slow gradients band

1. Check the dither.
2. Raise the grain slightly.
3. Keep the backdrop in floating point until the last step.
