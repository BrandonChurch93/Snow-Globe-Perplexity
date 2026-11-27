# Handover: `change_finisher`, unit `change`, branch `agent/p6-change`

## Newest: the seventh job as pushed at 9aa6e81b: the storm burns, the room stays, the base stands lit; what lies on the table leaves in sight ahead of the peak, two seasons' as motion and two below that bar

Written 2026-11-27 at 14:20 UTC by the clock. This part is newer than everything below it. Where the two differ, this part holds. The part under it (21:25 UTC on 26 November) is the design before it was built; what was built is here.

Head of the code branch `agent/p6-change`: 9aa6e81b (engine 4ff74825bab2aca8). It holds `main` 06954500 (status 214 alone over 4f95670b; the last change of code in it is chain 31, b22b5be4). Its own commits are eight: `src/shake/change.ts`; `src/core/materials.ts`; the scene and the lens (`src/post/post.ts`, `src/scene/lighting.ts`, `frame.ts`, `stage.ts`, `surface.ts`, `backdrop.ts`); the seasons' parts (`src/seasons/winter/base.ts`, `src/seasons/fall/base.ts`, `src/seasons/fall/arrival.ts`, `src/seasons/summer/base.ts`); and one commit for each of the three test files whose old rule is restated (`tests/shake-change.test.ts`, `tests/lens-glare.test.ts`, `tests/light-flood.test.ts`), each saying the old rule, the new rule and why; and, after the merge of `main` e5671c9c, one for the colour of the lamps (`src/scene/backdrop.ts` with its lines in `tests/lens-glare.test.ts`).

### What is not done and not seen, worst first

