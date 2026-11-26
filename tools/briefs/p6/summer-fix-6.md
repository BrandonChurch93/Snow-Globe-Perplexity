# Summer, the sixth list

From /root, after looking at the merged fifth list on `39901bc4` (rest and landed at hero, hd, review tier)
beside `references/approved/summer-rest.png` and `references/approved/summer-shake.png`, whole at 400 pixels
and in pairs at one scale (the approved on the left; they come with the message that names this file).

## What the whole picture says at 400 pixels

The fifth list is the first that changed the read: ours now reads as a clear ball in a dark room, with a
white flare on its right shoulder, a cream sand base with shells and a gold net on a black table. Thank you.

What still differs at 400 pixels, in the order it is seen:

1. Our glass wears a broad pale ring all round its outline. The approved's outline is thin, with a few sharp
   warm glints on it.
2. The inside of the approved glitters gold: many glowing points, lit seed hairs, a crown with lit rims. Ours
   is dimmer, with white stars and flat green dots.
3. At the foot of our scene, inside the glass, lies a white fuzzy band. It reads as snow.
4. Our heap at the right is a white patch. The approved's is warm sand.
5. Half a second after the landing ours is a ball of white feathers with a black tree in it. The approved is
   a glowing gold mist with the cottage and its lamps seen through it.

This list is those five things. It is the last list before Round 21 (decision 158 in `kit/PROGRESS.md`).

## Rules for this list

- As in the fifth list: the ruler is a guide and not a guard; what decides is the whole at 400 pixels beside
  the approved, then the pair. Say what you see before any number.
- The layout does not move (decision 157). Own files only.
- Checks by you before the push: `npx tsc --noEmit`, the tests of the files you touched, and `npm run strict`
  on `summer-rest` alone. If you touched a file another season reads, the sha256 of `winter-rest` at draft
  before and after. The whole vitest and the strict run on both keys are run once by /root on the merged head.
- Fifty minutes from the message, of which the checks take the last ten. Push to your branch
  `agent/p6-summer-<name>` (merge `origin/main` first, no force).
- The report: at most 250 words and 4 pictures. Per item one line: mended, bettered or not done, and what you
  see. Then the head, the make targets to run after the merge, and what was not seen. No ruler tables.

## Guards (one line for Glass, Miniature and Stone)

GLSL leaves `atan(0.0, 0.0)` open, and a value that is no number in one pixel spoils a master frame. The
lines named under your heading below take the form the other seasons now have, with your own names:
`dot(v.xz, v.xz) > 0.0 ? atan(v.x, v.z) : 0.0`. Do it first and alone, and show that `summer-rest` at draft
keeps its sha256 across that one change. One sentence in the report.

## Glass (`src/seasons/summer/glass.ts`)

1. The ring (pairs A and G). Ours has two or three broad pale bands along the whole outline, the widest about
   0.08 radii, grey beige, so the ball reads as a thick frosted tube, and it is the first thing seen at 400
   pixels. In the approved the outline is a thin line and the light on the glass is a few sharp things: at
   the upper left thin warm streaks a few pixels wide, broken, that follow the arc (pair A); at the right pale
   blue streaks (pair G). No band runs all the way round. So: the bands a quarter as wide, broken into
   streaks of unequal length, more than half of the outline with no band at all, and where a streak stays it
   is sharp and bright, not broad and grey.
2. The room through the upper half (pair A). Ours is a smooth khaki brown wash. The approved shows near black
   with soft red brown shapes and a few dim discs of the room's lights seen through the glass. Darker, about
   (25, 20, 15) between the shapes, and with form in it. Nothing even.
3. The burn at the lower left (the whole, and the left edge of pair C). Where the key passes through the
   glass at the left, low, above the bank, the approved has a white gold burn on the inner wall, about 0.12
   radii tall, with a soft warm glow from it into the scene. Ours has a small dull smudge. Build it.
4. The flare: keep it. Its glow a little warmer, its outer rays a little softer; the core stays white hot.
5. Guard: `src/seasons/summer/glass.ts:383`.
6. Exchange with Air as before: Air pushes its rest items 20 minutes after the message and tells you; merge
   it and set the ground under what you then see.

## Air (`src/particles/draw/looks.ts`, `src/particles/draw/cards.ts`, `src/particles/engine/kinds.ts`, `src/seasons/summer/veil.ts`)

At rest:

1. The heads (pairs A and B). Ours are white asterisks: about sixteen thick straight rays. The approved's are
   dandelion seeds: thirty to fifty hair thin rays, uneven, a little curved, cream to pale pink gold, many
   with a thin stem and a dark seed under them, and they let the room show through. So: twice the rays at
   half the width, a warm tint (the brightest tips about (255, 236, 205)), a small warm heart, and a stem
   with a seed on the near ones. The dim ones keep their weight and turn warm; none grey.
