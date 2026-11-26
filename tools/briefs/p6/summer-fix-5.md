# Summer, the fifth list

From /root, after looking at the merged fourth list (rest and landed at hero, hd, review tier) beside
`references/approved/summer-rest.png` and `references/approved/summer-shake.png`, whole at 400 pixels and in
pairs at one scale (640 pixels to a ball radius, the approved on the left; they come with the message that
names this file).

## What the whole picture says at 400 pixels

The approved reads as clear glass: a dark room seen through the ball's upper left, a warm glow low behind the
tree and the cottage, a few fine pale seed heads, yellow green points, a white hot flare on the right
shoulder, a cream carved base. Ours reads as a milky khaki ball covered in white asterisks, a small soft
smudge for a flare, a dark tree and a dark cottage, a dull base. The fourth list bettered every part and the
read at 400 pixels did not change. This list is about that read. Two things carry it, and they are worked
together: the ground of the ball (Glass) and the seed heads (Air).

## Rules for this list

- The ruler is a guide again, not a guard. Inside the ball its numbers may move while the form is built. What
  decides is the whole at 400 pixels beside the approved, then the pair. Say what you see before any number.
- The layout does not move (decision 157 in `kit/PROGRESS.md`). Own files only, except where this list gives
  a file by name.
- Checks by you before the push: `npx tsc --noEmit`, the tests of the files you touched, and `npm run strict`
  on `summer-rest` alone. If you touched a file another season reads, the sha256 of `winter-rest` at draft
  before and after. The whole vitest and the strict run on both keys are run once by /root on the merged head.
- One hour from the message, of which the checks take the last quarter. Push to your branch
  `agent/p6-summer-<name>` (merge `origin/main` first, no force).
- The report: at most 250 words and 4 pictures. Per item one line: mended, bettered or not done, and what you
  see. Then the head, the make targets to run after the merge, and what was not seen. No ruler tables.

## Glass (`src/seasons/summer/glass.ts`)

1. You have the word you asked for: take the level out of the upper left and the top, and put that light into
   bands of the glass. Through the upper left the dark room must show, as it does through the approved (pair
   A: dark ground, broad warm bands along the arc 0.03 to 0.13 radii inside the outline, a dark band between
   them). The golden haze stays where the approved has it: low, from the cottage's roof line down, brightest
   between the trunk and the right wall, falling off upward and to the left. No even tone anywhere.
2. The right arc (pair G): the broad peach band goes. In its place two or three pale blue white streaks along
   the arc, layered, as thick glass shows them.
3. The flare went too soft (pair G): ours is a fuzzy smudge with a dot in it. The approved is a white hot
   core that sits on the outline, a warm glow about a quarter radius wide round it, and ten or more fine
   straight rays of unequal length, the longest about 0.3 radii, sharp at the core and fading outward.
4. The net (pair E): its arms are pale threads with white blobs. The approved's are gold, about (255, 200,
   110), thin, sharp edged, brightest at their knots, and they lie on a table that is black between them. Ours
   lie on a grey sheen: take the sheen off the table inside the net's reach if it is yours, and say whose it
   is if it is not.
5. Exchange with Air: Air pushes its seed heads at rest 20 minutes after the message and tells you. Merge
   that branch into yours and set the ground under the heads you then see.

## Air (`src/particles/draw/looks.ts`, `src/particles/draw/cards.ts`, `src/particles/engine/kinds.ts`, `src/seasons/summer/veil.ts`)

1. The seed heads at rest read as white asterisks stuck on the glass (pairs A, B, C): all the same white, all
   sharp, all the same weight, and they hide the crown and the cottage. In the approved they have depth and
   light. Give them both: about one head in five near and sharp, its rays lit warm white; the others dimmer by
   a half to two thirds and a little soft; the far ones small grey puffs with no ray to be told apart. No
   head pure white: the brightest about (250, 235, 205). A few cores lit warm orange. Rays thinner than a
   pixel at hd read as hair; draw them at part strength, not at full strength a pixel wide.
2. Fewer where the scene is: at most four heads in front of the cottage and at most six in front of the
   crown, and those dim. The band of overlapping heads left of the tree goes: no two heads nearer than one
   head's width. If that needs a spacing rule in `src/particles/engine/engine.ts`, the file is yours for this
   list, on the condition that `winter-rest`, `spring-rest` and `fall-rest` at draft keep their sha256.