- **Below the bar on ruling (b): two of the four dressings do not leave as motion.** `/root` ruled at 07:58 UTC that what lies on the table leaves as motion over 5 to 6 frames ahead of the peak. Spring's petals do (lifted off the table at 1387, blown outward over 1388 and 1389, faint traces at 1390 and 1391, the table bare from 1392) and fall's leaves do (blown outward over 2827 to 2829, the table bare at 2830): they are loose pieces and `GUST` carries each. Winter's ferns and summer's sand heap are not loose pieces; each is one drawn thing, and the same course only thins it in fingers, from the foot outward. Winter: the ferns lie whole at 665 and 666, are a little thinner at 667, half gone in streaks at 668, traces at 669 and gone at 670; the far crumbs of snow go over 670 to 672. So the ferns themselves go in three frames, the table with its crumbs clears over six as a front that runs outward, and nothing on it flies (picture 84). Summer: the heap is whole at 2106, streaked at 2107, a set of dark wavy bands with thin bright ridge lines at 2108 and gone at 2109, with a far sprinkle of grains to 2112. That is two frames, and the frame between (2108) is no state of a heap of sand (picture 83). It is the weakest thing in the four changes: at a phone's size the heap stands at 2106 and is a dark smear at 2108. Both are better than the swap under the cover that the critic read as a flash cut (they go in sight, ahead of the peak, under a glow that is already strong), and neither is the motion the ruling asks. What would mend them: the heap can flatten and spread out from the foot over the six frames by its scale in `update` of `src/seasons/summer/slab.ts` (no shader line, so no still can move), and the front then takes it in fingers as it takes a field of sand; the ferns are drawn in `src/seasons/winter/frost.ts`, which is not this unit's file, and could draw back along their own veins (the level they grow by, run backward). Neither is built and neither is tried: summer's files are to be touched little and every line named, the heap is also the sand builder's, and `frost.ts` is another's. Both are offered.
- **Nothing was played, and of the final tier only four single frames were drawn.** Every judgement of motion in this part is from frames in order, looked at as sheets: every frame of the four windows at 480 px a frame, frames 1390 to 1400 whole at their own pixels, each window's even frames at 400 px a frame as a phone's feed shows it. The review tier was not drawn (`/root`'s word of 14:17 UTC on 26 November: no review sheets and not the sixteen final frames). Of the final tier (24 samples a frame) the four middle frames 675, 1395, 2115 and 2835 were drawn, each alone: on the pushed head 9aa6e81b (13:51 to 14:03 UTC, 153 to 181 seconds a frame) and, before `main`'s chain 31, on 3078bf14 (`main` a6fe2ff4, engine c2c9b8fc3e9ed661). On both draws 0.00 in 100 of the pixels of each frame hold a sum under 4, and the least sums of any pixel are 59, 57, 39 and 51. Frame 675 is the same file on both heads; the other three are other files, since chain 31 moved the storm. Since `main` 6909766b the final tier draws an open shutter a new way; no run of final frames of a change in order has been seen by this unit on it.
- **At the draft tier the base's pass is a fine grain of two bases.** A draft frame holds two samples, so where the outlines of the two bases differ (673 to 678 and the sisters) the edge of the base is a stipple of both, and so is everything on a base that only one of the two seasons has. `PASS_EVEN` shares the odd sample out among the pixels so the six frames are six even steps and not two. `/root` ruled at 08:01 UTC: leave the pass as it is, build no front. From eight samples a frame on, every pixel holds the new base in the same share of its samples, so the pass is a smooth dissolve; that is held by a test and was seen only on the four single final frames.
- **Two pairs of the glass's mean read over 6 levels, by a tenth of a level, and are not tuned.** On the pushed head: 1388 to 1389 reads +6.12 (185.86 to 191.98) and 2831 to 2832 reads +6.14 (197.44 to 203.58); 2120 to 2121 reads -5.95; the first window has none (its largest are +5.0 and -4.0). The code of this unit unchanged read -6.6 at 2120 to 2121 and +6.1 at 2831 to 2832 on `main` 82d0b882 and -5.9 and +5.7 on `main` 3170155e: pairs near 6 cross the line when `main` redraws a storm. `/root` at 07:58 UTC: if a pair stays over 6, name it with its numbers and do not tune further.
- **1408 to 1412, after the second change, read -4.2, -4.2, -3.8 and -3.3 pair by pair, and -3.7 at 1407 to 1408** (the glass's mean from frame to frame). `/root` at 05:41 UTC: the pairs over 6 there are open and are not this unit's. On this head none of them is over 6.
- **The count of black before the job was taken on the first change only.** `/root` asks for the count before and after. Before (the branch at 3b965fca, even frames 660 to 690, draft, `hd`): 0.07, 0.06, 0.06, 0.06 at 660 to 666, 0.00 at 668, 0.26 at 670, 1.73 at 672, 2.44 at 674, 2.36 at 676, 2.29 at 678, 0.47 at 680, 0.00 from 682; 19 to 32 in 100 held 6 or less on 670 to 680. The other three changes were not counted before the job, by `/root`'s word of 16:04 and 16:51 UTC on 26 November not to draw pictures of before. After: every frame of the four windows, in the readings below.
- **Not had in the first state of this job (ca73e182), accepted by `/root` at 16:04 and 16:51 UTC on 26 November, and what each is now.** (a) The pool under the flash was the lens's glow and the base was not in sight: now the pool is the table's own lit surface and the base is readable on every frame of the cover. (c) The table's front edge rises with the cover: still so, now as the pour on the table (the lowest 40 rows of the frame read (53, 49, 55) at 668 and (88, 77, 91) at 674, and the like in the other three). (d) The mirror image of the burning glass in the wet slab: none is read from the film's camera, which looks along the table; in the app at the level high it holds at its strength at rest, at low it swells with the cover. (e) The ball did not burn brighter under the flash: now it does, to white at its heart.
- **The app's own path was drawn on 0b3211ce and not again on the pushed head.** From 0b3211ce to the pushed head only `main`'s own work changed under `src` (fall's base, fall's props and village, summer's crown and tree: five files), no line of this unit's. The sheets of those frames were looked at again before this was written.
- **Spring's bramble** is a part of spring's base and passes with it, as a stipple at draft: at 1395 to 1397 its last third is a sprinkle of rose dots at the base's right end. Its rose edges are spring's own and are there at 1381, before the cover. `/root` at 08:01 UTC: if it is not this unit's, leave it and say so. It is left.
- **Round 22's second point, the height of the lift,** is the hand's and was not touched.
- **One draw did not repeat, once, on 26 November, and the cause is not found.** The first draw of film frame 2836 on the tree before the mend of thing 6 gave sha256 b0b87f4ee3be99d4; every other draw of it gave b3bfcffc1f888f6c. The difference was 54 single pixels by at most 2 levels. `/root` at 21:28 UTC: note it here; if it comes again, tell at once and keep both files. It has not come again: on b47a6e30 frames 2835 and 2841 were each drawn twice and are the same files; the 39 frames of the first window drawn on 0b3211ce, on 3078bf14 and on 9aa6e81b are the same files; the final frame 675 drawn on 3078bf14 and on 9aa6e81b is the same file.
- **A storm that `main` redraws changes the frames of a change with no line of this unit's changed.** In a swap window the particles collide with the solids of both seasons (`both` in `src/particles/engine/engine.ts`), so a new form in either season's miniature moves the storm from the window's first frame on. `main`'s chain 31 (summer's tree, b22b5be4) moved the frames of the second, third and fourth window against the draw on `main` a6fe2ff4 (all 39 frames of each are other files) and left the first the same bit for bit. Earlier, between `main` d2013ce3 and 82d0b882, the third and fourth differed in 240,000 to 680,000 pixels a frame. So a frame of a change may be compared only between two trees that hold the same `main`.
- **`main` moved once after the push.** `origin/main` is bbdd4b03 (status 215, 13:48 UTC); the pushed head holds 06954500. The one commit between changes `kit/CLOCK.json`, `kit/PROGRESS.md` and the status pictures and no file under `src`, `tests` or `tools`, and it merges into the pushed head with no conflict (`git merge-tree`, 14:07 UTC). It is not merged: no push of the code branch followed.
- **The clock on four messages.** The four low messages to `/root` that went with the push are stamped 13:45 UTC; the clock read 13:44 when they left.

### What stands now

**The cover's course (`src/shake/change.ts`).** The swap window of a shake is 36 film frames (one beat at 100 beats a minute and 60 frames a second): 648 to 684 in the first shake, and 720, 1440 and 2160 frames later in the other three. All places below are film frames of the first shake.

| What | From | To |
| --- | --- | --- |
| The cover rises (`CHANGE_COVER.riseFrom` to `fullFrom`), twelve frames | 661.47 | 673.47 |
| The cover is whole (`fullFrom` to `fullTo`) | 673.47 | 677.97 |
| The parts outside the glass that stand change (`OUTSIDE`: the slab, the lamps of the backdrop, the light of the room) | 674.22 | 677.22 |
| The base passes (`BASE_PASS`), six frames | 672.72 | 678.72 |
| The cover's tail (`fullTo` to `tailTo`), eighteen frames, twelve of them past the window | 677.97 | 695.97 |
| What is on the glass leaves (`GLASS_LEAVE`) | 661.47 | 673.47 |
| What is on the glass comes (`GLASS_COME`, to `goneAt`) | 677.97 | 683.47 |
| What lies on the table leaves (`DRESSING_CHANGE.leaveFrom` to `leaveTo`), six frames | 666.72 | 672.72 |
| The table is bare | 672.72 | 678.72 |
| What lies on the table comes (`comeFrom` to `comeTo`) | 678.72 | 683.47 |

A draft frame is two exposures about 0.45 of a frame after its number, so frame 673 is the first drawn wholly under the whole cover and 678 the first of the tail.

What is on the glass (each season's part `glass-dressing`: winter's frost, spring's dew and rain, summer's light on the glass, fall's crack and fog) leaves with the cover's rise, as it did: `GLASS_LEAVE` is the rise's own span and its line is not changed. The rise is twelve frames where it was seven, so what is on the glass begins to leave five frames earlier (661.47, was 666.47) and is gone at the same place (673.47).

**How the rise and the fall are eased.** What is eased is the picture and not the exponent. `COVER_ANSWER` is how the glass's mean answers the cover (read on film frames with the cover held at nine places, on the leaving and the coming storm of each change); `changeShown` is how far the picture has gone at a place in the window, and the cover at that place is the one that shows that much (`coverOf`). The rise: twelve frames, its pace coming up over the first tenth and to rest over the last tenth (`RISE_EASE`), even between. The fall: a tail of eighteen frames from the whole cover, a shoulder of three frames (`TAIL.round`, five into fall, `TAIL.roundEven`), then the power 1.45 of what is left (`TAIL.ease`), each frame less than the one before, to nothing at `tailTo`. Fall's storm as the change has just brought it is thin and dark and answers the cover evenly, not by the law of the other seven, so on a tail into a season named in `EVEN_AS_IT_COMES` the cover is the picture's share itself. The veil of a season that leaves late goes by ratio from nine tenths of the window on, under the tail, to nothing at `tailTo` (`veilCrossed`, `VEIL_LEAVE`), so the pale wash that left on one frame at the window's end now thins over the tail.

**The storm is what burns (`src/scene/lighting.ts`, `CHANGE_BLOOM`; `src/post/post.ts`).** Under the cover the flood stands at the heart of the storm alone and the lens lays the picture on itself over the middle of the ball by one number, read from the picture, so every season's storm comes to the same white at its heart: white in the middle, the season's colour at the limb, no edge, the storm's strokes across it. No flash, no glare bell, no flat halo and no veil over the picture are left. The glow is round, lies on the limb of the ball where the ball is in each span of the shutter (eight seats a picture, given by `src/scene/stage.ts`), is cut where the base hides the ball and dies before the picture's edge.

**The room stays.** The exposure of what the room lights falls to `dim` under the whole cover, and the room's tone is laid back at three quarters of itself, lifted a little in the colour of the pour. The lamps of the backdrop fall to a fifth of their light by how far the picture has gone (`mix.shown`) and do not go out; under the cover each goes to one level between its two seasons', so their crossing is no step (`src/scene/backdrop.ts`, `uBackHold`, `uBackEven`), and its colour passes from the one season's to the other's by the crossing's own share (`lampShare`, next paragraph but one). What the room sends in through the glass gives way to the storm's own light: at the whole cover 0.45 of it is left, of the dimmer of the two seasons' rooms (`through`, `rigInside`).

**A lamp's colour passes evenly across the crossing (`src/scene/backdrop.ts`, `lampShare`; found at 10:45 UTC on 27 November in the app's own frames, mended before the push).** The level of each lamp was evened under the cover and its colour was not: the two seasons' colours were mixed in light by the crossing's own share, so a lamp that one season gives many times the other's light had the brighter season's colour on the first of the crossing's frames. In the page's walk from winter into summer at one sample a frame (`hd`, level high) the lamp at the upper right went from blue to brown between frames 127 and 128, by 32 levels of red and 37 of blue in the mean of its patch, and by 7 and 13 on the next. In the film's draft frames about half of a lamp's move of hue fell on one frame (on c90f0ef8 the lamp at (1567, 360) moved 0.080 of its 0.158 of hue on 674 to 675, and a lamp of the third change 0.082 of its 0.098 on 2116 to 2117). On `main` the lamps went out under the cover, so this came with the cover that is read through. Now the share of the coming season's colour is weighed by the lamp's two lights, `share = m a / (m a + (1 - m) b)`, where `m` is the crossing's share and `a`, `b` are what the season that goes and the season that comes give the lamp. The mixed light is then `a b / (m a + (1 - m) b)`, the level's factor brings it to the same mean as before, and the colour is the two seasons' colours at one level each, mixed by `m`. The same lamp now moves by 9, 15, 13 and 6 levels of red over frames 128 to 131 (in the film's draft frames on 0b3211ce the first lamp moves 0.052 of its 0.158 on its largest frame and the third change's 0.036 of its 0.098; the fourth change's largest is 0.074 of 0.250, where it was 0.087). Where no two seasons cross and where nothing is evened the share is `m` to the bit: in the page's walk the frames on both sides of the crossing (123 to 127, 131, 132) are the same files as before the mend, pixel for pixel, and the eight keys did not move. The test holds the share to the bit outside a crossing and the colour's place to 1e-9 on every frame of one.

**The base stands in the light the glass pours (`src/core/materials.ts`, `pourOnBase`, `baseRoom`).** One line in `stageMaterial` after `spec.hook`, by `/root`'s word of 23:29 UTC, lays the pour on every lit part of a base after the part's own hook; no season's `base.ts` is touched for it. The rim by the glass takes the light whole and clips; the flank takes a few hundredths of it over three centimetres in the stuff's own colour, so each base keeps its colour (winter's wood is no longer salmon under spring's rose). Parts that read the room by their own names are held as the light chunk's are: winter's ice, fall's base, fall's candles (`src/seasons/winter/base.ts`, `src/seasons/fall/base.ts`, `src/seasons/fall/arrival.ts`). Summer's sand lost its own fall (`uSandRoom`, `SAND_DARK`): the fourteen lines under `src/seasons/summer/` that this job changes, all in `base.ts`, are named in the commit.

**Where the pour's lines stand in a base's shader, and the one pixel that showed why.** The pour is laid on what leaves the face (`outgoingLight`), on the line after three closes the sums of a base's own light (`POUR_AFTER`), under the coat of a base that has one. It was first laid into the diffuse sum, before `vec3 totalDiffuse =`. With that, on `main` 82d0b882, seven of the eight keys were `main`'s and summer-landed was not: f6c56497bedfc63d against cbe415cdef5fc7c5, one pixel, (1172, 904), red 51 against 50, low on summer's base, the same on three draws. Taken apart one piece at a time, each a build and a still: the removal of `uSandRoom` alone gives `main`'s picture; the held room lights alone give `main`'s picture; the pour forced to nothing moves the same pixel; a branch never taken, with no new uniform, in the same place moves the same pixel; an add of nothing with no branch moves the same pixel. So it was no light of the pour. It was the place: any line between a base's last product and the sum that takes it changes how the driver's compiler joins the two (the likely cause is that it factors or fuses a product with the sum after it only when nothing else reads the product; that part is not proven, the bisect is). On the line after the sums are closed no line of a base's own stands on either side. Proof: summer-landed is cbe415cdef5fc7c5 again on 82d0b882 with the whole pour in the program, and all eight keys equal `/root`'s lists on the merges of ade42c8f and of 3170155e. Under the cover it is the same sum in another order: twelve covered frames (668, 675, 686 and their sisters) drawn both ways on the same head differ in at most three pixels of 2,073,600, by one level; four of the twelve are the same bit for bit. `tests/lens-glare.test.ts` reads the line the pour follows out of three's own shader, so a three that writes it otherwise fails the test and does not drop the pour unseen. Whoever adds a line to a lit shader between a product and its sum can expect the same: a still that moves by a level in a pixel with nothing of theirs in the picture.

**The pool lies on the table round the foot (`src/scene/surface.ts`, `slabPourShare`).** Brightest at the foot, falling off outward, with the base's own shade in it, at its most where the cover is whole. No flood is laid outside the glass under the cover.

**The base passes evenly at every count of samples (`src/core/materials.ts`, `PASS_EVEN`, `passShare`).** Six frames, centred on the cover's peak. Under eight samples a frame the odd sample is shared out among the pixels by the standstill's tile (`stageStill`), so a patch of the picture holds the share itself on every frame: a draft frame of two samples shows six states of the pass and not two. From eight samples on nothing is changed, and nothing where the page draws one sample a frame: there the pass goes by the still tile as it did before this job, a pixel goes once and stays gone. The new sharing is for two to seven samples.

**What lies on the table leaves and comes as motion (`DRESSING_CHANGE`; `/root`'s ruling (b) of 07:58 UTC).** It was swapped under the cover in the span's three frames: the scatter lay lit round the foot on one frame and was gone in the next clear view, which round 22's motion critic read as a flash cut. Now the old season's leaves over the six frames before the base begins to pass, from the foot outward, and is thinned into the pool; the table is bare while the base passes; the new season's comes from the far places in to the foot over the first frames of the tail and is down inside the window. What is made of loose pieces is carried as well as thinned: spring's petals and fall's leaves are lifted and blown out along the table (`GUST` in `materials.ts`, read by `src/seasons/spring/slab.ts` and `src/seasons/fall/slab.ts`; its formulas are not changed). Winter's ferns (`src/seasons/winter/frost.ts`) and summer's sand heap (`src/seasons/summer/slab.ts`) are each one drawn thing and read no gust: the front thins them in fingers and nothing of them flies (the ferns over 667 to 669, the heap over 2107 and 2108), which is below the bar of the ruling (the first line of what is not done). No instant holds the dressing of two seasons, and none holds a dressing while anything else outside the glass is between two (three tests in `tests/shake-change.test.ts`).

### What was seen, and at which tier

All of it at the draft tier (two samples a frame), `hd`, drawn by lavapipe, on the engine of the pushed head (4ff74825bab2aca8), unless a line says otherwise: the first window on 9aa6e81b itself (its 39 frames are the same files as the draw on 0b3211ce), the other three on b47a6e30, which is the pushed head less a status file of `main`.

- **How it was looked at.** Every frame of the four windows (661 to 696 and the sisters) as sheets at 480 px a frame. Frames 1386 to 1402 as one sheet at 640 px a frame, as `/root` asked at 21:25 UTC, looked at in five parts at its own pixels. The table of 665 to 673 (the lower 440 rows of the frame) at 1280 px a frame. Frames 1390 to 1400 each whole at its own pixels, as left and right halves. Each window's even frames at 400 px a frame, the width of a phone's feed. The ball of 2113 to 2118 and the foot of 1387 to 1392 and of 2104 to 2109 cut out at their own pixels.
- **The rise.** The glow comes up round the limb over twelve frames, in the colour of the season that comes: rose into spring, cream gold into summer, amber into fall, ice blue into winter. At a phone's size the four are plainly four colours. Spring's petals and fall's leaves are blown outward along the table in the frames before the peak (1387 to 1391, 2827 to 2829); winter's ferns thin away in streaks from the foot outward (fainter at 667, half gone at 668, traces at 669, gone at 670, the far crumbs of snow over 670 to 672) and summer's heap shears into bands over 2107 and 2108; neither flies: see the first line of what is not done. The lamps of the backdrop fall and stay in sight on every frame; they stand lowest in the third change.
- **The whole cover (673 to 678 and the sisters).** The heart of the storm is white with no edge, the season's colour toward the limb, the storm's strokes across it. The base stands lit, its rim to white and its flank in its own colour, its form readable on every frame. The pool lies on the table round the foot and falls off outward. The table is bare. The base passes in these frames as a fine grain of two bases. The room keeps a dark tone in the colour of the change and is nowhere black.
- **The tail.** The glow thins over eighteen frames, each frame less than the one before; no step was seen in any of the four. The new season's dressing comes in from the far places to the foot over the first frames of the tail: spring's petals over 679 to 684, fall's leaves over 2120 to 2124, winter's first flakes at 2840 to 2842; summer brings nothing in its window (its heap comes later, by its own rise). The lamps come up in the new season's colour. From 688 spring's lantern, from 1408 summer's village and from 2850 winter's village show in the ball.
- **Frame 2116 against M4** (`/root`'s question of 01:11 UTC). M4 of the third change passes at 0.9567 while the eye can find the ground change: at the lower right limb of the ball the ground goes from summer's pale to fall's dark over 2114 to 2118, as a stipple under the storm, at low contrast. No house of either village was seen in those frames.
- **The four final frames** (24 samples a frame, `hd`, lavapipe): 675, 1395, 2115 and 2835 as drawn on the pushed head 9aa6e81b, each looked at as its left and right half at its own pixels, its base cut out at its own pixels, and whole at 400 px above its draft frame (picture 82 is the four). In each the heart is white with no edge, the glow lies soft round the limb in the change's colour, the base is in mid pass as a smooth dissolve of the two seasons' bases with no stipple and its form can be read, the pool lies on the table round the foot, the lamps are dim and in sight, and the room is dark with tone and nowhere black (the third change the darkest, least sum 39). At 400 px each reads as its draft frame does. Small things seen at their own pixels and left: in 675 and 1395 two bright dashes about 30 pixels long at the tip of spring's bramble, with a sprinkle of fine dots about 20 by 12 pixels under one (the bright rims of the bramble's leaves, spring's own, drawn out by the open shutter); in 2835 a comb of short gold dashes about 80 by 150 pixels at the left end of the base (bright glints of the base drawn out by the hand's travel). These are single frames: how the pass moves at this tier was not seen.
- **The app's own path,** one sample a frame, drawn by lavapipe on 0b3211ce (`main` 21ebbe2d, engine e78c64b1a02605a5), not again on the pushed head: a shake from winter into spring and a jump by the season mark from winter into summer, each at `hd` at the level high (frames 116 to 138) and in the phone's upright format at the level low (frames 112 to 150). In all four the glow comes up in the coming season's colour, the heart goes white, the base stands lit and passes with no stipple at this size (a pixel goes once at one sample a frame), the pool lies round the foot, the lamps dim and stay in sight and go from blue to the new colour in even steps, and the room keeps tone. At high the mirror image of the globe in the table holds under the foot; at low the soft image of the lit ball in the table grows with the cover and falls with the tail. Pixels under 4: 0.00 in 100 on every frame at high; at low 0.03 at frame 112, which is before the cover, and less on every other.
- **The eight keys at rest and landed are `main`'s pictures.** The sha256 of each of the eight on the pushed head 9aa6e81b is the one `/root` lists for `main` b22b5be4 (06954500 changes no file under `src`). No key moved.
- **The stand-ins view** of each season at rest (`--diag standins`) is black: winter, spring, summer and fall, the largest value of any pixel 0 in each, on b47a6e30.

### The pictures of this part

On this branch, each with its lines in `captions.txt`:

- 75 to 78: each change as two rows of four frames, the new cover above and the cover before this round below (`75-cover7-first-change-new-above-before-below.jpg` and its three sisters).
- 79: film frame 1395 whole, the new above and the frame before this round below.
- 80: the foot and the table over 1387 to 1392, spring's petals leaving as motion, the new above and before below.
- 81: the colour of the lamps across the crossing in the page's own path, with the mend above and before it below.
- 82: the four middle frames at the final tier, drawn on the pushed head.
- 83: summer's heap over 2104 to 2109, as it is, below the bar; no picture of before stands beside it, since the cover before this round was not drawn on those frames.
- 84: winter's ferns over 665 to 670, as they are at the left and before this round at the right, below the bar.

Pictures 52 to 55 are an earlier pushed state of this job (af9dca04) and 71 to 74 its first rough state; 77 and 78 take their rows of before from 54 and 55. Sent to `/root` by message and not on this branch: the four windows as strips, frames 1390 to 1400 at their own pixels (with the push, 13:44 UTC) and every frame of 1386 to 1402 at 640 px a frame (with the report).

### Readings on the pushed tree

**Pixels whose red, green and blue sum under 4, in 100 of the frame** (`/root` asks for under 1 on every frame of the four windows):

| Window | Largest share on any frame | Where | Under the whole cover | Least sum of any pixel there |
| --- | --- | --- | --- | --- |
| 1, winter into spring, 660 to 698 | 0.07 | 660 to 661 | 0.00 | 56 to 63 |
| 2, spring into summer, 1380 to 1418 | 0.00 | every frame | 0.00 | 48 to 63 |
| 3, summer into fall, 2100 to 2138 | 0.02 | 2136 to 2138 | 0.00 | 39 to 41 |
| 4, fall into winter, 2820 to 2858 | 0.07 | 2856 to 2858 | 0.00 | 49 to 55 |

Largest over the 156 frames: 0.07 in 100. Before this job the same count read up to 2.44 in 100 at the draft tier, and `/root` read 31 to 32 in 100 at 6 or less on the cover of the sixth job.

**The glass's mean from frame to frame** (the mean of the picture inside the ball, on a disc that rides with the ball; a pair over 6 levels with the room standing is the fault `/root` named at 00:53 UTC):

| Window | Pairs over 6 | Largest step up | Largest step down | Mean under the whole cover | Heart there |
| --- | --- | --- | --- | --- | --- |
| 1 | none | +5.0 at 671 to 672 | -4.0 at 684 to 685 | 201.9 to 205.0 | 245.9 to 247.9 |
| 2 | 1388 to 1389: +6.12 | +6.12 at 1388 to 1389 | -4.2 at 1409 to 1410 | 210.5 to 213.1 | 248.1 to 249.2 |
| 3 | none | +3.7 at 2111 to 2112 | -5.95 at 2120 to 2121 | 199.0 to 204.4 | 246.9 to 249.9 |
| 4 | 2831 to 2832: +6.14 | +6.14 at 2831 to 2832 | -4.7 at 2843 to 2844 | 208.3 to 217.8 | 249.0 to 252.1 |

1407 to 1412, pair by pair: -3.7, -4.2, -4.2, -3.8, -3.3.

**The step under the foot from frame to frame** (the measure of the first six jobs: the mean change of a pixel in a band under the base, the globe's travel taken out; the five pairs 673 to 678 and their sisters):

- Change 1: 14.23, 17.76, 17.52, 17.49, 15.99.
- Change 2: 15.42, 19.39, 18.06, 17.94, 14.92.
- Change 3: 16.60, 19.46, 19.98, 21.42, 19.63.
- Change 4: 19.21, 23.58, 25.56, 21.44, 17.22.

No pair stands out from its neighbours in any of the four. Under the cover of the sixth job the same measure read 1.95, 1.10, 2.25 and 0.72 at 675 to 676 and the sisters, but only because nothing under the foot was in sight there. Now the base stands lit and travels 44 to 52 px a frame with the hand, at two samples a frame, and that travel is what the measure reads.

**The pool at the peak** (40 rows about the brightest row under the ball; the heart is x 900 to 1020, the skirt x 300 to 420): 675: heart (227, 191, 189), skirt (29, 22, 28); 1395: heart (218, 194, 156), skirt (30, 25, 21); 2115: heart (218, 178, 131), skirt (27, 17, 10); 2835: heart (185, 206, 233), skirt (13, 22, 36).

**The table's front edge and the picture's corners** (the lowest 40 rows; the corners are what the glow must not reach): 668: edge (53, 49, 55), corners (9, 12, 20); 674: edge (88, 77, 91), corners (25, 19, 25); 1388: edge (52, 52, 46), corners (23, 20, 24); 1394: edge (89, 89, 76), corners (35, 28, 26); 2108: edge (59, 48, 34), corners (22, 17, 14); 2114: edge (81, 65, 39), corners (26, 16, 10); 2828: edge (43, 45, 64), corners (4, 8, 16); 2834: edge (56, 89, 139), corners (10, 18, 30).

**The lamps of the backdrop** (the mean of the lamp pixels of the upper right corner, x 1560 to 1920, y 0 to 360):

| Window | At rest before | Lowest | Under the whole cover | At the window's last frame | Largest step |
| --- | --- | --- | --- | --- | --- |
| 1 | 126.6 | 82.0 at 672 | 83.9 to 87.3 | 178.5 at 698 | +6.8 at 684 to 685 |
| 2 | 124.9 | 57.0 at 1397 | 57.0 to 59.0 | 115.7 at 1418 | -7.8 at 1383 to 1384 |
| 3 | 133.1 | 30.2 at 2112 | 30.7 to 30.9 | 37.3 at 2138 | -14.9 at 2103 to 2104 |
| 4 | 121.0 | 67.5 at 2832 | 69.0 to 72.6 | 148.6 at 2858 | -6.0 at 2823 to 2824 |

The lamp pixels are those that are lamps on the window's first frame, so after the change the reading is the new season's backdrop at the old season's lamp places (fall's lamps stand elsewhere: the reading stays at 37.3 while the brightest half in a hundred of the corner comes back to 176.6 by 2136). Each largest step lies in a row of its like and is no step on one frame: the third window's fall reads -4.7, -13.9, -14.9, -14.7, -13.6, -12.0, -10.0, -8.0, -5.7, -3.5, -1.7 over 2102 to 2112, the twelve frames of the rise.

**The glow just outside the limb** (a ring round the ball):

| Window | Before the rise | At its most | Largest step up | Largest step down |
| --- | --- | --- | --- | --- |
| 1 | 21.6 at 662 | 77.9 at 673 | +11.2 at 671 to 672 | -8.3 at 682 to 683 |
| 2 | 35.4 at 1382 | 87.2 at 1393 | +11.5 at 1391 to 1392 | -11.0 at 1402 to 1403 |
| 3 | 27.5 at 2102 | 70.6 at 2120 | +10.4 at 2111 to 2112 | -6.5 at 2122 to 2123 |
| 4 | 14.2 at 2822 | 72.5 at 2839 | +10.7 at 2831 to 2832 | -9.1 at 2841 to 2842 |

The steps are those from the rise's first frame on. Each largest step down lies in the tail between neighbours of its own size (the second window's tail reads -6.7, -10.0, -11.0, -8.6, -7.4, -6.2, -4.1 over 1400 to 1407; the third's -4.2, -6.5, -5.3, -5.4, -5.1 over 2121 to 2126), so the glow thins with no step. Before the rise the ring reads the backdrop's lamps as the hand carries the ball across them, not the glow: -13.0 at 2101 to 2102 and -9.8 at 1380 to 1381 are lamps leaving the ring (seen in the frames: the bright lamps of the upper right stand against the limb at 2100 and clear of it at 2103).

**The whole frame's median over the two tails `/root` named at 18:55 UTC** (point 5: say what it reads after):

- 1386 to 1402: 27.9, 29.0, 30.2, 31.6, 32.4, 35.2, 38.9, 42.3, 43.1, 43.0, 41.8, 40.5, 40.4, 39.4, 36.8, 33.8, 30.2. Largest steps +3.7 and -3.6.
- 2826 to 2842: 15.2, 16.1, 17.1, 18.7, 21.0, 24.4, 28.6, 31.9, 32.7, 33.4, 33.6, 33.8, 33.8, 33.3, 31.4, 28.8, 26.4. Largest steps +4.2 and -2.6.

### The wide reading of the lens's level: tried, not kept

The lens reads the level of the ball's middle from the picture (a disc of 0.12 of the ball's radius, 24 taps) to bring every storm's heart to the same white. A wider and finer reading was tried on 33 frames (experiment E5: patches of 0.12, 0.2 and 0.3 of the radius, a plain mean or a mean with a knee at 1 or at 4 that holds a single bright tap down, 24, 64 or 192 taps; the readings were printed by the page and read by `/tmp/j7/tools/e5.py`). The widest (0.3, knee 1, 64 taps) halved the mean step of the reading from frame to frame (4.0 in 100 against 8.1) and its largest step (15.1 against 21.5 in 100, at 2121 and 2123). But it reads 0.5 to 0.9 of what the narrow one reads wherever the storm is brightest in its middle (0.50 at 1394, 0.57 at 1400), so every heart would stand whiter, and `/root`'s word at 07:58 UTC was that no heart gets whiter and that the shoulder on fall's tail is the way. The steps of the glass that had been laid at the reading's door were fall's tail, and went with fall's shoulder of five frames. `src/post/post.ts` keeps the reading it had before the trial (`HEART_PATCH` 0.12, `HEART_TAPS` 24, a plain mean); the trial's code is not in the tree (a copy of the file with it is `/tmp/j7/post.ts.e5` in the VM, which is not kept).

### Checks and what they printed

Each line names the head it was taken on. `/root` ruled at 05:32 UTC that a proof already run stands for the push if the head is named. The pushed head 9aa6e81b is b47a6e30 with `main` 06954500 merged, which changes `kit/CLOCK.json`, `kit/PROGRESS.md` and the status pictures and no file under `src`, `tests` or `tools`; the two build to the same engine, 4ff74825bab2aca8. All by lavapipe at the draft tier, `hd`, unless a line says otherwise.

| Check | Head, `main` in it | What it printed |
| --- | --- | --- |
| The eight keys at rest and landed against `/root`'s list for `main` b22b5be4 (`node out/work/guards8.mjs`) | 9aa6e81b, `main` 06954500 (13:46 UTC); and b47a6e30, `main` 4f95670b (12:55 UTC) | All eight equal on both: winter-rest 0cab5cd137ba09d9, winter-landed a7ab4af383606ed0, spring-rest 78ee21faa1da0061, spring-landed c9d7c918a050607a, summer-rest 086768daf3d1707d, summer-landed ea9ae9d60385cd0d, fall-rest 1081f81241734a4c, fall-landed 731e87a720212c70 |
| `npm run strict` (the eight keys under pow, all+smooth, all+smooth+noguard) | b47a6e30 (13:29 UTC) | Exit 0. Last line, word for word: "strict: pass, 8 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, where that one differs by its answers (no number, 0, 0.577 and 1e30), and where those differ against its own --same picture (engine 4ff74825bab2aca8, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move" |
| `node tools/measure.mjs --unit change --tier draft` | b47a6e30 (12:59 UTC) | "measure change: complete · 24 of 24 lines, 0 red · draft · 199 s". M4 0.9694, 0.8957, 0.9567, 0.9592 (threshold 0.85); M5 0.993, 1, 0.9811, 0.9998 (threshold 0.6); M6 pass on all eight lines, at most 29 of 102,000 particles inside a solid (threshold 0.002). M4 and M5 are `/root`'s line for `main` b22b5be4 to the digit |
| `npm run gate -- --phase 4 --only G11,G12` | b47a6e30 (12:59 UTC) | "gate, phase 4: all 2 green" |
| `npm run determinism` | b47a6e30 (13:32 UTC) | "determinism: pass · 3 pictures, 4 page loads, preview, draft, 174 s" |
| `node tools/miniatures.mjs` | b47a6e30 (13:33 UTC) | Exit 0. "dressings: sha256 0a79da7d50cb09ca1d2a9e2c849d900123b42dfa904b2128d1a26f2a6fbb343b", "pass: sha256 47a35075638d3ae7a2f63291d916fbbe6743f17f3ae435bce92afb046c45e0ff" |
| `npm run master -- --calibrate`, this unit's head against plain `main` built in the same VM | 0b3211ce against `main` 21ebbe2d (not run again since) | The same line on both: ad1c6495e7f09eec6324eca368580a7416a288a9228fbc681a340112f61612d4 |
| One still of each season with `--diag standins` | b47a6e30 (13:34 to 13:35 UTC) | Black: the largest value of any pixel is 0 in winter's, spring's, summer's and fall's |
| `npx tsc --noEmit` | 9aa6e81b (13:36 UTC) | Exit 0, no line |
| `npx vitest run`, whole, alone in the VM | 9aa6e81b (13:37 to 13:41 UTC) | Exit 0. 68 files passed, 1 skipped (69); 961 tests passed, 8 skipped (969); 290.00 s |
| The first window drawn again, all 39 frames | 9aa6e81b (13:46 to 13:51 UTC) against the draw on 0b3211ce | 39 same files, 0 differ |
| The four middle frames at the final tier (675, 1395, 2115, 2835), each alone | 9aa6e81b (13:51 to 14:03 UTC) | Exit 0 and "complete true" on each, in 166, 153, 181 and 174 s. Pixels under 4: 0.00 in 100 on each; least sum of any pixel 59, 57, 39 and 51 |

Notes on the checks:

- **The skips of vitest** are the four tests of `tests/shake-looks.test.ts`, which run only when asked for by `SHAKE_LOOKS=1` (`describe.runIf(WANTED)`) and are skipped on `main` as well, and four of `tests/mix.test.ts` that skip themselves where the sound tracks are not in the VM (`skipIf`). No test of this unit is skipped.
- **`tests/steps.test.ts`** (the miniatures three ways) took 132.4 s in the whole run on 9aa6e81b, 133.9 s on b47a6e30 and 122.6 s before that, each time with nothing else at work in the VM. It did not stop at its limit of 300 s here. `/root` saw it stop at the limit once while other work ran beside it.
- **A first start of the strict run on b47a6e30 was stopped by hand** after 14 seconds with nothing printed (the chain log shows "strict exit 1" at 13:11 UTC), because the chain was started again to draw the fourth window anew. The run in the table is the second, whole one.
- **The miniatures' two hashes are not `main`'s** (`/root`'s line for b22b5be4: pass 4f125e6ec2e5a361, dressings 528474499f8193ad). The tool passes (the three ways of building give the same). The records it hashes hold the text of each material's program, and this unit's line in `stageMaterial` adds the pour's uniform and lines (`uPourOn`) to the program of every lit part. Compared leaf by leaf on 0b3211ce against plain `main` 21ebbe2d built in the same VM, 221 leaves differ and every one is program text; no leaf of geometry, of a texture or of a number differs.
- **The calibration line** was taken on 0b3211ce and plain `main` 21ebbe2d and not again; nothing of this unit's changed since.

### How this part's pictures and numbers were made

In the VM that drew them, which is not kept. The code tree is `/home/user/workspace/sg`. Frames: `node out/work/filmlist.mjs --tier draft --format hd --calls <frames> --stop <epoch seconds>` into `out/work/seq/film-hd-draft/` (about 8 seconds a frame on lavapipe). The four windows of the pushed tree are frames 660 to 698, 1380 to 1418, 2100 to 2138 and 2820 to 2858. The eight keys: `node out/work/guards8.mjs <dir>`. The app's own frames at one sample: `node out/work/appseq2.mjs --app shake|jump --from .. --to .. --format hd|phone --level high|low --frames .. --dir ..`. The readings: `gm2.py` (the glass's mean on discs that ride with the ball, the ball's place from a file of fits), `cmp.py` (two readings side by side, a pair over 6 marked), `lamps.py`, `rings.py`, `region.py`, `median.py`, `grain.py`, `black.py` (the share of pixels whose red, green and blue sum under 4), `footstep.py` (the step under the foot from frame to frame, the globe's travel taken out), `nums.py`. The sheets: `grid.py`, `ballstrip.py` (the ball cut square round its own centre, and under each the change from the frame before).

### Others at work in this unit's files

- The hand's four lines (`f.globe.twist ?? 0`, order 'XZY') in `src/scene/stage.ts`, `src/scene/lighting.ts`, `src/globe/shell.ts` and `src/core/chunks/veil.ts` are as `main` has them. So are the standstill's (`src/core/still.ts`, `stageStill`, `SETTLE_S`, `inAir`, and the test that pins the text of `stageGone`).
- `src/seasons/fall/base.ts` is also worked by fall's base builder, and `src/seasons/summer/base.ts` by summer's builders. `src/seasons/spring/base.ts` is the spring base builder's and is not touched here.
- The controls' second job (chain 24) changed the making block of `src/scene/stage.ts`; it joined with this job's lines by itself.

## The part before, of 26 November, 21:25 UTC: thing 6 is mended and pushed (a6ce69a8); things 1 to 5 are designed and not built

Written 2026-11-26 at 21:25 UTC by the clock. This part is newer than everything below it. Where the two differ, this part holds. The part above it (27 November) is newer and holds over this one: things 1 to 5 are built there.

Head of the code branch `agent/p6-change`: a6ce69a8 (engine d02c4c4f0d27779b). It is 557a79f2 (the branch with `main` 84f037e2 merged) and one commit on top, the mend of thing 6. `main` is ae5b48b4 as this is written. The head does not hold what `main` took after 84f037e2: 49dae6ef, the sand's third pass (8f6770e2), 1621ff09 (`src/capture/showcase.ts`: one sample set for every picture, which changes the bytes of every film frame and leaves the stills' bytes), the air's stop at zero (a54d91a5) and the cottage's third pass (18a19dd5). `/root` at 20:27 UTC: "do not chase main any further. Report on your merged head 557a79f2 (which holds 84f037e2) when its proofs are drawn." So this push was made without the newest `main` merged, by `/root`'s word, against the standing rule.

### What is not done and not seen, worst first

- **Things 1 to 5 of `/root`'s look at d3f0f958 are not built.** The glow is still a column, the pool still lies over the base, the globe still goes flat at the peak, the lamps are still gone in the two middle frames and the fall is still a blink. Every frame of a change on this head is the cover of ca73e182. A design stands below; one file of it is edited in a scratch tree and nothing of it is built or drawn.
- **M4 is red for the third shake on this head (0.77 against 0.85) and reads 0.8664 for the second, under the 0.88 `/root` asked for at 20:53 UTC.** It is not mended here. `/root` walked the red back to the merge of the air's seventh list (5f9a5fd2) and gave it to the air's builder at 21:09 UTC. What this unit read and tried is below.
- **One draw did not repeat.** The first draw of film frame 2836 on the tree before the mend gave sha256 b0b87f4ee3be99d4; a second draw of the same build and both draws with the mend gave b3bfcffc1f888f6c. The difference is 54 single pixels by at most 2 levels. The same was seen once on de25a24b. The cause is not found. It is not from the mend (the odd draw is the tree without it).
- **A merge of `main` into this head conflicts in one place:** `src/seasons/summer/veil.ts`, lines 15 and 16. Line 15 is this branch's (`bankWhite: 0.3` in `veil`), line 16 is `main`'s (new colours for the seed and the mote). They are neighbours, so git cannot join them. Both lines are to be kept. `src/seasons/summer/arrival.ts` joins by itself.
- **The eight keys were compared with `main`'s own, not with the tree before the mend.** Drawn on `main` 84f037e2 (engine 1bfc88dcec694187) and on the mend (engine d02c4c4f0d27779b), tier draft, format preview: all eight the same by sha256. The keys of 557a79f2 without the mend were not drawn.
- **Nothing here is tier final or review, and nothing was played.** Every picture is tier draft (2 samples), `hd`, lavapipe, looked at as sheets, at its own pixels and whole at 400 px wide.
- **The proof frames were drawn on trees that hold 84f037e2.** After `main` is merged, a frame may be compared only between two trees that both hold 1621ff09.

### The mend of thing 6 (a6ce69a8)

The cause is in part 0, thing 6, below: the shared veil whitens the bank of the flood by `VEIL_LOOK.bankWhite`, 2.2, a number made for snow. Past 1 it turns the bank to the opposite of its tint, which for summer's gold is a sky blue.

Four files, one commit:

- `src/seasons/kit.ts` line 48: `readonly veil: { tint: Rgb; density: number; rest: number; bankWhite?: number }`, and a comment on line 47. This file is not this unit's; the line is there by `/root`'s word of 18:55 UTC.
- `src/core/chunks/veil.ts`: line 285, the uniform `uVeilWhite`, which starts at `VEIL_LOOK.bankWhite`; line 310, its declaration in the shader; line 436, `veilLit` reads `uVeilWhite` where the number was baked in; lines 598 to 601, `updateVeil` sets it to `lerp(a.bankWhite ?? L.bankWhite, b.bankWhite ?? L.bankWhite, t)`, so it crosses with the tint through a change. Also by `/root`'s word.
- `src/seasons/summer/veil.ts` line 15: `bankWhite: 0.3` added to `veil`. The one line under `src/seasons/summer/` in this commit.
- `tests/light-flood.test.ts`: `describe("the white of the flood's bank")`, four tests: a season that gives none has the shared share; summer's own is short of white; it crosses with the tint; it reaches the shader as one uniform, read where the flood rolls the bank and nowhere else.

A season that gives no number has 2.2 as before, so winter, spring and fall are drawn as they were.

**The value, chosen by the picture.** Film frames 1400, 1402, 1410 and 1420, the body of the ball between the grains, before, at 1, at 0.6 and at 0.3:

| Frame | Before (2.2) | 1 | 0.6 | 0.3, the mend |
| --- | --- | --- | --- | --- |
| 1400 | (170, 172, 164) | (206, 180, 147) | (210, 181, 143) | (213, 182, 141) |
| 1402 | (172, 170, 156) | (207, 178, 141) | (211, 179, 137) | (213, 180, 135) |
| 1410 | (126, 109, 81) | (138, 114, 79) | (140, 116, 79) | (142, 117, 78) |
| 1420 | (140, 115, 78) | (142, 116, 78) | (142, 116, 78) | (142, 116, 78) |

Seen: before, the left two thirds of the ball are sky blue on 1400, 1402, 2080 and 2086, and the left limb is blue on 1410. At 1 the bank is grey. At 0.6 it is cream with a trace of grey olive. At 0.3 it is a warm cream gold, the nearest of the three to the approved landed storm seen brighter (that storm is about (186, 156, 117) in the body). 1420 is the same in all four, because the flood's bank is gone by then. Pictures 67, 68 and 70. Engines: before 8dc1d811c2feaaa6, value 1 8ffa1930eff93451, value 0.6 84b88cc9b7dfb682, the mend d02c4c4f0d27779b.

**The proof that nothing else moved** (sha256, first 16 places; draft, `hd`; before and with the mend, each drawn twice):

| Frame | What it is | sha256 |
| --- | --- | --- |
| 640 | winter in the hand | a0168a986add2636 |
| 676 | winter into spring, under the cover | da9b68f243aa7c6c |
| 690 | spring arrived | 44d097c2ec54b6a6 |
| 1340 | spring in the hand | f37845794d65d8d1 |
| 1360 | spring in the hand | 1bb1535728b95359 |
| 2780 | fall in the hand | 362666767a9a3ada |
| 2800 | fall in the hand | e8148611b3ae1956 |
| 2836 | fall into winter, under the cover | b3bfcffc1f888f6c (three draws of four; see the draw that did not repeat) |
| 2850 | winter arrived | 139551ecf9bfbfcf |

The eight keys with the mend, the same as `main`'s own: winter-rest 80a73da1376f4695, winter-shake d325dec9b95633ef, spring-rest 6c299aa4f979d7bf, spring-shake 0b2ec379c643ca2b, summer-rest 631d967a1cb0ce1b, summer-shake 64461c0a89ccb9d3, fall-rest d0f7a36f28e5f3d4, fall-shake 4fe85c7ee261752a. (The `-shake` keys are the landed pictures.)

Summer's flood moved, as meant (before, then with the mend): 1400 80573e7f41476a99, 194c6cc72baf64cb; 1402 36520202c07ccdb0, cb2e0db4680738c2; 1404 65410f8f1c995930, a6e6ee4652857340; 1408 a64a54addb8f4e2b, d0e2970052f949bb; 1410 aa86f6c57d06bd38, 26719d471e4e6d29; 1420 c4b025e92c8847ee, 502351f56e929632; 2080 163aa8473943c73f, ecc146ffef312562; 2086 ad1f18754250d10a, e6dc3bbee3fb46ae; 2100 e154d77beb1d4fed, b5d6858bfd46eea5; 2108 99061c3cecdfef79, fd53cf115980f97b; 2110 c10b424a8cea604f, 3863316d314e442e; 2120 33712a2534cc3c73, 766ec1be27c74cca.

`npx tsc --noEmit` exit 0 and `npx vitest run` exit 0 on a6ce69a8 (58 files passed and 1 skipped, 787 tests passed and 8 skipped).

**Fall is left alone.** A trial with fall's bank capped at 1 (engine 5537324ef13ebf79, not kept), against the mend with fall at the shared 2.2, picture 69. No lilac shows with the cap or without it at the size anyone sees it. 2108: largest step 9 levels, the ball's mean (166.85, 169.35, 123.01) against (168.67, 170.14, 121.40) capped. 2110: largest step 11. 2120: largest step 26 (33041 pixels move by more than 16 levels), the moved area (160.3, 155.6, 113.3) against (158.0, 157.4, 101.1) capped; the line on the lower left limb of 2120 reads (128.6, 104.8, 68.5) against (127.8, 105.3, 64.6), a warm brown that does not move with the cap, so it is not fall's bank. 2780: 0.07 in 100 of the ball moves by 1 level. 2800: largest step 20, the moved area a mint (121.1, 147.2, 100.4) against a deeper green (115.6, 146.7, 94.0).

**Two things said earlier, now settled.** The lilac on 2108 and 2110 that this unit named as fall's bank at 18:51 UTC is summer's bank leaving; it goes with the mend (picture 69, upper row against the middle row). And the pale green over the cream on 2100 to 2110 with the mend is fall's own fog coming in: 2086, two frames before the window, is cream with no green in it.

**The colour of the pour for summer is not moved by the glass builder's rim (1.3 to 0.3).** `pourColour` in `src/scene/lighting.ts` reads the rim's colour times the key's colour and no intensity. Read out by `/tmp/j7/probe/pour.ts`: summer's pour is in the shares 1.000, 0.689, 0.384, the strongest channel 1.4833.

### M4 and M5 on this head, and what M4 hangs on

`npm run measure -- --unit change --only M4,M5 --force --tier draft` on 557a79f2 with the mend (engine d02c4c4f0d27779b, 20:54 UTC):

| Measure | Shake | Result | Number | Counted |
| --- | --- | --- | --- | --- |
| M4 | shake-1 | pass | 0.9872 | 144978 of 146862 |
| M5 | shake-1 | pass | 0.9804 | 151567 of 154602 |
| M4 | shake-2 | pass | 0.8664 | 125188 of 144492 |
| M5 | shake-2 | pass | 1 | 169477 of 169484 |
| M4 | shake-3 | fail | 0.77 | 109116 of 141701 |
| M5 | shake-3 | pass | 0.9828 | 141823 of 144301 |
| M4 | shake-4 | pass | 0.9626 | 142190 of 147708 |
| M5 | shake-4 | pass | 0.9997 | 156060 of 156103 |

How M4 is drawn. It is taken at beat 2.5 of the shake, the middle of the swap window (film frames 666, 1386, 2106, 2826). That is before this unit's cover, which starts to rise at 0.513 of the window, is whole from 0.7075 to 0.8325 and is gone at 0.985 (film frames 666.47, 673.47 to 677.97 and 683.47 in the first change): at the middle the cover is 0. The cover view counts what stands between the eye and the miniature: the shared veil's fog, the particles, spring's mists and fall's fog (`src/seasons/fall/glass.ts`, which comes in evenly with the change). So M4 at the middle hangs on the air, not on the glow. `f.mix.veil` in `src/scene/stage.ts` crosses late (`VEIL_LATE`, 0.177 at the middle) where the leaving season has the thicker veil, and evenly where it has not.

What is open on this head. Third shake (summer into fall): the tree's crown, rows 250 to 399 of the cover view, median fog 0.79 to 0.83 against the 0.9 that counts. Second shake (spring into summer): the ground's front rim in streaks, rows 600 to 649 open in 32 of 100 pixels and rows 650 to 699 in 72 of 100.

The cause, by reading and by two trials. `stormHeld` in `src/seasons/summer/veil.ts` (the air's file) weights summer's held storm by `(f.to.veil === veil ? t : 0) + (f.from.veil === veil ? 1 - t : 0)` and lets it come in over the whole swap window. The held storm is thinner than the shared veil's flood (it takes off `calms` of the drift bank and sets its own bank and white), so while it holds the cover thins. In the third shake summer is the leaving season: its hold comes in at the weight 1 less t and opens the crown at the middle of the swap. In the second shake summer arrives: its hold is already half in at the middle and opens the front rim.

| Trial (on 557a79f2 with the mend; not kept; this unit does not touch that file) | Engine | M4 shake-1 | shake-2 | shake-3 | shake-4 |
| --- | --- | --- | --- | --- | --- |
| The head | d02c4c4f0d27779b | 0.9872 | 0.8664 | 0.77 | 0.9626 |
| S: the leaving term off (`mine = f.to.veil === veil ? (f.from.veil === veil ? 1 : t) : 0`) | 7ef035207ebac0fd | 0.9872 | 0.8664 | 0.9652 | 0.9626 |
| S2: S, and the hold coming in from the middle of the window (`ramp(beat, (w.fromBeat + w.toBeat) / 2, w.toBeat)`) | d3ff65b0a60daa0f | 0.9872 | 0.9043 | 0.9652 | 0.9626 |

M5 is the same four numbers in all three. In S the cover view of the second shake is byte equal to the head's; in S2 the third's is byte equal to S's. S2 seen on eight frames (1386, 1400, 1410, 2100, 2106, 2108, 2110, 2120) beside the head: 1386 the same to the eye, 1400 a more even cream with less of the tree through it, 2106 to 2120 a fuller mint with the gold patch in the middle gone, 1410 byte equal. `/root` has the result of S (sent 21:10 UTC) and has S2 in the report that follows this push. `main` has since changed summer's storm again (`STORM.share` 0.24, `bank.density` 0.006, the stop at zero), so these numbers are this head's and not `main`'s.

The uniform values read out of the page at the middle of each swap (turbulence 1, flood 1), by `out/work/veilprobe.mjs` with a hook that is not kept: shake-1 white 0.0317, bank level 0.14, bank density 1.057, drift 0.110; shake-2 white 0.00838, level 0.0625, density 0.2792, even 0.925, drift 0.0298; shake-3 white 0.01065, level 0.0124, density 0.3549, even 0.8765, drift 0.039; shake-4 white 0.01932, level 0.14, density 0.644, drift 0.0672.

### The design for things 1 to 5 (not built)

Read from the code on this head; the numbers are where the first trial starts, not results.

- **The fall as a tail (thing 5).** In `src/shake/change.ts`: the cover keeps its peak and gains a tail of 15 frames past the window that eases out (`COVER_TAIL = frames(15)`, `tailTo` 1.249 of the window, film frame 692.97 in the first change, 15 frames after the whole cover ends at 677.97; `risePower` 2 and `tailPower` 2; `goneAt` kept, because `GLASS_COME` in `src/core/materials.ts` reads it). `changeBloom` is then defined past 1. After the window the stage no longer knows that a season left: `from`, `to` and `season` are all the new one, and so they are in a shake that changes nothing (the stills' test shake and the film's preroll). So the tail needs one field on `Moment`; the lines are in the report to `/root` and under "Lines needed outside this unit's files" below.
- **The glow round, centred, closed (thing 1).** The lens's wide glow in `src/post/post.ts` (hole, halo, halo core and wide veil, lines 184 to 192) and its placing in `src/scene/stage.ts` (lines 600 to 609) go. In their place the lens's own bloom of what is bright (threshold 0.9, knee 0.5, strength 0.11, gain 1 and 6 times the tint) and at most a small glow with a closed reach about the ball's centre as it is in that frame (the mean over the frame's samples). 1.14 radii is 51 px past the limb at `hd`; the ball's top is 64 px under the top edge, so a reach under 1.17 radii dies before the edge.
- **The source stays the brightest thing (thing 3).** No flash term and no pour of the flash in `src/scene/lighting.ts` (`update`, lines 269 to 353; line 266 is the hand's builder's). The inner lights gain by a heart share to the power of the cover (4 and 8 to try). The glass (`src/globe/shell.ts`, not this unit's) already adds `uBloom` times (0.1 and 0.9 of the facing cubed) and a white core by the facing to the eighth, from `f.bloomTint` times 0.6: a white heart with colour round it, ready to be driven. `lensState.bloomTint` is copied in `src/scene/backdrop.ts` (line 481), so the glass's tint and the lens's can be split by a new field in `src/scene/frame.ts`.
- **The base lit, the pool on the table (thing 2).** The flood on the base gets its own branch under the cover (the old expressions kept exactly when the cover is 0, so rest and landed keep their bytes). Its shares now, of `uLightFlood` times `uLightFloodFloor.w` over pi: top face about 0.88, shoulder 0.54, flank 0.07 to 0.03; lift it until top and shoulder go near white in the pour's colour and the flank stays dark. The pool in `src/scene/surface.ts`: line 318, `glowRise = smoothstep(uFoot.z - 4, uFoot.z + 46 + lift, d)`, makes the pour darkest at the foot; the pour gets its own short rise (8 to 10 mm) times the foot's occlusion, so it is brightest at the foot and falls off outward with the base's soft shadow in it (line 492). Reach: under two thirds of the globe (the ball's radius is 60 mm, the base's 58, the base is 33 high; about 6.1 px a mm at `hd`).
- **The lamps veiled, not gone (thing 4).** The room's tone is the room times (1 less the dim). The lamps are held by `(lamps / dim)` to the power of the cover (about 0.15 to 0.25 to try) through a new `uBackHold` in `src/scene/backdrop.ts` (`vColor`, about line 246). The lamps inside the glass: `src/scene/stage.ts` lines 558 to 562 (`emissiveIntensity = flickerOf(...)`), this unit's to multiply; the villages' `uGlowGain` is not.
- **Summer's base.** `src/seasons/summer/base.ts` line 611 (`f.from === f.to ? 1 : Math.pow(SAND_DARK, f.mix.bloom)`) likely loses its condition for the tail. It is a summer line and is to be named in the report.
- **Tests to restate, each in its own commit that says the old rule, the new rule and why:** `tests/lens-glare.test.ts` (glare, halo, veil, the flash's pour, the hole, the flat halo, the seats, the halo's white) and `tests/shake-change.test.ts` (lines 132, 152, 203 to 205, 275).
- **The kit:** `kit/04-LOOK.md` section 6 (the bloom may flood the frame for a few frames in the swap window) and `kit/03-METHOD.md` line 197.
- **Where it starts from.** Film frame 676 on this head: a flat pink ball, a flat oval, the lamps gone, the glow a wide column; frame max 246, median luma 103, the top edge above the ball 120. `CHANGE_BLOOM` on this head: `{ lens: 0.2, swellFrom: 0.56, fall: 0.6, dim: 0.005, sharp: 4, pour: 30, pourOn: 5, flashPour: 0.005, image: 5, flood: 0.5, glare: 0.3, flashGlare: 0.7, glareReach: 1.1, glareSeat: 0.1, glareHole: 0.9, glareHoleReach: 1.3, halo: 0.8, haloReach: 1.4, haloUp: 0.4, haloDown: 0.33, haloSeat: 1.52, haloCore: 3, haloWhite: 0.5, tint: 1, veil: 0.03, flashVeil: 0.03, veilReach: 1.5, room: 0.75 }`.
- **The order of work:** merge `main` (the one conflict above), then the first change on frames 668 to 694 until it is the picture, then the other three, then the checks of the job file on the merged head (the strict run on the eight keys, the measure, G11 and G12, determinism, the count of true black on the 60 middle frames, the eight keys against `main`'s, the app's own path at high and low).

### Lines needed outside this unit's files (asked of `/root` in the report that follows this push)

For the tail. `src/core/stage.ts`, in `Moment`, after `period`:

```ts
  /** The season that left in the shake under way, from the end of its swap window to its landing; null or absent at every other moment. */
  left?: string | null
```

`src/film/moments.ts`, `timelineMoment` (the film and the app both build their moments there):

```ts
import { config } from '../config'

export function timelineMoment(tl: Timeline, t: number, mix: number, seed: number): Moment {
  const hit = eventAt(tl, t)
  const left = hit === null || hit.event.from === hit.event.to || hit.beat < config.shake.swapWindow.toBeat - 1e-7 ? null : hit.event.from
  return { ...seasonAt(tl, t), sinceLanding: t - lastLandingBefore(tl, t), globe: globePoseAt(tl, t), mix, seed, time: t, beat: hit ? hit.beat : null, period: null, left }
}
```

Not yet tried in a build.

### Others at work in this unit's files

- **The hand's builder (`/root/hand_closer`, `agent/p6-hand`)** draws the globe's twist through four single lines, two of them in this unit's files: `src/scene/stage.ts` (`this.globe.rotation.set`) and `src/scene/lighting.ts` (`this.turn.makeRotationFromEuler`), the other two in `src/globe/shell.ts` (`uTurn`) and `src/core/chunks/veil.ts` (`turn.setFromEuler`). `/root` at 20:22 UTC: "Keep off those four lines". Its retime of the first strokes of the held shakes and its deeper dip move the pose in this unit's windows (in the second shake's window most in its first half, up to 9.2 mm in x at 1368, and within 0.4 mm and 0.3 degrees from 1385 on), so every frame of a change moves when it is in `main`.
- **`agent/p6-standstill` (26e6ac52)** touches `src/core/materials.ts` and `src/scene/stage.ts`. `/root` holds it until this report is in.
- **The air's builder** has `src/seasons/summer/veil.ts` and the red M4. This unit's one line there is line 15.

### How this part's pictures and numbers were made

In the VM that drew them, which is not kept: the code tree `/home/user/workspace/sg`; frames by `node out/work/filmlist.mjs --tier draft --format hd --calls <frames> --stop <epoch seconds>` into `out/work/seq/film-hd-draft/`; the proofs under `/tmp/j7/m10/` (`before`, `beforeb`, `w03`, `w03b`, `w1`, `w06`, `fallcap`, `keys-main`, `keys-mend`, `measure-head`, `cover-head`); the trials under `/tmp/j7/m4/` (`S`, `S2`, `S2frames`, `headframes`); the maps of the cover view by `/tmp/j7/tools/covermap.py` and its rows by `/tmp/j7/tools/coverstat.py`; the sheets by `/tmp/j7/sheet.py`, which writes each label in a margin under its cell and nothing over a picture. A frame at `hd` draft takes about 10 s, a build about 20 s, the eight lines of the measure about 70 s, the tests about 150 s.

## The state after the seventh job, as it was at ca73e182

Written 2026-11-26 about 19:23 UTC, and older than the part above it. Seven jobs were done on this branch. The state of ca73e182 is here; the sixth job's state follows, then the fifth, the fourth, the second and third, then the first job's text as it was written.

Head of the code branch `agent/p6-change`: ca73e182 (engine 7bc857d50887da42), which holds `main` 5b23a870. `main` holds the first six jobs (the sixth as e58aa9d4) and nothing of the seventh; `/root` looks at the branch on its own sheets and merges it itself. As this is written `main` is 5f9a5fd2. Since 5b23a870 it has taken all seven summer branches of the seventh fix list (the room, the glass with the rim down to 0.3, the cottage, the stone, the sand, the tree and the air) and it holds nothing of the seventh job. The branch's working tree holds that `main` merged (a16acab9, not pushed) with the mend of thing 6 of part 0 on top, not committed. `main` holds the seventh list's scripts under `assets-src/` but the made assets are still those of 0e1100bb (16:40 UTC), so in any frame drawn on it summer's base, tree and cottage are the sixth list's meshes under the seventh list's shaders.

The head differs from `main` in eleven files. Under `src/`: `src/scene/lighting.ts` (the cover, `CHANGE_BLOOM` and `pourColour`), `src/post/post.ts` (the lens: glare, halo, veil, the room's tone), `src/scene/surface.ts` (the slab: `uPour`, `uImage`), `src/scene/frame.ts` (two fields, `poolOn` and `image`), `src/scene/stage.ts` (where the halo sits), `src/core/materials.ts` and `src/shake/change.ts` (comments only), and one guarded line in `src/seasons/summer/arrival.ts` (line 157). Under `tests/`: `tests/lens-glare.test.ts` (15 tests), `tests/light-flood.test.ts` and `tests/glsl-normalize.test.ts` (the exception for summer's arrival taken out, as `/root` asked at 15:27 UTC).

The seventh job (`tools/briefs/p6/change-7.md`) was the cover of the change itself. Until now the cover was a blackout: the exposure fell, everything the room lights fell to black with it, and for about ten frames the glass burned alone in a black frame. The job: the same cover with the room still there, the light of the glass pouring out on the table, the base and the mirror image, lamps that fall but do not go out, no patch of true black in any frame, each change in its own colour of light, and the swap as unseen as it was.

In short: the black frame is gone (0.00 in 100 of the pixels under 4 on all 60 middle frames, where the old cover had up to 2.44), the room keeps a tone, each change pours the arriving season's own colour, the swap is not seen, and the proofs are green. It is not yet the picture `/root` wants: on its own sheets `/root` named six things for the next turn on this branch, and they are the first part below.

### 0. What is not done, what is not seen and what still shows, worst first

#### The six things `/root` named for the next turn (17:46 and 17:55 UTC): the first five not begun, the sixth found (it is mended since: see the newest part, at the top)

`/root` looked at d3f0f958 on its farm sheets (tier review, `hd`, every fourth frame, then every second frame of the second and the fourth shake). Its verdict: better than `main` and nearer the kit (no black frame, the room keeps tone in the dip, the new base is lit in the last frame), and six things, the same on all four swaps. It asked that none be begun before the report. What follows is each thing, where it sits in the code and what I read there. The readings are mine, on my own draft frames; where they differ from `/root`'s numbers it says so.

1. **The glow is a column, not a halo.** `/root`: straight above the globe at the top edge of the frame it reads 130 to 135, at the same distance to the left and right 23 to 30; make it round, centred on the globe where it is in that frame, and let it die before the frame's edge. Where it sits: `src/post/post.ts` lines 184 to 191. The glare is `uGlare * exp(-far) * (1 - uGlareHole.x * exp(-far * uGlareHole.y))`, where `far` is the squared distance from `uGlareAt` in radii of the glass, corrected by the frame's aspect, so in itself it is round: a bell 1.1 radii wide (`glareReach`), centred 0.1 down the glass's axis (`glareSeat`), with nine tenths of its middle taken out (`glareHole`). Measured on the head, draft, `hd`, with a circle fitted to the ball's outline: on 1396 the ball's middle is (987, 420) and its radius 355 px, so the top edge of the frame is 1.18 radii above the middle, 65 px over the top of the ball. Luma there, straight above: 128. At the same 1.19 radii from the middle to the left, the right, the upper left and the upper right: 133, 135, 128, 130. At 1.5 radii to the left and right 104 and 107, at 1.75 radii 73 and 77, at 2 radii 46 and 48, at 2.5 radii 13 and 14, which is the room. Frame 675 (middle (936, 423), radius 354) and 1392 (middle (812, 418), radius 364) read the same way. So my reading is that the glow is round and centred on the ball where it is in each frame, and far too wide for where the ball stands: the top edge cuts it at its strongest, it runs on to more than 2 radii at the sides, and with the flat pool under it the whole reads as one tall shape. `/root`'s 23 to 30 at the sides is what I read about 2.2 radii from the middle, which is as far beyond the limb as the top edge is from the middle; taken from the middle both ways the two numbers would be alike. What follows for the mend: a round glow that dies before the top edge has 65 px, 0.18 radii, of room beyond the limb.
2. **The pool is laid over the base.** `/root`: it is as bright as the globe (186 to 188 against 190 to 204) and one flat oval that covers base and table alike, so it reads as a spotlight from above. The kit (`kit/03-METHOD.md` section 11) says the inner light "floods the base and the surface": the base should stand in that light as a thing, bright on its top and shoulder, falling off down its flank, losing its carving in the glare; the pool should be on the table round its foot, brightest at the foot and falling off outward, with the base's own soft shadow in it. "Its shape may go soft and that hides the dissolve; an oval in its place does not." Keep the pool under about two thirds of the globe. Where it sits: the oval is the halo of the flash, `uHalo * exp(-pool) + uHaloCore.rgb * exp(-pool * uHaloCore.w)` in the same lines of `src/post/post.ts`, set by `CHANGE_BLOOM.halo`, `haloReach` (1.4 radii to the sides), `haloUp`, `haloDown`, `haloSeat`, `haloCore`, `haloWhite` in `src/scene/lighting.ts` and placed by `src/scene/stage.ts`. It is a colour and a place in the lens and it was put there to hide the base while it passes (672.72 to 678.72 in the first shake); under it the pour on the table and the base is drawn in to `flashPour` (0.005) of itself. This is the "not had" (a) below, and `/root` has now said how it wants it had: the base lit and soft, not covered.
3. **The globe goes flat.** `/root`: the frame's brightest value falls from 242 to 254 before the swap to 216 to 228 at the peak; the source must stay the brightest thing in the frame, the limb's highlights and the hot heart of the storm should bloom to white there with colour round them (`kit/04-LOOK.md` section 6). Where it sits: the glare's hole keeps the glow off the ball (`glareHole` 0.9), the flash share of the glare is "still under white on the ball" by design, and the halo is whitened only half of the way (`haloWhite` 0.5). That was done on `/root`'s word about the first state (609d6d44), where the ball was one flat peach white with no stroke of the storm to read. So the next turn wants both: strokes to read and a heart and a limb that clip. It is the "not had" (e) below.
4. **The lamps of the room are gone in the two middle frames but for one or two dots.** `/root`: veiled by the glow, yes; gone, no. Where it sits: the lamps are the backdrop's discs (`src/scene/backdrop.ts` and each season's `backdrop.ts`); they fall with the exposure, which is `dim` (0.005) of itself at the whole cover, 7.64 stops, and what is laid back over the picture (`room`, 0.75) is the backdrop's dark tone alone, not its lamps. So the lamps need a floor of their own under the cover.
5. **The glow's course.** `/root`, whole frame median on the second shake: 1386 30, 1388 32, 1390 50, 1392 86, 1394 114, 1396 112, 1398 91, 1400 45, 1402 24; the fourth: 2826 14, 2828 21, 2830 41, 2832 70, 2834 98, 2836 100, 2838 82, 2840 42, 2842 23. The fall is the steeper side (the base box drops 188 to 87 between 1398 and 1400). A burst of light reads the other way: up fast, then a tail that dies away. Keep the peak where it is, let the fall run on as a tail of 12 to 18 frames that eases out and never blinks off; the peak of 112 and 100 against a room of 30 and 14 is too much wash and should come down by itself with things 1 and 2; say what it reads after. Where it sits: part 4 below has the course as it is written. The cover is a straight ramp (`src/shake/change.ts`, `changeBloom`, `CHANGE_COVER`): in the first shake it begins to fall at 677.97 and is gone at 683.47, and `changeBloom` is 0 once the place in the window reaches 1, which is film frame 684. A tail of 12 to 18 frames runs past the window, so it needs a clock that goes on after the window: that clock is not in `changeBloom` today and has to be found or made (the shake's own time in the frame, or a second window).
6. **Summer arrives blue.** `/root`: on 1400 and 1402 the left two thirds of the globe read sky blue between the grains, (152, 177, 191) and (122, 162, 185), where the approved `summer-shake.png` storm is cream gold, (186, 156, 117) over the middle of the globe. `main` does the same on 1400, so it is not from the glow. Find what is blue there (the veil's colour for summer in the window, a sky fill that the risen inner light multiplies, or the far side's switch) and make summer come in warm; if the cause is in a file of the air's or the glass's builder (`src/particles/`, the veil or the haze in the glass), do not edit it and tell `/root` the file, the line and the value. The cause is found and proven by trial, and it is not the cover. `veilLit` in `src/core/chunks/veil.ts` whitens the bank of the flood (the thick white of a shaken globe, which stands for as long as the globe is in the hand and is taken off between beats 3.05 and 3.55 of the shake, film frames about 1405 to 1423 in the second shake) by `mix(1, 1 / tint, K x low)`, where K is `VEIL_LOOK.bankWhite`, 2.2, at a whole flood. A K of 1 takes the season's tint out of the bank; 2.2 goes past white to the tint's opposite, so the bank's colour is 2.2 less 1.2 times the tint. For winter's blue tint that is a warm white, (1.24, 1.16, 1.00), which is what the number was made for; for spring it is (1.00, 1.12, 1.08), for fall (1.46, 1.06, 1.66), and for summer's gold tint, (1.75, 1.4, 0.86), it is (0.10, 0.52, 1.17), a sky blue. The trial, on ca73e182 with the number made a uniform that a season's veil can set, draft, `hd`, the body of the ball between the grains at 1400, 1402, 1404, 1408, 1410 and 1420. At 2.2 (the head): (148, 172, 187), (116, 159, 183), (94, 142, 164), (103, 141, 160), (138, 157, 167), (179, 146, 94). With summer at 1: (205, 188, 165), (199, 186, 164), (191, 176, 153), (189, 173, 149), (201, 179, 150), (180, 147, 93). At 0.6: (213, 190, 158), (209, 188, 155), (203, 181, 145), (200, 178, 142), (209, 181, 142), (180, 147, 93). At 0.3: (217, 190, 153), (214, 190, 149), (209, 183, 138), (207, 180, 136), (215, 183, 137), (180, 147, 93). 1420 does not move because the flood is nearly off by then. `/root` gave the mend to this unit at 18:55 UTC (the file has no owner at work), as a commit of its own before the other five things: `bankWhite` becomes a number each season's veil can set, 2.2 where it sets none, so that winter and spring do not move by a byte; summer sets its own, chosen by the picture (the approved landed storm is about (186, 156, 117) in the body; the ball in the hand should read as that storm seen brighter, cream to pale gold, never blue and never grey); fall only if its lilac shows at the size anyone sees it. Where it stands as this is written: the mend is in the working tree on `main` 5f9a5fd2 merged (a16acab9, not pushed), in three files, not committed: `src/core/chunks/veil.ts` (the uniform `uVeilWhite`, set in `updateVeil` and crossed with the tint), one line in `src/seasons/kit.ts` (`bankWhite?: number` in the veil's type; that file is not this unit's and the line is to be named to `/root` in the mend's report) and one line in `src/seasons/summer/veil.ts`. The frames before and with the mend are being drawn on the merged tree, and the value is chosen there. Two things read on the way and not settled: the same summer bank stands in the first part of the third change, before fall's cover (2100 to 2110, blue green on the head), and with the mend it read a pale green there and not cream, which is not yet understood; and fall in the hand (2780, 2800) read its own green with no lilac at draft, so fall is left alone unless the merged tree shows otherwise. A claim to take back: at 18:51 UTC I told `/root` that a green ball with lilac patches at 2108 and 2110 was fall's bank. It is summer's bank, still standing in the first third of fall's window. Two notes from others that touch this: the summer room builder put summer's own entry into `WALL.tints` (`src/scene/backdrop.ts`, a file of this unit, with `/root`'s word; it is in `main`), and the glass's builder took summer's rim from 1.3 to 0.3 in `src/seasons/summer/rig.ts`. The colour of the pour reads the rig's rim through its key, so the pour's colour for summer is to be read again on the merged tree.