2. The points (pairs A, B and G). Ours are flat yellow green discs with a hard edge, all one colour, all one
   size. The approved's have a tiny white hot heart and a soft glow three to four times as wide, run from
   yellow green to warm gold, differ in size, and a few are large faint discs out of focus. There are many
   more of them low at the left and round the crown, and few in the upper middle. The inside of the approved
   glitters. Ours must.

Half a second after the landing:

3. The storm (the landed whole, landed pairs A and C). Ours is cream white wedges, fans and long straight
   strokes, laid so thick that the cottage is gone and the tree is a black cut out. A blurred asterisk has
   become a triangle. In the approved the heads keep their tuft shape, a little smeared; between them lie
   short thin streaks, yellow green and warm white, a few pixels long, that go one way with the whirl; the
   dark of the room shows between them at the upper left; the cottage, its lamps and the tree are seen
   through a gold veil, and the lamps glow. So: no wedge and no fan (a head smears by no more than about its
   own width, or is drawn as a tuft with a short tail); strokes a third as long and half as wide; half as
   many before the cottage and the tree; the veil warm gold, not cream white, and thin enough over the scene
   that the cottage's front and its lamps read.
4. Exchange with Glass: push items 1 and 2 as they stand 20 minutes after the message, tell Glass, carry on.

## Miniature (`src/seasons/summer/mini/`, `assets-src/tree-summer`, `assets-src/village-summer`)

1. The bank (pair C). The band between the lawn and the foot of the glass is white and fuzzy and reads as
   snow or fleece. In the approved it is sand: tan gold, fine grain, a sparkle of lit grains along its upper
   rim where the key grazes it, its body in warm shade and darker than the base's lit sand. Make it that
   sand. No white in it.
2. The lawn (pair C). Too light, too evenly green, too many small flowers. The approved's is dark moss green
   with warm light on the tufts at the right and round the lamp post; the path's stones are large, flat and
   grey brown. A darker body, fewer flowers (the sunflowers and the roses at the door stay), light only where
   the lanterns and the key reach.
3. The pond (pair C). Ours is small and dark brown. The approved's is a pale mirror: it holds the glow
   behind the scene and the lamp post's reflection. The pond's form is the layout's and stays; give its water
   the mirror.
4. The crown (pair B). Its yellow patches read as blossoms; the approved has none. Dark pads with a fine
   gold light along their upper edges, a soft green glow where a lantern lights a pad from below, branches
   seen between the pads. The patches out, the light onto the edges.
5. The trunk reads red brown. The approved's is dark umber with gold light down its right edge.
6. Guard: `src/seasons/summer/mini/village.ts:229`.
7. Triangles stay under 1,800,000 at high, counted the gate's way.

## Sand (`src/seasons/summer/slab.ts`, `src/seasons/summer/arrival.ts`)

1. The heap (pair F) is still a flat white patch with a dark blotch behind it. The approved's is warm sand:
   gold cream on its lit side, about (240, 205, 160), every grain seen as a speckle of light and shade, a
   long soft shadow toward the camera, and the fall above it a fine golden veil against the dark. Nothing in
   the heap brighter than (250, 225, 190) except single glints. No white.
2. The sprinkle at the left (pair E): its form holds. Warmer, finer in grain, its lower edge softer.
3. The flying grains at the landing still carry coloured pixels (81 magenta, 27 blue, 214 green by your
   count). Give them a least size, or lay their colours as you did at rest, and count again.
4. `lens: { rows: 1080, most: 2 }` in `arrival.ts`: the masters are 3840 x 2160. A farm machine draws the
   rest still at uhd now and counts coloured pixels on the sand; if its count is not 0 it comes to you. If
   you know already that the mend holds only at 1080 rows, say so at once and make it follow the picture's
   rows.

## Stone (`src/seasons/summer/base.ts`, `assets-src/base-summer`)

1. The carving (pairs D and D2): bettered, and smooth as suede. The approved's swells have crests that catch
   the key as thin bright lines, and hollows that fall into warm brown shade; its relief is about twice
   ours. Raise the relief and let the crests light.
2. The lip (the upper left of pair D2): ragged and grey at its outer edge, with dark smudges under it. A
   smooth pale rounded collar, the palest lit thing of the base along its top.
3. The blue glass piece: paler, frosted, light through it, as the green ones now are.
4. Guards: `src/seasons/summer/base.ts:224` and `:409`.
5. M3 stays over the config's 0.75, without speckle.
