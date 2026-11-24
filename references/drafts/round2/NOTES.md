# Snow globe reference run, round 2: NOTES

Reference run of 2026-11-23, round 2, for the snow globe showcase film. It made eight images of one glass snow globe on a dark polished surface: each of the four seasons at rest, and each of the four in the middle of a shake. It was not a build task.

Everything in this folder is a draft. Nothing here has been approved, so there is no `references/approved/` folder yet. Round 1 is one folder up, in `references/drafts/`.

The 30 take files were written between 20:36 and 22:34 UTC. Each shot was pushed when it was finished. The contact sheet and this file followed in a last commit.

The set was handed over for review before the open items at the end of this file were worked on. See "Independent review" and "Open".

## Layout

| Path | What |
| --- | --- |
| `keep/` | The best take of each shot as an exact 16:9 file. These eight are the references. |
| `<shot>-take<N>.png` | Every take of the run, 30 in all. `<shot>` is `<season>-rest` or `<season>-shake`. |
| `prompts/<shot>-take<N>.txt` | The exact prompt sent for that take. |
| `contact-sheet.jpg` | The eight kept images, 4 x 2. Top row at rest, bottom row mid-shake. Film order left to right: winter, spring, summer, fall. |

## The eight kept images

| Shot | File | Source | Size |
| --- | --- | --- | --- |
| Winter at rest | `keep/01-winter-rest.png` | `winter-rest-take5.png`, byte for byte | 2816 x 1584 |
| Spring at rest | `keep/02-spring-rest.png` | `spring-rest-take3.png`, byte for byte | 2816 x 1584 |
| Summer at rest | `keep/03-summer-rest.png` | `summer-rest-take4.png`, byte for byte | 2816 x 1584 |
| Fall at rest | `keep/04-fall-rest.png` | `fall-rest-take3.png`, byte for byte | 2816 x 1584 |
| Winter mid-shake | `keep/05-winter-shake.png` | `winter-shake-take5.png`, byte for byte | 2816 x 1584 |
| Spring mid-shake | `keep/06-spring-shake.png` | `spring-shake-take3.png`, byte for byte | 2816 x 1584 |
| Summer mid-shake | `keep/07-summer-shake.png` | `summer-shake-take3.png`, byte for byte | 2816 x 1584 |
| Fall mid-shake | `keep/08-fall-shake.png` | `fall-shake-take4.png`, byte for byte | 2816 x 1584 |

- Every kept image is the generator's output as it came back. Nothing was cropped, scaled, painted or composited afterwards.
- `keep/01-winter-rest.png` is the anchor. It went into every generation made after it was chosen, so the camera, the glass and the surface would match.
- Where the globe sits in the anchor, as a share of the frame: the glass runs from 30.5 to 69.7 percent of the width, its top is at 6.0 percent of the height, and the foot of the base is at 90.5 percent. Top of the glass to foot of the base is 84.5 percent of the frame height. The brief asks for about 80.

## What the brief fixed

- Keep: the miniature layout of the round-1 keeps (cottage left, tree right, pond in front, lamppost, fence, path), the glass quality, the winter frost, the fall crack and green fog.
- Camera: much closer, the globe and base about 80 percent of the frame height, centred. Macro lens, shallow depth of field.
- Setting: no room. One dark polished surface and a soft out-of-focus background. Outside the glass the season shows only through light colour, bokeh and what lies on the surface: frost in winter, petals in spring, sand in summer, dry leaves in fall.
- Light from inside the globe in every season.
- Particles far denser, clearly visible at many depths.
- More sculptural bases. Winter: carved dark wood and brass, icicles, snow on the ledge. Spring: living moss and roots, tiny mushrooms, a trickle of water. Summer: sandstone with seashells and sea glass, sand drifting off the edge, no driftwood. Fall: black wrought iron thorns, small lit jack-o-lantern faces, melted candle wax.
- Summer clearly different from spring: golden dusk, deep green tree, sunflowers, lanterns.
- Eight shots from one camera: four at rest and four mid-shake. Mid-shake means the globe full of swirling particles in a vortex, the scene half hidden, motion blur on the particles only.
- Winter at rest first, as the anchor for the other seven. Three takes of each shot, and at most five.
- 16:9. No people, no text, no logos. No animals except the fireflies in summer and the bats in fall.