#### What `/root` accepted as known at 16:04 UTC, for the round's critics

- (a) **The pool on the six frames of the flash is the lens's glow, not the table's lit surface, and the base is not in sight there.** On 673 to 678 of the first shake (1393 to 1398, 2113 to 2118 and 2833 to 2838 in the other three) what lies below the ball is a flat oval of light in the new season's colour, a colour and a place: it has no sheen and nothing on the table catches it. The table's own surface carries the pour on 669 to 672 and on 679 to 681 only. What lies on the table changes between 674.22 and 677.22 (the old leaves in the first half, the new comes in the second), the base between 672.72 and 678.72, and in a trial that held the pour on the table through the flash, frame 676 showed spring's petals arriving on the lit table. So the pour is drawn in to 0.005 of itself under the flash and the glow stands in its place. Thing 2 above is `/root`'s answer to this.
- (c) **The table's front edge rises at the flash.** The lowest 40 rows (x 300 to 1620): (58, 41, 46) at 672, (78, 53, 56) at 674, (87, 59, 61) at 677, (59, 50, 62) at 680: 20 to 30 levels of red over its neighbours. It is the lower tail of the halo and the veil.
- (d) **The mirror image of the burning glass.** In the film's frames none is read: from the film's camera no mirror image of the glass is read in any frame of the four windows, at rest or under the cover. In the app on a phone it is there, and the two levels differ: at `high` the slab draws the stage a second time, so the image is the glass as it is drawn and holds at its resting strength through the flash; at `low` the slab bakes it as a glow under the foot, and since the mend 60cd390c that glow swells with the cover (part 3).
- (e) **The ball does not burn brighter under the flash than before the cover.** Mean luma of a disc of 230 px about (960, 400): 175 at 668, 173 at 670, 184 at 674, 184 at 676, 187 at 678, 165 at 680. The flare is read from the glow round the ball and the pool below it, not from the ball. Thing 3 above.

