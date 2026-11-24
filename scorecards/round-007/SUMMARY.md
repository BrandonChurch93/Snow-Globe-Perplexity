# Round 7 · winter (Phase 3, the look lock; winter's fifth round, the last `quality.lookLockMaxRounds` allows, an extra round)

Judged commit `4f10d97` (engine hash `ff72ea5c293221f1`). Frozen 2026-11-24 22:16 UTC; the last answer arrived 23:28 UTC (R3 part 2). Stills at the `final` tier from the `full` set, motion sheets at `review`.

## Scores

| Role | Part | What it saw | Asked on | Score | Severe | Major | Minor |
| --- | --- | --- | --- | --- | --- | --- | --- |
| R1 | | The two keys beside the approved images, and crops | `gpt_6_2_sol` | 7 | 2 | 7 | 1 |
| R2 | | 15 jurors on three judged stills; the 10 votes on the two controls reused (decision 62; the controls' bytes equal Round 6's) | five families | fails | | | |
| R3 | 1 | Judged stills and native crops: hero at rest, landed, interior | `grok_4_7` | 7 | 0 | 2 | 2 |
| R3 | 2 | Judged stills and native crops: base, surface, settled | `gemini_4_carbon` | 5 | 0 | 7 | 1 |
| R3 | 3 | Judged still and native crops: macro | `claude_opus_5_5` | 5 | 0 | 6 | 5 |
| R4 | 1 | Ten sheets: the lift, the strokes, the set down, the first second after the landing | `pplx_computer_glm_5_3_1009` | 7 | 1 | 2 | 0 |
| R4 | 2 | Two sheets: the whole shake with its clearing; the globe at rest, frames 288 to 575 (decision 67) | `kimi_k3` | 4 | 1 | 2 | 2 |

A role split across critics takes the lowest score and every issue: R1 is 7, R3 is 5 (parts 7, 5 and 5), R4 is 4 (Round 6: 5, 5, 5; Round 5: 5, 6, 3; Round 4: 5, 4, 5; Round 3: 4, 3, 3). R2: 4 of 15 jurors took a judged still for a photograph or a film frame (rest 1 of 5, landed 2 of 5, settled 1 of 5; all four votes were for a film frame, none for a photograph) against 7 of 10 for the controls; the bar is a share of 0.5, so R2 fails and counts as one major issue. Machine checks: all 15 green on a clean clone (419 of 423 tests, 4 skipped; `gate.log`). Measures at `final`: 24 of 24 lines, 0 red (stamped 2026-11-24T23:04:59Z). M3 on `winter-rest` reads 0.9203 against 0.75, the base at 0.920 and the miniature at 0.931 of the approved image's fine detail (red at 0.7186 in Round 6); M4 0.9922 against 0.85; M5 0.9994 against 0.6.

