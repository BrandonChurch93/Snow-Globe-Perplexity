# Summer, fourth list (after my look at the merged third list)

Written by /root on Nov 26 from `summer-rest` at the hero camera, hd, review tier, drawn on the merge of all
five third lists, beside `references/approved/summer-rest.png`. Pairs at one scale (640 pixels to a ball
radius, the approved on the left) come with the message that names this file: A the ball's upper left, B the
crown, C the cottage and the ground, D the base, E the table at the left, F the heap at the right, G the
flare, and the middle of the base's body at its own pixels.

## What changed in how to read the pictures

The ruler now agrees with the approved picture in most regions, and the picture still does not look like it.
The tones are close. The forms are not. Two examples, measured:

- Ball, upper left: mean colour ours (142, 128, 99), approved (127, 112, 87). Close. But the approved has
  that tone from hundreds of thin bright things over a darker ground with a slope of light across it, and ours
  has it from one even veil with thick pale shapes in it.
- Base body, middle: ours (59, 58, 49), approved (51, 55, 48). Close. But the approved is carved in flowing
  ridges with warm dark creases, and ours is level and smooth.

So from here on: tone stays where it is (the ruler is a guard: no region may leave the approved by more than
it does today), and every item below is about form. Judge by the pair at one scale and by the whole picture
at 400 pixels beside the approved. Say in your report what you see, in plain words, before any number.

Everything here is `summer` only. `src/scene/`, the shake and the other seasons are not yours. Branches as
before (`agent/p6-summer-glass`, `-mini`, `-air`, `-stone`, `-sand`), from origin/main, which holds all five
third lists, the tree's guard against a vector of no length (keep that line in `mini/tree.ts`) and the
checkpoint fix. Merge origin/main before your last push. Never rebase, never force.

## Air (the seeds and the lights)

1. A seed head is a burst of hair thin rays. In the approved each head is 24 to 40 straight rays one pixel
   wide at hd from a small bright core, unequal in length, and about one head in three hangs a thin stalk one
   pixel wide with a small seed at its end. Ours are six to ten soft wedges three to five pixels wide: they
   read as snow crystals or feathers. Make the rays thin and many and crisp. Near heads 13 to 26 pixels across
   at hd, most heads 8 to 14, far heads 4 to 7. The core warm white near (245, 235, 215), the tips falling to
   about (190, 175, 150). Sharp, except at most one head in ten very near the glass, which may be soft.
2. No clumps. In ours the heads in the upper left overlap into one white mass (pair A). No head's disc may
   cover another's by more than a third; spread them through the whole ball so the upper left is no denser
   than the lower right. The count in sight stays 120 to 140.
3. The lights are mostly sparks. In the approved there are some hundreds of tiny sharp points, yellow green
   near (225, 235, 120), a core of two to three pixels at hd with a small halo of six to eight, and only 15 to
   25 soft discs of 12 to 22 pixels at low strength. Ours are mostly soft discs of 10 to 25 pixels, and they
   lie over the crown and the cottage as green blobs (pairs B and C). Turn the share round: 250 to 400 sparks
   in sight, at most 25 soft discs, none of the discs brighter than half of what it is now where it lies
   over the crown or the cottage.
4. The storm, half a second after the landing: thin streaks and a fine even speckle through the whole ball,
   warm white, the tree and the lanterns showing through, where ours is thick white strokes in patches. The
   thin rays of item 1 carry most of this; then look at the landing and say what is left.

## Glass

1. The veil inside the ball has a slope, not a level. In the approved the light inside is a warm bright core
   behind the tree and the lanterns, about (200, 170, 120) at its brightest between the trunk and the right
   wall, falling to about (60, 55, 45) at the far upper left near the rim, with the dark room showing through
   the upper left. Ours is one even khaki, about (140, 125, 95), from rim to rim (pair A, pair B). Keep the
   regions' means near where they are and move the light: brighter and warmer behind the tree, darker toward
   the upper left and the top.
2. Thick glass at the rim. The approved shows two or three soft bands of warm reflection running along the
   upper left arc, 0.03 to 0.10 radii inside the outline, and layered pale blue white streaks inside the right
   arc beside the flare. Ours has one thin line at the left and one broad peach band at the right (pair G).
3. The flare. The approved is a soft warm glow about a quarter radius wide with some eight short soft rays
   and a small core. Ours is a hard white core with fourteen or more long thin sharp rays: it reads as a drawn
   star. Halve the rays' length, soften them, eight to ten of them, warmer, with a broad soft glow under them.
4. The net of light. Its arms are smooth even curves like thread. In the approved they are veins: they
   branch, change width along their length, and carry bright beads at their knots (pair E). The place is
   right now; work the arms.