## Every take

The images passed in are listed in the order they were passed, so "image 1" in a prompt is the first one named here.

- Anchor: `keep/01-winter-rest.png`.
- Round-1 keep: that season's kept image from round 1, `../keep/0N-<season>.png`. Round-1 crop: the same image cropped to the globe, not scaled.
- G1 and G2: the two real snow globe photographs carried over from round 1. S, V, D and T: four more real photographs. All six are listed under "Real photographs".
- Guide: a take with things pasted or painted into it by script. See "How the guides were made".

"Fresh" means the model drew the whole frame from the prompt and the images passed in. An edit starts from an earlier take and asks for a short list of changes. "From a guide" asks the model to photograph the guide for real.

The lists come from the run log. Where the log shows a call only in part (winter at rest takes 1 to 3, the first take of the other three at-rest shots, winter mid-shake take 1), the list was completed from the role the prompt gives each image.

### Winter at rest

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `winter-rest-take1.png` | Seedream 5 Pro | Fresh | Round-1 crop, round-1 keep, S, G1, G2 | Framing as asked. Snow specks in the air outside the glass. Loose snow on the surface, no frost growing out from the base. Frost only low on the glass. |
| `winter-rest-take2.png` | Seedream 5 Pro | Fresh, same images. The prompt adds a ring of fern frost on the glass, fern frost growing out from the base, a black mirror surface and unpainted carving. | Round-1 crop, round-1 keep, S, G1, G2 | Ring of fern frost on the glass, fern frost on the surface, air outside the glass empty. Snowfall thin. A large bubble at the top of the dome. |
| `winter-rest-take3.png` | Seedream 5 Pro | Edit of take 1 | `winter-rest-take1.png`, S, round-1 crop (most likely; the log is cut off at the third image) | Air outside the glass empty, fern frost on the surface, more frost on the glass. |
| `winter-rest-take4.png` | Seedream 5 Pro | Edit of take 2 | `winter-rest-take2.png`, G1 | About three times the snowfall, in near, middle and far layers. Pond frozen, bokeh on both sides, smaller bubble. Some empty patches in the snowfall. |
| `winter-rest-take5.png` | Seedream 5 Pro | Edit of take 4 | `winter-rest-take4.png`, G1 | Snowfall fills the liquid with no empty patches. **Kept. This is the anchor.** |

### Spring at rest

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `spring-rest-take1.png` | Seedream 5 Pro | Fresh | Anchor, round-1 crop, round-1 keep, G2 | Framing, glass and surface match the anchor. Base of mossy stone, roots and mushrooms with a trickle of water. Petals sparse. Windows dim, lamppost unlit. A window-like reflection on the upper right of the dome. |
| `spring-rest-take2.png` | Seedream 5 Pro | Edit of take 1 | `spring-rest-take1.png`, anchor | Warm windows, lit lamppost reflected in the pond, dawn mist, reflection gone. Petals still sparse. |
| `spring-rest-take3.png` | Seedream 5 Pro | From a guide | Guide (take 2 with petals and rain trails painted in), anchor | Dense petals at many depths, rain trails on the glass. **Kept.** |

### Summer at rest

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `summer-rest-take1.png` | Seedream 5 Pro | Fresh | Anchor, round-1 crop, round-1 keep, G2 | Framing, glass and surface match the anchor. Sandstone base with shells. Lanterns small. Seeds and fireflies sparse. Sea glass drawn as round glossy beads. A window-like reflection on the upper right of the dome. |
| `summer-rest-take2.png` | Seedream 5 Pro | Edit of take 1 | `summer-rest-take1.png`, anchor | Large lit paper lanterns from the cottage to the tree, reflection gone, sand running off the ledge, bright caustic lines on the surface. Seeds and fireflies still sparse. Sea glass still beads. |
| `summer-rest-take3.png` | Seedream 5 Pro | From a guide | Guide (take 2 with seeds and fireflies painted in and the sea glass roughly repainted), anchor | Dense seeds and fireflies at many depths. The sea glass came back as flat chips that read as painted. |
| `summer-rest-take4.png` | Seedream 5 Pro | Edit of take 3 | `summer-rest-take3.png`, anchor | Frosted sea glass in aqua, green and cobalt. Seeds and fireflies held. **Kept.** |