Counted over all the answers: 4 severe and 27 major issues (R1 2 and 7; R3 0 and 15; R4 2 and 4; R2's failure as 1 major), and 11 minor (R1 1, R3 8, R4 2).

The pass bar asks green checks and measures, R1, R3 and R4 at 9 or more with no severe or major issue open, R2 passing, and every judged still at `final`. Round 7 does not pass: the checks and the measures are green and every judged still is at `final`, but R1 gave 7, R3 5 and R4 4 where 9 is asked, four severe and twenty-seven major issues are open, and R2 fails. Against Round 6: likeness rose from 5 to 7; craft's parts gave 7, 5 and 5 where Round 6's gave 5, 8 and 7, so the role's lowest holds at 5; motion's parts gave 7 and 4 where Round 6's gave 5 and 6, so the role's lowest fell by one; the jury fell by one vote. Severe issues went from three to four. Round 6's red measure is green. Round 7 was the last round the count allows (`quality.lookLockMaxRounds` 5, Rounds 3 to 7), so the look lock ends on the count without a pass, and every open severe and major issue is written under "Open items".

## What the critics found, severe first

By part of the picture. The role, the severity and the neutral file name stand before each quote.

The storm:
- R1, severe, `set-B-01-a.jpg` (R1 names a pair by its `-a` file; the judged still of the pair is `set-B-01-b.jpg`, winter in the landed state from `hero`): "The candidate reads as a tight circular vortex made of broad continuous white ribbons. The target mixes finer broken streaks and individually lit flecks at several depths, with a softer snow cloud near the floor. The intended extra occlusion is not the problem."
- R4 part 1, major, `set-D-02.jpg` (the first second after the landing): "The storm clearly outlasts the glass motion, but the brightest snow remains a broad smear across the lower glass as the tree reappears. The end reads more as the mist thinning than distinct flakes slowing and settling."
- R4 part 2, major, `set-E-01.jpg` (the whole shake and its clearing): "the snow storm is a uniform milky whiteout that fills the sphere evenly from edge to edge, reading as an opacity fade; there is no lag behind the glass, no slam and no folding storm structure".
- R4 part 2, major, `set-E-01.jpg`: "the fog clears as a global fade across the whole sphere at once rather than snow falling and settling downward; visibility returns everywhere simultaneously".

The tabletop:
- R1, severe, `set-A-01-a.jpg` (the rest pair, "also in set B"): "The dark tabletop loses the readable mirror image of the gold foot, warm pinpoint highlights and cool bright right rim. Broad flat white skid-like marks and a heavy contact band replace the target's scattered, raised frost and snow."
- R4 part 1, severe, `set-B-03.jpg` (the strokes, 1.50–1.73 s) and `set-D-01.jpg` (after the landing, 2.40–2.77 s): "The wood and tabletop flash orange as the large winter snow patches vanish, then the patches visibly grow back from the base after touchdown. The outdoor powder changes more conspicuously than the globe lands."
- R3 part 2, major, `set-F-03.jpg` (native size crops of winter in the settled state from `hero`; crops 9, 11 and 12; its first half is inside the glass): "spiky white frost cards stick straight up out of the interior snow bank with hard cutout edges, and the large fern-frost fronds on the dark surface have thick opaque slab edges with an abrupt jump between bright blue-white and dark brown fronds on the left".

The shake:
- R4 part 2, severe, `set-E-01.jpg`: "the globe never moves during the shake: outline, base and reflection are pixel-stable in every frame, with no lift, no tilt and no displacement; the shake is conveyed only by the interior fogging up, so the globe reads as weightless and untouched rather than a heavy thing in a hand".
- R4 part 1, major, `set-A-02.jpg` (the lift, 0.40–0.57 s) and `set-C-02.jpg` (the set down): "The globe glides sideways on an almost level lift and eases into contact with little visible load transfer. The strokes do have clear reversals, but the endpoints make the plinth feel light."

The glass:
- R1, major, `set-A-02-a.jpg` (crops of the rest pair, "also in set B"): "The top oval is bigger and reads as an outlined bubble cap; the right-hand white reflection is rounder and more blurred and the shell edge reads like a comparatively thin blue outline. The frost is coarser and more regularly combed along the left edge, with some separate stenciled tufts near the floor, instead of dissolving into the thickness of the glass."
- R3 part 1, major, `set-A-02.jpg` (crops of the rest still): "the rim has two edges, so the wall has thickness, but the cottage, fence, and tree stay straight and the same size up to the glass. The liquid does not bend or enlarge them. The closer rim crops in set-C-02.jpg and set-C-03.jpg show the same thing".
- R3 part 1, major, `set-A-02.jpg`: "a hard-edged elliptical ring sits on the glass, apart from the soft discs of light behind it. The same shoulder is in set-B-02.jpg".
- R3 part 2, major, `set-F-01.jpg` (winter in the settled state from `hero`): "the globe has an air-bubble ring at its crown as if filled with water, yet the cottage, tree, and background inside are not bent or enlarged by liquid at all, and the background bokeh lights vanish behind a flat dark backdrop inside the rim".

The flakes in the settled still:
- R3 part 2, major, `set-F-02.jpg` (crops of the settled still, crops 5 and 6): "despite very shallow macro depth of field on the table and background bokeh, none of the snow particles blur out of focus near the glass; sharp small flecks sit directly over the blurred foreground snow bank".

The miniature:
- R1, major, `set-A-02-a.jpg`, the cottage: "The cottage is bulkier, the roof rises higher and has a thick smooth overhang on the right, and the wall is made of chunkier high-contrast cobbles. The target's neatly framed arched door, distinct stepped threshold and delicate fence give way to a less legible door surround and heavier rails and posts."
- R1, major, `set-A-02-a.jpg`, the tree: "The target has finely layered snow-covered boughs, a wide twisted bark trunk and small embedded lights. The candidate has clumpier isolated snow caps, cleaner glossy orange branches and prominent clusters of uniformly bright bulbs."
- R1, major, `set-A-02-a.jpg`, the pond: "The pond reads wider and flatter gray, with a blunt dark edge and a broad blurry gold pool. The target has irregular snowy banks, a more textured blue surface and a compact sparkling lamp reflection."
- R1, major, `set-B-02-a.jpg` (crops of the landed pair), the lamp's light: "An oversized yellow bloom from the lamp floods the cottage front and door; the target shows a defined lantern, a restrained pool low in the snow, and crisp warm lights along the gable where it shows through. This is light spill rather than the intended storm occlusion."
- R3 part 3, major, `set-G-01.jpg` (the macro still): "the snow is a grey rectangular block with near-vertical sides and a flat top. It sits on the foliage like a box or a stray chimney, not like snow that has settled on leaves".
- R3 part 3, major, `set-G-01.jpg`: "the wood is smooth tubes with a stretched, swirled painted grain and no bark relief. The knot is a flat painted swirl. The branches look like one smooth cartoon shape, not a carved miniature".
- R3 part 3, major, `set-G-03.jpg` (crops of the macro still): "a fan-shaped patch with radial lines and a hard notch in the trunk outline read as a geometry or texture seam".
- R3 part 3, major, `set-G-03.jpg`: "the roots end on a hard, clean line on top of the snow, with no sinking in, no snow piled against them and no contact shadow. The tree looks placed on the ground rather than growing out of it".
- R3 part 3, major, `set-G-02.jpg` (crops of the macro still): "the roof snow is a smooth clay-like shell in a flat salmon tint, with diagonal streaks like brush strokes. It has no sparkle, no grain and no texture at the eave edge, so it reads as a painted plastic cap".
- R3 part 3, major, `set-G-03.jpg`: "the lower black strap runs past the door edge onto the stone wall and ends in an arrow point in mid-air. The upper strap does the same on the left. The hardware is not attached to anything".
- R3 part 2, major, `set-F-02.jpg` (crops of the settled still, crops 2, 4 and 6): "the snow resting on the foliage pads looks like grey sculpted clay blobs with sunken donut holes in the middle and a straight brown stick poking through the lower-right pad, while the upper branches are smooth barkless striped tubes with light wires cutting across open air".
- R3 part 2, major, `set-F-02.jpg` (crops 3, 5 and 6): "the wooden fence is a boxy flat-brown low-detail model with grey striped panels and no snow on its posts or rails, the windows are flat yellow grids with no glass reflection or depth, and the smooth grey roof snow meets an un-snowed chimney on a hard cut line".

The base:
- R1, major, `set-A-02-a.jpg` ("also in set B"), the collar: "The exposed seat and lip read as two clean gold stripes, and the snow looks flatter and more crusted. The icicles are mostly thin uniform needles with less interior sparkle than the target's thicker irregular glassy drops."
- R1, major, `set-A-02-a.jpg` ("also in set B"), the wood and metal: "The leaf-and-cone relief is thinner, darker and more sharply outlined, the right wood panel is washed with a flat pale frosting, and the foot reads as cleaner more separated bands. The target has fuller polished leaf relief, more visible wood and softer bronze highlights."
- R3 part 2, major, `set-D-02.jpg` (native size crops of winter in the rest state from `base`, crops 1 to 4; its first clause is about the glass): "the glass sphere ends on a straight horizontal line perched atop the upper brass ring instead of seating inside it, the collar snow stretches into faceted brownish-grey peaks on the left and repetitive doughy lobes on the right, and several icicles hang from dry brass where no snow overhangs".
- R3 part 2, major, `set-D-03.jpg` (crops of the same still, crop 7): "the pinecone is made of smooth rounded berry-like beads rather than thin woody scales, and it stays dark and completely unfrosted inside a zone where the surrounding wood and carved oak leaves are coated in white rime".

Jury (R2), what the jurors named: eleven said an ordinary 3D render and four a film frame. Eight of the eleven named the staging, for example "The dead-center studio product-shot framing of the isolated snow globe is the strongest cue" (the framing is the approved images' own, Declined issues 3). Others: "physically impossible miniature effects (such as wispy chimney smoke and glowing lights inside a water-filled globe lacking realistic liquid refraction)" (2 on the impossible details); "The snow forms a nearly perfect spiral around the cabin, like a particle effect arranged for a product render" (2 on the swirl, and one of the four film-frame voters: "The snow swirl inside the globe is smeared and not physically coherent"); "The tree’s glossy, ribbon-like branches look digitally sculpted rather than like the material of a physical miniature" (1); "uniformly placed icicles, crisply glowing miniature scene inside the globe, and smooth synthetic bokeh" (1).

Minors, in short: R1, the discs behind the globe ("The blue blobs are more uniform and pronounced and the far upper-right warm halo is weaker"). R3 part 1: the glass frost ("the ferns repeat along the curve like a flat brush"); the bank at the pond ("smooth like icing, and the water meets it on a hard dry line with no wet edge"). R3 part 2: the carved leaves and acorns from the `base` camera ("isolated single-pixel bright shader fireflies and tiny harsh highlights on the acorn caps appear on the dark wood when zoomed past native size"). R3 part 3: the steps' snow; the foot of the lamp post; the pond ("a flat grey-dark oval with a uniform dark rim and no reflection of the lamp, the lights or the cottage"); the snow on the lintels ("a crisp rectangular block with square corners"); the macro shows no glass ("The scene reads as an open diorama"). R4 part 2: the small lights at rest ("the tree and window glow shift in brightness and saturation between frames, reading as flicker"); the rest drift ("almost no perceptible particle drift between frames; the settled globe looks near frozen").

## What improved since Round 6, in the critics' own words

- The cover of the storm is no longer a fault. Round 6, R1: the tree "looks pasted on". Round 7, R1: "The intended extra occlusion is not the problem."
- The strokes are seen. Round 6, R4 part 1: "the strokes are a soft rock whose tilt does not lag". Round 7, R4 part 1: "The strokes do have clear reversals".
- The storm outlives the motion and turns as one. Round 6, R4 part 1: "a milky fog that thins in place". Round 7, R4 part 1: "The storm clearly outlasts the glass motion", and its fix says "Retain the coherent residual whirl".
- The glass has a wall. Round 7, R3 part 1: "the rim has two edges, so the wall has thickness".
- The jury's four film-frame voters: "glass refraction, frost, glowing lights and bokeh. It looks like high-end CGI"; "The cinematic, near-photoreal lighting and the elaborate suspended-snow/glass miniature detail look most like high-end CG rather than a real product photo or an ordinary stock render."
- In numbers: R1 5 to 7 (severe 1 to 2, major 4 to 7, minor 5 to 1); R3 part 1 5 to 7 (major 3 to 2); R4 part 1 5 to 7 (major 3 to 2); M3 0.7186 (red) to 0.9203 (green). Against that: R3 part 2 8 to 5 (major 3 to 7); R3 part 3 7 to 5; R4 part 2 6 to 4; the jury 5 of 15 to 4 of 15.

## What Round 6 named that Round 7 no longer names

Read from all six answers.

- R1: the storm as "a dull grey haze" with "regular parallel ring-shaped bands that look like a procedural texture"; the tree "crisp and fully clear ... so it looks pasted on"; the streaks as "short, dark grey dashes"; the front edge of the inside snow as "a smooth, rounded slab with a clean lip" (Round 7 names "separate stenciled tufts near the floor" there instead); the door and fence as orange; the missing ivy; the wood "dusted with glitter"; the grade "slightly cooler and more teal".
- R3 part 1: the star as "a flat yellow cutout"; the icicles as "milky opaque white with no light transmission" (R1 still names them, as "thin uniform needles"); the storm as "uniform-width curved white streaks, evenly spaced and all equally sharp at one depth"; the "stamped four-point sparkle star sprites"; the band across the backdrop; the lying flakes as "flat white decals"; the floating clump.
- R3 part 2: the near flakes as "similarly sized, uniformly cream-colored circles" that read "as a separate overlay" (Round 7 names the opposite there: "none of the snow particles blur out of focus near the glass"); the lower front of the glass as "a broad opaque gray band" where landform, liquid and pane "read as one solid bowl" (Round 7 still names the line where the glass meets the collar, from the `base` camera: "ends on a straight horizontal line perched atop the upper brass ring"). Its third major of Round 6, the tabletop frost that "looks printed onto the tabletop", is named again.
- R3 part 3: the "several parallel blue-gray bands" along the blurred ridge; the bark's "repeated glossy orange plates"; the crown snow's "sharp triangular teeth"; the roof snow's "ruler-straight seam above an exposed brown strip"; the roofline's bulbs as "a row of nearly identical yellow discs"; the near flakes as "paired peach blobs"; the pond's "red-orange pinprick noise".
- R4 part 1: the "blown-out white orb" (it now names "The wood and tabletop flash orange"); the last wisps that "crawl in place".
- R4 part 2: the rest sheet that "never shows the globe at rest" (declined, and decision 67 moved the sheet); the snow that "never dies away and instead coarsens"; the start with "zero drifting snow particles".
- The measures: M3 on `winter-rest`, red in Round 6, is green.

## What was done with it

- Every severe and major issue is written under "Open items" in `kit/PROGRESS.md` as items 38 to 62: 25 items from 31 issues (4 severe, 27 major), five of them holding a severe issue, each with the still, the critic's words, what was tried and what to try next. `round_scribe` drafted them from the answers; the Builder checked the counts by answer against the JSON files, and they agree.
- The plateau rule on Rounds 6 and 7: ladder moves 19 to 35 under "Look lock". To a next rung: the storm's drawing, the mirror image, the trunk, the crown's snow, the roof's snow, the pond, the cottage. No rung left, so open items only: the weight of the shake, the tabletop snow that leaves and returns, the slab's frost, the top of the glass, the glass on the collar, the base's ice and snow, the base's wood, the small bulbs.
- Declined or contested, with the reason, under "Declined issues" 7 to 13. What each critic saw stays open in every case; only the named ask is set aside.
- No fix pass follows inside the look lock: Round 7 was the last round `quality.lookLockMaxRounds` allows, and it does not pass. `winter` is marked `finished` at that limit on the build `4f10d97` (decision 72). Its open items are worked in the polish rounds of Phase 5, worst first.
- The key (`KEY.json`, `KEY-jury.json`) was copied into this folder only after every answer was in (23:10 for the jury, 23:28 for the critics). `MANIFEST.md` lists every file each critic and juror was sent.
