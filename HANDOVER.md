# Framing of the app: handover

Branch `agent/p6-framing`. Start 04:04:54 UTC, limit 07:04:54 UTC.
Files changed: `src/app/framing.ts`, `tests/framing.test.ts`. Nothing else.

## Commits, in order

| Commit | What |
| --- | --- |
| 54952071 | The app's camera stands back for the bar of a shake, so the whole globe stays on a narrow screen |
| 65e59d4a | The stand-back's test restated: the aim may rise as the camera stands back, it never falls |
| 518d68a7 | The camera rises as it stands back, so the near edge of the table never comes into a phone's frame |
| 82d406b3 | A phone's globe sits in the middle of the room over its controls (`overUnder` 1.6 to 1.1) |
| 74823323 | The test of the app's turn restated: the film's turn plus `FRAME.narrowYawDeg` on a narrow upright screen |
| ef657284 | A phone stands 1.2 degrees round the globe at rest, so no bright light of the room is cut by an edge |
| d8e56589 | A tilted view keeps to the room the level one has (`holdTilted`) |

## The three faults

### 1. A phone's globe leaves the screen during the shake

Cause. On an upright screen the camera stands as near as the widest base at rest allows: 98 percent of the width. A shake
carries the glass about 33 mm to either side and leans it. Held where it stands at rest, on 390 x 844 the glass passes the
edge by 44.6 px and the widest base by 69.7 px, for 119 of the 144 frames of the bar of `live-0` (computed).

Mend. `fit` now also finds `far`: the nearest distance that holds every stroke of all `FRAME.shakePaths` (8) live paths,
glass and widest base, between the sides by the margin. `standBack` takes the camera there with the lift (it leaves from
standing, covers most of the way early because the hand tips the globe outward on its first frames, arrives without a
stop), keeps it there for the strokes and the set-down, and brings it home over `FRAME.homeBars` (1 bar) after the
landing. A shake asked while it still comes home takes it back from where it is. A wide screen does not move at all.

The choice the brief left open, and how I made it. Fitting the stroke to the free margin: at rest the widest base already
stands at the margin (3.9 px of 390), so the stroke that fits is no stroke; it would not be a shake. Making the globe
small enough at rest that the whole shake fits without a move: 72 percent, a glass 223 px across on a 390 px screen, with
more dark above it, which is fault 3 made worse. So the camera stands back for the bar and the globe keeps its size at
rest. Whether the move reads as the camera breathing or as a lurch I could not see: nothing here plays. What I can state
is computed and tested: no step, the globe shrinks by under 2.5 percent a frame at 60 a second on the way out, most of it
while the hand lifts, and grows by under half a percent a frame on the way home. It has to be watched on a real machine.

Drawn through the app's script, every shake is the path `live-0` (the first shake of a session). The other seven live
paths, and a jump by a season mark (`Session.goTo`, which is a shake on the next live path), are held by the tests,
which walk every moment of all eight on every screen shape; I did not draw them.

On 390 x 844 the camera goes from 1162 mm to 1613 mm; the glass is 111.7 px in radius through the bar against 155.5 px
at rest (72 percent). The widest base then ends 4.0 px inside the edge (the margin is 3.9 px), the glass 22 px inside.
On 1024 x 1366: 715 mm to 989 mm, glass 409 px to 296 px, widest base 10.4 px inside.

The camera's aim rises as it stands back (`aimForTable`, `FRAME.tableKeepMm`), because from further back the lower edge of
a tall frame would otherwise look past the near edge of the table. So the globe sits low in the frame during a phone's
shake. See "still wrong".

The top of the lift at 1920 x 1080. The camera does not move there. The rule holds the lifted glass under the top edge by
the margin, 1 percent of the height, 10.8 px. Drawn: in frames 50, 73, 134 and 152 the highest edge of the glass is 10 to
14 px under the top edge. The review saw about 15 px. It is inside, and it is tight.

THE MEND NEEDS LINES IN THREE FILES THAT ARE NOT MINE. Sent to their owners. Without them the rule and its tests are
there, and the caller still holds the camera at rest through a shake.

State on `main`. At 06:28 UTC (ce9548e2) the replay's line was in (b0019b15) and the app's and the stills' were not,
on no branch I could fetch, while Status 139 said the fault was mended and merged (its phone picture was drawn with my
lines applied in my working tree). I told `/root` at 06:31. `/root` put the app's line and the stills' lines on `main`
as 27e83641 at 06:33. All three callers now pass the moment. What I then measured on 27e83641 is under "checks".

The lines, as I sent them:

`src/app/app.ts` (sent to `/root/first_frame_finisher`), in the frame loop, the pose after the moment:

```ts
      moment = session.moment(mix, seed)
      pose = livePose(painter.width / Math.max(1, painter.height), look.yaw, look.pitch, under(dt), moment)
```

`src/app/replay.ts` (sent to `/root/controls_finisher`; 709666de on `agent/p6-controls`, on `main` since b0019b15):

```ts
  pose(under: number): Pose {
    return livePose(this.aspect, this.look.yaw, this.look.pitch, under, this.moment())
  }
```

`src/capture/showcase.ts` (sent to `/root`), in the still and in `renderAppFrame`:

```ts
      const since = { beat: null, sinceLanding: stateSeconds(spec.state) - barSeconds }
      const pose = onScreen ? livePose(format.width / format.height, 0, 0, under, since) : spec.rig ? poseWith(spec.camera, spec.rig) : poseById(spec.camera)
      if (onScreen) drawn = framingOfRig(liveRig(format.width / format.height, 0, 0, under, since), format.width, format.height)
```

and, in the record `renderAppFrame` returns, `framing: framingOfRig(liveRig(format.width / format.height, 0, 0, under, moment), format.width, format.height)`.

`barSeconds` there is the length of a bar of the shake in seconds (`config.film.beatsPerBar * beatSeconds`); a `Moment`
carries `beat` and `sinceLanding`, which is all `liveRig` reads of it (`Shaking`).

Every shake picture on this branch of looks was drawn with those lines applied in my working tree and never
committed. The checks at the end ran without them, on the branch as pushed.

### 2. A phone's base is wider than the screen at rest (M1 red for `screen-phone`)