### Fall at rest

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `fall-rest-take1.png` | Seedream 5 Pro | Fresh | Anchor, round-1 crop, round-1 keep, G2 | Crack at the upper left, green fog, wax and cobwebs on a base of twisted iron. Few thorns. Two lit faces with a shapeless fire opening between them. Leaves and embers sparse. A window-like reflection on the upper right of the dome. |
| `fall-rest-take2.png` | Seedream 5 Pro | Edit of take 1 | `fall-rest-take1.png`, anchor | Came back almost unchanged. |
| `fall-rest-take3.png` | Seedream 5 Pro | From a guide | Guide (take 1 with the reflection narrowed, a third face, two thorn rings and many leaves and embers pasted in), anchor, T | Dense leaves and embers at many depths, forged thorn rings, three lit faces, a narrow highlight where the reflection was. **Kept.** |

### Winter mid-shake

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `winter-shake-take1.png` | Seedream 5 Pro | Fresh from the anchor | Anchor, V, D, round-1 crop | A milky vortex. The snow reads as haze more than as separate flakes, and the miniature is clear of it. |
| `winter-shake-take2.png` | Seedream 5 Pro | Edit of take 1 | `winter-shake-take1.png`, V | Separate streaked flakes, but wound into one tornado-like plume across the tree. |
| `winter-shake-take3.png` | Seedream 5 Pro | From a guide | Guide (anchor with a painted vortex), anchor, V, round-1 crop | One rotation of streaked snow round the scene. The miniature is almost entirely clear of the storm. |
| `winter-shake-take4.png` | Seedream 5 Pro | From a guide | Guide (anchor with a heavier painted vortex), V, anchor | About half hidden, lights glowing through. The frost ring on the glass is mostly lost. |
| `winter-shake-take5.png` | Seedream 5 Pro | From a guide | Guide (take 4 with the anchor's frost laid back on the glass), V, anchor | Frost ring back. The tree crown is fairly clear of the storm. **Kept, at the five-take limit.** |

### Spring mid-shake

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `spring-shake-take1.png` | Seedream 5 Pro | From a guide | Guide (spring at-rest keep with a painted vortex), spring at-rest keep, V, anchor, round-1 crop | The storm came back thinned. The miniature is mostly clear. |
| `spring-shake-take2.png` | Seedream 5 Pro | From a guide | Guide (heavier painted vortex), V, anchor | Crisp streaked petals. About a third of the miniature hidden. |
| `spring-shake-take3.png` | Seedream 5 Pro | From a guide | Guide (painted vortex, heavier again), V, anchor | A clear vortex, about two thirds hidden, windows and lamppost burning through. **Kept.** |

### Summer mid-shake

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `summer-shake-take1.png` | Seedream 5 Pro | From a guide | Guide (summer at-rest keep with a painted vortex), summer at-rest keep, V, anchor, round-1 crop | The storm came back thinned. The miniature is mostly clear. |
| `summer-shake-take2.png` | Seedream 5 Pro | From a guide | Guide (heavier painted vortex), V, anchor | A thicker golden storm. Seeds and firefly trails in the air outside the glass. The stream of sand off the ledge is gone. |
| `summer-shake-take3.png` | Seedream 5 Pro | From a guide | Guide (take 2 with bands of its own storm laid over the cottage and the tree, and everything outside the glass taken from the at-rest keep), V, anchor | Cottage and tree veiled, lanterns glowing through, nothing outside the glass, sand stream back. **Kept.** |

### Fall mid-shake

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `fall-shake-take1.png` | Seedream 5 Pro | From a guide | Guide (fall at-rest keep with a painted vortex), fall at-rest keep, V, anchor, round-1 crop | The miniature is mostly clear. The crack grew. |
| `fall-shake-take2.png` | Seedream 5 Pro | From a guide | Guide (heavier painted vortex), V, anchor | A believable storm of streaked leaves, embers and fog. Cottage and tree still mostly clear. The door turned glowing green and the left window orange. |
| `fall-shake-take3.png` | Seedream 5 Pro | From a guide | Guide (take 2 with bands of its own storm laid over the cottage and the tree), V, anchor | Cottage veiled. The door still glows green and the left window orange. |
| `fall-shake-take4.png` | Seedream 5 Pro | From a guide | Guide (take 3 with the at-rest door and left window pasted back, storm bands over the tree, and everything outside the glass taken from the at-rest keep), V, anchor | Door dark wood, windows green and purple, branches veiled, about half hidden, bats near the top, hairline crack, green fog. **Kept.** |

Counts: winter at rest 5, spring at rest 3, summer at rest 4, fall at rest 3, winter mid-shake 5, spring mid-shake 3, summer mid-shake 3, fall mid-shake 4. 30 in all.

## Faults seen in the kept images

- All eight: the globe and base take 84.5 percent of the frame height, not about 80. The anchor used all five of its takes, and the other seven are locked to it.
- All eight: a faint 8-pixel compression grid in the dark background. It comes from the JPEG data the generator returns. In dark areas (below 40 on a 0 to 255 scale) the mean step across a block edge is 1.35 to 1.82 levels, against 0.47 to 0.94 inside a block. It shows at 100 percent and not at contact-sheet size.
- Winter at rest: the snowfall is not far denser than in round 1. In the open liquid above the cottage the reviewer counted 296 flakes against 231 in the round-1 keep, covering 12.0 percent against 9.7. Most flakes are one size, and few are large ones close to the glass.
- Winter at rest: a faint pale band at the far left of the frame. A small bubble at the top of the dome, which is nearly gone in the mid-shake shot.
- Summer at rest: the shells are few, and the sandstone is only moderately sculptural.
- Summer, both shots: the caustic on the surface left of the base reads as thin gold veins running out from one point, not as a pool of refracted light.
- Fall at rest: thorn stems cross parts of the lit faces. The crack is fine and branching, not a single hairline. The glass is drawn 2.5 percent larger than the anchor's.
- Fall, both shots: the black iron base is dark against a dark surface and loses its shape at small sizes.
- Winter mid-shake: the tree crown is fairly clear of the storm, so less than half of the scene is hidden.
- Spring mid-shake: the blossom crown is soft. The rain trails on the upper left of the glass are missing, and there are fewer beads than at rest.
- Summer mid-shake: dark green leaf fragments fly in the storm and the crown looks partly shredded. The take-3 prompt asked for a few torn leaves. The fireflies read pale, not yellow-green.
- Fall mid-shake: the miniature does not match fall at rest. The jack-o-lantern at the foot of the tree is about 120 px wide, flattened and has no face. At rest it is 68 px wide with a carved grin. A second orange lump sits at the lower right, where the at-rest image has rocks and grass. The tree is thinner, branches differently, has a paler trunk and has lost its ember lights.

## How the shots were checked against each other

- The anchor's glass circle was drawn over every at-rest keep. At 2816 x 1584 the anchor's glass has its centre at (1411, 647) and a radius of 552. Spring and summer sit on that circle. Fall has its centre at (1418, 656) and a radius of 566.
- Each mid-shake keep was compared with its at-rest keep outside the glass, where nothing should move. The mean absolute difference, on a 0 to 255 scale, is 5.65 for winter, 6.66 for spring, 5.14 for summer and 4.05 for fall. For scale, two different seasons at rest differ by 25.57 over the same area (winter against spring). Inside the glass the same pairs differ by 50.71, 42.35, 46.00 and 46.58.
- Summer against spring, at rest: the two differ by 31.72 outside the glass, more than winter and spring do. The whole-frame average colour has a hue of 35 degrees in summer (amber) and 353 degrees in spring (pink). Winter is 209 degrees (blue).
- Every kept image was read at full size and in enlarged crops of the dome, the miniature, the base and the surface.

## Independent review

After the eight shots were kept, a reviewer that had seen only the two briefs, the showcase rules and the eight kept images scored the set 8.5 out of 10. The bar for delivery is 9 with no must-fixes, so the set does not pass yet.

| Shot | Score |
| --- | --- |
| Winter at rest | 8 |
| Spring at rest | 9 |
| Summer at rest | 9 |
| Fall at rest | 9.5 |
| Winter mid-shake | 9 |
| Spring mid-shake | 9 |
| Summer mid-shake | 8.5 |
| Fall mid-shake | 8 |

Found good: the same camera and layout in all eight, each pair registered to within 2 to 4 px outside the glass, summer clearly different from spring, the setting, the bases, the light from inside, no text and no people.

Must-fixes named by the reviewer:

1. Winter at rest: the snowfall is not far denser than in round 1.
2. Fall mid-shake: the pumpkins and the tree differ from fall at rest.
3. All eight: the compression grid in the dark background.

The other points it raised are in "Faults seen in the kept images". Each was confirmed by eye in enlarged crops.

## Open

None of the three must-fixes is fixed. The set was exported for review first.

| Shot | Takes used | Takes left |
| --- | --- | --- |
| Winter at rest | 5 | 0 |
| Spring at rest | 3 | 2 |
| Summer at rest | 4 | 1 |
| Fall at rest | 3 | 2 |
| Winter mid-shake | 5 | 0 |
| Spring mid-shake | 3 | 2 |
| Summer mid-shake | 3 | 2 |
| Fall mid-shake | 4 | 1 |

What each open point needs:

- Fall mid-shake, take 5, the last one: a guide built from take 4 with the at-rest tree, its ember lights, the small jack-o-lantern and the ground showing through the storm. The prompt drops the lines that ask for faint, grey-green, broken branches. The better of takes 4 and 5 is kept.
- Summer mid-shake, take 4: the at-rest crown showing through the storm, no leaf fragments, yellow-green firefly trails.
- Spring mid-shake, take 4: the at-rest rain trails and beads laid back onto the glass.
- Summer at rest, take 5, the last one: the caustic repainted as a soft pool with a few broad curved bands. It is only worth keeping if the inside of the globe comes back unchanged and the mid-shake shot is then matched to it.
- Compression grid: no take needed. The block edges can be smoothed in the flat dark areas of the eight keeps, with a fine dither against banding. The keeps would then no longer be byte for byte the takes.
- Winter at rest snow density, and the dome bubble that differs between the two winter shots: blocked. Both winter shots are at the five-take limit.

## Models

- Seedream 5 Pro (`seedream_5`) made all 30 takes. It returns 2816 x 1584, exactly 16:9. It returned JPEG data in a file named `.png`. Each take was saved again as a real PNG with the same pixels.
- Nano Banana Pro was not used in this round.
- Seedream 5 Pro follows a guide closely when no calm picture of the same season is among the images passed in. It still thins a guide's storm by roughly half, so the guides were built more hidden than the result was meant to be.

## How the guides were made

A guide is a take with rough changes laid into it by script. It is only ever an input: the prompt says that parts of it were pasted in by hand and asks for the same picture photographed for real. No guide is in this repository, and no kept image is a guide.

- Particles at rest (spring take 3, summer take 3, fall take 3): petals, seeds and fireflies, or leaves and embers were painted into the liquid in three depth layers, so the count and the depth were fixed before the model drew them.
- Fall base (fall take 3): the window-like reflection was narrowed to one soft highlight, the left lit face was copied to the middle of the base, and two rings of forged thorns cut from photograph T were laid round the base and darkened.
- Painted vortex (winter mid-shake takes 3 and 4, and the first two mid-shake takes of the other seasons, plus spring take 3): motion-streaked particles at three depths and a turning haze were painted inside the glass of the at-rest keep, with the lights of the miniature showing through.
- Storm bands (summer mid-shake take 3, fall mid-shake takes 3 and 4): the model kept clearing the storm away from the cottage and the tree. Bands of the previous take's own storm were laid over them. For summer take 3 and fall take 4, everything outside the glass was taken from the at-rest keep.
- Frost (winter mid-shake take 5): the anchor's ring of fern frost was laid back onto the glass of take 4.
- Door and window (fall mid-shake take 4): the door and the left window of the at-rest keep were pasted back over take 3.

Every mid-shake shot starts from its season's at-rest keep or from the take before it. That is why the base, the surface and the background do not change between the two shots of a season.

## Real photographs

Six photographs by other people were passed in as references. They are not in this repository.

| Name | Used for | Source |
| --- | --- | --- |
| G1 | Flakes hanging at many depths in the liquid, soft thick dome glass. Winter at rest takes 1, 2, 4 and 5. | A Viennese snow globe with St. Stephen's Cathedral, photo by Martin Betz for Österreich Werbung. Page: https://www.austria.info/en-gb/inspiration/snowglobes/ Image: https://fuutazbsb.filerobot.com/Freigegeben/Schneekugel-Stephansdom_Oesterreich-Werbung_Martin-Betz.jpeg |
| G2 | Clear heavy glass with curved reflections and lens-like refraction. Winter at rest takes 1 and 2, and the first at-rest take of spring, summer and fall. | Photo by lilartsy on Pexels. Image: https://images.pexels.com/photos/3403893/pexels-photo-3403893.jpeg |
| S | A globe standing on a black polished surface with a soft mirror reflection and bokeh lights behind. Winter at rest takes 1, 2 and 3. | "Christmas Snow Globe on Glass Surface", photo by Sadik Brika on Pexels. Page: https://www.pexels.com/photo/14919312/ Image: https://images.pexels.com/photos/14919312/pexels-photo-14919312.jpeg |
| V | Particles streaked by motion in swirling liquid, with a lit house glowing through. Every mid-shake take. | "Christmas snowglobe", photo by Darren Coleshill, CC0. Page: https://commons.wikimedia.org/wiki/File:Christmas_snowglobe_(Unsplash).jpg Original: https://unsplash.com/photos/GAJ4g8f7FBk |
| D | How thick a storm of flakes gets and how the scene is lost behind it. Winter mid-shake take 1 only. | A photograph on Unsplash. The photographer was not identified. Image: https://images.unsplash.com/photo-1510995574575-fd5cd3ad4968 Found through: https://unsplash.com/s/photos/snow-globe |
| T | Forged iron thorns. Fall at rest take 3, and the thorn rings pasted into its guide. | "Bombenopfer Einzelgrabanlage Dornenkrone3.jpg", photo by Vitavia, CC BY-SA 4.0. It shows the iron crown of thorns sculpture by Egon Lissow at Ohlsdorf Cemetery, Hamburg. Page: https://commons.wikimedia.org/wiki/File:Bombenopfer_Einzelgrabanlage_Dornenkrone3.jpg Image: https://upload.wikimedia.org/wikipedia/commons/0/0d/Bombenopfer_Einzelgrabanlage_Dornenkrone3.jpg |

Each was cropped before use. G3 from round 1 was not used.

## Assumptions

- 84.5 percent of the frame height was accepted as "about 80 percent", and all eight shots are locked to the anchor's framing.
- The surface is close to black piano gloss. The background is darkness and season-coloured bokeh only. Nothing floats in the air outside the glass.
- "Pass the four keep images as references" was read as each season's round-1 keep going into that season. Each went into the first at-rest generation of its season, whole and as a crop. The crop also went into the first mid-shake generation. Later mid-shake takes drop the calm pictures of the same season, because they pulled the storm back to calm, and the layout reaches them through the guide.
- The mid-shake shots show the globe standing still on the surface an instant after the shake, with the liquid still turning. Only the particles are blurred.
- The contact sheet is 4 x 2 with one caption line under each cell: season, state and the number of the kept take. Nothing is drawn on the images.