3. The points of light (pair A): ours are flat dots, each in a dull olive ring, sprinkled evenly. The
   approved's glow: a small hot core, a soft halo that adds light and never darkens, and they gather in loose
   swarms with dark between. A few are large, faint and out of focus. About ten over the cottage, not forty.
4. The storm, half a second after the landing (whole, landed): ours is cold white fuzzy patches whirling in
   arcs over a dark scene. The approved is a fine warm bright mist: the whole ball glows cream gold from
   inside, about (245, 225, 185), the tree, the cottage and the lanterns stand in it as soft shapes, and over
   it lie hair thin short streaks swept one way and a fine bright speckle. So: the strokes thin, short and
   crisp as in your one still, and the light they lost carried by the storm's veil, warm, brightest low
   behind the scene. The puffs out.
5. Exchange with Glass: push items 1 to 3 as they stand 20 minutes after the message, tell Glass, and carry on.

## Miniature (`src/seasons/summer/mini/`, `assets-src/tree-summer`, `assets-src/village-summer`)

1. The mound, by decision 157: summer's lawn is a layer of turf over the shared ground, as winter's snow is
   (`snowTop` in `src/scene/layout.ts`, which you read and do not change). Thick against the cottage's foot
   and the tree's roots, thinning to nothing at the pond's edge and the path. The things stay where they are.
2. The crown (pair B): the body of every pad near black green, about (20, 28, 15). Light only as a thin gold
   edge on the pads' upper rims, from the key behind and to the right. The even mid green on the leaves goes.
   The pads flatter, in tiers, with the sky between them.
3. The cottage (pair C): it went dark all over. In the approved the roof is dark blue grey slate with a soft
   sheen along its ridge, and the front wall is lit warm by the lanterns: pale rubble stones, a pale arch
   round a brown door, one lit window. Light the front from the lanterns, keep the roof dark. If the wall's
   pattern can be chosen for summer without moving another season's picture, make it round rubble.
4. The lawn (pair C): lit tufts with a gold rim at the right, toward the key; the stone path seen; tufts
   growing over the bank's upper edge. The bank: sparkle, single grains that glint.
5. Triangles stay under 1,800,000 at high, counted the gate's way.

## Sand (`src/seasons/summer/slab.ts`, `src/seasons/summer/arrival.ts`)

1. The magenta and blue pixels at the heap's cut edge are a fault and come first. Find the cause and mend it;
   say what it was. No pixel of the heap may be a colour sand is not.
2. The heap (pair F) is still a shape: a bright diagonal tongue with a hard dark wedge between it and the
   base. The approved is a low broad mound lying against the base's foot. The low light from behind grazes
   over its top, so its far side is cream, its near side falls into shade over a roll about 0.1 radii wide,
   every grain on the lit side is seen and some glint, and its outline is nowhere a line: it thins into single
   grains on the black table. Build that form. No wedge.
3. The sprinkle at the left (pair E): give it the core it lacks. Dense and near white, about (251, 223, 186),
   in a strip along the base's shadow line with a sharp lower edge, thinning within 0.12 radii above it; a few
   gold glints further out.
4. The fall: narrower still, 0.08 radii at the lip to 0.12 at the foot, a veil and not a spray of dots.

## Stone (`src/seasons/summer/base.ts`, `assets-src/base-summer`)

1. Colour comes first (pairs D left and D right). The right half of our base is slate grey, colder than the
   table. In the approved that same half is the palest and warmest part of the base: cream, about (230, 212,
   185) where the key reaches it and a warm tan in its shade. Find what turns ours grey (the fill, the shade's
   colour, the sand's own colour) and say what it was. No lit place on the base may read grey or blue.
2. The ridges read as lines drawn with a comb: thin, near black, evenly spaced, and at the right as rows of
   short dark slots. The approved is sandstone worn by wind: five to seven broad soft swells down the body's
   height, uneven in width, that run into one another and part round the shells; their hollows are wide and
   warm brown, never black. Fewer, broader, softer. The slots go.
3. The lip reads as another material: dark olive with pale blotches. It is the same sand as the body, a soft
   roll that the key lights along its top, breaking into the body below it. No blotches, and not darker than
   the body.
4. The shells are cream and pink white, lit, the palest things on the base; ours are grey. The sea glass is
   frosted and lets light through: each piece is paler than ours, with a soft glow on its far side and one
   small glint; ours are dark opaque beans.
5. M3: the config's 0.75 is the measure and 0.78 passes it. Do not add speckle to reach more. If the broader
   forms take it under 0.75, say so with the number and I decide.