At rest an upright screen now holds the whole globe between its sides by the margin: the glass and the widest base any
season builds (`FRAME.baseReachMm`, fall's, with the pumpkin at its foot), since one framing holds all four seasons.
On 390 x 844 the base runs from 45.0 px to 345.0 px (the still's own record). M1: see "checks".

### 3. 390 x 844: the top quarter flat dark, one light cut in half by the left edge at y 237

Two changes.

`FRAME.overUnder` 1.6 to 1.1. The room over the glass is 1.1 times the room between the foot and the highest control, so
the globe sits nearly in the middle of what the controls leave. With the controls measured the glass top goes from 192 px
to 164 px and the foot from 570 px to 541 px (both from the stills' own records).

`FRAME.narrowYawDeg` 1.2 on screens narrower than `FRAME.narrowAspect` (0.6). Straight on, exactly one bright light of the
room is cut by the left edge, over the middle of the glass. Turned 1.2 degrees it stands whole inside the frame at about
x 20, y 200. The test finds the cut lights from the room's own emitters on 320 x 568, 360 x 800, 375 x 667, 390 x 844,
393 x 852, 412 x 915 and 430 x 932, with the controls measured or not, and finds none.

What I see, at full size and at 200 px wide, beside the review's left panel and the before still: the globe stands higher
and reads as the centre of the picture; the dark over it reads as the room, with one whole light at the left; nothing
bright touches an edge. The top fifth is still dark. That is the room, which is dark by design, not an empty band.

## Also done: a tilted view keeps to its room

Found while testing the orbit. A drag that tilts the view up opens the foot of the globe downward. On a wide screen the
heap went under the top of the controls from about 12 of the 19.5 degrees the orbit allows, and a shake asked while tilted
carried the lifted glass over the top edge (1.5 percent of the height at the top tilt on 1920 x 1080).

`holdTilted`: the camera keeps its aim wherever that holds the globe between the line over the controls and the margin
under the top edge; else it carries the globe up to the line or down to the margin; and where the tilted globe is taller
than the room it stands back, heap on the line and lifted glass on the margin, no further. 1920 x 1080 at the top tilt:
701 mm to 849 mm, the glass 331 px to 278 px in radius. A phone has the room and does not move. One result is kept, so
a view held still costs about a microsecond a frame; a moving tilt costs about 15.

The alternative, if this is not wanted, is one line for `/root`: `"orbitPitchMaxDeg": 12` in `config/showcase.json`.

## Still wrong, worst first

1. Nobody has watched the stand-back move. The caller lines are on `main` since 27e83641, and there I drew one shake in
   the live app on a phone-sized screen and computed every frame of eight (see "checks"). Whether the move reads as the
   camera breathing or as a lurch is not known. It has to be watched on a real phone.
2. During a phone's shake the globe is 72 percent of its rest size and low: glass top at 345 px of 844, foot at 618 px,
   the top 40 percent dark room with two small lights. It is forced from both sides: the width decides the distance, and
   the near edge of the table decides how low the camera may aim. Centring it would take a pitch 6.5 to 8 degrees higher
   during the bar, which `tests/app.test.ts` forbids (the app's pitch is the film's while it stands back) and which
   would change the look of the shake. That is a design call above this job.
3. On arrival on a phone the globe glides up about 30 px a moment after the controls first show. Until the app has
   measured its controls it takes a bar of 96 px (`FRAME.barPx`); a phone's controls measure about 154 px. It was there
   before this job (about 35 px with the old ratio). `tools/visit.mjs --layout phone` step 5 says `NOT 5 look-returned`
   (`returnedApart` 47.44) and, reading its two pictures, this is why: the first is taken before the measure (glass top
   197 px), the returned one after (165 px). I did not run that step on `main` to see whether it said NOT before.
   The bar is `display: none` until it shows (`src/ui/ui.module.css`, `.bar[hidden]`), so the app cannot measure it
   earlier (`src/app/app.ts` line 166 waits for `data-interface="shown"`).
   Two remedies, neither in my files alone. (a) Lay the bar out unseen before it shows (`visibility: hidden`, not
   `display: none`) and drop the wait in `app.ts`: the first picture then stands where it stays, on every screen.
   (b) In `roomUnder`, estimate a narrow upright screen's bar as what its controls measure; that writes a number of the
   controls' layout into the framing, and `tests/app.test.ts` line 594 states the estimate and would need restating.
   I shipped neither: (a) is not mine, and for (b) I could not measure the controls on other phone sizes in the time left.
4. At the lowest pitch on a phone (tilted 2.5 degrees down) the globe drops about 50 px: glass top 214 px against 165 px
   (`06-limit-pitch-down.png`). The table rule does it, and it is continuous. It clears the controls.
5. Tablet at rest: one light is cut in half by the right edge near the top. Seen in the M1 still of `screen-tablet`
   (summer): right edge, y 38 to 146 px of 1366, bright (220 of 255 at its middle). By the brief's rule ("nothing bright
   is cut in half by an edge at rest" on a tall screen) this is not mended for a tablet; it is mended for phones only.
   Computed, straight on, lights of level 0.1 and more that an edge cuts, and the turns (in tenths, within 3 degrees)
   that leave none cut:
   800 x 1280: one (level 0.12), clear at 1.2 to 2.0. 768 x 1024 and 1024 x 1366: one (0.16), clear at 0.7 to 0.9.
   820 x 1180 and 834 x 1194: two (0.18, 0.11), clear at -2.7 to -2.5. 1080 x 1350: one (0.15), clear at -1.5 to -0.7.
   1080 x 1080: five (one of 0.57), clear at 1.0 to 1.5. 1280 x 1024 and 1920 x 1080: none.
   2560 x 1080: two or three (one of 0.41, right edge), clear at 1.9 to 3.0.
   No single turn clears every shape. The rule that would: for the shape, the smallest turn at which no bright light of
   the room is cut, found once in `fit` from the room's emitters. It needs the emitters of `src/scene/backdrop.ts` made
   readable (they are private; my test casts), and `tests/app.test.ts` line 607 restated by its owner; it says
   `if (w / h >= FRAME.narrowAspect) expect(rig.yawDeg).toBe(hero.yawDeg)`. I found this at 06:02 and did not start it:
   not enough time left to build, test and see it. hd: two dim lights (under 0.1) are cut by the top edge.
6. Under a tilt the sides keep at least half the margin, not all of it: a tilt changes how near each end of a stroke
   stands, by up to 0.6 percent of the half width (tablet, top tilt). The test states half.
7. Very tall strips (narrower than about 0.4) are held by the table rule at ratios up to about 2 over to under.
8. The sheets are drawn through the script, which carries no controls: their rest frames stand at the estimate (glass
   top 194 px), not where the app settles (164 px). The bar of the shake is the same either way.

## What I did not see with my own eyes

- Anything moving. The software renderer draws a phone frame of the app in 15 s. Every claim about motion (no step, the
  ease out and home, under 2.5 percent a frame) is computed and tested, not watched.
- 320 x 568, 360 x 800, 844 x 390 and 2560 x 1080 through a shake: computed only (the tests walk every moment of every
  path on them). Drawn: phone (60 frames: whole, bar, landing), tablet (8 picked frames), hd (6 picked frames).
- 844 x 390 in the app with its real controls (`tools/visit.mjs --layout side --only 1,5`, on 66936ac4): drawn and seen
  at first paint, with a look held, returned, and at the limit of the turn (picture 10): the whole globe stands inside,
  glass top about 17 px under the top edge, foot about 287 px, clear of the controls (from 335 px). I stopped that visit
  before its two tilts, to measure `main`. It says `NOT 5 look-returned` there too (`returnedApart` 3.84).
- The stand-back of the top tilt on 1920 x 1080: computed only. The app's drag script turns to the limit and tilts
  down, not up; I drew it on hd (picture 9: the globe keeps its size and place). On the phone I saw the app at the limit
  of the turn, the top tilt and the lowest tilt (`visit` step 5, picture 7).
- The shake in the app itself with its real controls. `visit` step 2 was not run to its end; it photographs the start
  and the end of a shake, not a stroke.

## The numbers, named once (`FRAME` in `src/app/framing.ts`)

`overUnder` 1.1, `narrowAspect` 0.6, `narrowYawDeg` 1.2, `tableKeepMm` 20, `shakePaths` 8, `pathStepBeats` 0.004,
`pathFine` 40, `nearShare` 0.02, `keepShare` 0.0015, `fitFar` [1, 2, 4], `fitPasses` 16, `backPower` 4, `homeBars` 1,
`tiltShares` [0.25, 0.5, 0.75, 1], `tiltPasses` 6. The orbit's limits are read from `config/showcase.json`; none changed.

## The tests (`tests/framing.test.ts`, 23)

Screens walked: 320 x 568, 360 x 800, phone, tablet, 4 to 5, square, 5 to 4, hd, a phone on its side, 2560 x 1080.

- Glass, widest base and heap inside the frame by the margin at every moment of every shake, controls measured or not.
- The same at rest, and through a second shake asked while the camera still comes home.
- The camera stands back only as far as the widest stroke asks: not at all on a wide screen.
- The lowest edge of the frame never looks past the near edge of the table, however the view is turned.
- A phone's globe sits `overUnder` over to under, or as high as the table's edge allows.
- The aim rises on a straight line as the camera stands back, and only as far as keeps that edge out.
- Back with the lift, there for the strokes and the set-down, home over a bar, never with a step.
- The globe shrinks under 2.5 percent a frame at 60 a second and grows again under half a percent a frame.
- Pitch, turn and lens are the film's while it stands back; never nearer than the film.
- A tilted view keeps to the room: top, foot and heap by the margin, the sides by half of it.
- A tilt moves the camera only where the room asks, never nearer, and only as far as the room asks.
- A tilt never steps: a tenth of a degree moves the camera under a millimetre.
- No bright light cut by an edge at rest on seven phone sizes; the review's cut light found straight on; other screens keep the film's turn.

## Checks

No shader changed, so the strict run was not run. Nothing in `config/showcase.json` changed.

On 43b8108d (the branch before `main` 197e2476 was merged; that merge is summer's air and touches none of my files):

- `npm run measure -- --unit globe --only M1 --tier draft`: `measure globe: complete · 8 of 8 lines, 0 red · draft · 74 s`
  (the first run stopped at the chunk budget with 7 of 8 after 434 s; the second carried on). The lines asked for:
  - `pass M1 screen-phone: 0 (threshold 0, no config key) 0 invalid values in 329160 pixels; the globe and base lie inside the 390 x 844 frame (glass top at 164.4 px, foot at 541 px, base from 45 to 345 px)`
  - `pass M1 screen-tablet: 0 (threshold 0, no config key) 0 invalid values in 1398784 pixels; the globe and base lie inside the 1024 x 1366 frame (glass top at 113.4 px, foot at 1123.1 px, base from 117.5 to 906.5 px)`
  - `pass M1 screen-wide: 0 (threshold 0, no config key) 0 invalid values in 2073600 pixels; the globe and base lie inside the 1920 x 1080 frame (glass top at 48.7 px, foot at 880.2 px, base from 634.9 to 1285.1 px)`
  - also green: `screen-wide-fall`, `live-winter`, `live-spring`, `live-summer`, `live-fall`.

On 66936ac4 (the branch with `main` 197e2476 merged, as pushed):

- `npx tsc --noEmit`: exit 0, no output.
- `npx vitest run`: `Test Files  49 passed | 1 skipped (50)`, `Tests  568 passed | 7 skipped (575)`.
- `npm run determinism`: nine lines `identical`, then `determinism: pass · 3 pictures, 4 page loads, preview, draft, 391 s`.
- `npm run determinism -- --film`: fifteen lines `identical` (the three stills, `film-3240` and `loop-288`, passes b, c and d
  against pass a), then `determinism: pass · 5 pictures, 4 page loads, preview, draft, 700 s`.
- One still with stand-ins only: `npm run still -- --season winter --state rest --camera hero --tier draft --format phone
  --interface --live high --force --diag standins`: black. Largest value 0, 0 of 329160 pixels above zero.
- M1 was not run again after the merge of `main`: the merge changes none of my files, and the limit left no time for it.
- On `main` ce9548e2, which holds this branch (06:28 UTC): `npx tsc --noEmit` exit 0; `npx vitest run`:
  `Test Files  49 passed | 1 skipped (50)`, `Tests  568 passed | 7 skipped (575)`.
- The same tree with the app's line and the stills' lines applied (scratch, never committed): tsc exit 0; vitest
  `Test Files  49 passed | 1 skipped (50)`, `Tests  568 passed | 7 skipped (575)`.

On `main` 27e83641 (the caller lines in; 06:35 to 06:50 UTC). `/root` asked for the live app, not the replay.

- Computed through the app's own `LiveSession` (`shake()`, `tick(1 / 60)`, `moment()`) and the app's own call,
  `liveRig(aspect, 0, 0, under, moment)`, eight shakes in one session (the paths `live-0` to `live-7`), each to its
  landing and a bar and a half after: 2544 frames a screen. A scratch test, not committed; the cover of the globe is
  computed as `tests/framing.test.ts` computes it. Distances are from the nearest edge, in px of the screen.
  - 390 x 844, controls measured 154 px: camera 1162 to 1613 mm. The widest base any season builds: 3.9 px inside at rest
    (the margin asked is 3.9 px), 4.1 px at the least in the bar. The glass alone: 23.2 px at the least (shake 5, frame
    105, beat 2.91). Glass top 163.9 px under the top edge at the least. The heap 16.8 px over the line of the controls at
    the least (shake 1, frame 37, beat 1.02). With the controls only estimated: the same to the sides, top 193.6 px.
  - 1024 x 1366, controls 208 px: camera 751 to 990 mm. Widest base 12.1 px at the least (asked 10.2 px; shake 4, frame
    104, beat 2.88), glass 57.5 px, top 51.9 px. With the controls estimated: 715 to 989 mm, base 10.2 px at rest and
    10.8 px in the bar, top 88.6 px.
  - 1920 x 1080: the camera does not move (701 mm, or 751 mm with controls of 164 px). Sides 405.7 px at the least. The
    lifted glass 10.8 px under the top edge at the least (asked 10.8 px; shake 6, frame 37, beat 1.02).
  So the whole globe stays on the screen on all three, at every frame of all eight shakes: computed.
- Drawn in the live app on 27e83641 (the built app in a browser, 390 x 844, touch, pixel ratio 1, `?quality=low`, one
  press of Shake; every frame the app drew was read off its canvas in the same task, so nothing was missed): picture 11.
  The app drew ten frames from the press to the landing (winter to spring), one every 1 to 16 s; the session moves at
  most 0.25 s a frame (`LIVE.maxFrameSeconds`), so this is the whole shake at four frames a second of its own time.
  What I see, at full size: the camera stands back with the lift, from the first frame; the whole glass and base stand
  inside the screen in all ten frames. Read off the frames: the glass is 222 px across through the bar (computed 223.4)
  and its room to the sides is 78 and 65 px (frame 1), 117 and 51, 38 and 129, 100 and 68, 71 and 97, 85 and 83,
  then the frame of the season's glare, where the glow hides the edge of the glass (the glass is inside by eye), then
  55 and 113, 73 and 94, and landed 88 and 79. The nearest drawn is 38 px; the nearest computed, between those frames,
  is 23.2 px. The globe is small and low through the shake, as "still wrong" says.
- Tablet and hd in the live app on `main`: not drawn (no time; an hd frame takes about 40 s). Computed, above. Drawn
  only through the replay with my lines applied, before they were on `main` (pictures 3 and 4).
- Not run on 27e83641: full vitest, both determinism runs, M1. `/root` reports tsc clean and 92 framing and app tests
  passed there. The determinism runs above passed on 66936ac4, where the callers did not yet pass the moment.
- Seen in passing in the live app: the app measures its controls every 20 frames (`MEASURE_EVERY`) and then eases. On a
  real phone that is a third of a second; here it is minutes, so the globe stood at the estimate (glass top about 194 px)
  through this run.
- The drag script on 1920 x 1080, frames 30 and 140 (`tools/sheet.mjs --app drag --level high --format hd`, picked
  frames): drawn and seen, picture 9.

## Pictures on this branch

See `captions.txt`.

## Appendix: the two scratch tools behind the measures on `main` 27e83641

Neither is committed anywhere else. They are here so the measures can be made again on a later `main`.

The walk of the app's own session (`tests/zz-live.test.ts`, run with `npx vitest run tests/zz-live.test.ts`; it prints
one line a screen and asserts nothing):

```ts
// Scratch, never committed: the app's own session and the app's own call of the camera, frame by frame at 60 a second.
import { it } from 'vitest'
import { config } from '../src/config'
import { FRAME, liveRig, roomUnder } from '../src/app/framing'
import { LiveSession, type LiveSim } from '../src/app/session'
import { poseOfRig, reachOf, type Rig } from '../src/film/moves'
import { beatSeconds, type Timeline } from '../src/film/timeline'
import type { GlobePose } from '../src/shake/table'

const RAD = Math.PI / 180
class FakeSim implements LiveSim {
  step = 0
  advanceTo(step: number, _tl: Timeline): void {
    this.step = Math.max(this.step, step)
  }
  reset(): void {
    this.step = 0
  }
}
const cover = (rig: Rig, g: GlobePose): { side: number; glassSide: number; top: number; foot: number; heap: number } => {
  const r = reachOf(poseOfRig(rig), g)
  const p = rig.pitchDeg * RAD
  const k = Math.tan((rig.fovDeg * RAD) / 2)
  let side = r.side
  for (const end of [-FRAME.baseReachMm, FRAME.baseReachMm]) {
    for (const up of [0, config.globe.baseHeightMm]) {
      const ax = end * Math.cos(g.tiltZ) - up * Math.sin(g.tiltZ)
      const ay = end * Math.sin(g.tiltZ) + up * Math.cos(g.tiltZ)
      const y = ay * Math.cos(g.tiltX) + g.y - rig.aimHeightMm
      const z = ay * Math.sin(g.tiltX) + g.z
      side = Math.max(side, Math.abs(ax + g.x) / (rig.distanceMm - y * Math.sin(p) - z * Math.cos(p)) / k)
    }
  }
  const reachMm = config.globe.baseDiameterMm / 2 + FRAME.heapMm
  const heap = (rig.aimHeightMm * Math.cos(p) + reachMm * Math.sin(p)) / (rig.distanceMm + rig.aimHeightMm * Math.sin(p) - reachMm * Math.cos(p)) / k
  return { side, glassSide: r.side, top: r.top, foot: r.foot, heap }
}

it('prints the worst margins of eight shakes of one session, as the app calls the camera', () => {
  const screens: [string, number, number, (number | null)[]][] = [
    ['phone 390 x 844', 390, 844, [null, 154]],
    ['tablet 1024 x 1366', 1024, 1366, [null, Math.round(0.152 * 1366)]],
    ['hd 1920 x 1080', 1920, 1080, [null, Math.round(0.152 * 1080)]],
  ]
  for (const [name, w, h, bars] of screens) {
    const a = w / h
    for (const controls of bars) {
      const under = roomUnder(h, controls, w)
      const low = -1 + 2 * under
      const s = new LiveSession(new FakeSim(), config.seasons[0]!)
      const worst = { side: Infinity, sideAt: '', top: Infinity, topAt: '', foot: Infinity, footAt: '', glass: Infinity, barSide: Infinity, barSideAt: '', barTop: Infinity, barTopAt: '', barGlass: Infinity, barGlassAt: '' }
      let far = 0
      let near = Infinity
      let frames = 0
      for (let n = 0; n < FRAME.shakePaths; n++) {
        const asked = s.shake()
        if (asked === null) throw new Error(`shake ${n} refused`)
        let f = 0
        let after = 0
        while (after < Math.round((FRAME.homeBars * config.film.beatsPerBar * beatSeconds + 0.5) * 60)) {
          s.tick(1 / 60)
          f++
          frames++
          if (!s.busy) after++
          const m = s.moment(1, 1)
          const rig = liveRig(a, 0, 0, under, m)
          const c = cover(rig, m.globe)
          far = Math.max(far, rig.distanceMm)
          near = Math.min(near, rig.distanceMm)
          const side = ((a - c.side) * h) / 2
          const top = ((1 - c.top) * h) / 2
          const foot = ((-Math.max(c.foot, c.heap) - low) * h) / 2
          const at = `shake ${n + 1} frame ${f}${m.beat === null ? ' (after the landing)' : ` (beat ${m.beat.toFixed(2)})`}`
          if (side < worst.side) (worst.side = side), (worst.sideAt = at)
          if (top < worst.top) (worst.top = top), (worst.topAt = at)
          if (foot < worst.foot) (worst.foot = foot), (worst.footAt = at)
          worst.glass = Math.min(worst.glass, ((a - c.glassSide) * h) / 2)
          if (m.beat !== null) {
            if (side < worst.barSide) (worst.barSide = side), (worst.barSideAt = at)
            if (top < worst.barTop) (worst.barTop = top), (worst.barTopAt = at)
            const gl = ((a - c.glassSide) * h) / 2
            if (gl < worst.barGlass) (worst.barGlass = gl), (worst.barGlassAt = at)
          }
        }
      }
      console.log(
        `LIVE ${name}, controls ${controls ?? 'estimated'}: ${frames} frames of 8 shakes; camera ${near.toFixed(0)} to ${far.toFixed(0)} mm; ` +
          `least to a side ${worst.side.toFixed(1)} px at ${worst.sideAt} (glass alone ${worst.glass.toFixed(1)} px); ` +
          `least under the top edge ${worst.top.toFixed(1)} px at ${worst.topAt}; least over the line of the controls ${worst.foot.toFixed(1)} px at ${worst.footAt}; ` +
          `margin asked ${(FRAME.edgeShare * w).toFixed(1)} px sides, ${(FRAME.edgeShare * h).toFixed(1)} px top; IN THE BAR: side ${worst.barSide.toFixed(1)} px at ${worst.barSideAt}, glass ${worst.barGlass.toFixed(1)} px at ${worst.barGlassAt}, top ${worst.barTop.toFixed(1)} px at ${worst.barTopAt}`,
      )
    }
  }
})
```

The page script that reads every frame the live app draws (`tools/zz-live2.mjs`; build, `npx vite preview --port 4173
--host 127.0.0.1 --strictPort`, then `node tools/zz-live2.mjs 250 26`; frames and a log go to `/tmp/live4`). The tap
lands late on a slow renderer, so the frames of the shake are the ones the log marks `control disabled true`:

```js
// Scratch, never committed: one shake in the live app on a phone-sized touch screen; every frame the app draws is kept,
// read off the canvas in the same task as the app's own frame.
import fs from 'node:fs'
import { launch, watchPage } from './lib/browser.mjs'
const out = '/tmp/live4'
const seconds = Number(process.argv[2] ?? 240)
const most = Number(process.argv[3] ?? 26)
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const t0 = Date.now()
const log = (s) => fs.appendFileSync(out + '/log.txt', `${((Date.now() - t0) / 1000).toFixed(1)} ${s}\n`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
const page = await context.newPage()
const errors = watchPage(page)
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window)
  window.__shots = []
  window.__grab = false
  window.__pressed = null
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      cb(t)
      if (!window.__grab) return
      try {
        const c = document.querySelector('canvas')
        const b = document.querySelector('#ui [data-control="shake"]')
        if (c) window.__shots.push({ at: performance.now(), pressed: window.__pressed, disabled: b?.getAttribute('aria-disabled') ?? null, w: c.width, h: c.height, url: c.toDataURL('image/jpeg', 0.92) })
      } catch (e) {
        window.__shots.push({ at: performance.now(), error: String(e) })
      }
    })
})
await page.goto('http://127.0.0.1:4173/?quality=low', { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => document.querySelector('[data-interface="shown"]') !== null, null, { timeout: 300000 })
log('controls shown')
await page.evaluate(() => {
  window.__grab = true
})
await sleep(1500)
fs.writeFileSync(`${out}/page-rest.png`, await page.screenshot({ type: 'png' }))
const before = await page.evaluate(() => window.__shots.length)
log(`rest pictures ${before}`)
await page.evaluate(() => {
  window.__pressed = performance.now()
})
await page.locator('#ui [data-control="shake"]').tap({ timeout: 120000 }).catch(async () => page.locator('#ui [data-control="shake"]').click({ timeout: 120000 }))
log('pressed shake')
const until = Date.now() + seconds * 1000
let saved = 0
const dump = async () => {
  const shots = await page.evaluate((from) => window.__shots.slice(from).map((s) => s), saved)
  for (const s of shots) {
    const name = `f${String(saved).padStart(3, '0')}`
    if (s.url) fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(s.url.split(',')[1], 'base64'))
    log(`${name} at ${(s.at / 1000).toFixed(2)} s of the page, ${s.pressed === null ? 'before the press' : `${((s.at - s.pressed) / 1000).toFixed(2)} s after the press`}, control disabled ${s.disabled}, canvas ${s.w} x ${s.h}${s.error ? ` ERROR ${s.error}` : ''}`)
    saved++
  }
}
while (Date.now() < until && saved < before + most) {
  await sleep(1500)
  await dump()
}
fs.writeFileSync(`${out}/page-end.png`, await page.screenshot({ type: 'png' }))
log(`done, page errors ${JSON.stringify(errors)}`)
await browser.close()
```


# Second job: on a phone the shake sits higher, over a longer table

Mail from `/root` 07:19 UTC, box to 08:15. Verdict reported at 08:13: BETTERED.

## Commits

- `64353fa2` Phone shake: the far camera aims lower over a longer table (`src/app/framing.ts`, `src/scene/surface.ts`,
  `tests/framing.test.ts`).
- Merges of main around it: `a9ffd0c5` (main bcad846f), `f53ce4f1` (main bef56f56), `508f1dac` (main 16dcd6ae),
  `d9c7e03c` (main 12465d0e). `d9c7e03c` is the head that was pushed, at 08:08.

## The fault and what was done

On 390 x 844 the globe sat low through a shake: glass top about 330 to 345 px of 844, the top 40 percent of the screen
dark. The aim could not drop because the table's near edge would have come into the picture.

- `SLAB_SHAPE.nearMm` 620 to 880 in `src/scene/surface.ts`: one geometry for every screen and for the film.
- `FRAME.tableRestMm: 600`: at rest the camera looks no further down the table than it did, so a longer table moves
  no globe at rest. `tableReach(back)` is 600 at rest and `nearMm - tableKeepMm` = 860 fully stood back.
- `FRAME.shakeMid: 0.43`: on a screen narrower than `narrowAspect` (0.6), where the camera stands back, the far rig
  starts from the aim it rests with and raises it until the middle of the glass, at the highest moment of a shake,
  sits 43 percent down the height; bounded by the foot's line and by `aimForTable(..., tableReach(1))`.
- `liveRig` blends the aim by how far the camera has stood back and clamps it with `tableReach(stood)`.
- 880 and not 900: at 900 the tilt test of the first job read 1.5139 against its limit of 1.5. The limit was kept.
- The pitch limit in `tests/app.test.ts` did not stop anything: pitch is untouched, only the height of the aim drops.

On 390 x 844 the far rig went from 1612.93 mm, aim 97.73 mm, to 1616.25 mm, aim 55.41 mm.

## The numbers

Live app, 390 x 844, touch, pixel ratio 1, `?quality=low`, one press of Shake, winter to spring, every frame read off
the canvas. The middle of the glass as a share of the height, by a circle fitted to the silhouette (fit 0.25 px).

| frame | BEFORE, main 27e83641 | AFTER |
| --- | --- | --- |
| 1 | lift 47.6 (top 279 px) | lift 41.0 (top 224 px) |
| 2 | stroke 52.1 (329) | stroke 43.2 (254) |
| 3 | stroke 52.3 (331) | stroke 43.0 (253) |
| 4 | stroke 52.2 (331) | stroke 43.2 (254) |
| 5 | stroke 52.3 (331) | the change: the glow hides the glass |
| 6 | stroke 52.4 (332) | stroke 43.0 (253) |
| 7 | the change: the glow hides the glass | set down 44.7 (266) |
| 8 | stroke 52.3 (331) | landed 44.4 (261) |
| 9 | set down 52.9 (336) | way back 42.6 (236) |
| 10 | landed 53.6 (341) | way back, last drawn, 39.7 (192) |

- AFTER frames are f024, f034, f041, f072, f098, f120, f146, f152, f175, f197 of 198 drawn (`/tmp/live-after3`).
- Computed at 60 a second: 43.0 to 43.7 through the strokes, 44.4 to 44.8 at the set down. Rest 37.8 with the
  controls measured (glass top 164 px, radius 155.1), 41.3 before the app has measured them.
- Small phones, computed, not drawn: 375 x 667, 320 x 568 and 360 x 640 hold 43.0 to 45.2 while stood back; their
  aim went from 56.5 to 61.2 mm, about 8 px lower on the screen than before.
- Side room, the same before and after to the digit: least beside the glass 23.2 px (computed, shake 5, beat 2.91; by
  shake 25.0, 25.4, 23.3, 23.4, 23.2, 27.0, 23.5, 24.2); least beside an end of the base 3.7 px. Least drawn after:
  26.8 px. The 38 px of the first report was the nearest of ten drawn frames, not the least.
- The table to the bottom edge: in all 198 frames the row means of the lowest 160 rows never step by more than 0.95
  levels of 255 from one row to the next; the lowest 300 rows of four frames were looked at with the brightness
  raised 8 times, both corners.

## Proofs

Film B, hd, draft, lavapipe, sha256 before and after the change, both on main bcad846f, identical:

- frame 0 (macro): `2cde11777c275cc8338de729213b971940cb1889174e1f0f3b2475f34c6482c5`
- frame 1022 (base): `7539c717242347a07a353eb2a075c92ef4b008e80e82e76c7aed1c3e2fa0a72c`
- frame 1742 (interior): `ad021262919d4ab740c7baf34c4f84b1944fd7f3671376c95e6b92828a0075cd`
- frame 2462 (low, along the table): `24c62e94ceb68df359565abaddf3b4d851ea35c725651f2d9c223ba6769c5ce2`

Main changed those frames itself after bcad846f: `58455e4c` draws the particles as quads where the machine's largest
point is too small, which lavapipe's is (against the hashes above frame 0 differs in 42078 pixels by at most 5 levels,
1022 in 769, 1742 in 1541, 2462 in 944). So the proof was made again on the head that was pushed. Before: `d9c7e03c`
with `src/app/framing.ts`, `src/scene/surface.ts` and `tests/framing.test.ts` as they are in main 12465d0e (table
620 mm; the test file only so that the build's type check passes), built and drawn. After: `d9c7e03c`. Identical:

- frame 0: `b59f1d429fbff8e29a8a36cd94612ab3f77a636a50ffbe7cf1a283c57cf55033`
- frame 1022: `4e54e043ddeb63b747bad69d4678fe2b7d5358c955e490e1edf1ceeea896d902`
- frame 1742: `89b1423bc7a0dd0527dc45d1cee077577fe8148b11c0a2c0f2bc04b796b8fb47`
- frame 2462: `7d8edcc308372ba6a9aa18d3f4830bd0edfa9d083e4663adcfb24836a6dd89c1`

Each frame by `npm run seq -- --first N --last N --tier draft --format hd --look no --force`, then `sha256sum` of
`out/work/seq/film-hd-draft/film-00NNNN.png`. The tools read `dist`, so `npm run build` comes after every change of
source and never while a render runs.

Rest: 4600 rest rigs over 23 screens (yaw, pitch, controls measured and not) are the same numbers to full precision
before and after. The far rig differs only on the 8 screens narrower than 0.6.

## Checks on d9c7e03c

- `npx tsc --noEmit`: exit 0. `npx vitest run`: 53 files passed, 1 skipped; 638 tests passed, 7 skipped.
- `npm run strict` on all eight keys (the slab's shape is a shader string): "strict: pass", engine bc83c318e4fb9252,
  drawn by lavapipe. Seven keys: 0 pixels differ in every row. winter-shake: 2 pixels differ by 1 level under
  all+smooth and all+smooth+noguard, 0 under pow and guards; the limits are 1 level and 0.01 percent of pixels.
- `npm run determinism`: pass (3 pictures, 4 page loads, preview, draft).
- `--diag standins` on winter-rest, hero, phone, draft (390 x 844): every pixel 0.
- `tests/framing.test.ts`, 25 tests: the band on five tall phones (360 x 800, 390 x 844, 393 x 852, 412 x 915,
  430 x 932) over all eight shake paths with the controls measured and not; "never looks past an edge of the table" on
  nine screens, yaws to 35 degrees and every tilt through the lift.

## Why not MENDED

1. The band of 42 to 58 percent cannot hold at the two ends of a shake: rest is 37.8 (41.3 until the controls are
   measured) and may not change, so the first frames of the lift and the last part of the way back lie above 42. The
   test holds the band at every moment the camera has fully stood back, and between rest and the band elsewhere.
2. Side room is what main had, not 38 px at every moment. Holding 38 px always needs the globe at about 66 percent of
   rest instead of 72. It was not shrunk.

## Still wrong

- The dressing was not extended. Spring's petals lie within 240 mm of the axis by their own numbers (`PETALS.farMm`)
  and fall's leaves thin out likewise in the pictures, so the stretch of table nearest the camera is bare in the
  shake, as the table beyond the dressing already was. No line shows where they stop.
- A tilt at rest still uses the 600 mm reach, so the first job's fault (d) stays.
- The globe is still 72 percent of rest in the shake.
- Summer's sand has a jagged edge at the foot at low and medium (not from this job, not on the new part).

## What I did not see

- Nothing moving: the software renderer draws a frame every 1.2 to 1.8 s.
- The BEFORE frames are from main 27e83641 on the old software renderer and stop at the landing.
- The last 28 percent of the camera's way back (computed only).
- The glass and the table in the frames of the change: the glow and the cover hide them.
- In fall at both levels and in winter and spring at medium the ten frames of the seasons run end before the camera is
  fully back (glass 222 to 228 px across against 220).
- The seasons' rest frames are before the app has measured its controls.
- Level high, tablet and hd were not drawn live again. Tablet and hd: the far rig is the same numbers.
- The film frames were not redrawn on main 80391266, which merged this branch as `5fbcd0d3` and then took the change
  of season's light and the first picture.

## How the measures were made

All four tools are scratch and are not in the repository. The two page scripts must sit in `tools/` while they run,
because they use `tools/lib/browser.mjs`; move them out again before any commit. They need `npx vite preview` on
127.0.0.1:4173 over a `dist` built from the source, and they are render processes: one at a time, never beside a build.

- `zz-live2.mjs SECONDS MOST OUTDIR QUERY HOMEFRAMES`: one shake on a 390 x 844 touch screen; keeps every frame the
  app draws as `fNNN.jpg`, read off the canvas in the same task as the app's own frame. `HOMEFRAMES` ends the run that
  many frames after the control is enabled again. Under lavapipe the app's clock moves about 0.055 s a drawn frame, so
  one whole shake is about 175 frames and five minutes.
- `zz-live3.mjs OUTDIR QUALITIES SEASONS FARFRAMES`: each season at each quality, one rest frame and the first
  `FARFRAMES` frames after the press, as PNG.
- `measure.py DIR [names]`: the glass's circle by a circle fitted to the upper rim of the silhouette; prints the top,
  the centre as a share of the height, the radius and the room at each side.
- `measure_edge.py FILES`: the same circle where a glow or a glint breaks the silhouette, by the strongest step in
  brightness along the upper arc.

### `zz-live2.mjs`

```js
// Scratch, never committed: one shake in the live app on a phone-sized touch screen; every frame the app draws is kept,
// read off the canvas in the same task as the app's own frame.
import fs from 'node:fs'
import { launch, watchPage } from './lib/browser.mjs'
const out = process.argv[4] ?? '/tmp/live4'
const seconds = Number(process.argv[2] ?? 240)
const most = Number(process.argv[3] ?? 26)
fs.rmSync(out, { recursive: true, force: true })
fs.mkdirSync(out, { recursive: true })
const t0 = Date.now()
const log = (s) => fs.appendFileSync(out + '/log.txt', `${((Date.now() - t0) / 1000).toFixed(1)} ${s}\n`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await launch()
const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
const page = await context.newPage()
const errors = watchPage(page)
await page.addInitScript(() => {
  const raf = window.requestAnimationFrame.bind(window)
  window.__shots = []
  window.__grab = false
  window.__pressed = null
  window.requestAnimationFrame = (cb) =>
    raf((t) => {
      cb(t)
      if (!window.__grab) return
      try {
        const c = document.querySelector('canvas')
        const b = document.querySelector('#ui [data-control="shake"]')
        if (c) window.__shots.push({ at: performance.now(), pressed: window.__pressed, disabled: b?.getAttribute('aria-disabled') ?? null, w: c.width, h: c.height, url: c.toDataURL('image/jpeg', 0.92) })
      } catch (e) {
        window.__shots.push({ at: performance.now(), error: String(e) })
      }
    })
})
await page.goto(`http://127.0.0.1:4173/${process.argv[5] ?? '?quality=low'}`, { waitUntil: 'domcontentloaded' })
await page.waitForFunction(() => document.querySelector('[data-interface="shown"]') !== null, null, { timeout: 300000 })
log('controls shown')
await page.evaluate(() => {
  window.__grab = true
})
await sleep(1500)
fs.writeFileSync(`${out}/page-rest.png`, await page.screenshot({ type: 'png' }))
const before = await page.evaluate(() => window.__shots.length)
log(`rest pictures ${before}`)
await page.evaluate(() => {
  window.__pressed = performance.now()
})
await page.locator('#ui [data-control="shake"]').tap({ timeout: 120000 }).catch(async () => page.locator('#ui [data-control="shake"]').click({ timeout: 120000 }))
log('pressed shake')
const until = Date.now() + seconds * 1000
let saved = 0
const dump = async () => {
  const shots = await page.evaluate((from) => window.__shots.slice(from).map((s) => s), saved)
  for (const s of shots) {
    const name = `f${String(saved).padStart(3, '0')}`
    if (s.url) fs.writeFileSync(`${out}/${name}.jpg`, Buffer.from(s.url.split(',')[1], 'base64'))
    log(`${name} at ${(s.at / 1000).toFixed(2)} s of the page, ${s.pressed === null ? 'before the press' : `${((s.at - s.pressed) / 1000).toFixed(2)} s after the press`}, control disabled ${s.disabled}, canvas ${s.w} x ${s.h}${s.error ? ` ERROR ${s.error}` : ''}`)
    saved++
  }
}
const homeFrames = Number(process.argv[6] ?? 0)
const home = async () => (homeFrames > 0 ? page.evaluate((n) => { const i = window.__shots.findIndex((s) => s.disabled === 'true'); if (i < 0) return false; let k = 0; for (let j = window.__shots.length - 1; j > i && window.__shots[j].disabled !== 'true'; j--) k++; return k >= n }, homeFrames) : false)
while (Date.now() < until && saved < before + most && !(await home())) {
  await sleep(1500)
  await dump()
}
await dump()
fs.writeFileSync(`${out}/page-end.png`, await page.screenshot({ type: 'png' }))
log(`done, page errors ${JSON.stringify(errors)}`)
await browser.close()
```

### `zz-live3.mjs`

```js
// Scratch, never committed: every season at rest and stood back in a shake, in the live app on a phone-sized touch screen,
// at the qualities asked. One page a season; frames are read off the canvas in the same task as the app's own frame.
import fs from 'node:fs'
import { launch, watchPage } from './lib/browser.mjs'
const out = process.argv[2] ?? '/tmp/live-seasons'
const qualities = (process.argv[3] ?? 'low,medium').split(',')
const seasons = (process.argv[4] ?? 'winter,spring,summer,fall').split(',')
const farFrames = Number(process.argv[5] ?? 9)
fs.mkdirSync(out, { recursive: true })
const t0 = Date.now()
const log = (s) => fs.appendFileSync(out + '/log.txt', `${((Date.now() - t0) / 1000).toFixed(1)} ${s}\n`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const browser = await launch()
for (const quality of qualities)
  for (const season of seasons) {
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, hasTouch: true, isMobile: true })
    const page = await context.newPage()
    const errors = watchPage(page)
    await page.addInitScript(() => {
      const raf = window.requestAnimationFrame.bind(window)
      window.__shots = []
      window.__grab = false
      window.requestAnimationFrame = (cb) =>
        raf((t) => {
          cb(t)
          if (!window.__grab) return
          try {
            const c = document.querySelector('canvas')
            const b = document.querySelector('#ui [data-control="shake"]')
            if (c) window.__shots.push({ at: performance.now(), disabled: b?.getAttribute('aria-disabled') ?? null, url: c.toDataURL('image/png') })
          } catch (e) {
            window.__shots.push({ at: performance.now(), error: String(e) })
          }
        })
    })
    await page.goto(`http://127.0.0.1:4173/?quality=${quality}&season=${season}`, { waitUntil: 'domcontentloaded' })
    await page.waitForFunction(() => document.querySelector('[data-interface="shown"]') !== null, null, { timeout: 300000 })
    log(`${season} ${quality}: controls shown`)
    await page.evaluate(() => {
      window.__grab = true
    })
    await page.waitForFunction(() => window.__shots.length >= 2, null, { timeout: 300000, polling: 200 })
    const rest = await page.evaluate(() => window.__shots.length)
    await page.evaluate(() => document.querySelector('#ui [data-control="shake"]').click())
    log(`${season} ${quality}: ${rest} rest pictures, pressed`)
    await page.waitForFunction((n) => window.__shots.filter((s) => s.disabled === 'true').length >= n, farFrames, { timeout: 300000, polling: 200 })
    const shots = await page.evaluate(() => window.__shots)
    const far = shots.filter((s) => s.disabled === 'true')
    const save = (name, s) => fs.writeFileSync(`${out}/${season}-${quality}-${name}.png`, Buffer.from(s.url.split(',')[1], 'base64'))
    save('rest', shots[rest - 1])
    far.forEach((s, i) => save(`far${String(i + 1).padStart(2, '0')}`, s))
    log(`${season} ${quality}: ${shots.length} pictures, ${far.length} with the control disabled, page errors ${JSON.stringify(errors)}`)
    await context.close()
  }
log('done')
await browser.close()
```

### `measure.py`

```python
# Scratch: the glass's circle in a live phone frame, by a circle fitted to the upper rim of the globe's silhouette.
import sys, glob, re
import numpy as np
from PIL import Image
from scipy import ndimage

def measure1(path, thr=60):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    h, w = im.shape[:2]
    lum = 0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2]
    mask = lum > thr
    mask = ndimage.binary_closing(mask, iterations=2)
    lab, n = ndimage.label(mask)
    if n == 0:
        return None
    sizes = ndimage.sum(mask, lab, range(1, n + 1))
    k = int(np.argmax(sizes)) + 1
    comp = lab == k
    rows = np.where(comp.any(axis=1))[0]
    top = int(rows[0])
    # boundary points of the upper cap
    pts = []
    widths = []
    for y in range(top, min(h, top + 400)):
        xs = np.where(comp[y])[0]
        if len(xs) == 0:
            break
        widths.append((y, xs[0], xs[-1]))
    # the cap: rows from the top until the width stops growing (the equator), keep the upper 70 percent of that
    ws = np.array([b - a for _, a, b in widths], dtype=np.float32)
    sm = ndimage.uniform_filter1d(ws, 9)
    eq = None
    for i in range(10, len(sm) - 10):
        if sm[i] >= sm[i - 8] and sm[i] > sm[min(len(sm) - 1, i + 8)] + 0.5:
            eq = i
            break
    if eq is None:
        eq = int(np.argmax(sm))
    use = widths[3:max(12, int(eq * 0.75))]
    for y, a, b in use:
        pts.append((a, y)); pts.append((b, y))
    P = np.array(pts, dtype=np.float64)
    A = np.c_[2 * P[:, 0], 2 * P[:, 1], np.ones(len(P))]
    bvec = (P ** 2).sum(axis=1)
    sol, *_ = np.linalg.lstsq(A, bvec, rcond=None)
    cx, cy = sol[0], sol[1]
    r = float(np.sqrt(sol[2] + cx * cx + cy * cy))
    res = float(np.sqrt(np.mean((np.hypot(P[:, 0] - cx, P[:, 1] - cy) - r) ** 2)))
    # the lowest lit row of the globe and its base: the foot, below the circle, where the silhouette within the circle's columns ends
    col = comp[:, int(max(0, cx - r * 0.5)):int(min(w, cx + r * 0.5))].any(axis=1)
    foot = top
    for y in range(top, h):
        if col[y]:
            foot = y
        elif y - foot > 6:
            break
    return dict(h=h, w=w, top=top, cx=cx, cy=cy, r=r, res=res, left=cx - r, right=w - (cx + r), foot=foot)

def measure(path):
    best = None
    for thr in (60, 85, 110, 135, 160):
        try:
            m = measure1(path, thr)
        except Exception:
            m = None
        if m is None or not (95 < m['r'] < 175) or m['res'] > 1.5:
            continue
        m['thr'] = thr
        if best is None or m['res'] < best['res'] - 0.05:
            best = m
    return best

if __name__ == '__main__':
    d = sys.argv[1]
    names = sys.argv[2].split(',') if len(sys.argv) > 2 else sorted(p.split('/')[-1][:-4] for p in glob.glob(d + '/f*.jpg'))
    for n in names:
        m = measure(f'{d}/{n}.jpg')
        if m is None:
            print(n, 'nothing'); continue
        print(f"{n} top {m['top']:4d} px  centre x {m['cx']:6.1f} y {m['cy']:6.1f} ({100*m['cy']/m['h']:5.1f} percent)  radius {m['r']:6.1f}  glass {m['cy']-m['r']:6.1f} to {m['cy']+m['r']:6.1f}  side room {min(m['left'],m['right']):5.1f}  foot {m['foot']}  fit {m['res']:.2f} px thr {m['thr']}")
```

### `measure_edge.py`

```python
# Scratch: the glass's circle where a glow hides the silhouette: the circle whose upper arc lies on the strongest step in brightness.
import sys
import numpy as np
from PIL import Image
from scipy import ndimage
def edge(path, r0=110.2, box=(120, 300, 330, 520)):
    im = np.asarray(Image.open(path).convert('RGB')).astype(np.float32)
    lum = ndimage.gaussian_filter(0.2126 * im[..., 0] + 0.7152 * im[..., 1] + 0.0722 * im[..., 2], 1.0)
    gy, gx = np.gradient(lum)
    th = np.radians(np.arange(15, 166, 2.0))
    best = None
    for r in np.arange(r0 - 3, r0 + 3.01, 0.5):
        for cx in np.arange(box[0], box[1], 1.0):
            xs = cx + r * np.cos(th)
            ok = (xs >= 1) & (xs < lum.shape[1] - 2)
            for cy in np.arange(box[2], box[3], 1.0):
                ys = cy - r * np.sin(th)
                xi = np.clip(np.round(xs).astype(int), 0, lum.shape[1] - 1)
                yi = np.clip(np.round(ys).astype(int), 0, lum.shape[0] - 1)
                # brightness rises going inward: the gradient along the inward normal (-cos, +sin in image rows)
                g = -(gx[yi, xi] * np.cos(th)) + gy[yi, xi] * np.sin(th)
                s = float(np.sum(g[ok]) / max(1, ok.sum()))
                if best is None or s > best[0]:
                    best = (s, cx, cy, r)
    return best
if __name__ == '__main__':
    for p in sys.argv[1:]:
        s, cx, cy, r = edge(p)
        print(p.split('/')[-1], f'centre x {cx:.0f} y {cy:.0f} ({100*cy/844:.1f} percent) radius {r:.1f} glass {cy-r:.0f} to {cy+r:.0f} side room {min(cx-r, 390-cx-r):.1f} score {s:.2f}')
```