#### Not drawn and not seen here

- **The final tier and the review sheets.** `/root` took them to its own machines at 14:17 UTC ("You do not draw the review sheets or the 16 final frames"). Every picture named in this text is tier draft (2 samples), `hd`, lavapipe, unless it says otherwise.
- **The count at final** on the four middle frames of each change: not taken here, for the same reason.
- **The outer frames of the four windows on the final head, and the pictures "before the job" beyond the first change.** `/root` at 16:51 UTC: "Do not draw the pictures "before the job" or the outer frames on your one machine." On the final head the 15 middle frames of each change were drawn and counted (668 to 682, 1388 to 1402, 2108 to 2122, 2828 to 2842). The count "before" is from the even frames 660 to 690 of the first change only.
- **Not played.** The frames were looked at in order as sheets and one by one at their own pixels. No moving picture was played, so "it reads at 400 px, played in order" is not seen as such: what is seen is the four changes side by side in cells of 297 px (picture 56).
- **The app at the level `low` on `hd`, the jump at `low`, the stir and the drag:** seen as sheets of the frames named in part 6, not played.
- **On a phone the pool is cut by both side edges of the frame** on app frames 125 to 131 (picture 62): the oval is 1.4 radii of the glass to each side and the phone's frame is narrower than that. It belongs to thing 2.

### 1. What the cover is now

All of it is in `src/scene/lighting.ts` (`CHANGE_BLOOM`, `pourColour` and the lines of `Lighting.update` that read them), `src/post/post.ts` (the lens), `src/scene/surface.ts` (the slab), `src/scene/frame.ts` (two fields) and `src/scene/stage.ts` (where the halo sits). The text above `CHANGE_BLOOM` says the same in the code's own words. The values on the head: `{ lens: 0.2, swellFrom: 0.56, fall: 0.6, dim: 0.005, sharp: 4, pour: 30, pourOn: 5, flashPour: 0.005, image: 5, flood: 0.5, glare: 0.3, flashGlare: 0.7, glareReach: 1.1, glareSeat: 0.1, glareHole: 0.9, glareHoleReach: 1.3, halo: 0.8, haloReach: 1.4, haloUp: 0.4, haloDown: 0.33, haloSeat: 1.52, haloCore: 3, haloWhite: 0.5, tint: 1, veil: 0.03, flashVeil: 0.03, veilReach: 1.5, room: 0.75 }`.

- The exposure falls as before, to `dim` (0.005) of itself at the whole cover, and everything inside the glass rises by as much, so the glass and the storm in it are drawn as they were. That part is the sixth job's and is not touched.
- The room keeps its tone. What the fall takes from the dark of the backdrop is laid back over the whole picture in the backdrop's own colour (`room`, 0.75 of it; each season's `backdrop.ts` names its colour, measured in the corners of the film's frames at rest, and the two are mixed as the base is). So the corners go from the old season's dark to the new season's dark and never to black. The lamps of the backdrop are not laid back: they fall with the exposure and are nearly gone at the whole cover (thing 4 of part 0).
- The glass pours its light out, in the new season's colour from the first frame of the cover. On the slab's own near black it is `pour` (30) times what the new season's lights lay there at rest; on the base and on everything that lies on the table (winter's frost, the petals, the leaves, the slab's own dust and lumps) it is `pourOn` (5) times, so what is white there stays under white and takes the colour of the light; the flood of the new season's light on the top of the base is held the same way (`flood`). `frame.pool` is what the slab and the glass take, `frame.poolOn` what lies on it takes; the slab's shader gets them as `uPool` (the smaller) and `uPour` (the difference), and only its own `albedo` is lit by `uPour`.
- The lens lays a glow round the ball (`glare`), a bell 1.1 radii of the glass wide with nine tenths of its middle taken out by a second bell 1.3 radii wide, so it sits round the ball more than on it and the strokes of the storm are read through it. A veil of the same colour lies wider and weaker (`veil`).
- The flash is the top of the cover, the cover to the fourth power (`sharp`): in the first shake it is whole in film frames 674 to 677, a part of itself in 672, 673 and 678 and next to nothing beyond (the base passes between 672.72 and 678.72; the other three shakes are 720, 1440 and 2160 frames on). In it the glare rises (`flashGlare`), the pour on the table, the base and the dressing is drawn in to `flashPour` (0.005) of itself, and the lens lays the glow of the pool over the foot (`halo`): a flat bell centred between the collar and the foot of the base (`haloSeat`), 1.4 radii to the sides, 0.4 upward and 0.33 downward, whitened half of the way at its heart (`haloWhite`, on a bell `haloCore` times as tight), so it covers the base, leaves the ball alone and has fallen off above the lower edge of the frame.
- Nothing in the picture feeds the glare, the halo or the veil: no lamp, no petal. They are a colour and a place, set by the frame. That is what keeps the swap unseen under them, and it is also why the pool reads as laid over the picture (thing 2 of part 0).
- The film and the app set the same uniforms from the same function; `tests/lens-glare.test.ts` reads them for both.

Before the job `CHANGE_BLOOM` was `{ lens, swellFrom, fall, dim: 0.005, glare: 0.5, glareReach: 0.8, glareSeat: 0.1 }`: the fall and one round glare on the ball, and nothing laid back.

### 2. Each change has its own colour of light

