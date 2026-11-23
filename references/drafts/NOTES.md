# Snow globe reference run: NOTES

Reference run of 2026-11-23 for the snow globe showcase film. It made four images of one glass snow globe on a windowsill, one per season, each at rest. It was not a build task.

Everything in this folder is a draft. Nothing here has been approved, so there is no `references/approved/` folder yet.

The 17 take files were written between 19:00 and 19:44 UTC, before this repository was created. The files were added afterwards in one commit.

## Layout

| Path | What |
| --- | --- |
| `keep/` | The best take of each season as an exact 16:9 file. These four are the references. |
| `<season>-take<N>.png` | Every take of the run, 17 in all. |
| `prompts/<season>-take<N>.txt` | The exact prompt sent for that take. |
| `contact-sheet.jpg` | The four kept images side by side in film order: winter, spring, summer, fall. |

## The four kept images

| Season | File | Source | Size |
| --- | --- | --- | --- |
| Winter, Christmas | `keep/01-winter.png` | `winter-take5.png`, trimmed | 2720 x 1530 |
| Spring | `keep/02-spring.png` | `spring-take2.png`, byte for byte | 2816 x 1584 |
| Summer | `keep/03-summer.png` | `summer-take4.png`, trimmed | 2720 x 1530 |
| Fall, Halloween | `keep/04-fall.png` | `fall-take4.png`, trimmed | 2720 x 1530 |

- Trimmed means cropped, never scaled. Nano Banana Pro returns 2752 x 1536, a little wider than 16:9. The trim removes 16 px from each side and 3 px from the top and from the bottom. Every pixel that remains is unchanged.
- `keep/01-winter.png` is the anchor. It went into the later generations as an input so the camera, the layout and the room would match.
- Where the globe sits in the anchor, as a share of the frame: the glass runs from 35.7 to 64.6 percent of the width, its top is at 20.2 percent of the height, and the foot of the base is at 79.8 percent. Top of the glass to foot of the base is 59.6 percent of the frame height.

## What the brief fixed for all four

- Camera: slightly below eye level, three-quarter view, the globe centred and about 60 percent of the frame height.
- Miniature: a small stone cottage left of centre, one large tree right of centre, a small pond in front, one lamppost, a low fence, a short path to the door.
- Room: the same wooden windowsill, window and room. Only the light and the season change.
- 16:9. No people, no text, no logos. No animals except the fireflies in summer and the bats in fall.
- Three takes of each season, and at most five.

## Every take

The images passed in are listed in the order they were passed, so "image 1" in a prompt is the first one named here. G1, G2 and G3 are the three real photographs listed under "Real photographs". The anchor is `keep/01-winter.png`.

"Fresh" means the model drew the whole frame from the prompt and the images passed in. A pull-back and a cleanup both start from an earlier take. See "How the pull-backs were made".

### Winter, Christmas

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `winter-take1.png` | Seedream 5 Pro | Fresh | G1, G2, G3 | Globe far too large, about 82 percent of the frame height. Frost drawn as snowflake shapes. |
| `winter-take2.png` | Nano Banana Pro | Fresh, same prompt as take 1 | G1, G2, G3 | Globe too large and right of centre. A brighter, different room. |
| `winter-take3.png` | Seedream 5 Pro | Pull-back attempt | Take 1 at 72.5 percent on a blurred extension of itself, G1, G2, G3 | Came back at the same tight framing as take 1. |
| `winter-take4.png` | Nano Banana Pro | Pull-back of take 1 | Take 1 at 70.7 percent on a grey canvas, G1, G2, G3 | Framing right, natural frost, lights on the eaves. A lit lamp in the room and a ghost reflection of the globe in the right-hand window. |
| `winter-take5.png` | Nano Banana Pro | Cleanup of take 4 | `winter-take4.png`, G1, G2, G3 | Lamp and ghost reflection gone, room softer, base carved. **Kept. This is the anchor.** |

### Spring

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `spring-take1.png` | Nano Banana Pro | Fresh | Anchor, G1, G2, G3 | Reads as plastic. Oversized flowers. Cottage redesigned with a blue roof. |
| `spring-take2.png` | Seedream 5 Pro | Fresh, same prompt as take 1 | Anchor, G1, G2, G3 | Framing, room and cottage match the anchor. **Kept.** |
| `spring-take3.png` | Seedream 5 Pro | Fresh. The prompt asks for heavy drops with long trails, many more flowers on the base and tulips round the pond. | Anchor, G1, G2, G3 | Heavier beads on the glass and more flowers, but the globe is about 66 percent of the frame height and the sill is brighter. |

### Summer

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `summer-take1.png` | Seedream 5 Pro | Fresh | Anchor, G1, G2, G3 | Glass about 20 percent wider than in the anchor. A dandelion seed and a few firefly dots outside the glass. |
| `summer-take2.png` | Nano Banana Pro | Pull-back of take 1 | Take 1 at 80.5 percent on a grey canvas, anchor, G1, G2, G3 | Framing matches. Room brighter, armchair shifted. |
| `summer-take3.png` | Seedream 5 Pro | Fresh. The prompt locks the framing with numbers. | Anchor, G1, G2, G3 | Framing, room and cottage match the anchor. Base of stacked driftwood and sand. A few fireflies and one seed outside the glass, and chimney smoke. |
| `summer-take4.png` | Nano Banana Pro | Cleanup of take 3 | `summer-take3.png`, G1, G2, G3 | Fireflies and seed outside the glass gone, smoke gone. **Kept.** |

