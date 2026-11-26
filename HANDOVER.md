# spring-drops: handover

Branch `agent/p6-spring-drops`. Files changed: `src/seasons/spring/glass.ts`, and the dew's lines of `src/seasons/spring/base.ts`.

## The cause, as found by trial

A picture is the mean of 24 pinhole pictures, each from its own lens point, pixel offset and moment of the shutter. Whatever is a pixel wide or less is drawn 24 times, each time in another pixel, and the set of 24 is another in every frame. Three things in spring were that small at 3840:

1. The body of a bead. `dewTap` read the frame behind the drop with one tap at level 0, where one pixel of a bead 15 pixels across stands for 20 to 130 pixels of the frame. Each sample picked another texel.
2. The glints on a bead. The key's lobe (power 140) and the rim's (power 90) are about one pixel wide on a bead of that size, and many times brighter than white, so each of the 24 copies is a white dot; the red and violet beside it are the lens fringe of the grade.
3. A grain of dew on the moss: a disc 0.42 of a cell of 0.133 mm, about one pixel at 3840 in these frames. 24 copies of it stand as a ring of dots.

The trial is in `trial-draft-8x.jpg`: at 2 samples a bead on main is a patch of unlike single pixels; with the tap mended its body is smooth and only the glint is left as a knot of white, red and blue pixels; with the glints widened that is gone too. A grain of dew on main is one white pixel with a red and a blue one beside it.

`uFlags.w` was read, not drawn: `src/scene/stage.ts` sets the presence of every material that is not in the arrival to 1, and the glass dressing is not in the arrival. With the tap mended the body of a bead is whole in every sample, which a share under 1 would have stippled, so the hash in `dewKeep` is not the cause.

## The mend

- `glass.ts`: when the frame behind the drops is copied, a soft copy is drawn too: half the size, values that are not numbers taken out, with its levels (mipmaps). `dewTap(at, span)` reads the level whose texels are as wide as the span of the frame that one pixel of the drop stands for. Beads and trails both.
- `glass.ts`, `dewWater`: the two glints and the room in the skin are no narrower than two pixels (the turn of the normal over a pixel sets the power), with the same light in all.
- `base.ts`: a grain of dew and the pixel it falls in are together no narrower than 1.22 cells; the 8 cells round a point are read, since a wide grain reaches into its neighbours; the light is divided by the cube of the widening. At hd from the hero camera nothing is widened.

## Numbers (3840 final, frames 1135 to 1138, disc of radius 6 on a bead, 4 on a dew ring, travel taken from the after frames)

| patch | neighbour difference, before | after | share moving by more than 24 levels, before | after |
| --- | --- | --- | --- | --- |
| bead at (1465, 306) | 15.4 | 7.8 | 0.339 | 0.024 |
| bead at (1515, 331) | 17.6 | 10.3 | 0.015 | 0.000 |
| dew ring at (2355, 1569) | 15.8 | 5.4 | 0.102 | 0.000 |

The plain stone wall beside the beads reads 4.9. The second bead's dots on main mostly travel with the bead, so its second number was low before.

## Not seen

- Frames 1139 to 1164 after the mend, and any frame in motion as a film.
- The trails at 3840 at 8 times (they share the tap and the glints).
- Any other camera than the film's at 1135 to 1138 and the hero at hd.
- A real graphics card: all of this was drawn by lavapipe.