## Miniature

1. The crown is pads with gaps. In the approved the crown is seven to nine flat cloud shaped pads, each 0.25
   to 0.4 radii wide and about 0.1 thick, very dark in their body, about (20, 28, 15), with only their upper
   edges lit warm gold green, about (150, 160, 70), and between the pads gaps where the warm light and the
   branches show: a fifth of the crown's box is gap. Ours is one round mass of mid green leaves lit from the
   front with pale specks along its edges (pair B). Darker body, light only on the pads' tops, real gaps, and
   take the pale specks off the edges: they read as noise.
2. The trunk half again as thick, darker, with a thick branch seen going into each pad.
3. The cottage sits in shade. Ruler: cottage, luminance at the 50th percentile ours 107, approved 62. Its
   front is dark warm stone, lit by the lanterns and the window, not by the key. Walls grey brown stone, not
   orange brick. The roof darker.
4. The ground is a mound, and the bank is sand. In the approved the lawn rises to the cottage and the tree
   and falls to the pond, and at the bottom of the ball lies a slope of cream sand with a soft lit crest. Ours
   is flat and dark, and the bank is a white fringe that reads as fur or frost (pair C).
5. Triangles. The phase 6 gate on `10c4c2b6` said: "summer at high: 1817862 triangles, over
   perf.maxTriangles.high 1800000". Count it on your head (`npm run gate -- --phase 6 --only G15`, or the way
   the gate counts) and bring summer at high to 1,760,000 or less. Say where you took them from; the grass is
   the largest single part of yours (90,832).

## Base

1. Carved ridges. The approved body is cut in flowing ridges that sweep from the upper left down to the
   right and bend round the shells, 20 to 35 pixels apart at hd, their creases warm and dark, about
   (35, 25, 15), their crests lighter, about (95, 100, 95) in the shade and up to (240, 190, 135) where the
   key reaches them at the left. Ours is smooth with faint level bands (pair D and the body's middle at its
   own pixels). This is the one thing that makes the base read as worked sand, and it should carry the detail
   measure: once it does, take the even speckle down to where it no longer reads as a grainy photograph in
   the shade. M3 stays at 0.80 or more.
2. The shells. The approved's are pale, ribbed and glossy with one small hard highlight each; the stone in
   the front middle is a pale ribbed clam, not a grey pebble with a streak; the large scallop at the right is
   about a third larger than ours. Ours read grey and matt.
3. The lip stays where it is (measured: its top edge at the centre lies at 0.69 radii below the ball's
   centre, the approved's at 0.72). Make its edge uneven, as packed by hand, with a few broken places.

## Sand

1. The sheet at the left is a sprinkle, not a shape. Ours is a filled pale bar with an outline (pair E). In
   the approved it is separate grains over the dark table: thick along its lower edge, which is the base's
   shadow line, and thinning to nothing within about 0.12 radii above it and with distance from the base; no
   outline anywhere; the grains golden, about (240, 205, 150), a few glinting. If it cannot be made to read
   as a sprinkle, take it out: an empty dark table is closer to the approved than a bar.
2. The heap is a soft dune. Ours has a hard edge between a flat white lit face and a flat brown shade, and
   a cut outline against the table (pair F). In the approved the light rolls over the dune in a slope about
   0.1 radii wide, the lit side is pale cream about (235, 215, 190), the shade about (120, 100, 80), the
   outline breaks up into single grains, a few near grains are large and out of focus, and about one grain in
   thirty glints.
3. The fall is a narrow veil of fine grains: about 0.08 radii wide at the lip and 0.12 at the foot, grains
   of about one pixel at hd, denser than ours, brightest where the light comes through it. Ours is twice as
   wide with grains of about three pixels and a hard corner at the lip.

## For each of you

- 50 minutes. One report by message: the head, what you see in plain words item by item (mended, bettered,
  not done), then the ruler lines of the regions you touched, then the checks.
- Pictures with the report, at most ten: the whole of `summer-rest` at hero, hd, review tier beside the
  approved at 1400 pixels and at 400 pixels, and the pairs of your items at the scale of mine (the approved
  left). Air and sand also the landing (`--state landed`).
- Checks before the push: `npx tsc --noEmit`, the whole `npx vitest run`, `npm run strict` on
  `summer-rest,summer-shake` (its last line word for word), and the sha256 of `winter-rest` at draft the same
  as on origin/main.
- Name the make targets I must run after the merge.
- If an item of yours needs a thing from another builder's file, do not edit that file: say what you need
  and from whom in your report, and send that builder the same sentence.