### Fall, Halloween

| File | Model | What it is | Images passed in | Outcome |
| --- | --- | --- | --- | --- |
| `fall-take1.png` | Seedream 5 Pro | Fresh | Anchor, G1, G2, G3 | Glass about 31 percent wider than in the anchor. Cottage redesigned as a steep-roofed witch's house. |
| `fall-take2.png` | Nano Banana Pro | Pull-back of take 1 | Take 1 at 73.9 percent on a grey canvas, anchor, G1, G2, G3 | Framing matches. Still the steep-roofed cottage. Window panes nearly solid black. |
| `fall-take3.png` | Seedream 5 Pro | Fresh. The prompt locks the framing with numbers and asks for the anchor's cottage. | Anchor, G1, G2, G3 | Keeps the anchor's cottage. Glass about 11 percent wider than in the anchor. Four candles. Leaves on the sill. |
| `fall-take4.png` | Nano Banana Pro | Pull-back of take 3 | Take 3 at 87.1 percent on a grey canvas, anchor, G1, G2, G3 | Framing matches. The prompt also asked for a bare sill and three candles. Neither happened. **Kept.** |
| `fall-take5.png` | Nano Banana Pro | Cleanup of take 4 | `fall-take4.png`, G1, G2, G3 | Sill bare, three candles. The candles and their reflections in the window came back larger. Not kept for that reason. |

Counts: winter 5, spring 3, summer 4, fall 5.

## Faults seen in the kept images

- Winter: none flagged.
- Spring: the rain beads mostly sit still on the glass and do not run. The flowers on the base are small.
- Summer: small bulb lights along the cottage eaves read as a carry-over of the winter string lights. The paper lanterns are small.
- Fall: four lit candles on the sill where the other seasons have three.
- Fall: a few fallen leaves on the sill, outside the glass.
- Fall: the crack in the glass is forked, not a single hairline.
- Fall: a faint wisp of chimney smoke, which the brief lists only for winter.
- Fall: the iron base stands a little taller than the other three.
- Fall: the window behind the globe is drawn about 3 to 5 percent of the frame width further left than in the other three. The wide window post sits at about 70.5 to 76.5 percent of the width, against 73 to 80 percent in winter, spring and summer.

## How the four were checked against each other

- The outline of the anchor's glass was laid over each kept image. The glass lines up in all four.
- The window was measured. In winter, spring and summer the wide window post runs from 73 to 80 percent of the frame width. In fall it does not, as listed above.
- The rest of the room was compared by eye at reduced size. The bookshelf, the armchair, the curtain and the candles sit in the same places in all four. Winter, spring and summer have three unlit candles. Fall has four lit ones.

## Models

- Seedream 5 Pro (`seedream_5`) made 8 takes, all of them fresh except `winter-take3.png`. It returns 2816 x 1584, exactly 16:9. It returned JPEG data in a file named `.png`. Each of those takes was saved again as a real PNG with the same pixels.
- Nano Banana Pro (`nano_banana_pro`) made 9 takes: two fresh ones (`winter-take2.png`, `spring-take1.png`), every pull-back on a grey canvas and every cleanup. It returns a real PNG at 2752 x 1536.
- Each cleanup was given only the take it cleans up and the three photographs.

## How the pull-backs were made

A fresh take often came back with the globe too large in the frame. A pull-back fixes the framing without drawing the globe again from nothing.

- The take is scaled down and pasted onto a flat grey 2752 x 1536 canvas.
- For summer and fall it is scaled and placed so that its glass lands where the anchor's glass sits: same width, same centre, same top.
- Winter had no anchor yet. Take 1 was scaled to 70.7 percent, which brings its globe from about 82 to about 60 percent of the frame height.
- The model is asked to fill the grey area with the rest of the room and to keep the picture in the middle as it is. It still redraws the whole frame, so small details in the middle can shift.
- `winter-take3.png` tried the same thing on Seedream 5 Pro, with a blurred extension of the take in place of the grey. It did not hold the framing.

## Real photographs

Three photographs of real glass snow globes went into every generation, as references for how glass and liquid behave. They are other people's photographs and are not in this repository.

| Name | Used for | Source |
| --- | --- | --- |
| G1 | Flakes hanging at many depths in the liquid, soft thick dome glass | A Viennese snow globe with St. Stephen's Cathedral, photo by Martin Betz for Österreich Werbung. Page: https://www.austria.info/en-gb/inspiration/snowglobes/ Image: https://fuutazbsb.filerobot.com/Freigegeben/Schneekugel-Stephansdom_Oesterreich-Werbung_Martin-Betz.jpeg |
| G2 | Clear heavy glass with curved reflections of the room and lens-like refraction | Photo by lilartsy on Pexels. Image: https://images.pexels.com/photos/3403893/pexels-photo-3403893.jpeg Found through: https://www.pexels.com/photo/snow-globe-on-windowsill-14718603/ |
| G3 | A small house standing in liquid with flakes in front of it and behind it | Austrian snow globes, Heirloom Art Co. Page: https://www.heirloomartco.com/products/snow-globes Image: https://www.heirloomartco.com/cdn/shop/files/9F3A0972.jpg?v=1699901202 |

Each was cropped to the globe before use. Twenty candidate photographs were found. Five did not download and were dropped.