The brief: "each change has its own colour of light (the new season's)". The first form took the colour of the arriving season's lamps (the sum of the lamps of its miniature), and winter's lamps and spring's are the same warm colour, so the first change and the fourth could not be told apart. Since 3e8a5a75 the colour is the arriving season's own rig, its rim through its key (`pourColour` in `src/scene/lighting.ts`, read from each season's `rig.ts`: winter's blue, spring's rose, summer's gold, fall's orange), at the strength of the lamps' strongest channel, so the top of the glow stands where it stood. `CHANGE_BLOOM.tint` is the share of the way from the lamps' colour to the rig's; it is 1. The pour, the glare, the veil and the halo all take it. `/root` kept the tint at 16:04 UTC and again at 16:51 UTC ("the tint stays if the proofs hold on the merged head"); they hold (part 11).

The pool at the peak frame of each change, heart (x 900 to 1020) and skirt (x 300 to 420), 40 rows about the brightest row under the ball, means of 8 bit levels:

| peak frame | without the tint, heart | without, skirt | with the tint, heart | with, skirt |
| --- | --- | --- | --- | --- |
| 675, into spring | (232, 195, 158) | (158, 123, 89) | (232, 207, 208) | (158, 117, 117) |
| 1395, into summer | (232, 181, 131) | (158, 109, 65) | (231, 216, 198) | (157, 132, 96) |
| 2115, into fall | (232, 206, 169) | (156, 133, 95) | (232, 204, 181) | (156, 109, 54) |
| 2835, into winter | (232, 194, 160) | (157, 121, 88) | (197, 212, 235) | (99, 125, 161) |

"Without" is the head 37926c17 (engine 9bac98146d7f7c70), "with" is af9dca04 (engine 1b120a3ccbf06f35); the same numbers come out of the frames of ca73e182 line for line. Picture 61 has the four peaks in one row without the tint and one row with it. The heart is whitened, so the colour is read in the skirt and in the glow round the ball: rose, gold, orange, blue.

### 3. The mend at the level `low`: the mirror image the slab bakes (60cd390c)

Found after the push of d3f0f958, in the app on a phone at the level `low`. There the slab does not draw the stage a second time; it bakes the mirror image of the glass as a soft glow under the foot (`src/scene/surface.ts`, the line that begins `vec3 near =`). That line read `uPool + uPour`, the pour on the table, which is drawn in to 0.005 of itself under the flash. So the glow under the foot went bright as the cover rose (app frames 121 to 125), out under the flash (126 to 131: (31, 22, 27) at 127 against (65, 48, 37) at rest) and bright again as the cover fell (133 to 136): two swells with a hole in the middle, at the very frames in which the glass burns most.

The mend: the baked image reads a colour of its own, `frame.image` (`uImage` in the slab's shader). Under the cover it is the lights inside at rest, held through the fallen exposure, and on top of that `CHANGE_BLOOM.image` (5) times what the new season's lights at rest lay there, as much of it as the cover is whole, in the colour of the pour; it is not drawn in under the flash. Away from a change it is `pool`, so nothing moves at rest. The glow now swells once with the cover, is at its most under the flash and falls with it. Mean of the glow's box on the phone (rows 70 to 82 in 100, x 31 to 50 in 100): (65, 48, 37) at 118, (107, 78, 67) at 121, (148, 113, 107) at 124, (164, 126, 121) at 127, (140, 103, 100) at 130, (94, 68, 67) at 132, (62, 45, 45) at 134, (40, 31, 26) at 137. Picture 63 has both, before above and now below.

What the mend does not move: the film (it draws the stage a second time and `uReflect.y`, the share of the baked image, is 0 there) and the app at `high`. Proven pixel for pixel on the film's frames 668 to 675 and on 23 frames of the app on a phone at `high` and 15 on `hd` at `high`, each against d3f0f958. At `low` the frames outside the cover (112, 118, 137, 138, 140, 150) are the same pixel for pixel as before the mend; 120 to 136 differ, as they should.

So the two levels differ in the mirror image: at `low` it swells with the flare, at `high` it holds at its resting strength, since there it is the glass as drawn and the glass is held level through the cover (the "not had" (e)). Two tests in `tests/lens-glare.test.ts` hold the mend: the baked image never falls under what it is at rest through the cover and is at its most under the flash, and the slab's shader lights the baked image by `uImage` and holds no `uPool` or `uPour` in that line.

### 4. How the rise and the fall are eased

`/root` asked for this at 17:46 UTC. In short: they are not eased. The cover is a straight ramp with a corner at each of its four ends, and everything else is a function of it.

The cover (`src/shake/change.ts`, `CHANGE_COVER` and `changeBloom`), first shake, in film frames (the other three are 720, 1440 and 2160 frames on): 0 until 666.47, whole at 673.47 (a rise of 7 frames), whole until 677.97 (4.5 frames), 0 at 683.47 (a fall of 5.5 frames). No ease in or out at any of the four corners. The comment in the code gives the reason it had under the blackout: the exposure falls by the cover as an exponent, so a straight ramp is the room falling by the same share of a stop on every frame.

What reads the cover (`src/scene/lighting.ts`):

- The exposure is 0.005 to the power of the cover: 7.64 stops in all, 1.09 stops a frame on the way down and 1.39 stops a frame on the way back.
- The pour on the table, the base and the dressing, the standing share of the glare (`glare`, 0.3), the veil and the room's tone laid back are straight in the cover.
- The flash is the cover to the fourth power (`sharp`). The halo, which is the pool one sees at the peak, and the flash's share of the glare (`flashGlare`, 0.7) are straight in the flash. Frame by frame: 668 0.002, 669 0.017, 670 0.065, 671 0.175, 672 0.39, 673 0.757, 674 to 677 1, 678 0.978, 679 0.436, 680 0.158, 681 0.041, 682 0.005.
- The pour on the table is the cover times 0.005 to the power of the flash, so it has two small tops, 0.36 of itself at 670 and at 681, and is 0.005 of itself on 674 to 677.

So in the picture the pool comes from next to nothing to whole inside four frames (670 to 674) and is gone inside three (678 to 681): the fall is the steeper side, which is what `/root` measured on its sheets (thing 5 of part 0). `changeBloom` is 0 once the place in the window reaches 1 (film frame 684), so a tail that dies over 12 to 18 frames cannot be written as a function of the window alone.

### 5. What is seen, frame by frame

The first shake, winter to spring, film frames 668 to 682, tier draft (2 samples), `hd`, lavapipe, drawn on the head ca73e182 and looked at in two sheets of cells 397 px wide and one by one. The other three changes go the same way in their own colours (pictures 56 and 61; pictures 52 to 55 have each change in a sheet of its own but are from before the tint, so all four are in the lamps' warm colour there).

| frame | what is in the picture |
| --- | --- |
| 668 | Winter at rest but for the lamps, which have begun to fall. |
| 669, 670 | A rose glow rises round the glass. The base is lit by it, on its side and its top; the frost by the foot takes the colour of the light and stays under white; the lamps are lower. |
| 671 | The glow stands round the ball and the pool lies at the foot, over the lower half of the base; of the lamps two faint discs are left at the right. |
| 672 | The pool is a wide flat oval at the foot, the base is nearly gone in it. |
| 673 to 678 | The ball with the strokes of its storm readable, in a glow that the top edge of the frame cuts; the pool a flat oval below it that ends above the lower edge of the frame; the room dark with a tone; of the lamps one or two faint dots; no base in sight. |
| 679 | The pool has thinned. Spring's petals lie lit on the table; the base is a dark shape in the haze. |
| 680 | Spring's base stands dark under a rose haze, the lamps come back. |
| 681, 682 | Spring, landed: the room lit, the lamps bright. |

The swap is not seen: no frame shows two bases or a base half changed, and no frame shows the dressing of the table change (the frost is last read in 672, the petals first in 678 at the far left and plainly in 679). The step of the picture under the foot from one frame to the next, where the base passes (a band 500 px wide and 100 rows deep from 10 rows under the foot's line, the travel of the globe taken out, mean step of a pixel in levels of luma): 675 to 676 1.95, 1395 to 1396 1.10, 2115 to 2116 2.25, 2835 to 2836 0.72, where the ball itself steps by 4.8 to 7.9 on the same frames. The largest in the six frames of each flash is at the last, as the halo goes: 677 to 678 8.48, 1397 to 1398 9.27, 2117 to 2118 9.47, 2837 to 2838 11.42.

Does it read as a globe that flares and lights the table? In the cells of 297 px of picture 56, yes, in all four, each in its colour. With `/root`'s six things in mind it reads as a globe in a column of light over a bright oval, and that is the next turn.

### 6. The app's own path

The brief: "The app's own path draws the same thing at one sample, at the levels high and low, for a shake and for a jump by a season mark." `/root` at 16:51 UTC: "the app's path (shake, stir, drag and jump still reach the same change)".

The door, by the code: every way into a change in the app goes through `shake(to)` in `src/app/app.ts` (line 313): the Shake control, the Space key (line 511), the phone's own motion (line 337) and the four season marks (lines 364 and 365). It calls the session's `shake()` or `goTo`, and both end in `go(to)` in `src/app/session.ts` (about line 117), which starts the same shake the film has, with the same window and so the same cover. A stir and a drag never change the season (`src/app/replay.ts`): they move the liquid and the camera and nothing in this unit reads them, so their proof is that their pictures did not move.

Drawn on ca73e182 (engine 7bc857d50887da42), one sample, by the app's own loop replayed frame by frame (`out/work/appseq2.mjs`, part 12). The control is pressed at app frame 30 and the globe lands at 174; an app frame is the film frame of the first shake less 546, so the cover shows on app frames 120 to 136. No picture held a pixel that is not a number, and the page gave no error in any run.

| Run | Frames | Against | Result |
| --- | --- | --- | --- |
| Shake, winter to spring, `hd`, `high` | 122 to 136, 15 frames | d3f0f958 (engine bf7d83a7d0c27deb), the state `/root` looked at | the same, pixel for pixel |
| Jump by the summer mark from winter, `hd`, `high` | 122 to 136, 15 frames | d3f0f958 | the same, pixel for pixel |
| Shake, winter to spring, phone, `low` | 112, 118, 120 to 138, 140, 150: 23 frames | the mend 60cd390c before `main` was merged (engine 5bfef7fd57ca3b57) | 21 the same; 122 differs in 3 pixels by at most 2 levels and 126 in 2 pixels by 1 level, inside the glass |
| Jump by the summer mark from winter, phone, `low` | the same 23 frames | the same | the same, pixel for pixel |
| Stir, winter, `hd`, `high` (pointer down at 30, let go at 39) | 29, 34, 39, 60, 120 | d3f0f958, and `main` 5b23a870 | the same as both, pixel for pixel |
| Drag, winter, `hd`, `high` (pointer down at 30, held to 126, let go at 162) | 29, 78, 126, 162, 240 | d3f0f958, and `main` 5b23a870 | the same as both, pixel for pixel |

The five pixels that moved on the phone at `low`: between 60cd390c and ca73e182 the source differs only in files `main` brought (`src/core/chunks/veil.ts`, `src/core/params.ts`, `src/globe/shell.ts`, `src/particles/draw/cards.ts`, `src/seasons/fall/glass.ts`), none of them this unit's.

What the sheets show (not played):

- Shake at `high` on `hd`: the same course as the film's first change, frame for frame (part 5).
- Jump from winter into summer at `high` on `hd` (picture 66): 122 winter; 124 a gold glow rising with winter's base lit by it; 126 to 131 the ball in a gold glow over a flat oval pool, no base in sight; 133 summer's base under a gold haze; 136 summer, the room back, the ball sky blue. The blue is thing 6 of part 0.
- Shake on a phone at `high` (picture 62): the mirror image of the glass is the glass as the slab draws it a second time and holds through the flash. The pool is cut by both side edges of the frame on 125 to 131.
- Shake and jump on a phone at `low` (picture 63 for the shake): the glow under the foot swells once with the cover and goes with it. The count of true black on the head: 0.03 in 100 at 112 and 118, before the cover, and 0.00 on 120 to 150, for the shake and for the jump alike; at `high` on `hd` 0.00 on all 15 frames of each.
- Stir and drag: winter at rest, the liquid stirred, the camera turned in the drag. Nothing of the cover. Count of true black 0.04 in 100 at most, as on `main`.

Not drawn, read from the code only: with reduced motion asked for, a change is a dissolve and has no cover (`src/app/session.ts` line 120); when the look is turned by a drag the place of the glare follows the glass in the turned view (`src/scene/stage.ts` lines 354 to 361).

### 7. The count of true black

The rule of the brief: on every frame of the four windows fewer than 1 pixel in 100 holds a sum of red, green and blue under 4 (8 bit). `/root` at 14:17 UTC: the count is taken at draft on every frame of the four windows, and at final on the four middle frames of each change only (those are `/root`'s to draw).

- Before the job, the first change, even frames 660 to 690, draft, `hd` (the branch at 3b965fca, engine f800ef889b4d6232): 0.07, 0.06, 0.06, 0.06 at 660 to 666, 0.00 at 668, then 0.26 at 670, 1.73 at 672, 2.44 at 674, 2.36 at 676, 2.29 at 678, 0.47 at 680, and 0.00 from 682 to 690. So four frames of the sixteen were over the line. The share at 6 or less was 19 to 32 in 100 on 670 to 680 and the share at 15 or less 45 to 48 in 100: the frame was black but for the glass.
- Now, on ca73e182, the 60 middle frames (668 to 682, 1388 to 1402, 2108 to 2122, 2828 to 2842), draft, `hd`: the largest share under 4 is 0.00 in 100. The least sum of any pixel of 2842 is 14.
- The outer frames of the four windows (the first eight and the last eight of each) were not drawn on the final head: `/root` said not to draw them here. On the first state of this job (609d6d44) the even frames 660 to 690 of the first change were drawn and counted: 0.07, 0.06, 0.06 and 0.06 at 660 to 666, where the cover has not begun and the picture is the one before the job, and 0.00 from 668 to 690. The cover is nothing before 666.47 and after 683.47 (and at the same places in the other three windows), and that has not moved since the first state. So that the outer frames of the other three windows and of the final head are under the line is said from the code and from the first change, not from a drawing of them.
- In the app on a phone: 0.03 in 100 at app frames 112 and 118, which are before the cover, and 0.00 on 120 to 150, at `high` and at `low` alike.

The second rule this job has held since the fifth: no pixel of the lower 38 in 100 of the frame has every channel at 225 or over. The brightest pixel there by its least channel, over the 15 middle frames of each change: 214, 211, 199, 216.

The counting tool, as it was run (`black.py file...`):

```python
import sys
import numpy as np
from PIL import Image
worst = 0.0
for p in sys.argv[1:]:
    im = np.asarray(Image.open(p).convert('RGB')).astype(np.int32)
    s = im.sum(axis=2)
    a = 100.0 * (s < 4).mean(); b = 100.0 * (s <= 6).mean(); c = 100.0 * (s <= 15).mean()
    worst = max(worst, a)
    print('%-34s under 4: %6.2f   6 or less: %6.2f   15 or less: %6.2f   least sum %3d' % (p, a, b, c, int(s.min())))
print('largest share under 4 over %d pictures: %.2f in 100' % (len(sys.argv) - 1, worst))
```

### 8. The four things `/root` saw in the first state (609d6d44), and what they are on the head

All numbers are means of 8 bit levels (red, green, blue) on draft frames of the first shake, `hd`, on ca73e182.

1. The halo was a column to the lower edge of the frame. It became a flat bell that sits between the collar and the foot of the base, 1.4 radii of the glass to the sides, 0.4 upward and 0.33 downward, so the pool is a wide flat oval and ends above the lower edge. The table's front edge (the lowest 40 rows, x 300 to 1620) at 674: (182, 145, 107) in the first state, (78, 53, 56) now, against (58, 41, 46) at 672 and (59, 50, 62) at 680. What `/root` now names a column (thing 1 of part 0) is the other glow, the one round the ball, which the top edge cuts.
2. The ball was one flat peach white at 674 and 676. The glare now has nine tenths of its middle taken out, so it sits round the ball. Inside the ball at 674 the luma runs from 170 to 198 (5th to 95th in 100) where the first state had 208 to 218 and the old cover 180 to 203; the mean step of a pixel from the mean of its 33 px square is 5.1 where the first state had 0.8 and the old cover 3.6. At 676: 4.0, 0.8 and 3.0. So the strokes are read through the peak. The mean luma of the ball at 674 is 184 now, 214 in the first state and 191 under the old cover. Picture 59 has the four peaks at the frames' own pixels. `/root`'s thing 3 of part 0 is the other side of this: the ball no longer clips anywhere.
3. The grains on the table were clipped white dots at 668 to 672. They were three different things and each took the table's whole pour: winter's frost (its own shader), the slab's dust and the slab's lumps of snow (both in the slab's shader). All three now take the smaller pour. The brightest 1 in 100 of the grains by the foot at 670 (x 460 to 580, y 930 to 1000): (224, 210, 183) in the first state, (149, 128, 117) now and (89, 58, 22) under the old cover. Of the lumps out on the table to the right (x 1340 to 1460, y 780 to 860): (209, 215, 206) in the first state, (123, 120, 138) now and (115, 100, 114) at 671; the old cover had (6, 12, 22). Picture 58 has both three times enlarged.
4. The corners were a warm brown at 674 to 678, cold on the frames to either side. The top corners (240 by 160 px each) now go one way, from winter's cold to spring's mauve: (3, 7, 14) at 668, (6, 7, 13) at 670, (14, 12, 17) at 672, (14, 12, 18) at 674 and 675, (17, 14, 19) at 677, (18, 14, 20) at 678, (12, 11, 17) at 680, (13, 12, 18) at 682; the first state had (44, 29, 18) at 674 and the old cover (0, 1, 3).

### 9. Three guards on `normalize`

`/root` asked at 14:36 UTC for a guard on summer's dust off the mound, in the form of the mend in `main`, and for a look at this unit's other arrivals and the cover's new lines for the same shape.

- `src/seasons/summer/arrival.ts` line 157 on the head: `vec2 out2 = (dot(position.xz, position.xz) > 0.0 ? normalize(position.xz) : vec2(1.0, 0.0)) * 0.6 + vec2(sin(turn), cos(turn));`. It was `vec2 out2 = normalize(position.xz) * 0.6 + vec2(sin(turn), cos(turn));`. This is the only line this branch changes under `src/seasons/summer/` (commit 4f157596); `git diff origin/main -- src/seasons/summer/` shows that one line and nothing else. No line of `src/seasons/summer/rig.ts` is changed: the tint reads the rig, it does not write it.
- `src/seasons/spring/slab.ts` line 124: `petalAt += (dot(aRest.xy, aRest.xy) > 0.0 ? normalize(aRest.xy) : vec2(1.0, 0.0)) * petalGust.x;` and `src/seasons/fall/slab.ts` line 78: `leafAt += (dot(leafRest, leafRest) > 0.0 ? normalize(leafRest) : vec2(1.0, 0.0)) * leafGust.x;` (commit ca044c4b). `main` guards the same two lines in the same words since 445e12cd, so the merge took them as one and they show in no diff.
- `tests/glsl-normalize.test.ts` came with `main` and skipped summer's arrival by name (`WITH_ITS_BUILDER`); the exception is out, in the merge commit b876f98d as `/root` asked at 15:27 UTC, and the file's tests pass with summer's arrival read.
- Looked at and left: winter's, spring's and fall's `arrival.ts` hold no `normalize(`; summer's arrival normalizes elsewhere only vectors that carry an offset, a normal, a view and a half vector; the cover's lines in `src/post/post.ts` hold none.

### 10. The motion critic's four issues on the second change (Round 21, R4, 3 of 10)

R4 judged film B's frames 1296 to 2014 on `main`'s older commit 0e1100bb, which held the old cover (the blackout). `/root` passed on the four issues that touch the change at 17:36 UTC and asked, for each, whether this head mends it, mends it in part or does not touch it, with a frame as proof, and for a reading of the code on the second and the fourth. R4's sheets step by 12 to 14 frames (1374, 1386, 1400, 1412, 1426, 1438); that matters for what it saw. My frames are draft, `hd`, on ca73e182: 1380, 1384, 1386, the fifteen middles 1388 to 1402, 1404 to 1412 in twos, 1420, 1426, 1436, 1446, and 1290, 1338 and 1350 for the third issue. Picture 64 is the course of the cover, picture 65 the foot and the table.

**Issue 1.** "1386 to 1412: room, bokeh and reflections plunge to pitch black, then pop back at 1412 in warm gold; spring's base and petals pop in plain view into summer's; the interior fog jumps to electric cyan and yellow, olive gold at 1426." Mended in part.
- The black: gone. The share of pixels under 4 is 0.00 in 100 on every frame drawn of the second shake, 1380 to 1446 (27 frames) and 1290, 1338 and 1350. The room keeps its tone through the cover and comes back with it, not in a step: the cover begins to fall at 1397.97 and is gone at 1403.47 (picture 64: 1400 with the cover at 0.63, the room dim under a gold haze; 1404 the room whole).
- The swap in plain view: not seen on this head. The petals lie in the gold light on the table up to 1392; on 1394 to 1398 base and table are under the flat pool of the lens (the "not had" (a) of part 0, and thing 2); summer's base is first in sight at 1400, soft under the gold haze. No frame shows one base give way to the other. What is seen in its place is the oval.
- The fog in the glass: not mended on this head. Between the grains the body of the ball reads sky blue from 1400 to 1410, (148, 172, 187) at 1400, (116, 159, 183) at 1402, (94, 142, 164) at 1404, (103, 141, 160) at 1408, (138, 157, 167) at 1410, then cream at 1412, (190, 179, 163), and gold at 1420 and 1426, (179, 146, 94) and (162, 132, 80). That is R4's "electric cyan" and "olive gold". The cause is found and is not the cover: part 0, thing 6. `/root` gave the mend to this unit at 18:55 UTC; it is the next commit on the branch and is not in ca73e182.

**Issue 2.** "1296 to 1438: the globe barely lifts (about 5 px), small even oscillations, nearly stops 1374 to 1386, at 1400 jumps about 28 px right and about 30 px higher, whips left with tilt at 1412: two animations stitched." Not touched: the path of the globe in the hand, the cut and the camera are not this unit's ("Do not touch the simulation, the cut, the cameras or the sound"). My reading of the code:

- Where the path is written: `src/shake/table.ts`. `HAND` (line 67) is the hand of the stills and the preroll, `HELD` (line 162) the hand of the film's shakes and of the app. It is one path for each shake from the lift to the landing, not two pieces joined: lift over 1 beat, six strokes over 2 beats, set down over 1 beat, 36 frames a beat. Its sizes are in `config/showcase.json` lines 157 to 159: `liftMm` 7.25, `strokeMm` 25, `tiltDeg` 6, on a sphere of 120 mm.
- The camera of a shake is `MOVES.wide`, the hero camera, and it does not follow the globe (`src/film/moves.ts` lines 114 and 501: "it stays where it holds it, on the glass, and does not follow the globe"). The hero frame is 172.9 mm tall, about 6.2 px a mm on `hd`, so the lift of 7.25 mm is about 45 px on `hd` and about 9 px in a cell 400 px wide.
- The strokes are meant to be that small. `kit/PROGRESS.md` decisions 29, 35 and 45 took the lift from 18 mm to 13.5 and then under the kit's own floor, because the lifted globe came within 2 px of the top edge of the hero frame (open item 29); decisions 64 to 66 set the strokes to 25 mm, "as long as the pins allow" (lines 619 and 682: the liquid engine's pins hold for 22 to 25). The same reading has come from the motion critics before: open items 71, 81 and 127 in `kit/PROGRESS.md` ("The globe barely moves in the hand", "a low lift, even strokes, little tilt").
- The pose of the second shake, from the path itself (`globePoseAt`): the lift reaches 7.2 mm by frame 1320 and holds 5.4 to 7.2 mm until the set down. The six strokes turn at x -24.4, +20.7, -18.0, +16.5, -19.7 and +25.6 mm, at beats 1.18, 1.49, 1.87, 2.32, 2.65 and 2.89, which are about frames 1338, 1349, 1363, 1379, 1391 and 1400. So the strokes are not even: they shrink to the fourth and grow again, and the last, at 1400, is the largest and goes to the right.
- "Nearly stops 1374 to 1386": the pose is x 7.2 mm at 1374, 14.3 at 1380 and -6.2 at 1386. There is no stop; R4's two frames fall on either side of the fourth stroke, the smallest, and both lie near the middle.
- "At 1400 jumps about 28 px right and about 30 px higher": 1400 is the turn of the sixth stroke, +25.6 mm, about 160 px to the right of the middle on `hd`; against 1386 (-6.2 mm) that is a step to the right in R4's sheet, as it saw. The pose holds no rise there: y is 5.7 mm at 1386, 5.4 at 1398 and 7.2 at 1404, at most 1.8 mm, about 11 px on `hd`. The pictures agree: the middle of the ball, found from its cap, is (952, 426) at 1386 and (1154, 421) at 1400 on `hd`, 202 px to the right and 5 px higher. It stands at y 417 to 426 on every frame from 1338 to 1426 where the cap is clear of the glare, against 466 at rest (1290).
- "Whips left with tilt at 1412": the strokes end and the set down begins at beat 3, frame 1404; the path carries its last swing into the set down (decision 59), a turn of -11.4 mm at beat 3.36, about frame 1417, while the tilt goes from -5.4 to +3.8 degrees between 1404 and 1416. That is written, not a seam. The globe lands at 1440 and rocks (y 2.1 mm at 1446).
- These files are the same on this head as on the judged commit, so the motion R4 saw is the motion here. What this job changes in R4's picture of it is only what lies over frames 1386 to 1403.

**Issue 3.** "The petals on the table are frozen; at 1400 to 1412 sand piles, contact shadow and light wedges are pinned under an airborne base." `/root`: "Yours: the shadow and the mirror image of the shared stage against the globe's height." Not changed by this job.
- By the code the slab reads the foot on every frame: `src/scene/surface.ts` line 625 sets `uFoot` to the globe's x and z, the foot's radius and the lift (`su.uFoot.value.set(g.x, g.z, footRadius, g.y)`) and line 627 the lean; `slabShade` (line 278) lets the tight shadow of contact go as the foot lifts (`contactLiftMm` 1.2) and keeps a wide soft one, and the mirror image is the stage drawn a second time from where it stands.
- Proof (picture 65): 1290 at rest; 1338, lifted 6.9 mm and 24.2 mm to the left; 1350, lifted 6.9 mm and 19.2 mm to the right. The dark under the base goes with the base both ways, and the petals it stood beside lie bare where it left. On 1404, 1408 and 1412 (lifted 7.2 mm; 12.9 mm right, 4.8 mm right, 3.6 mm left) the base passes over summer's sand, the dark under it goes with it, and its mirror image stands under it at the lower edge. In 1338 and 1350 the mirror image is cut by the lower edge of the frame and is not read.
- What R4 saw and is still there: nothing that lies on the table moves when the globe is lifted. The petals lie still. Summer's sand heaps, which are heaped against the foot at rest (`src/seasons/summer/slab.ts`: "a cone at the sand's angle of repose with its top against the foot"), come up in the window while the globe is 7 mm in the air, so the lifted base hangs over a heap whose hollow is where the base will land. The bright wedge on the left is the long streak of that sand in the key light. The heaps are this unit's files and were not part of this job. Not mended.

**Issue 4.** "1296 to 1386: the petals translate rigidly with the glass, then a milky pink blur washes over." Not touched: the particles and the veil in the glass are not this unit's. My reading of the code:

- The particles are kept and moved in the glass's frame, not in the room's. `src/particles/engine/engine.ts` line 1185 steps the liquid model with the hand's pose before, at and after the instant (`this.model.step(globePoseAt(tl, t - DT), globePoseAt(tl, t), globePoseAt(tl, t + DT), t)`), and the model (`src/globe/liquid.ts`) turns the hand's motion into a flow inside the glass. What the glass's travel does to them is modelled, not integrated: a slosh with a gain of 0.3, a time of 0.22 s and a length of 30 mm (`SLOSH_GAIN`, `SLOSH_SECONDS`, `SLOSH_LENGTH_MM`, lines 38 to 40), and a load that the liquid carries, thrown at most 30 mm (`CARRY` 2, `LOAD_MAX_MM` 30, lines 65 and 66).
- The sizes: the comment at line 727 of `src/globe/liquid.ts` gives the slosh as 20 to 90 mm/s while the hand strokes. The hand's fastest stroke in the second shake is 261 mm a beat, which is 435 mm/s. So of the glass's travel the particles are given four fifths or more outright and lag by a fifth or less; to the eye they go with the glass. In the room's frame a petal in water would stay nearly where it was for the first instant of a stroke and the wall would come to it.
- The "milky pink blur" is the veil in the glass rising with the storm; it is the glass's and the air's (`src/core/chunks/veil.ts`, each season's `glass.ts`), not the cover, which begins at 1386.47.

### 11. The checks on ca73e182 (engine 7bc857d50887da42, which holds `main` 5b23a870)

All run in this VM on the merged head, one after another, 18:06 to 18:59 UTC.

- `npx tsc --noEmit`: 0 errors.
- `npx vitest run`: 57 files passed, 1 skipped; 775 tests passed, 8 skipped.
- The strict run on all eight keys (`npm run strict`), last line: "strict: pass, 8 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, and against its own --same picture where that one differs (engine 7bc857d50887da42, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move". 30 of the 32 rows read "0 pixels differ". The two that do not are `winter-shake`'s, "2 pixels differ, largest step 1, box 547,194,572,212", the same two pixels as in every strict run since the third job.
- `node tools/measure.mjs --unit change --tier draft`: "measure change: complete · 24 of 24 lines, 0 red · draft · 205 s". M4 (the miniature hidden in the middle of the window, threshold 0.85): 0.9874, 0.8968, 0.9601, 0.9631 for the four shakes. M5 (the miniature seen after the landing, threshold 0.6): 0.9804, 1, 0.9712, 0.9998. M6 (particles inside a solid, threshold 0.002): 0.000441 at most.
- `npm run gate -- --phase 4 --only G11,G12`: "gate, phase 4: all 2 green".
- `npm run determinism`: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 194 s".
- The count of true black on the 60 middle frames, draft, `hd`: "largest share under 4 over 60 pictures: 0.00 in 100". On the fifteen further frames of the second shake drawn for part 10 (1290, 1338, 1350, 1380, 1384, 1386, 1404 to 1412 in twos, 1420, 1426, 1436, 1446): 0.00 on every one.
- The eight keys at rest and landed (`winter-rest`, `winter-shake` and so on, 960 by 540, drawn by `out/work/keys8.mjs`) against the same eight drawn on `main` 5b23a870 in a second tree: all eight the same picture, pixel for pixel. None moved.
- The 60 middle frames against the same 60 drawn on af9dca04 (the head before `main`'s last merges): the 45 of the first, second and fourth change are the same, pixel for pixel. All 15 of the third change (2108 to 2122) differ, inside the glass only, in few pixels by small steps: at most 0.06 in 100 of the pixels of a frame (2122), the largest step 7 levels (2109 and 2116), and the share that moves by more than 4 levels is 0.00 in 100 on every frame. A correction to what I told `/root` at 18:07 UTC: I gave the cause as the order of drawing. It is not. Between af9dca04 and ca73e182 `main` brought guards into summer's and fall's glass (e235f76b, `src/seasons/summer/glass.ts`, and the `atan` guards of 976e271e), and the third change is the one that holds summer's and fall's glass together.
- The app's path: part 6.

### 12. For the next builder: how the pictures and the numbers were made

Nothing under `/tmp` and nothing under `out/work/` is kept: the tools of this job are gone with the machine. The three that draw are here in full, the rest are a few lines each and are said in words.

- **One machine, one render at a time.** Everything was drawn by lavapipe in this VM: tier draft (2 samples), `hd`, about 8.5 s a film frame. An app shake of 15 frames on `hd` at `high` takes about 130 to 160 s, 23 frames on a phone about 170 s at `high` and 80 to 95 s at `low`. `npx vitest run` about 140 s, `npm run strict` on eight keys about 17 min, the measure 160 s, the gate 30 s, determinism 217 s. No build while a render runs; the work was chained in one shell script that wrote a line to a log after each step, and the script was never edited while it ran.
- **Film frames by number** (`out/work/filmlist.mjs`, run in the repo): `node out/work/filmlist.mjs --tier draft --format hd --calls 668,669,670 --stop <epoch seconds>`. The frames land in `out/work/seq/film-hd-draft/film-000668.png`; remove the file first if the frame was drawn on another engine.

```js
import { parseArgs } from '../../tools/lib/paths.mjs'
import { Session } from '../../tools/lib/page.mjs'
import { readPlan, renderFrames, sourceOf } from '../../tools/lib/sheetlayout.mjs'
const args = parseArgs(process.argv.slice(2))
const stopAt = Number(args.stop) * 1000
const o = { tier: String(args.tier), format: String(args.format), assets: 'full', diag: '', force: true, deadline: stopAt }
const calls = String(args.calls).split('/').map((r) => r.split(',').map(Number))
const stamp = () => new Date().toISOString().slice(11, 19)
const session = await Session.open({ what: `filmlist ${process.argv.slice(2).join(' ')}` })
try {
  const page = await session.page({ format: o.format, assets: o.assets })
  const src = sourceOf(await readPlan(page), 'film')
  for (const call of calls) {
    if (Date.now() > stopAt) {
      console.log('out of time before', call.join(','))
      continue
    }
    const r = await renderFrames(session, page, src, call, o, async (i, file) => console.log(stamp(), 'frame', i, file))
    console.log(stamp(), 'call', call.join(','), 'rendered', r.rendered, 'of', r.total, 'complete', r.complete, 'seconds', r.seconds.toFixed(0))
  }
  console.log('errors', page.errors.slice(0, 5).join(' | '))
} finally {
  await session.close()
}
```

- **The app's own frames** (`out/work/appseq2.mjs`): a scripted walk of the app (`shake`, `jump`, `stir`, `drag`; `src/app/replay.ts`), each frame at the level's one sample. `node out/work/appseq2.mjs --app shake --from winter --format phone --level low --frames 118,122,127 --dir /tmp/dir`; for a jump add `--to summer`. The first line of its output is the plan with its events. In a shake and a jump the control is pressed at app frame 30 and the globe lands at 174; an app frame is the film's frame of the first shake less 546; the cover shows in app frames 120 to 136.

```js
import fs from 'node:fs'
import path from 'node:path'
import { parseArgs } from '../../tools/lib/paths.mjs'
import { Session, cfg } from '../../tools/lib/page.mjs'
import { appSource, renderFrames } from '../../tools/lib/sheetlayout.mjs'
const args = parseArgs(process.argv.slice(2))
const o = { tier: 'draft', format: args.format ? String(args.format) : cfg.formats.preview.id, assets: 'full', diag: '', force: true, deadline: Date.now() + 3600e3 }
const dir = String(args.dir)
fs.mkdirSync(dir, { recursive: true })
const stamp = () => new Date().toISOString().slice(11, 19)
const session = await Session.open({ what: `appseq2 ${process.argv.slice(2).join(' ')}` })
try {
  const page = await session.page({ format: o.format, assets: o.assets })
  const ask = { ...(args.from ? { from: String(args.from) } : {}), ...(args.to ? { to: String(args.to) } : {}) }
  const plan = await page.evaluate(([n, a]) => window.showcase.dev.appScript(n, a), [String(args.app), ask])
  console.log(JSON.stringify({ frameCount: plan.frameCount, fps: plan.fps, events: plan.events, from: plan.from, to: plan.to }))
  const src = appSource(plan, String(args.level || 'high'))
  const list = String(args.frames).split(',').map(Number)
  const t0 = Date.now()
  await renderFrames(session, page, src, list, o, async (i, file) => {
    const s = await page.evaluate(() => { const c = document.querySelector('canvas'); return { ...window.showcase.dev.sanity(), canvas: c ? [c.width, c.height] : null } })
    fs.copyFileSync(file, path.join(dir, `app-${String(i).padStart(6, '0')}.png`))
    console.log(stamp(), 'frame', i, 'no number:', s.invalid, 'values of', s.pixels, 'pixels, canvas', JSON.stringify(s.canvas))
  })
  console.log('seconds', ((Date.now() - t0) / 1000).toFixed(0), 'engine', JSON.stringify(await page.evaluate(() => window.showcase.info().engineHash ?? null)))
  console.log('errors', page.errors.slice(0, 5).join(' | '))
} finally {
  await session.close()
}
```

- **The eight keys as the strict run draws its plain picture** (`out/work/keys8.mjs <dir> <key,key,...>`; preview, draft), to compare two commits pixel for pixel. The strict run leaves the same pictures in `out/work/strict/none/`.

```js
import path from 'node:path'
import { Session, stillSpec, renderStill, requireBuild } from '../../tools/lib/page.mjs'
const dir = path.resolve(process.argv[2])
const keys = process.argv[3].split(',')
const engine = requireBuild()
const session = await Session.open({ what: 'keys8' })
try {
  for (const key of keys) {
    const spec = stillSpec({ key, format: 'preview', tier: 'draft' })
    const r = await renderStill(session, spec, { file: path.join(dir, `${key}.png`), force: true })
    console.log(new Date().toISOString().slice(11, 19), key, r.reused ? 'reused' : 'rendered', r.record.engineHash, r.record.seconds)
  }
  console.log('engine', JSON.stringify(engine))
} finally {
  await session.close()
}
```

- **The other side of a compare** was a second worktree at the commit of `main` that the head holds, built there (`npm run build`) and drawn with the same scripts, so both sides hold everything of `main` and what differs is this branch alone. The tools serve the `dist` of the tree they are run in.
- **Compares** are pixel for pixel on the 8 bit pictures: the count of pixels in which any channel differs, the largest step, and the box they lie in. "The same" in this text always means no pixel differs.
- **The numbers of the picture**: the pool's heart and skirt are means over x 900 to 1020 and x 300 to 420 of the 40 rows about the brightest row under the ball; the ball's luma is the mean of a disc of 230 px about (960, 400); the corners are 240 by 160 px each; the front edge is the lowest 40 rows, x 300 to 1620; the mirror box on a phone is rows 70 to 82 in 100 and x 31 to 50 in 100 of the frame. Luma is 0.2126, 0.7152, 0.0722 of the 8 bit levels.
- **Where the ball is in a frame**: the largest bright shape of the upper six tenths of the frame, its holes filled, and a circle fitted by least squares to the upper part of its outline; the misfit of the outline to the circle was 1 to 4 px on the frames of the flash.
- **The course of the cover and the pose of the globe without a drawing**: `npx vite-node <file>.ts` on a few lines that import `changeBloom` and `CHANGE_COVER` from `src/shake/change`, `CHANGE_BLOOM` from `src/scene/lighting`, and `filmTimeline`, `defaultGrid`, `globePoseAt`, `eventAt`, `prerollSeconds` from `src/film/timeline` (the instant of film frame n is `prerollSeconds + (n + 0.5) / fps`). The first window begins at film frame 648 and is one beat, 36 frames, long.
- **Sheets**: cells with the label in a margin under each, never over the picture. The looks are JPEG, at most 1200 px on the long edge, at most four a push, with `captions.txt`.
- **Before a push of code**: fetch, merge `origin/main` (never rebase), `git merge-base --is-ancestor origin/main HEAD`, a clean tree, `npx tsc --noEmit` and `npx vitest run` on the merged head. `main` was merged into the branch fourteen times in this job; the merges were small but each one costs a vitest run.
- **What moves a film frame that this branch did not touch**: a guard in a shader of `main` can move a few pixels inside the glass by a few levels (part 11 has the case). Compare against the `main` the head holds, not against an older drawing.

## The state after the sixth job

Written 2026-11-26 about 13:40 UTC. Six jobs were done on this branch. The newest state is here; the fifth job's state follows, then the fourth, the second and third, then the first job's text as it was written.

Head of the branch: 3b965fca, which is the commits 94cfd6fe and cc3a1ba7 with `main` merged in five times (66a757c2 at `main` 9135eca1, 97257b96 at dd65a4a2, 10cb1fb6 at 10f6c5bd, b2b28e14 at 10c4c2b6, 3b965fca at 910fbd9f). `main` holds the first five jobs (the fifth as e02383a3). The head differs from `main` (910fbd9f) under `src/` in two files only, `src/seasons/winter/frost.ts` and `src/seasons/fall/glass.ts`, and builds to the engine f800ef889b4d6232. Nearly every picture and most checks below are from an earlier head, 66a757c2, which is the two commits on `main` 9135eca1 and builds to f5f4fbccf375f470. `main` moved four times after it; one of the four (10f6c5bd, summer's second list) changed ten files under `src/`, all summer's or the particles' drawing and none of them this unit's, and so moved the engine. `/root` chose the earlier push at 12:58 UTC and takes strict, determinism and the gate on the head that holds summer's third list into its own round. What was drawn on the pushed head's own engine is told in part 5. Every picture and check below names the engine it is from.

The sixth job was the dots on the sides of the glass, which the fifth job looked into and did not mend. In short: winter's frost on the glass and fall's crack are mended; summer's flares are not (they are in another builder's hands); what the count still finds in the app after the mend is named part by part under "What still shows": most of it is the base's pass at one sample, which is this unit's and has stood since the fourth job.

### 1. Winter's frost on the glass goes by its cover

Commit 94cfd6fe, "Winter's frost on the glass leaves and comes by its cover, not as dots". `src/seasons/winter/frost.ts`, the first shader (`GLASS`), four lines; `/root` gave the file to this unit for the job at 11:33 UTC.

What was wrong: under a shake the frost on the glass left by `stageGone()`, a hash to a pixel. The app draws one sample a frame, so a pixel held the frost whole or not at all, and the frost on the rim stood as single dark pixels for the frames it left.

What it is now: the frost is thinned by the share of it that stays, `seen`: one less the change for the season that leaves, the change for the season that comes, times its presence (`uFlags.w`). The line is `float seen = (uState.w > 1.5 ? 1.0 - c : uState.w > 0.5 ? c : 1.0) * uFlags.w;`, then `if (seen <= 0.0) discard;` in place of `if (stageGone(c)) discard;`, and `gl_FragColor *= seen;` after the colour is set. The frost's colour is already times its cover and is laid over what is behind (blend one, one less the cover), so the frost times `seen` over a ground is the mean of the samples that kept it and the samples that dropped it. At rest `seen` is 1. The views that say which part a pixel is (`uDiag`) read the cover that is left. The frost on the table (`SHEET` and `SHAPES` in the same file) still leaves by `stageGone()`: it was not asked and was not looked at.

Tests, in `tests/shake-change.test.ts`: the shader thins by the share and no longer drops by the hash; the share is the part of all hashes the old rule kept, for each mode, change and presence; a thinned picture over a ground equals the mean of the kept and the dropped.

Seen leaving in the app (one sample a frame, a shake from winter to spring, lavapipe), before from `main` 0e9dbcca (engine 06926917ace0eb4c), after from 66a757c2 (engine f5f4fbccf375f470). The count is the one `/root` named: pixels darker than every one of their eight neighbours by more than 40 levels of luma, in the whole frame.

| app frame | 121 | 122 | 123 | 124 | 125 | 126 | 127 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `hd`, level high, before | 17 | 2 | 34 | 279 | 810 | 1328 | 149 |
| `hd`, level high, after | 16 | 1 | 3 | 0 | 0 | 27 | 149 |
| `phone` (390 by 844), level low, before | 7 | 0 | 10 | 36 | 97 | 144 | 13 |
| `phone` (390 by 844), level low, after | 7 | 0 | 0 | 0 | 0 | 3 | 13 |

By eye, at the frames' own pixels and enlarged: before, the band of frost on the rim is a pepper of single dark pixels in 123 to 126 at both sizes; after, it is an even veil that thins from frame to frame and is gone in 127. Pictures 39 and 40 (`hd`) and 41 (`phone`). Frame 127 is the same picture before and after, pixel for pixel: the frost is gone by then. What the count still finds after is told under "What still shows".

Seen coming: nothing of the frost is drawn while winter comes, before or after. `src/seasons/winter/arrival.ts` sets the frost's growth to nothing for as long as the two seasons are in the picture under a shake (`frost.setGrowth(0, 0, 0, 0)`), and the frost grows from the landing on by its own rule. So in a shake from fall to winter, app frames 132 to 137, the picture is the same before and after, pixel for pixel, at `hd` and at `phone`, and the glass is clear in all six. Picture 47. The mend's other branch (the change for the season that comes) is reached only if winter comes without a shake; that was not drawn.

### 2. Fall's crack goes by its cover

Commit cc3a1ba7, "Fall's crack in the glass leaves and comes by its cover, not as dots". `src/seasons/fall/glass.ts`, the `CRACK` shader, the line `/root` named (533) and the two that go with it.

What was seen before, in the app at one sample a frame, a shake from fall to winter, `hd`, level high (`main` 0e9dbcca, engine 06926917ace0eb4c): in app frames 121 and 122, the first two of its leaving, the crack's lines are broken into dots and dashes; from 123 on it is too dim to tell. On the `phone` at the level low it is a faint hair with gaps. So it stood as dots, and it is mended the same way: the same `seen`, `gl_FragColor = vec4(col, alpha) * seen;`. Fall's fog and lip on the glass already thinned this way.

Seen after (66a757c2, engine f5f4fbccf375f470): the crack is an even line that dims over 121 to 126 and is gone in 127. Picture 42. The two pictures of a frame differ in 2331 pixels in 121 (largest step 75 levels), 2356 in 122 (42), 2333 in 123 (17), 2294 in 124 (7), 2073 in 125 (4), 1357 in 126 (4) and 0 in 127, all on the crack's lines; on the `phone` 444 (25), 493 (20), 448 (6), 431 (3), 386 (2), 189 (2) and 0. The count of dark pixels is the same before and after in every frame (3, 3, 6, 3, 0, 9, 48 at `hd`): the crack is a bright line, so its gaps were never dark pixels, and what the count finds there is inside the glass.

Seen coming: nothing of the crack is drawn while fall comes, before or after. In `src/seasons/fall/glass.ts` the crack spreads only from the landing (`crackSpread(since)`), and the season that comes has nothing until it lands. A shake from summer to fall, app frames 132 to 137, `hd`, level high: no crack in any of the six, and the picture of 66a757c2 (engine f5f4fbccf375f470) is the picture of the same tree with fall's `glass.ts` as `main` 9135eca1 has it (engine ae0b32d470fef994), pixel for pixel, in all six. Not drawn on the phone. As with the frost, the mend's other branch is reached only if fall comes without a shake, which was not drawn.

Test, in `tests/shake-change.test.ts`: the shader thins by the share and no longer drops by the hash, and what it thins is colour and cover together.

### 3. The film

Film frames at `final` (24 samples), `hd`, lavapipe. Before: `main` 0e9dbcca (engine 06926917ace0eb4c). After: 66a757c2 (engine f5f4fbccf375f470), which holds `main` 9135eca1. To be sure the two `main`s do not differ in these frames, 2840, 670 and 2830 were drawn once more from the head's tree with the two mended files as `main` 9135eca1 has them (engine 8c80c39c45d29cce): each is the picture of 0e9dbcca pixel for pixel. So what follows is what the two mends move and nothing else.

| film frame | what it is | pixels that move | largest step | over 1 level |
| --- | --- | --- | --- | --- |
| 670 | the frost leaves (first shake, app frame 124) | 113,794 (5.49 percent of the frame) | 34 | 75,365 |
| 2840 | winter comes (fourth shake, app frame 134) | 960 | 1 | 0 |
| 2830 | the crack leaves (fourth shake, app frame 124) | 2,586 | 2 | 7 |
| 2120 | fall comes (third shake) | 0 | 0 | 0 |

670 is the one to look at, and it is said plainly: the picture after is not the picture before less its grain. Picture 43 (the right half of the glass at its own pixels) and 44 (the rim three times as large).

- What is seen. Before: the frost on the rim is a fine dark grain at the frame's own pixels, with 24 samples. After: an even veil, no grain. By the count at 20 levels (no pixel is darker than its eight neighbours by 40 in either): 11 in luma and 17 in a channel before, 0 after.
- What else moves. Of the 113,794 pixels, 31,590 move by more than 4 levels, 9,638 by more than 8 and 519 by more than 16; the largest step, 34, is at x 1024, y 164. The mean step over the frame is 0.74 of a level darker. Smoothed, so that grain falls out (after less before, the mean of the three channels over a square of 9, 17 and 33 px): from 11.9 darker (x 1107, y 569) to 5.2 brighter (x 563, y 636) at 9 px; from 10.5 darker (x 1111, y 565) to 2.2 brighter at 17 px; from 8.0 darker to 0.9 brighter at 33 px. So there are patches: the largest is low on the right of the glass, about 30 px across, where the picture after is up to 12 levels darker; a fainter one, brighter, is low on the left.
- Why. Shown by a trial. Under the old rule the frost was dropped by `stageGone()`, and that reads the hash every other part reads, `stageHash(vec3(gl_FragCoord.xy, uSeed))`, at the same pixel and the same sample. A part that leaves is gone where the hash is under its change, a part that comes shows there. So the frost and what lies behind it went by one throw: the samples that dropped the frost first were the samples that showed the new season first, and the frost stayed longest over the old. It was never spread evenly over what leaves and what lands. Write f for the change the frost reads, i for the change the part behind it reads, K for the frost's cover, D for the colour that leaves behind the frost and L for the colour that lands. With the blend the shader uses (the frost's colour over what is behind, one less its cover), the mended mean of the samples less the old mean is K times the smaller of f and i, times one less the larger of the two, times (D less L). It is nothing before and after the change and largest midway. The mended frame is darker where what lands behind the frost is brighter than what leaves, and brighter where it is darker. The trial: the frost with the old rule (kept or dropped whole in a sample) but on a hash of its own, `stageHash` of the pixel moved by 17 and of the seed moved by 0.37 (engine e8497d0931a57a22, never committed). Its frame 670, smoothed as above, is the mended frame to within 3.8 levels at 9 px (the trial keeps the grain), 2.0 at 17 px and 1.0 at 33 px. Against the frame before it shows the same patches at the same places: 13.9 darker at x 1107, y 570 and 5.0 brighter at x 563, y 636 at 9 px; 11.5 and 2.4 at 17 px; 8.5 and 1.0 at 33 px. So the patches are not something the thinning adds. They are the tie between the frost's dots and the inside's dots, which the old picture had and the mended one does not. The formula is the blend's arithmetic; it was not checked pixel by pixel against pictures of the two insides.
- One pixel of the picture after, x 1128, y 617, is brighter than its eight neighbours by 13 levels of luma (150, 135, 127 on a ground of about 129, 120, 119). It lies in the band of frost on the rim, where the frost has glints of its own (`frostGlints`); before, the grain there is as large. I did not follow it further.
- Only 670 of the frost's leaving was drawn at `final`. The film frames beside it (667 to 669, 671, 672) were not drawn after the mend, so the leaving was not seen as a run of film frames; in the app's frames 121 to 127, one sample each, it is an even veil that thins.

2840: the 960 pixels lie at x 1151 to 1403, y 196 to 469, on the right of the glass, each by one level. Drawn once more with the frost as `main` has it and the crack mended (engine aaaaaa275320708b), 2840 is `main`'s picture pixel for pixel, so the frost's mend moves them and the crack's does not. So something of the frost is drawn there while winter comes, so faint that it shows only as a level's rounding in a film frame; in the app's frames 132 to 137 no pixel differs. I did not find out what it is.

2830: the 2,586 pixels lie along the crack's lines (x 494 to 911, y 104 to 692) and about 20 of them are scattered a little off the lines (x 830 to 910, y 250 to 360). By eye the two pictures are the same at three times their size. Picture 45.

2120: the same picture, pixel for pixel.

### 4. The rest keys

The four rest keys (camera hero, `hd`, final, 24 samples) from 66a757c2 (engine f5f4fbccf375f470) differ in 0 pixels, largest step 0, from the same four of `main` 0e9dbcca (engine 06926917ace0eb4c), which is `main` as the fifth job was merged into it (e02383a3) with summer's assets made again (3b9091ca, no file under `src/`). Against e02383a3 itself no key was drawn. The page's own count of values that are no number is 0 in all eight pictures.

### 5. What was drawn on the pushed head's own engine

The pushed head, 3b965fca, builds to the engine f800ef889b4d6232. On that engine the app's own path was drawn for the two ways the job mends: a shake from winter to spring at `hd`, level high, app frames 123 to 126, and a shake from fall to winter at `hd`, level high, app frames 121 and 122. Each of the six is 0 pixels from the picture of 66a757c2 (engine f5f4fbccf375f470) that the looks branch shows as "after". The stand-ins view of winter and of fall was drawn once each on the same engine at 960 by 540: 0 pixels that are not 0 in both, so no part is drawn as a stand-in there. The strict run on four keys is told under the checks.

### 6. The 28 pixels of film frame 1395, left over from the fifth job

Ended, and not this unit's. The 28 pixels of film frame 1395 (final, `hd`) stand between the fifth job's "before" picture, drawn at 09:45 UTC, and every picture of that frame drawn since. Drawn again on four trees, each time on a fresh page: x1 (engine 5138daec5baa9eb4), x3 (engine 972ed45362d50c31) and x2 (engine 924ef24df0a377e7) each drew the head's picture. x4a is the tree the "before" picture itself names (tree 632d9514, engine b2552a068a75a0bc), frame 1395 drawn alone at 13:32 UTC: 28 pixels against the "before" picture (largest step 2 levels, one pixel over 1 level, in a box x 857 to 1242, y 632 to 680) and 0 pixels against the fifth job's head. x4b is the same tree with frame 675 drawn first and 1395 after it on one page, as the morning's run did: 1395 is again 28 pixels from the "before" picture and 0 from the fifth job's head, and 675 is 0 pixels from its own "before" picture. So the "before" picture of 09:45 is a one-off that its own tree does not draw again; no change of source makes it and none unmakes it. The cause was not found. What was not tried: the morning's exact order of all frames drawn on that page, and a second machine.

### What still shows, worst first

1. Film frame 670 after the mend differs from before in patches, as told under "The film". I hold the picture after for the better one (no grain on the rim, and the tone is the one the app shows), but it is a change of a `final` frame of the film by up to 12 levels over patches about 30 px across, and `/root` said the film must not get worse. If the film is to stay as it was, the film's samples can keep the old rule and only one sample thin: `uPass.w > 1.5` tells them apart in the shader. That was not built.
2. The base's pass at one sample, this unit's, left over from the fourth job (the brief allowed it to stay): in the app the new base comes by its hash, and where it stands above the old base against the lit glass that is a band of single dark pixels along the foot's upper line, 15 to 25 px high at `hd`. In a shake from winter to spring it is what the count still finds after the mend: 27 pixels in app frame 126 and 149 in 127 at `hd`, 3 and 13 on the `phone`, and the view that names the part of every pixel (`ids`) says `base-spring` at every one of them. The fourth job saw it in 126 to 131. Picture 46. One sample holds one base or the other at every pixel, so there is nothing to thin; a mend would have to be another way for the base to pass in the app, and none was tried.
3. In app frame 121 of the same shake the count finds 16 pixels after (17 before): by the `ids` view 10 are the liquid's, 2 the new miniature's, 2 the table's frost, 1 the glass and 1 the frost on the glass. Those inside the glass are not this unit's.
4. The inside's own change at one sample is a fine pale grain over the lower inside in app frames 121 to 127 (pictures 40 and 41, the same before and after). It is the miniature and the liquid changing by the hash; inside the glass, not this unit's.
5. Summer's flares still leave by the hash (`src/seasons/summer/glass.ts`, now at lines 222, 262 and 345 after summer's second list). The file is in another builder's hands; `/root` passed the formula on. Not drawn.
6. Winter's frost on the table (`SHEET` and `SHAPES` in `frost.ts`) still leaves by `stageGone()`, with the table's front. Not asked; in app frame 121 two of the pixels the count finds are its.
7. The frost commit's message (94cfd6fe) says a film frame "holds what it held, less the noise". That is not exact, as 670 shows; the commit is pushed and history is not rewritten, so the correction stands here.

### Not seen in the sixth job

- Summer's flares, and summer leaving at one sample at all.
- Either mended dressing coming by the change: neither is drawn while its season comes under a shake (see above), and a change without a shake was not drawn.
- A phone at the level high (a canvas of 780 by 1688); the crack's coming on the phone; 4K.
- Anything moving. lavapipe draws well under a frame a second; every judgement here is from still frames laid side by side.
- The film frames beside 670 at `final` after the mend.
- The rest keys against e02383a3 itself: they were compared with `main` 0e9dbcca, which is e02383a3 and one commit more (3b9091ca, summer's assets made again, no file under `src/`).
- On the pushed head's own engine (f800ef889b4d6232) only what part 5 names was drawn: six app frames at `hd`, two stills of the stand-ins view, and the strict run's pictures of four keys. No film frame, no rest key against `main` and no frame at the phone's size was drawn on it.
- The page's own count of values that are no number (`window.showcase.dev.sanity()`) read 0 after every picture drawn in this job. For the film's frames and the keys that is a reading of the picture. For the app's frames it reads the accumulator's target, which the app's own path does not write, so its 0 there proves nothing.

### Checks

On the pushed head, 3b965fca (engine f800ef889b4d6232), after the last merge of `main` (910fbd9f):

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: `Test Files  54 passed | 1 skipped (55)`, `Tests  741 passed | 9 skipped (750)`, exit 0. The same run on the heads before it: b2b28e14 741 passed, 10cb1fb6 739 passed, 66a757c2 738 passed, 9 skipped each time; the numbers grow with `main`'s own tests.
- `npm run strict -- --keys winter-rest,winter-shake,fall-rest,fall-shake`, after the push: `strict: pass, 4 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, and against its own --same picture where that one differs (engine f800ef889b4d6232, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move`, ended 13:27 UTC. 14 of the 16 rows read 0 pixels; the two rows of winter-shake read "2 pixels differ, largest step 1, box 547,194,572,212", as in every earlier run.

On 66a757c2 (engine f5f4fbccf375f470), before `main` moved four more times:

- `npm run strict`, all 8 keys, ended 12:40 UTC: `strict: pass, 8 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, and against its own --same picture where that one differs (engine f5f4fbccf375f470, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move`.
- `npm run determinism`, ended 12:43: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 200 s`.
- `npm run gate -- --phase 4 --only G11,G12`, ended 12:44: `gate, phase 4: all 2 green`; G11 pass, G12 pass.

Not run on the pushed head: the strict run on the four keys of spring and summer, determinism and the gate. `/root` said at 12:58 UTC that its round runs them on the commit that holds summer's third list, and asked for the earlier push with tsc and vitest.

The page's own count of values that are no number read 0 after every film frame, key and app frame drawn in this job; what that is worth on app frames is told under "Not seen".

## The state after the fifth job

Written 2026-11-26 about 11:31 UTC, when five jobs had been done on this branch. It is kept as it was written, but for this paragraph, the word "then" in the next, and one code quote that is put in words. Where it tells of draws made after the fifth job's report it says so. The fourth job's state follows it, then the second and third, then the first job's text as it was written.

Head of the branch then: 03b972d7, which is the commits d6b5b696 and f69156b9 with `main` merged in four times (d6a7d81a at `main` 210a125a, 48e5d52f at 38eff8da, d283564c at 4d9963ca, 03b972d7 at 9bdcb434). `main` holds the first four jobs (the fourth as d449199f). Two engines are named below. f69156b9 builds to 5138daec5baa9eb4. The second merge brings three lines of `src/particles/engine/remote.ts` (the live particles' runner, no shader), so the head builds to another: edc6089afec023dd. Every picture and check below names the one it is from.

The fifth job was three things. In short: the speck is mended, the table's jump at a step of the level is mended, the dots on the sides of the glass are looked into and not mended.

### 1. The speck: a sliver on the outline whose varyings are no number

Commit f69156b9, "Inside: a sliver on the outline whose varyings are no number is dropped". Two lines of `stageOutside()` in `src/core/materials.ts`, which lie outside this unit's block; `/root` said at 10:39 UTC to put them in this push as a commit of their own.

What it was: film frame 2115 at `hd` and the final tier held one dark pixel on the glass's left rim (x 625, y 600), parted by the lens into a speck of 3 by 3. The review tier did not hold it.

How it was found, so the next one is found the same way:

- The 24 samples of the frame were read back one by one before the divide. One of them (place 15 in the shutter, index 16, t 0.6460) held no number in R, G and B at that pixel; the other 23 were plain numbers. The mean keeps it (`src/core/accumulator.ts`, `o = m + (s - m) * uWeight`).
- That sample was drawn again inside a scissor of 3 by 3 pixels with the parts of the scene hidden one at a time. One mesh alone cured it: fall's miniature ground (`userData.stage.part` "miniature-fall").
- Its shader was then given tests at that fragment. Every varying was no number (`vViewPosition`, `normal`, `diffuseColor`); nothing was infinite; `gl_FrontFacing` was true.

Why: `lensPlace` (`src/globe/lens.ts`) puts a vertex no ray reaches on the outline, so a triangle whose corners are all unseen is a sliver along the outline, and `stageOutside()` is what drops its fragments. A fragment of such a sliver can come with every varying as no number. A comparison with no number is false whichever way it is asked, so `vStageSeen <= 0.0` and `dot(c, c) > r * r` both answered false and the fragment was kept. It is not an open case of an expression, so the strict run's wrappers cannot see it.

The mend: both tests are asked the way that is true for no number (the shader's not of `vStageSeen > 0.0` and its not of `dot(c, c) <= r * r`). For every number they answer as before. Test: "is dropped: both tests of the outline are asked the way that is true for no number" in `tests/shake-change.test.ts`.

Seen: 2115 at `hd`, final, drawn again with the two lines (engine 35b68a58cb15f8a4, a working tree that also held the table's mix and the reading probe): that sample reads 0.009, 0.010, 0.013 at the pixel, the dark room behind; the mean holds nothing that is no number in the 21 by 21 window round it; the picture differs from the one without the lines in 7 pixels (x 624 to 626, y 599 to 601, largest step 41 levels). Picture 32.

The rest keys with and without the two lines (camera hero, `hd`, final, 24 samples): 0 pixels differ in each of the four and the largest step is 0, at final from the pushed head's engine (edc6089afec023dd) against `main` before this job (engine b2552a068a75a0bc), and at review (8 samples) from f69156b9's engine (5138daec5baa9eb4) against the same. So no rest key moves, by the two lines, by the table's mix or by `main`'s three lines. The page's own count of values in the mean that are no number is 0 in every one of those sixteen pictures.

Counts of dark pixels, the measure `/root` named (darker than every one of its 8 neighbours by more than 60 levels, in luma): the four middle frames of the changes at `hd`, final, before (engine b2552a068a75a0bc): 0 in 675, 1395, 2115 and 2835. The speck itself is not caught by that measure: its dip is 28 levels in luma and 30 in a channel. At 20 levels the count is 0, 0, 1 (the speck) and 0. After: 2115 with the two lines (engine 35b68a58cb15f8a4) holds 0 at 60 and 0 at 20. From the pushed head's engine (edc6089afec023dd), drawn after the report of the fifth job: 2115 differs from the picture before in 7 pixels (x 624 to 626, y 599 to 601, the speck, largest step 41) and holds 0 at 60 and 0 at 20; 675 and 2835 differ from the pictures before in 0 pixels; 1395 differs in 28 pixels, 27 of them by one level and one by two, which are not the speck's and are told in the sixth job's part at the top. The four rest keys at final hold 1 (winter), 8 (spring), 11 (summer) and 0 (fall) before and the same after, since the pictures are the same pixel for pixel. I looked at the deepest of each six times enlarged and all four are picture detail: winter (1024, 489) a gap between lit branches; spring (975, 701) the bank's edge between glints on the water; summer (1289, 702) single dark pixels in the thin edge of the sand, about x 1280 to 1340, y 690 to 870; fall (977, 694) detail among the leaf bits. Summer's are plain numbers and not this fault; they are summer's own, and worth a look before the masters.

The measure that finds this fault for certain is not the dark pixel but the page's own count of the values in a picture's mean that are no number (`window.showcase.dev.sanity()`, read before the lens and the grade; `out/work/count.mjs` printed it, a tool that is not committed). It is 0 in all four rest keys at final and at review, before and after. It is 0 in the four middle frames from the head's engine as well.

The reading probe is not in the push. It lived in `src/capture/showcase.ts` for the length of the hunt and was taken out again with `git checkout`. The tools that drove it are under `out/work/` and are not committed.

### 2. The table at a step of the level (open item 232)

Commit d6b5b696, "Table: the mirror and the baked glow cross over at a step of the level". Files: `src/scene/surface.ts` (not its caustic), `src/scene/stage.ts`, `src/scene/frame.ts`, `tests/shake-change.test.ts`.

What was wrong: high and medium draw the globe mirrored in the table, low draws a baked glow in its place. The app steps down a level a window where the frames are slow, so on a machine that cannot hold medium the mirror was cut to the glow in one frame.

What it is now, and the means:

- `ReflectMix` in `src/scene/surface.ts` holds the mirror's share of the table, 1 to 0. `Stage.setQuality` tells it of every step of the level (`level()`); each frame asks it for the share (`frame(live, mirror, time)`).
- After a step of the page the share goes to its new end by an even part of the page's clock: `reflectStep`, half a second in all, never more than an eighth a frame and never less than a sixtieth (`REFLECT_MIX`). That is 30 frames at 60 frames a second, 15 at 30 a second, and 8 at 16 a second or slower.
- The shader draws the mirror where its share is above 0 and the baked glow where its share is above 0, and adds the two by their shares (`uReflect.x`, `uReflect.y`). Where one has no share its branch is not run, so a whole mirror and a whole glow are the same numbers as before.
- The mirror pass runs for as long as any of the mirror is in the picture (`f.planar = f.reflect > 0`) and not a frame longer: after a step down to low that is the mix's half second, 7 frames on the slowest machine, at the lower level's size.
- A picture of the capture is drawn whole at once whatever was drawn before it. The capture sets the level before each live picture and takes it back after, with no frame between; the mix crosses over only for a live frame that comes after a step. A frame that is not live (a sample, a view) is always whole.
- A known edge: two picks of the level between two frames snap. The menu cannot do that.

Seen in the app's own frames, in a browser on the phone layout (390 by 844, device ratio 3, lavapipe), the level forced from the M menu, every frame the page drew kept. Before (engine b2552a068a75a0bc): the step from high to low is one frame in which the lower third of the screen changes by a mean of 30.5 levels, 68 percent of its pixels by more than 12 levels, the largest by 121; the step back up is the same. After: (engine 35b68a58cb15f8a4, the working tree of d6b5b696 with the two lines and the reading probe in it) the frame of the step down changes the lower third by a mean of 4.7 levels, 4.8 percent of its pixels by more than 12, the largest by 32, and each of the ten frames after it by 1.0 to 4.3; the step back up is 4.6 (5.3 percent, the largest 30), then 2.2 to 4.2 for eight frames, then 0.7 at rest. At rest a frame differs from the one before it by 0.7 (high) or 0.9 (low): the snow falls. The frame of the step down also takes the canvas from 780 by 1688 to 390 by 844, which is a part of its 4.7. On lavapipe the level low draws quickly, so the mix there runs its half second over more than eleven frames. The same on the build of f69156b9 (engine 5138daec5baa9eb4): the frame of the step down 4.6 (4.6 percent of the table's pixels by more than 12, the largest by 30), the ten after it 1.2 to 4.2, then 0.9 at rest; the frame of the step up 4.5 (5.4 percent, the largest 30), the eleven after it 1.1 to 3.4, then 0.7 at rest. Pictures 37 and 38. The frame of a step between high and low also changes the picture above the table (a mean of 5 levels): the canvas goes from 780 by 1688 to 390 by 844 and back, which is the level's own pixel ratio and not the table. The path a slow machine takes in truth, high to medium to low and back to medium, from the head's engine (edc6089afec023dd), measured after the report of the fifth job: high to medium is no step of the table (both draw the mirror): the frame of the step changes the table by a mean of 3.2 levels (0.5 percent of its pixels by more than 12, the largest by 21), which is the canvas going from 780 by 1688 to 585 by 1266, and the frames after it by 0.8, as at rest. Medium to low: the frame of the step 6.1 (13.7 percent by more than 12, the largest by 30; the canvas goes to 390 by 844 in the same frame), then seven frames of 3.8 to 4.4 (the largest 13 to 27), then 0.9 at rest: eight frames, an eighth of the mirror each, which is the mix's floor on a machine as slow as lavapipe here. Low back to medium: the frame of the step 4.6 (5.3 percent, the largest 26), then eight frames of 1.6 to 4.2, then 0.8 at rest. No picture of this path was pushed. Pictures 33 and 34.

Tests: "the table between two levels of quality" in `tests/shake-change.test.ts`, four tests of the mix's numbers.

### 3. The dots on the sides of the glass: looked into, not mended

What it is: the old season's dressing on the glass leaves as the cover rises (`GLASS_LEAVE` in `src/core/materials.ts`), and it leaves by `stageGone()`: a pixel's hash under the share that has passed drops the fragment. In a film frame each of the samples has its own hash, so the mean is an even fade. The app draws one sample a frame, so each pixel holds the frost whole or not at all, and the band of frost on the rim is a pepper of single dark pixels against the light inside.

Seen: app frames 124 to 127 of a shake from winter to spring, one sample a frame, at `hd` (level high) and at `phone` (390 by 844, level low). At both sizes the rim is dotted on both sides in 124 and 125, thinner in 126, clean in 127: three frames, a twentieth of a second at 60 frames a second. In a still frame it reads as noise on the glass at both sizes. Pictures 35 and 36. Not drawn: a phone at the level high (its canvas is 780 by 1688, and the capture draws `phone` at 390 by 844).

Why it is not mended here: the frost is `src/seasons/winter/frost.ts`, which is not in this unit's list, and the time of the job was spent. The mend I would make, not written and not drawn:

- The frost is drawn with its colour already times its cover and laid over what is behind. For such a part the mean of the dropped and kept samples is the same picture as the part drawn once with its colour and cover times the share that stays. So: a part that is laid over (the dressings on the glass) is thinned by the share that stays in place of being dropped by the hash. One sample then holds the film's mean, with no dots; the film's own frames stay the same picture but for their grain. A sample still holds one season: the old dressing is gone before the new one comes (`GLASS_LEAVE` ends at the cover's `fullFrom`, `GLASS_COME` starts at `fullTo`).
- Fall's fog on the glass already thins this way (`src/seasons/fall/glass.ts`, FOG and LIP: `float seen = (uState.w > 1.5 ? 1.0 - c : uState.w > 0.5 ? c : 1.0) * uFlags.w;`) and spring's dew shrinks drop by drop (`dewKeep`). Winter's frost on the glass (`src/seasons/winter/frost.ts`, the first shader), fall's crack and summer's flares (`src/seasons/summer/glass.ts`) still leave by the hash. Only winter's was seen in the app.
- For winter it is four lines of `frost.ts`, which is not in this unit's list; they were sent to `/root` with the fifth job's report, not compiled and not drawn: the same `seen` in place of `if (stageGone(c)) discard;`, `if (seen <= 0.0) discard;`, and `gl_FragColor *= seen;` after the two lines that set the colour and before the `uDiag` branch. It must be seen leaving and coming at one sample and in a film frame at the final tier, and it needs the strict run.
- The other way, if a dressing is not laid over but written whole: give it a front (`stageEdge`), so the dots stand in a narrow band that crosses the frost and not all over it.

### What still shows, worst first

1. The dots on the sides of the glass in the app, above.
2. Everything the fourth job left, below: it is as it was.

### Not seen in the fifth job

- The dots on the sides of the glass were not mended (thing 3 above).
- No frame at 4K, the masters' format. Nothing here was drawn above `hd`.
- The film in motion, and the app in motion: all of the above is from stills and from the app's frames kept one by one.
- A machine that is slow in truth. Every app frame is from lavapipe in a headless browser with the level forced from the M menu. The app's own stepping down, by its rule of slow frames in a window, was not provoked.
- The tablet layout across a step of the level. Only the phone layout was drawn.
- A phone at the level high for the dots (a canvas of 780 by 1688).
- The other three seasons' dressings leaving at one sample: only the shake from winter to spring was drawn in the app.
- The strict run on the engine of the pushed head. It ran on f69156b9 (engine 5138daec5baa9eb4). The head adds `main`'s three lines of `src/particles/engine/remote.ts`, the live particles' runner, which is no shader.

### Checks on 03b972d7

- `npx tsc --noEmit` on 03b972d7: exit 0. It prints nothing.
- `npx vitest run` on 03b972d7. Its last line: `Duration  154.27s (transform 4.30s, setup 0ms, import 40.77s, tests 406.32s, environment 41ms)`. Above it: `Test Files  54 passed | 1 skipped (55)` and `Tests  708 passed | 9 skipped (717)`.
- `npm run strict` with no arguments, on f69156b9 (engine 5138daec5baa9eb4). Its last line, word for word: `strict: pass, 8 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, and against its own --same picture where that one differs (engine 5138daec5baa9eb4, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move`. It was not run again on the head's engine: the head adds no shader.
- `npm run determinism` on f69156b9. Its last line: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 235 s`. On the head's engine (edc6089afec023dd), after the report: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 197 s`.
- `npm run gate -- --phase 4 --only G11,G12` on f69156b9. Its last line: `gate, phase 4: all 2 green`. G11 and G12 both read `pass`. On the head's engine, after the report: `gate, phase 4: all 2 green`, G11 and G12 both `pass`.

## The state after the fourth job

Written 2026-11-26 about 10:03 UTC, after four jobs, and left as it was written but for this line, the next and one note that is marked. The third job's state follows it, then the first job's text.

Head of the branch then: 632d9514, which is in `main` as d449199f.

### The fourth job: the base passes in an even share of a frame's samples

Commit 2e19534b, "The base passes in an even share of a frame's samples at every pixel, in place of grain".

What was wrong: which base a pixel holds under the cover was a hash drawn afresh at each sample of a frame. Of N samples a pixel held the new base in a number that fell by chance, so the strip between the two bases' lines stood as grain at native pixels.

What it is now, and the means:

- One hash to a pixel for the whole frame (`uPass.x`, the frame's seed) and one share for the whole frame (`uPass.z`, the change number at the frame's first sample, carried on `Sample.hold` from the capture's `picture` loop in `src/capture/showcase.ts`).
- Of N samples the hash is set at the middle of one of N even levels (`uPass.w` is N), and each sample steps it on by whole levels and round again (`uPass.y`). So every pixel holds the new base in the same number of the frame's samples: the share to the nearest of N.
- The step goes by the sample's place in the shutter, not by its index: `passStride` levels a place (1 of 2, 3 of 8, 7 of 24), a rank 1 lattice. The globe travels while the shutter is open (about 50 px a frame at `hd` at the first change), so a base's line that stands across the travel is drawn out and a pixel there is under that base for a part of the shutter only. With this stride the samples that hold the new base fall evenly over any part of the shutter. The first try stepped one level an index: the flat middle of the strip was even but both sloped ends kept their grain.
- Every sample of every pixel still holds one base or the other: the line `if (uState.w > 1.5 ? h < c : h >= c) return true;` is as it was.
- One sample (the app's own path, `sample` null) keeps the plain hash, no step and the sample's own share: the same picture as before by the code.
- Code: `stageUniforms.uPass`, the base's branches of `stageChange()` and `stageGone()`, `passSpread`, `passStride`, `passStep`, `passLevel` in `src/core/materials.ts`; one line in `src/scene/stage.ts`; `Sample.hold` in `src/core/sampler.ts`; three lines in `src/capture/showcase.ts`. Test: "holds the new base at every pixel in the same number of a frame's samples..." in `tests/shake-change.test.ts`.

### What was seen in the fourth job, and at which tier

All drawn with lavapipe, on 632d9514 unless said.

The head 632d9514 is 2e19534b with `main` merged in three times (82d5c566, 65d17346, 632d9514). The merges brought no file under `src/` or `config/`, so the engine is one and the same from 2e19534b on: b2552a068a75a0bc. Every after picture of this job was drawn from that engine; where a before stands beside it, its commit or engine is named.

- `hd`, `review` (8 samples), film frames 673 to 678, bbe4db9b beside 82d5c566: picture 26. Before: the strip between the two bases' lines is grain in 674 to 678. After: the strip is one even tone that darkens frame by frame; 673 holds the old base alone. Left over: a rim of fine dots a few px deep on the strip's two lines, plainest at the two sloped ends in 676 to 678.
- `hd`, `final` (24 samples), the middle frame of each change (675, 1395, 2115, 2835): picture 27 (the foot at its own pixels) and picture 28 (whole frames). In all four the strip is a smooth band and no grain is seen in it at its own pixels. Enlarged six times, 675 shows a trace of fine texture in the drawn out ends. In all four the glass is a lit globe with its halo.
- `hd`, `final`, 2115 once more, drawn from the head's source with the fourth job's five files set back to bbe4db9b (engine 4708b960e00eb5d2), the same seeds: picture 31, before over after. Before: the strip is a fine grain at its own pixels. After: smooth bands. The two pictures differ by more than 2 levels in 14,995 pixels, all inside x 642 to 1269, y 601 to 689: the strip and nothing else.
- One speck in 2115 at `final`: about 3 by 3 px at x 625, y 600, on the left rim of the lit glass about 140 rows above the base's line, one dark pixel with its colours parted by the lens. It is in the before picture too, pixel for pixel the same, so it is older than this job. Its cause is not found. See "What still shows".
- The app's own path (the shake from winter to spring, 60 frames a second, one sample a frame, `preview`), app frames 124 to 136 at level high and at level low: pictures 29 and 30. The glass is a lit globe in all of them. The base's pass is a fringe of dots a few px deep along the foot's lower line in 126 to 131, the line is clean from 132, and spring's base is in sight from 134. High and low read alike.

### The number

The measure, said plainly. Before and after are drawn from the same seeds and differ only where the base's pass differs, so the strip is found without looking at grain: it is the pixels of the lower half of the frame where the two pictures differ by more than half a level of luma, closed over 5 by 5 px. The inner strip leaves out all that lies within 3 px of the strip's rim. The number is the spread (standard deviation, in 8 bit levels of luma) of each pixel of the inner strip about the mean of its own 3 by 3. The floor is the same number on plain lit glass 40 rows above the strip: what the picture's own texture gives where no base passes. The script is `/tmp/looks4/grain3.py` in the builder's VM (not in the repo); its text is short and is set out in this paragraph.

`hd`, `review` (8 samples), bbe4db9b against 82d5c566, inner strip:

| frame | before | after | floor |
| --- | --- | --- | --- |
| 673 | 3.51 | 1.47 | 1.33 |
| 674 | 5.86 | 2.05 | 1.11 |
| 675 | 7.60 | 2.51 | 1.15 |
| 676 | 9.16 | 3.13 | 1.19 |
| 677 | 10.21 | 3.18 | 1.18 |
| 678 | 9.66 | 4.37 | 0.99 |

Mean of 674 to 678: 8.50 before, 3.05 after, floor 1.12. Over the middle 300 columns of the strip (the lines lie along the globe's travel there): 7.33 before, 2.07 after. Over what lies more than 200 columns from the middle (the sloped ends, drawn out by the travel): 10.28 before, 4.49 after. On the 3 px of rim that the inner strip leaves out (it holds the two lines themselves, so an edge is in the number both times): 4.04 to 5.44 before, 2.88 to 4.60 after.

`hd`, `final` (24 samples), 675, after only, on the same strip: 1.48, against a floor of 0.76 (middle 300 columns 1.09, sloped ends 1.76, the 3 px of rim 2.12). No before was drawn of 675 at `hd` `final`.

`hd`, `final`, 2115, before against after, the one pair drawn at that tier (the strip found from the pair itself): 4.59 before, 1.59 after, floor 0.56 (middle 300 columns 4.58 to 1.58, sloped ends 4.63 to 1.66, the 3 px of rim 2.50 to 1.93). So at 24 samples the strip still stands about 1 level over the floor. I could not see that at the frame's own pixels; enlarged three times it is a faint fine texture. Its likely cause, not proven: each pixel takes its share from its own set of samples, and the lit glass behind the strip is not the same picture in every sample.

### What still shows, worst first

1. One speck in film frame 2115 at `hd` `final` (x 625, y 600), found by eye and then by a search for lone dark pixels: it is the only one in the four `final` frames. It is not on the base, and it is not of this job: the same frame drawn without the fourth job's change holds it, pixel for pixel. The six `review` frames of that change hold nothing at that place, so it belongs to the 24 samples of `final`. Its cause is not found and nobody has been told of it but `/root`. It should be looked into before the masters. (Note of the fifth job: the cause is found and it is mended, see the top.)
2. At `review` (8 samples) the rim of dots on the strip's lines, as in picture 26. The cause: the globe travels while the shutter is open, so near a line a pixel is under one base for a part of the shutter only, and the count of samples there is off by about half a sample from pixel to pixel. At 24 samples half a sample is a third as much light, and I did not see the rim at the frame's own pixels.
3. The app's own path keeps its dots (pictures 29 and 30). One sample holds one base or the other at every pixel, so there is nothing to spread. The brief allowed it to stay.
4. From the third job, unchanged: fall's lantern faces go out under the cover, and summer's collar shows as a thin arc under the glass (clean in picture 27).

An option that was weighed and not taken: drop the pixel's own hash where a frame has more than one sample, so that each sample holds one base whole. No dots would be left anywhere, the rim included. The price: where the globe's travel draws a line out, the base that holds the fewer samples would be drawn by as few as 1 of 24 copies of its line. It also departs from the brief's letter (a pixel's own hash stays fixed within the frame).

### Not seen

- No frame at 4K, the masters' format. Nothing here was drawn above `hd` (1920 by 1080).
- The film in motion. No clip was made or watched in this job; all of the above is from stills.
- A before at `hd` `final` for 675, 1395 and 2835: the job's brief said to draw those frames once, on the new head. One before was drawn at that tier after all, of 2115, to find out whether the speck was new.
- The three later changes (1393 to 1398, 2113 to 2118, 2833 to 2838) at `review` on the new head. Of each only the middle frame was drawn, at `final`.
- The app's path on bbe4db9b was not drawn, so no app frame of before was laid beside one of after. That one sample holds the same picture as before stands on the code: the hash, the seed and the share are the ones the old line read.
- Other formats (vertical, square) and the `draft` tier (2 samples) on the new head.

### Checks on 632d9514

- `npx tsc --noEmit` on 632d9514: exit 0. It prints nothing.
- `npx vitest run` on 632d9514. Its last line: `Duration  157.86s (transform 5.20s, setup 0ms, import 47.37s, tests 399.87s, environment 5ms)`. Above it: `Test Files  53 passed | 1 skipped (54)` and `Tests  676 passed | 7 skipped (683)`.
- `npm run strict` with no arguments, run on 82d5c566, whose engine is the head's (b2552a068a75a0bc). Its last line, word for word: `strict: pass, 8 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, and against its own --same picture where that one differs (engine b2552a068a75a0bc, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move`. Of the 32 rows, 30 hold 0 pixels that differ and the two smooth rows of `winter-shake` hold 2 pixels that differ by 1 level, as in the third job.
- `npm run determinism` on 632d9514. Its last line: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 191 s`.
- `npm run gate -- --phase 4 --only G11,G12` on 632d9514. Its last line: `gate, phase 4: all 2 green`. G11 and G12 both read `pass`.

## The state after the second and third jobs

Written about 09:10 UTC. Head then: bbe4db9b, the merge of `origin/main` at 9eeacff5 over f3e3a0dd.

- Second job, commit 6f0266bd, "The cover of a change: the glass stays a globe that burns from inside". Under the cover the light inside the glass is held up (`uLightBurn` in `src/core/chunks/light.ts` and the particle shaders), so the glass keeps its line, the storm inside is lit and the halo lies round it. `CHANGE_BLOOM` now has `glare` 0.5 and `glareReach` 0.8. Pictures 5 to 14.
- Third job, commit f3e3a0dd, "The base passes from the old shape to the new over six frames, so its line against the lit glass never steps". `BASE_PASS` in `src/shake/change.ts` is the middle of the outside span, three frames either side. In `stageChange()` (`src/core/materials.ts`) each pixel of each sample holds one base or the other, and the share that holds the new one grows straight over the pass. Under the cover what is in sight of the bases is their line against the lit foot of the glass. Room, table and backdrop keep the three frame span. Pictures 15 to 25.

### What was seen in the third job, and at which tier

All drawn with lavapipe.

- `hd`, `draft` (2 samples a frame), film frames 672 to 679, on f3e3a0dd: picture 15.
- `hd`, `review` (8 samples), the six frames round each of the four changes (673 to 678, 1393 to 1398, 2113 to 2118, 2833 to 2838), on bbe4db9b: pictures 17 to 24. In all 24 the glass is a lit globe with its halo. In each change the two frames either side of the middle hold the same outline at the foot.
- `preview`, `final` (24 samples), film frame 675 alone, on bbe4db9b: picture 25.

### What showed then, worst first

1. The base's pass was grain (mended in the fourth job, see above). The strip is about 20 to 30 px high at `hd` in the first change, 10 to 15 in the second, 30 to 40 in the third and a few px in the fourth. It lasts six frames.
2. Fall's lantern faces go out under the cover (plain in 2831, faint in 2832, nearly gone from 2833). They did so before the first job too (picture 16), so they were left.
3. Summer's collar catches the light from inside as a thin arc under the glass. It was left on purpose. It comes in and goes out over the pass and not in one frame (pictures 20 and 22).

### Checks on bbe4db9b

- `npx tsc --noEmit`: exit 0.
- `npx vitest run`: 53 files passed, 1 skipped; 654 tests passed, 7 skipped.
- `npm run strict` with no arguments. Its last line, word for word: `strict: pass, 8 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, and against its own --same picture where that one differs (engine 61469070ca770782, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move`. Of the 32 rows, 30 hold 0 pixels that differ and the two smooth rows of `winter-shake` hold 2 pixels that differ by 1 level.
- `npm run determinism`. Its last line, word for word: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 190 s`.
- `npm run measure -- --unit change --only M4,M5` on 03cefa58 (tier final): 8 lines, 0 red. M4 0.9874, 0.8894, 0.9635, 0.9625. M5 0.9804, 1, 0.9739, 0.9998. `main` at 12465d0e reads the same values. Not run again on bbe4db9b or after.

### A change of design in the third job

The test of the second job that asked for the base to swap whole now asks for the pass: six frames or more centred on the span's middle, the shader's line, the room under 2 percent of its light through the whole pass, and no more than an eighth of the base being the other season's wherever the cover is not whole.

## As of the first job (06:45 UTC)

The text below was written at 06:45 UTC and is kept as it was. Three things in it are no longer so: the cover is no longer a ball of light on black, the base no longer dissolves over three frames, and frames have now been seen at `hd`, at `review` and at `final`.

Start 2026-11-26T04:04:50Z. Last commit on the branch: 6f502ae1, the merge of `origin/main` at f00a7aab. Under it 2961ed31, the merge of `origin/main` at ce9548e2 over the sand commit b26df9a2.

## What the change is now

One window drives everything outside the glass. The span of the change is three frames long (window frames 26.22 to 29.22: film 674.22 to 677.22 in the first shake, plus 720 a shake), in the middle of the last and fastest stroke. In it the base, the dressing on the table, the dressing on the glass, the lamps of the backdrop, the slab and the room light all change.

- The base: two whole bases are drawn, the old one gives way to the new by a hash dissolve, every pixel of every sample is one base or the other. Never a morphed base.
- The dressing on the table: the old leaves in the first half of the span, the table is bare at its middle, the new comes in the second half.
- The cover (`CHANGE_COVER` in `src/shake/change.ts`, `CHANGE_BLOOM` in `src/scene/lighting.ts`): the camera's exposure falls to a two hundredth (`dim` 0.005) as a straight ramp over seven frames, holds whole for four and a half (film 673.47 to 677.97), and comes back over five and a half. The lights inside the glass rise by as much as the exposure falls. The lens adds a glare in the colour of the new season's light, a bell 0.7 radii of the glass wide centred near the middle of the glass (`glare` 2, `glareReach` 0.7, `glareSeat` 0.1). At a two hundredth the brightest lamp of a backdrop is under the toe of the film, so nothing outside the glass is seen to change: the room is dark for the frames in which it changes.
- Between two seasons the swell of the shake lays nothing on the base or the table (it used to light them as a lamp), and the swell gives way as the cover rises, so the lights inside stay inside the range of a half float sample (at most 200 times their resting selves).
- The film and the app's own path share the cover (`f.mix.bloom`), a shake of one season has none.

## What I saw, and at which tier

Everything below was seen at `preview` (960 by 540), tier `draft` (two samples), on the software renderer of this VM. Nothing was seen at `hd`, at `review` or at `final`: an `hd` draft frame costs about 117 s here, so the four windows the job file names were not possible inside the limit. Each frame was looked at at full size, and the runs as sheets of 236 to 480 px cells.

- Film, first change (winter to spring), every frame 666 to 684. 667 to 671: the glass burns with a halo and the room falls dark, the base a dark shape. 672 to 679: a ball of light about the size of the glass on black, two faint lamp dots, the frost star faint at 672 and gone by 674, petals faint from 679. 680 to 683: the room comes back as spring. No pop, no third base, no frame with two seasons.
- Film, second change (spring to summer), every frame 1387 to 1403 before the sand commit, and every frame 1396 to 1402 again after it. The same shape of cover in summer's cream. Before the sand commit the crest of summer's sand heap came on one frame (1396 to 1397, 8 to 90 of 255) while the room was black. After it 1397 holds 17 and 1398 holds 25 there, and nothing outside the ball is above 10 of 255 in 1396 to 1398. 1399: the ball, summer's lamps faint (27 of 255). 1400: summer's base and the heaps faint under the ball. 1401 and 1402: the room back as summer, the sand comes back with the room.
- Film, third change (summer to fall), frames 2114 to 2120 before the sand commit and 2113 to 2115 after it. Before it the same crest went on one frame (2114 to 2115, 84 to 36). After it the streak is gone: 2113, 2114 and 2115 are a ball of cream light on black, nothing more than 2.2 radii from the middle of the ball is above 13 of 255, and the place of the crest holds 11, 21 and 36, which I take to be the skirt of the glare as the glass moves towards it (2115 measures the same before and after the commit). 2116 to 2118 before the commit: nothing outside the ball above 13. Fall's lamps show from 2119.
- Film, fourth change (fall to winter), frames 2834 to 2840. 2834 to 2838: a ball of peach light on black, nothing outside it above 16 of 255. 2839: winter's base faint under the ball, two lamps faint (41). 2840: the rim of the glass and winter's base lit by the glow, the room on its way back.
- App path, shake (winter to spring) at `high`, every frame 119 to 139. The same cover: the room dark by 126, the ball alone 127 to 132, spring back by 137.
- App path, jump (winter to summer) at `high`, every second frame 121 to 137, before the sand commit. The same frames as the shake (press at 30, landing at 174). Summer's sand shows at 133, as the room comes back.
- App path, shake (winter to spring) at `low`, every third frame 122 to 137, after the sand commit. The same cover: winter's base faint at 125, the ball alone at 128 and 131 (outside it nothing above 16 and 31 of 255, a lamp dot), spring's base and petals faint at 134, spring whole at 137.
- App path, jump (winter to summer) at `low`, frames 127, 130, 133 and 136, after the sand commit and on the merge of `origin/main` at ce9548e2 (2961ed31). 127 and 130: the ball alone on black (outside it nothing above 31 and 11 of 255). 133: the ball, summer's lamps and base faint. 136: summer whole, the sand heaps with it. No streak of sand in the dark.
- App path, jump at `high`, frames 132 to 134 again after the sand commit (on 2961ed31). 132: the ball alone (nothing outside it above 18 of 255). 133: summer's lamps and base faint, the brightest thing outside the ball a lamp at 46, where the sand stood at 113 before the commit. 134: the room on its way back, the base and the sand with it.

## What is still wrong, worst first

1. The cover is a blackout. For about eight frames (0.13 s) the picture is a soft ball of light on black. It hides the change wholly, and at 60 frames a second it reads as a flash, but frame by frame it is a disc on black and not the glass burning in its own shape (see the first note below). A reviewer may hold the device itself against the film.
2. The two ends of the exposure ramp carry the largest steps of the window: 666 to 667 and 682 to 683 (the mean of the whole frame moves by 11 and by 16 of 255 there, the other frames of the ramps by 5 or less). The ramp is straight in stops. I did not see it as a pop, but those are the two frames to look at first at `hd`.
3. Under the whole cover the lamps of the backdrop are faint dots (up to 24 of 255 on a ground of 4) that dissolve from the old season's places to the new one's over three frames.
4. The glare is in the new season's colour from its first frame, while the light inside is still partly the old season's.
5. The sand commit is a patch on one material: summer's sand alone falls further under the cover. Any other part lit far over the key would stand out of the dark the same way. I saw none in the frames I saw.
6. The top of the picture cuts the halo of the glare in the shake's framing.

## What I did not see

- Anything at `hd`, at `review` or at `final`. The frames each side of the strongest moment at `final`.
- The fall of the room in the third and fourth changes (2106 to 2113, 2826 to 2833) and the last three frames of the fourth (2841 to 2843).
- The third change's return after the sand commit (2116 to 2123), and 2121 to 2123 at all.
- Every app frame between the ones named above.
- The film played at speed. Every judgement here is from stills.
- Any film frame after the merges of `origin/main` at ce9548e2 (summer's air, glass and sand cut by other builders, the phone's framing) and at f00a7aab. But for the app's jump frames named above as after the merge, every picture named here is of the branch before that merge. I also looked at the strict run's plain picture of `summer-rest` on the merge: summer at rest with its sand lit as before.
- Summer's two keys beside the pictures of c86cdf75 (see Checks: they were held against `main` at ce9548e2).

## Checks

The strict run, the standins still, `determinism` and the gate ran on 2961ed31 (engine `8f72b90115dc6fae`), which holds the merge of `origin/main` at ce9548e2. The last commit, 6f502ae1, adds only the merge of `origin/main` at f00a7aab (the tools, `src/app/app.ts`, `src/capture/showcase.ts`, the kit's log and the status pictures). `tsc` and `vitest` ran on both and printed the same.

- `npx tsc --noEmit`: clean.
- `npx vitest run`: 49 files passed, 1 skipped; 568 tests passed, 7 skipped.
- `npm run strict -- --keys winter-rest,winter-shake,spring-rest,spring-shake,summer-rest,summer-shake,fall-rest,fall-shake --modes pow`. Its last line, word for word: `strict: pass, 8 keys under pow (engine 8f72b90115dc6fae): no pixel moves by more than 1 level, at most 0.01% of pixels move`. Per key: `winter-rest` 7 pixels differ by 1 level, `winter-shake` 5 pixels by 1 level, the other six 0 pixels, each row `pass`.
- Why `--modes pow` only: with its default modes the strict run fails on `main` itself. At c86cdf75 it printed `strict: 2 FAILED (engine e35b2bd01d0015cf)`, the `all+smooth` rows of `winter-rest` and `spring-rest`. I told `/root` after the first push. Decision 138 in `kit/PROGRESS.md` has since said how those rows are to be read. I did not run the other modes again.
- One still with `--diag standins` (summer, rest, preview, draft): it printed `rendered ../../../../tmp/looks/standins-summer.png in 19.7 s (simulation 0.3 s, 1 samples in 19.2 s, float32)`, and every pixel of the picture is 0 (960 by 540, read back with a script).
- `npm run determinism`: its last line is `determinism: pass · 3 pictures, 4 page loads, preview, draft, 426 s`. Every picture of passes b, c and d is identical to pass a.
- `npm run gate -- --phase 4 --only G11,G12`: it printed `G11 pass`, `G12 pass` and, as its last line, `gate, phase 4: all 2 green`. An earlier state of the branch (the second push) printed `G11 pass`, `G12 pass`, `gate, phase 4: all 2 green`.
- `npm run measure -- --unit change --tier draft`: not run. Its eight `hd` pictures did not fit in the time that was left after the strict run, and I chose to look at the app's jump instead. So M4 to M6 are not shown green by me. M4 and M5 read the `cover` view of the storm inside the glass and M6 counts particles inside solids. None of the three reads anything this unit changed, and the raw resolve of the diag views ignores the fall of the exposure and the glare.
- The eight judged keys, each drawn plain by the strict run at preview, draft, on 2961ed31. `winter-rest`, `winter-shake`, `spring-rest`, `spring-shake`, `fall-rest` and `fall-shake` are pixel for pixel the pictures `main` draws at c86cdf75 (0 pixels differ in each; the two rest keys against the strict run's plain pictures of c86cdf75, the other four against stills of the same key drawn from a worktree at c86cdf75). `summer-rest` and `summer-shake` are pixel for pixel the pictures `main` draws at ce9548e2 (0 pixels differ), the commit the sand commit sits on, so the sand commit moves nothing at rest or landed. Summer could not be held against c86cdf75, because `main` has changed summer since. By the code: a key at rest or landed has one season on the stage, so the cover is 0, the exposure's fall is `pow(dim, 0)` which is 1, the glare is 0, `uSandRoom` is 1, and every part takes the path it took before.
- What I broke of the rules: the second and the third push went up before a strict run on their state, and the third before `tsc` and `vitest` had run on its merge. Both passed when run afterwards. The fourth and last push (6f502ae1, 06:42 UTC) went up after the strict run, `tsc` and `vitest` on 2961ed31, and after `tsc` and `vitest` on the merge itself.

## Things the next builder should know

- The storm in the glass takes most of its light from the room's key through the glass (`veilLit` in `src/core/chunks/veil.ts`, the particle shaders in `src/particles/draw/`), which falls with the exposure. So under the whole cover the inside of the glass is dark and the ball of light is the glare alone. To make the glass burn in its own shape the light of the veil and of the particles inside would have to rise with the flare. Those files are not this unit's. I tried raising the lights inside four times over (`burn`): it showed only a faint arc of the glass's rim, and raised the values stored in a sample to 800 times rest, so I took it out.
- The resolve (`src/post/post.ts`) multiplies the whole frame by the last sample's `lensFall.dim`, while each sample's lights inside rise by `1 / dim` at its own instant. On the frames of the ramps the inside is a few percent off (about 9 percent under on the way down into the dark, 13 percent over on the way back at two samples). Not seen as a step.
- `lensFall` is a module level value in `src/post/post.ts` that `Lighting.update` writes and the post reads. The raw resolve (the `cover` view and the other diag views) ignores it.
- The lamps on the particles (`uLamp` in `src/particles/draw/points.ts`) and anything emissive inside the glass do not rise with the flare, they fall with the exposure.
- The glare is in the new season's glow colour from its first frame, while the light inside is still partly the old season's.
- Where half float samples are not there (`caps.half` false) the inside clamps at white and goes dark under the cover. Only the glare is left. The change is still hidden.
- The top of the picture cuts the halo of the glare in the shake's framing. The framing is not this unit's.
- `npm run strict` with its default modes fails on `main` itself (c86cdf75): `winter-rest` and `spring-rest` in the `all+smooth` rows. Not from this branch.
- `SAND_DARK` in `src/seasons/summer/base.ts` is the one place where a part falls further than the room. If the cover ever gets a deeper `dim`, or the room's key itself falls under the cover, take it out.
- Summer's sand has a one pixel crimson fringe at the edges of its grains and along the crest at preview, draft (seen in strict's plain picture of `summer-rest`, enlarged four times). It is in `main`'s own picture at ce9548e2, which is pixel for pixel this branch's, and it was in film frame 1403 before the sand commit. I did not follow it to its cause. The sand's material is in `src/seasons/summer/base.ts`, which `summer_finisher` also changed in this phase.
- The earlier states of this branch, in order: a whole frame wash (read as a white frame cut in), `dim` 0.06 with a weak wide glare seated at the collar (a flat peach fog, and the lamps of the backdrop and the frost star were seen to change in the dark), `dim` 0.012 (lamps still seen at sRGB 23 to 74), then this.
