# Fall's air, handover

Branch `agent/p6-fall-air` at 7a5fd873 (36f3fcc8, the fourth list, with main a7f9032b merged). The proof ran on 36f3fcc8, which holds main b4bc96c0; a7f9032b moves no still.

## What the fourth list put in
- `src/seasons/fall/glass.ts`: the lip mesh goes out from 8.0 mm (beside the scene) to 8.8 mm (at the front) above the collar's line, over 1 mm, and 0.08 of it stays below (`lipFootMm`, `lipFootFadeMm`, `lipFootLeft`, `lipFootFront`). That part of the lip showed as a bright green band under the ground's edge, where the approved's base stands over the glass.
- `src/particles/draw/cards.ts`: a bat is not drawn along its path through the shutter (`batStreak`) and keeps `batEdge` of a pixel's softness; a spark's halo at rest is faint on most sparks and full on a few (`restHaloFaint`, by the same number that sets the halo's radius). Only the bat and the spark branches changed.
- `src/particles/draw/looks.ts`: spark `restGain` 9, `restCore` 0.08, `restHalo` 0.3, `restHaloVary` [0.6, 2.6, 4], `restHaloShare` 0.12, `restHaloFaint` 0.3, `restHot` [1, 0.8, 0.5], `restHotWide` 1.2, `restOutField` 0.05, `restOutScene` 0.95; `batStreak` 0, `batEdge` 0.35, `batRestTilt` 0.45, `batRim` 0.6; `leafRestMm` [1.35, 2.75, 4.5], `leafMost` 0.43.
- `src/particles/engine/kinds.ts`: bat `sizeMm` [4.6, 6.1], `cruiseMmS` 5.7, `reachMm` 13.5.
- `src/seasons/fall/veil.ts`: the leaf colour's blue 0.075.

## How a bat's place is set
A bat circles the globe's axis (engine `wanderAt`, not this branch's file): ring = `reachMm` times a share of its own, angle = `cruiseMmS` over the ring times the time plus a phase of its own, height of its own. Only `cruiseMmS` and `reachMm` are in the kinds line. With the angle each bat has at the rest still's time (about 14.4 s) as u = 14.4 times cruise over reach, the upper bat turns 1.28 for each 1 of u and the lower 1; the two bats' angles cannot be set apart. Read off the samples: at reach 32 the upper bat's place was not smooth in cruise (two places, about (1085,181) and (878,225), changing between cruise 26.33, 26.36, 26.38 and 26.40). At reach 13.5 it is smooth. The fit over cruise and reach finds no pair that puts both within 20 px; the best it finds is about 30 px each, within its own error of 15 px.

## Still short of the approved, worst first
1. Sparks: points outside the crown box and the smallest class, see the report's counts. The approved's fine points are mostly pale specks that are not orange blobs; a brighter mote colour and more sparks in the open air were tried and did not raise the peaks outside without raising the smallest class.
2. Bats' places: upper 44 px, lower 32 px from the approved's.
3. Leaves: the small class is not larger than the large class in the blob count; the skew of `leafRestMm` did not move that count in five trials (the count follows the bright orange patches, and the sparks' halos when they are large).
4. The warm pale band along the upper left rim: the shell or the room, not the air; left to the glass's owner.

## Not seen
- The bats in motion: the film was not rendered with the slower, tighter ring. Their turn is about 0.42 to 0.54 radians a second now (was about 0.8 to 1.0).
- The lip with the ball turned, and at the storm other than the landed still.

## The spark trial after the fourth list (c13801a0, pushed as 1ba316ee)

What it does: at rest, sparks under the clear ones (own number from 0.22 on) keep 0.3 of their light (`sparkRestFine` in looks.ts, one line in the card's vertex stage) and are tinted pale gold (`spark.restFineHot`, `spark.restFineSeen`, one line in the spark's fragment stage). The storm is untouched.

Reads at hd, review tier, 7a5fd873 to c13801a0, approved in brackets: smallest orange class 326 to 318 (206); points outside the crown box 825 to 1042 (1484); miniature's M3 share 0.893 to 0.917 (main without my change 0.922).

Tried on the way: the same points left orange (smallest 375, outside 1007); dimmer and more of them (395, 1067); a whiter tint (290, 1075) which read as snow by eye and was dropped.

Open: the fine points are paler and cooler than the approved's. Bats stay 44 px and 32 px off, accepted by the root. Next list: the leaves' lengths in three boxes.
