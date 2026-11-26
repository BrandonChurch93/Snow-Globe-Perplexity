# Job 7: `change_finisher` · unit `change` · branch `agent/p6-change` · the cover is light that pours out, not a dark room

Read again first: `kit/02-SUBJECT.md` line 141, `kit/03-METHOD.md` section 11, `kit/04-LOOK.md` section 5 ("The slab is near black, not black. The darkest part of any frame still has tone.") and section 6 (line 55), and your own item 222 in `kit/PROGRESS.md`.

## The fault
Across each of the four changes the picture outside the glass goes to black for about ten frames (shake-1: 670 to 681; the same place in the other three): a pale ball with a soft halo on a black frame, cut straight across its foot by a base that cannot be seen. Read from your own pictures 19 and 28 on `agent/p6-change-looks`: 31 to 32 percent of the pixels hold a sum of red, green and blue of 6 or less, 48 percent 15 or less.

Three things are wrong with that, in this order.
1. It is a blackout. The route was my own first one ("the room falls away from it, as a camera's exposure does"), and I asked for "a near silhouette" and "near dark". What stands is dark without the "near": no table, no base, no lamp. The kit's look says the darkest part of any frame still has tone. The motion critic of Round 20 marked "the dark frame at 23.33 s" as part of a severe issue, and a viewer of the film sees the picture go out four times.
2. The light of the globe lights nothing. A glass that burns bright enough to make a lens flare stands on a wet black table one hand above it, and the table, the base and the mirror image under it stay black. The kit's method: "the inner light of the new season rises far above its resting level and floods the base and the surface". That flood is what makes it read as light pouring out, and it is missing.
3. Only the lens glare is left as a sign of the light, a flat disc that is the same in all four changes.

## What is asked
The same cover, with the room still there and the light on the things around the globe. For the frames of the cover:
- The light pours out. On the table round the foot lies a pool of the new season's light (the old season's while the change is below a half, or however your window has it), strongest at the foot and falling off with distance as light does, with the mirror image of the burning glass in the wet slab under it. The top of the base and its collar catch the light from above; its side stands as a near silhouette against the lit table, with the form still readable. The dressing on the table nearest the foot is lit by it.
- The room keeps tone. The lamps of the backdrop fall, since the eye and the lens close down for the glare, but they do not go out, and the slab away from the pool stays near black with tone, as at rest. No frame of the film holds a patch of true black: on every frame of the four windows, at `hd` and the `final` tier, fewer than 1 pixel in 100 holds a sum of red, green and blue under 4. Count it and put the count in your report (before and after).
- The swap stays unseen. Everything your jobs 1 to 6 won holds: no frame with a base that is neither season's, no clean frame with two seasons outside the glass, no step on a single frame (your own counts at the foot, frames 675 to 676 and its three sisters, are the measure), the frost and the crack leave as they do now. If the base's dissolve can now be seen in the pool's light, the light is your tool: the pool and the glare may peak higher for the two to four frames in which the base turns, as the kit's line 55 allows ("the bloom of the new season's light is allowed to flood the frame for a few frames"), but the frames before and after it show a lit room, not a black one.
- It reads at 400 px, played in order, as a globe that flares and lights the table, in all four changes, and each change has its own colour of light (the new season's).
- The app's own path draws the same thing at one sample, at the levels high and low, for a shake and for a jump by a season mark.

How far the room falls, how wide the pool is and how bright the peak: yours, by looking. If you find that a part of this makes the swap visible again and cannot be had together with it, keep the swap unseen, go as far as you can, and say exactly which frame shows what.

## Yours
The files of your job 1 (see `change.md`), as before. Summer's `glass.ts`, `arrival.ts`, `slab.ts`, `base.ts` and every other file under `src/seasons/summer/` are with five other builders until their third list is merged: do not touch them before I say so; tell me the lines you need there.

## Done means
- For each of the four changes: a sheet of every second frame from 660 to 690 (and the three sister ranges) at `review`, `hd`, before beside after, and the four middle frames at `final`. Looked at by you at full size and at 400 px.
- The count of dark pixels above, per window, before and after.
- G11 and G12 (`npm run gate -- --phase 4 --only G11,G12`), `node tools/measure.mjs --unit change --tier draft` (M4 to M6 green for all four), `npm run determinism`, the strict run on all eight keys, `npx tsc --noEmit`, `npx vitest run` on the merged head.
- The eight keys at rest and landed are the same pictures as before, or you say which moved and why.
- The app's path at high and low for one shake and one jump.

## Time
Limit 80 minutes from the message that gives you this job. Push a first state that you would show inside 45 minutes (with its sheet for shake-1 on your looks branch and one line to me), so that I can look early. One report at the end, in your usual form: what is not done or not seen first.
