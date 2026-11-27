# Winter glints, handover

Branch agent/p6-winter-glints. Two faults at 3840 x 2160, final tier, film frames 30 and 31.

## The pond

Cause. At 3840 the ice map stands at four texels and more to a pixel, and the bump normal was taken from a one pixel difference, so it turned fully from pixel to pixel and was new in every frame. Two places read it:

- the mirror lobe of the lamp (iceLamp): with the mirror normal held flat the dark and bright dashes in the streak went;
- three's own direct highlight at roughness 0.09: with a band limited normal there the scattered white dots went.

Glitter and sparkle switched off changed nothing. The colour on the dots is the post's fringe.

Mend, in src/seasons/winter/mini/village.ts (iceMaterial, CALM). Where a pixel holds a texel or more of the ice map, bump and grain are read three levels up over six pixel steps; the mirror lobe widens with the reflection's change over the pixel; the lamp's highlight takes more roughness where the normal changes, and both are held no brighter. Below a quarter texel to a pixel nothing changes, so the hd pictures hold.

Numbers, 3840 final, frame 30 against 31, fine part (sigma 2 px), travel removed:

| box | rms main | rms mend | agreement main | agreement mend |
| --- | --- | --- | --- | --- |
| patch 1800,1760,2060,1960 | 7.95 | 1.24 | 0.093 | 0.596 |
| core 1860,1760,2000,1860 | 11.79 | 1.56 | 0.162 | 0.765 |
| top 1840,1700,2040,1800 | 11.03 | 2.06 | 0.159 | 0.745 |

At sigma 4 px the mend reads 0.785, 0.91 and 0.874 (main 0.204, 0.256, 0.283). The asked 0.8 is not reached in the finest band: what is left there is 1.2 to 2.1 levels rms, the size of the lens samples' own grain (plain snow on main reads agreement 0.18 to 0.36).

hd review against main: rest differs only in the pond (x 875..1055, y 657..715), mean 134.39 against 135.45, greatest 252.1 against 254.8. Landed: 643 px over 2 levels in x 935..1022, y 669..710. M3 winter-rest 0.9322 against main 0.9365.

## The frond

Cause. The lens fill blurs each pixel by the radius the blur map holds, and the glass dressing was hidden from that map, so the frost took the radius of what stands behind it. Behind the left fronds the backdrop is not drawn, so the radius there is the tile reach (the tile maximum in src/core/accumulator.ts), fed in frame 30 by a sliver of ground at the ball's left limb with about 73 px. Frame 30: 26 px over the frond. Frame 31: about 2 px. Not the keep switch, not the floor pass, not uGrow.

Mend. src/scene/stage.ts drawBlur draws winter's glass dressing into the map after the map's own draw; src/seasons/winter/frost.ts answers there with a cut of 0.004 (the picture's own discard), the plain texels view keeps 0.3.

Fill radius on the frost's pixels, px, 3840 final:

| cover | frame 30 main | frame 30 mend | frame 31 mend |
| --- | --- | --- | --- |
| over 0.3 | 12.4 | 3.2 | 1.6 |
| 0.05 to 0.3 | 20.4 | 2.0 | 1.7 |
| under 0.05 | 19.5 | 2.1 | 1.7 |
| no frost | 21.0 | 20.9 | 4.6 |

Fine rms in the frond box (440,1330,540,1450): main 2.26 then 2.90, mend 2.90 then 2.76.

The cut. 0.3 leaves a hard outline, 0.05 ends the streak tips on an arc, 0.02 a fainter arc, 0.004 none.

## Other seasons and checks

Spring, summer and fall at rest, hd: byte for byte as main by sha256 at final (24 samples) and at draft with both trees on c1423ee5, and at draft again with both on 13e1a911 (spring e97d1b6f, summer 432f3c88, fall 7977ab28). A later head of main voids this guard; take it again from that head.

Film frame 650 at hd final against main: 2 pixels differ by 1 level, nothing else. Winter at rest, hd final: only the pond differs (x 869..1062, y 651..722); the frost is as on main.

tests/shake-change.test.ts stated the old rule (a fixed cut of 0.3 in the frost's view); it is restated in its own commit.

## Still wrong, worst first

1. The undrawn backdrop beside the frond still takes the tile reach in frame 30 and not in 31: a faint step (2 to 3 levels) at the frost's outer limit, and the flake beside the frond is crisp with a halo in 30 and soft in 31. That is the tile maximum, a shared file, left as told.
2. The pond's finest band agrees 0.6 to 0.77, not 0.8.

## Not seen

Frames 27 to 29 and 32 to 34 at 3840 final. The close, frames 3281 to 3284. The tile switch in other seasons beyond one pair in each hold (spring 1000, summer 1750, fall 2500: no tile over 25 px, greatest reach 8.1, 4.1 and 21.8 px).
