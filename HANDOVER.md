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
- Drawn in the live app on 27e83641 (the built app in a browser, 390 x 844, touch, pixel ratio 1, quality low, one press
  of Shake): in progress as this was pushed; the next push says what the frames show.
- The drag script on 1920 x 1080, frames 30 and 140 (`tools/sheet.mjs --app drag --level high --format hd`, picked
  frames): drawn and seen, picture 9.

## Pictures on this branch

See `captions.txt`.
