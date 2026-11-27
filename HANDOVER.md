# Handover: `controls_finisher`, the steps, the governor line, two late mends (branch `agent/p6-steps`)

Written 06:10 UTC Nov 27. Main is at `a7f9032b` (chain 17).

- Branch `agent/p6-steps`, last commit pushed `75e5403f` (holds main `fe261991`). You took it into chain 16 as it stands.
- Walked for this handover: `eb7db90d`, which is `75e5403f` with main `d13d29c6` merged in and nothing else. It is on
  my disk only. I did not push it, so that the branch stays as you took it.
- Pictures: this branch, `agent/p6-steps-looks`.

Everything below was run in one VM with no GPU: 4 cores, Chromium 147.0.7727.15 drawing through lavapipe, which does not
link programs aside (no `KHR_parallel_shader_compile`). The live page draws about one frame a second at 320 x 320
(`?quality=low`) and one in two to six seconds at 1920 x 1080. So nothing here was seen moving at speed, nothing was
heard (this VM has no sound files), and no real card, phone, tablet, pointer or finger was used. Where a line says
UNKNOWN it means exactly that: measured here, not known on a real card.

No fresh reviewer read this work. My rules say I start no agents, so the review the Project's standard asks for at the
end could not be made from here.

## 1. On the branch since `6dc688e2` (which main holds as `ce591ce8`): two mends of my own earlier work

Both were found while I gathered this handover. Neither moves a pixel: the eight stills run on `75e5403f` equal your list
for `fe261991`.

### `ed19e3c7` A season's grid is taken whole before it is inflated

- What was wrong: the page inflated each collider file as it came from the host (`fetchCollider`, mine, `78fc89c5`). The
  browser's own record of the page's requests then called summer's file cancelled (`Network.loadingFailed`,
  `net::ERR_ABORTED`, `canceled: true`), a few milliseconds after its last bytes: on 5 loads of 7 of `6dc688e2` by my
  count at the time. The logs I kept hold 6 of those loads, 4 with summer's file cancelled and 2 with none
  (`req-6dc6-a`, `-b`, `-c`). The page had the grid whole every time (1,048,592 bytes, read back in the page), nothing
  was thrown and nothing came to the console. The fault was in the record only. A host's log, the browser's network
  panel or a walk that listens for failed requests reads it as a file that did not load. `tools/visit.mjs` leaves
  `ERR_ABORTED` out of the count it prints (it is also what a request cut off by the tool itself looks like), which is
  why no walk said so before. Its `result.json` holds them all under `failedRequests`.
- The cause is in the browser, read in its source at the tag of the version here (147.0.7727.15,
  `third_party/blink/renderer/platform/loader/fetch/response_body_loader.cc`): a body read as a stream tells its reader
  that it has ended before it records the end itself, and `Cancel()` asks only whether the body is still loading. A
  reader that lets go on hearing of the end so cancels a body that has just ended whole. Chromium's main branch has
  since turned the two round, with the comment "Record the terminal state before notifying the client, which may
  Cancel() on seeing it." I did not look for the first version that has it, so a visitor's Chrome may or may not.
- Why summer's and no other: I do not know. Which body is caught is a matter of timing inside the browser.
- Mend (`src/scene/gridfile.ts` `fetchGrid`, `src/scene/stage.ts`): the file is read whole, then inflated. The grid is the
  same to the bit.
- Proof on the build of `75e5403f` (engine `af0bf8ec08ce5dab`), 6 loads at 320 x 320, low: 24 of 24 grid files
  finished, none failed, every grid whole, no rejection (`req-75e5.log`). Test: `tests/collider-file.test.ts`, "a grid
  the page fetches" (2 tests): the page is handed a file whose stream may not be read. With the old line back: "Error:
  the file was read as it came", 1 failed, 1 passed.

### `e19369f9` A browser that cannot link aside is not asked to

- What was wrong: the hand (`77b8442f`, mine) asked for each program through three's `compileAsync`. Where a browser has
  no `KHR_parallel_shader_compile`, three answers with a console warning, once a page: "THREE.WebGLRenderer:
  KHR_parallel_shader_compile extension not supported." Firefox does not have the extension
  (https://caniuse.com/mdn-api_khr_parallel_shader_compile), nor has the renderer here, where every load of `6dc688e2`
  had that one line.
- Mend (`src/scene/stage.ts`, the hand): such a browser is given `compile`, which is all `compileAsync` did for it but for
  the warning and a wait of 10 ms. A browser that links aside is asked as before, so that path is the one main already
  had. It has never run here: this renderer cannot link aside.
- Proof on the build of `75e5403f`: the same 6 loads, the console holds nothing. No unit test holds it: the hand needs a
  GPU. `tools/visit.mjs` and `tools/standstill.mjs` print the console's lines of every walk.

## 2. What I chose: the governor line (`1555255d`, on main since chain 13)

You gave leave for line 485 of `src/app/app.ts` and one optional member on the Stage interface, and asked me to say what I
chose.

- The line: `if (!session.skipping && !d.stage.awaited?.() && governor.frame(dt)) applyLevel()`. One reader. The governor
  takes the median of 90 frames, so a frame it is not told of is simply not in that median.
- The member, `awaited?(): boolean` (`src/core/stage.ts:79`), says at each frame whether the page worked on the season
  pressed for in the time that frame took to come: `workIn` (`src/scene/steps.ts:199`) calls `wish.gives()` each time it
  works on that season; `Wish.drawn` moves the note from "giving" to "given" at the frame; `gave` reads it. So the
  governor is kept untold only of frames before which work was in fact done for the season pressed for.
- It is there from the first press on (`GlobeStage.expect`, `this.awaited ??= ...`, one caller, `src/app/app.ts:322`). A
  still, a film and the loop never press, so they have no such member and the line reads as it did.
- Files that fail or never come: the season is not worked on, so every frame is heard. A making that breaks off: heard
  from the next frame. A long making: what is left `LAST_S` (3.5 s) after the press is made in one piece, and the
  governor hears again two frames after that at the latest. You settled both points I raised (03:38): the probe keeps
  the member, and the long making ends two frames after `LAST_S`. Nothing was changed after that.
- Test: `tests/governor-making.test.ts` (10 tests) runs the line as it stands in `src/app/app.ts` with the page's own
  loader, session, wish and governor. With the old line put back: 5 failed, 5 passed.
- NOT SEEN on a real page at 60 a second. Here the page never reaches a pace at which the governor's floor matters.

Also on main from this branch: the miniatures made in steps (merged 02:17 as `37c2be1c`) and `2cf928b4`, the wish goes
once its season is on show (reduced motion). That one was read from the page's state lines only: with reduced motion
set and a press 1 s after the controls, the other seasons were ready 20.3 and 22.8 s after the controls (main then:
15.9 and 16.1 s; before the mend 34.9 s and once not within 45 s), and the press was in spring 8.6 and 10.0 s after it.
Nobody has looked at a device with the setting on.

## 3. The live page's controls: what I know is not right or not seen, one line each

For the last walk of the published page. Everything here is from `eb7db90d` (section 5 says what that is), walked from
04:55 to 05:58 UTC with `tools/visit.mjs`: steps 2 to 10, 12, 14, 15 and 16 at 600 x 600; steps 1, 11 and 16 on hd; 1,
2, 11 and 13 on phone; 1 and 11 on tablet. 89 lines, 2 of them NOT (one is line 7 below, one is the tool's). The dim and
the keys were also read with two scratch tools (`scratch-tools/dim-clock.mjs`, `keys-walk.mjs`). In every run the
console held nothing and no page error came. Main has gone on since, to `a7f9032b` (chains 16 and 17: the other
builders' scenes and the new first pictures; between `eb7db90d` and it no file of the controls, the app, the core or
the tools differs). I walk again on the head of job 1 of section 9 and bring this list up to date then.

Not right, worst first. Each line ends with what to look at.

1. An early press on the mark of summer or fall, or on Shake at `?season=spring` or `?season=summer`: that season's
   programs are linked and its buffers uploaded in the middle of the shake (section 4, item 2). Look: the plain address,
   the fall mark within 5 s of the controls coming, the swirl for a stop.
2. The first shake into spring links one program in the middle of the swirl (section 4, item 5). Look: the first press
   on Shake at any time, the swirl about half way.
3. The picture at rest stops about 1.5 s after the controls come (six pictures uploaded at once, section 4, item 6) and
   once more while summer's set is made (0.7 s of the page's own script here, item 3). Look: the snow at rest in the
   first ten seconds after the controls.
4. In a browser that does not link aside the picture at rest stutters while the other seasons are handed to the GPU
   (section 4, item 4). Look: Firefox, the first minute at rest.
5. The hint comes late when the thread stands across the fifth second after the controls: 7.039 s on phone in the walk
   (hd 4.999, tablet 4.997) and 5.9, 5.6, 9.698 (tablet) and 7.939 s (hd) in the standstill runs, for 5 asked; it came
   0 and 15 ms after the stop ended. Look: the ring round Shake, 5 s after the controls come.
6. A press is taken late when the thread stands: 1.982 s from the press to the busy control (summer to fall by pointer)
   and 1.052 s (the first of four presses in a row); the eleven other timed presses took 0.03 s at most. Look: a press
   in the first seconds, while the page still makes its seasons; the control must answer at once.
7. At 600 x 600 the first still stands half a pixel to the right of the live picture: it fits the live picture best
   moved 0.5 px to the left, where the tool asks for under half a pixel (`NOT 16 first-look`; the still's box by the app
   is -59.5, 0, 719.01 x 600.01). On hd it fits with no shift. It is as on main `38eff8da` and `266d093d`, where I
   showed it (`walk-f/sq-1-half-pixel.jpg` on `agent/p6-controls-looks`) and named the mend: the still's box on whole
   pixels in `put` of `index.html`, your file. `put` is the same on `a7f9032b`. By eye nothing doubles. Look: a window
   nearly square, the glass's upright edges as the live picture comes in over the still.
8. An eight bar music loop is heard with a seven bar period, because the overlap of two passes comes out of the loop
   itself (`seamOf`, `src/audio/index.ts`; said in the handover of `agent/p6-controls`). Nothing was heard here. Listen:
   the music through one whole loop, for a phrase that comes a bar early.

Seen right, where a number of the walk reads wrong.

9. The dim. The walk's line reads 6.923 s on hd (phone 9.864, tablet 9.639) for 8 asked. That is the tool's clock,
   not the page's: the tool counts from the answer to its second move, and the page counts two moves made within 0.2 s
   of each other once (`moveGapSeconds`, by the events' own time stamps), so that it had already begun to count at the
   first. By the page's own clock (`dim-clock.mjs`) the controls never dimmed before 8 s: 8006, 8002, 8008 and 8000 ms
   after the last move the page counted once the seasons were made and the thread did not stand (`dim-late-eb7d.log`;
   in the first of those rounds the two moves were stamped 197 ms apart and the tool counted 7258 ms), and 13568,
   13342, 12310 (hd), 12037, 11996 and 8472 ms (600 x 600) in the first minute, each at the end of a stop of the thread
   that lay across the eighth second (`dim-eb7d.log`). Look: the controls go quiet 8 s after the pointer stops, and not
   before.
10. The keys with no control in focus (`keys-walk.mjs`, 7 lines, all ok, each picture looked at): the right, left, up and
    down arrows change the season, round the ends too, and take no focus; with a mark in focus the arrow moves the
    focus to the new season's mark; a key held through the landing starts no second shake; `s` with no sound to turn
    does nothing. Tab order: winter, spring, summer, fall, Shake; the ring is 2 px of rgba(255, 242, 222, 0.96).

The tool's faults (`tools/visit.mjs`, my file). I mend them with the push of job 1.

11. Step 5 run after step 4 reads `NOT 5 look-returned` (12.76 apart, rest 2.53): step 4 ends 12 frames after its stir
    and step 5 takes its picture of rest with the snow still in the air. Step 5 alone: 4 lines, all ok, 1.11 apart at
    a rest of 0.94.
12. The dim's seconds, line 9.
13. The walk's printed count of failed requests leaves out every request the browser calls cut off (`ERR_ABORTED`),
    because that is also what a request looks like that the tool itself cuts off by opening the next address. So it
    was blind to the grid file of section 1. In these walks `result.json` holds 9 such requests: one in the run of
    steps 12, 10, 14 and 15 (`village-fall.glb`) and 8 of summer's files in the first look at 600 x 600, both runs that
    open one address after another. I take them for the tool's own, by where they fall. I have not proved it request
    by request.
14. A picture is taken when this machine gets to it. On hd the picture named `01-first-paint` already shows the
    hint's ring.

Not seen. Each is a thing to look at.

- Anything at 60 a second: the controls' arrival (0.7 s), the hint's pulse (1.9 s), the dim (0.9 s) and the wake
  (0.18 s), a press (0.26 s), the dissolve under reduced motion (1.8 s). All read as states and numbers.
- The sound control and any sound. This VM has no sound files, so the page hides the control (`sound: hidden`, `audio:
  none`) and Shake stands alone under the marks. Look and listen: the sound control beside Shake, its two states, the
  key `s`.
- A finger. The tool sends the taps. The marks are 48 x 48 on phone and tablet and 44 x 44 on hd and on a phone lying
  on its side.
- The safe area under the page: 0 here. Look: a phone with a home bar, the gap under Shake.
- A real phone turned in the hand. Walked as a window of 390 x 844 made 844 x 390 and back, at rest and in a shake:
  5 lines ok.
- Safari and Firefox. Everything here is Chromium 147.
- A tab hidden and come back to (section 4, item 10).
- The governor at speed. Here the page picks its quality by itself as high, then medium 11.4 s and low 27.5 s after.
- Reduced motion on a device. Emulated here: 12 frames, 9.3 s, the lines ok.
- The keys under a hand, and a screen reader. The names it would read were read from the page (step 8), not heard.

## 4. The steps and the hand: what is still wrong, worst first

What the steps and the hand do, so that the list can be read: a season not on show is made a few steps a frame while the
picture rests (aside: 4 ms or a quarter of the frame; for a season pressed for: 12 ms or the whole frame), and then
handed to the GPU a few programs, pictures and buffers a frame (the hand, 4 ms a frame). A press makes its season the
one worked on (the wish), for at most 4 s of session time.

1. Nobody has seen any of it on a real card at 60 a second. Every number here is from a machine that draws a frame in
   one to six seconds. What the steps are for (no stop at rest, no stop in the first shake) can only be judged there.
2. A press in the first seconds for a season that is not the first in the hand's chain still links that season's
   programs and uploads its buffers at the first frame that shows it, which is in the middle of the shake: the fault the
   hand was made for. The hand is one chain (`this.handing`, `src/scene/stage.ts:206`), in the order the seasons are
   asked for (the config's order, without the season the page opened on): the season pressed for waits behind the season
   the hand is on, and that one is held while the wish stands (`Wish.holds`). Who meets it: a visitor who presses the
   mark of summer or fall early on the plain address, and a visitor who opens `?season=spring` or `?season=summer` and
   shakes early (the next season is then second or third in the chain). On the plain address the Shake control and the
   space bar go to spring, the first in the chain, whose hand does run through the shake, at 4 ms a frame; whether that
   is done before spring is shown is UNKNOWN on a real card. How early is early: until the hands before it are done.
   Here that is 97 s after the controls for all three; on a real card UNKNOWN, a few seconds by my reckoning, and the
   hint invites a press at 5 s. Not mended. This machine has three or four frames between a press and the frame that
   shows the season, so it can show that a hand starts and not that it is enough, and I will not call that a proof.
   What I would make, in my file (`src/scene/stage.ts`), if you want it: the hand of the season pressed for runs beside
   the chain and not behind it, both where its making ends after the press
   (`this.handing = this.wish.awaits(season) ? Promise.all([this.handing, this.hand(season)]).then(() => undefined) : this.handing.then(() => this.hand(season))`
   in `make`) and where it was made before the press and still waits in the chain (started in `expect`, each season's
   hand started once). The second half needs a note of which hands have started. Neither is made or tried.
3. Summer's set stops the page's thread for most of a second while the picture rests, on every machine, because it is
   the page's own script: the sand's field (`field()` in `src/seasons/summer/slab.ts`, not my file) is made inside the
   one step `kit.dressing()` (`src/scene/stage.ts:396`), and the steps cannot split a step. In Node here, the first time
   in the process, as the page makes it: 700 ms on `eb7db90d` (item 8). Chain 15 made the field finer: 9,783,708 samples
   of the ground are walked, 4,368,416 on `fe261991`; `field()` alone, timed beside a running walk, took 640 to 1000 ms
   on `eb7db90d` and about 370 ms on `fe261991`. I sent you a patch at 05:09 (`summer-field.patch` on this branch): the
   march skips the stretches of a ray that cannot shade its start, walks 935,219 samples and took 117 to 215 ms where the
   old took 545 to 839 ms in the same runs; the five arrays came out the same to the byte in three runs
   (`scratch-tools/field-try.mjs`). Proved in Node only: `npx tsc --noEmit` exit 0, `tests/grain-file.test.ts` and
   `tests/summer-fall.test.ts` 15 passed; no still drawn, no guard taken, not on a page. You passed it to the sand's
   builder (05:12). With it about 200 ms are left in one piece; the dressing made in steps is the second job of section 9.
4. A browser that does not link aside (Firefox; the renderer here) waits for each program in the hand, one a frame, while
   the picture rests: 69 programs for the three other seasons, each a wait of about a second on this machine
   (`getProgramInfoLog`, `getShaderInfoLog`), so the picture at rest stutters here for the first 100 s. Before the hand
   those waits all fell in the first shake into each season. On a real card in Firefox UNKNOWN: walk it there.
5. The first shake into spring links one program in the middle of the swirl even when the hand is done: spring's soft copy
   for its drops (`src/seasons/spring/glass.ts:726`, `softPass ??= new Pass(SOFT, softUniforms)`, there since `3159872c`,
   not my file). It is made in the drops' `onBeforeRender`, which the hand leaves out on purpose (it would copy a frame of
   one pixel). Here the page's thread waits 6.0 s for it (one stop, 4.0 s after the press); the four shakes after it have
   no stop but two of 50 to 65 ms at the press. On a real card UNKNOWN, a small program. A mend is written and NOT
   TRIED: `spring-soft.patch` on this branch, against `75e5403f`. It touches two files: mine (`src/scene/stage.ts`: the
   hand also runs what a mesh names under `userData.warm`) and spring's glass, which is not mine (a function that makes
   the soft copy's program and draws it once into a target of one pixel, with the renderer's target and its count of
   draws put back). Not committed, no test, no still, no page. It needs the builder of spring's glass and the eight
   stills before anyone takes it.
6. About 1.5 s after the controls come, the first season's full pictures are uploaded together: six `texSubImage2D` in one
   stop of 3.4 s here (`gl-big-6dc6.log`). Left as it is by agreement (the picture uploads); on a real card UNKNOWN.
7. The first shake's two waits inside `bufferSubData` (223 and 5 ms here): left as agreed, UNKNOWN on a real card.
8. Pieces of a season's set that are still made in one piece each, which the steps cannot split (the seasons' files, not
   mine). In Node here on `eb7db90d`, nothing else running (`scratch-tools/kit-steps.mjs`): the first making in the
   process, as the page makes it, and in brackets the least of three more, in ms. "glass" and "surface" are the two
   halves of the one step `kit.dressing()`.
   - winter: base 2 (0), arrival 57 (26), lights 98 (88), frost 1 (0)
   - spring: base 1 (0), arrival 0 (0), lights 1 (1), glass 23 (0), surface 3 (0)
   - summer: base 1 (0), arrival 0 (0), lights 2 (1), glass 1 (0), surface 700 (23)
   - fall: base 1 (0), arrival 0 (0), lights 48 (36), glass 92 (0), surface 3 (0)

   After summer's surface (item 3) the longest are winter's lights (98), fall's glass (92), winter's arrival (57) and
   fall's lights (48). The miniatures are not in this list: they are made in steps.
9. `KEEP_MS` (4 ms kept free at the end of a frame) was chosen on this machine: UNKNOWN on a phone.
10. A hidden tab makes its seasons at the timer's pace (a page that draws no frame is given a turn every 50 ms at best,
    and a browser slows the timers of a hidden tab to one a second): a visitor who comes back early meets seasons not yet
    made. Read in the code, not seen.
11. The loader asks for the seasons one after the other: behind a season whose files never settle, the ones after it
    are not asked for until a press asks for them. Read in the code, not seen.
12. Left as they are, by agreement with you (02:17): the two picture uploads, `dewKeep`, the particles' stipple,
    `copyBehind`, `bakeGrid`.

## 5. What was measured here, and on which head

All at 320 x 320, `?quality=low`, unless a size is named. The logs are in my scratch folder (`out/work/p6s/`, not
committed); the tools that are not in the repo are on this branch under `scratch-tools/`.

On the build of `6dc688e2` (engine `711273c25f131354`). Its page is that of `75e5403f` but for the two mends.

- The controls come 7.0 to 7.4 s after the address is asked for.
- At rest, the 30 s after the controls (`tools/standstill.mjs --gap 50`): the page's thread stood still 18 times,
  23.4 s in all, the longest 3.3 s. A profile of the load puts little of it in the page's own script: the longest piece
  under `make` after the controls is 394 ms, 12 pieces are 30 ms or more, 1.8 s in all. The rest is the renderer here.
- The hint: 6.6 s after the controls in that run and 5.8 s in the run with five shakes, for 5.0 asked; behind a stop of
  the thread that lay across the fifth second. At the sizes of phone, tablet and hd, where none did: 5.004, 5.001 and
  5.010 s.
- A press 1 s after the controls: it reached the page 1.7 s later (the thread stood), the control went busy 1 ms after
  that and the next frame came 9 ms after that; it landed 22.5 s after the press. The other seasons were ready 50.4 s after
  the controls.
- Five shakes, the first once the seasons were in the GPU's hands, each next one 3 s after a landing: the seasons were
  ready 34.7 s and in the GPU's hands 97.0 s after the controls. Shake 1, into spring: 13 frames, one stop of 6.0 s from
  4.0 s after the press. Shakes 2 to 5, into summer, fall, winter and spring: 10 frames each and no stop but two of 50
  to 65 ms at the press.
- What the page hands the GPU (`gl-count.mjs`): 36 programs before the controls; 69 at rest after them, in three groups
  (23, 24, 22), with 69 waits in `getProgramInfoLog`; in shake 1 one program (waits of 4455 and 1667 ms) and two
  `bufferSubData` (223 ms the longer); in shake 2 none.
- Six `texSubImage2D` in one stop of 3.4 s from 1.5 s after the controls (`gl-big.mjs`).

On the build of `75e5403f` (engine `af0bf8ec08ce5dab`): six loads, 24 of 24 grid files finished, the console empty, the
controls at 6.9 to 8.3 s.

On the build of `eb7db90d` (engine `42af82aa0e16ae70`; it is `75e5403f` with main `d13d29c6` merged in, local, not
pushed): the walks of section 3, the set pieces of item 8 of section 4, and the standstill again.

- The controls come 6.9 to 7.7 s after the address is asked for (six runs).
- At rest, the 30 s after the controls: the thread stood still 24 times, 28.4 s in all, the longest 3.1 s; 29 frames.
  On `6dc688e2` it was 18 times, 23.4 s, 3.3 s, 25 frames; on `91d91c8d` of this branch 23 times, 27.0 s, 3.8 s,
  29 frames. That is the spread of this machine, where a frame takes about a second; no change is to be read from it.
- The hint: 5.9 s after the controls in that run and 5.6 s in the run with five shakes. At the sizes of phone, tablet
  and hd: 5.005, 9.698 and 7.939 s. On tablet a stop of 5.1 s lay across the fifth second, on hd one of 6.8 s; the hint
  came 0 and 15 ms after the stop ended.
- A press 1 s after the controls: it reached the page 189 ms later, the control went busy 2 ms after that and the next
  frame came 38 ms after that; it landed 24.7 s after the press. The other seasons were ready 52.9 s after the controls.
- Five shakes: the seasons were ready 36.6 s and in the GPU's hands 101.0 s after the controls. Shake 1, into spring:
  14 frames, one stop of 6.3 s from 5.5 s after the press. Shakes 2 to 5: 10 frames each and no stop but two of 50 to
  65 ms at the press.
- The console: 0 lines in all six runs.

## 6. Checks run and what they printed

On `75e5403f` (holds main `fe261991`), 04:28 to 04:49 UTC:

- `npx tsc --noEmit`: exit 0. `npm run build`: exit 0.
- `npx vitest run`: "Test Files  66 passed | 1 skipped (67)", "Tests  919 passed | 8 skipped (927)". Against your 921
  passed and 4 skipped on `fe261991`: two tests more, mine, and four of `tests/mix.test.ts` skipped here, where there
  are no sound files.
- `node tools/miniatures.mjs`: "pass: sha256 998acb35427999b7be4eec2d4304910e3f2a48f78fbb4ac48f0f1608f47dd1d5", and
  the same sum from main `fe261991`'s own tool, whole and three ways.
- The eight stills (hero, hd, draft), sha256 first 16, all equal to your list for `fe261991`: winter-rest
  0cab5cd137ba09d9, winter-landed a7ab4af383606ed0, spring-rest 3e0590b86f060f86, spring-landed 8003c5ad4b71bf89,
  summer-rest 4ee19cfaa5e10a91, summer-landed 5977d3d747736eae, fall-rest bc84d1af2466c07f, fall-landed
  e26e787b52e49ef1.
- `npm run measure -- --unit summer --only M3 --tier review --force`: "pass M3 summer-rest: 0.9528 (threshold 0.75,
  detail.minSharpnessRatio)".
  Yours: 0.9528.
- Each season at rest with `--diag standins`: the brightest value is 0 in all four pictures.
- `npm run determinism`: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 159 s".
- `npm run strict -- --keys winter-rest,spring-rest,summer-rest,fall-rest`: exit 0. Its last line, word for word:
  "strict: pass, 4 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, where that
  one differs by its answers (no number, 0, 0.577 and 1e30), and where those differ against its own --same picture
  (engine af0bf8ec08ce5dab, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move"
- Six page loads with the browser's own record of requests: section 1.

On `eb7db90d` (holds main `d13d29c6`): `npx tsc --noEmit` exit 0; `npm run build` exit 0; `npx vitest run` "Test Files  66
passed | 1 skipped (67)", "Tests  919 passed | 8 skipped (927)"; `node tools/miniatures.mjs` pass with the same sum,
from main `d13d29c6`'s own tool too. The stills, the determinism run and the strict run were not made again
on it: it adds main's own commits to `75e5403f` and nothing of mine.

Earlier, on `6dc688e2` (holding main `7e543b87`): `tests/governor-making.test.ts` 10 passed, with the old line back
5 failed and 5 passed; the strict run passed on the same four keys.

## 7. What I did not see with my own eyes

- Anything moving at speed. Every picture here is one frame of a page that draws a frame in one to six seconds. The
  swirl, the landing, the controls' arrival, the hint's pulse, the dim and the wake, a press and the dissolve under
  reduced motion were read as states and as numbers, never seen as motion.
- Any sound, and the sound control: this VM has no sound files, so the page keeps the control hidden.
- A real card. Every time in this file is from lavapipe on 4 cores. What a real card does with the hand's 4 ms a frame,
  with the uploads and with the links is UNKNOWN.
- A browser that links aside: the `compileAsync` path of the hand has never run here.
- Firefox, Safari, a phone, a tablet, a finger, a screen turned in the hand, a tab hidden and come back to, a device
  with reduced motion set.
- The governor line at speed: held by its test only (section 2).
- The field patch and the soft copy's mend on a page (section 4, items 3 and 5).
- The eight stills, the determinism run and the strict run on `eb7db90d` (section 6): they were run on `75e5403f`.

## 8. Run it again

One render, walk or build at a time on a machine like this one. With the assets in place as the README says:

```
npm ci
npm run build
node out/work/p6s/serve.mjs "$PWD" 4180 &
node tools/visit.mjs --url http://localhost:4180/ --layout 600x600 --only 2,3,6,8,9 --name does
node tools/visit.mjs --url http://localhost:4180/ --layout hd --only 1,11 --name hd
node tools/visit.mjs --url http://localhost:4180/ --layout phone --only 1,11,2 --name phone
node tools/visit.mjs --url http://localhost:4180/ --layout tablet --only 1,11 --name tablet
node tools/visit.mjs --url http://localhost:4180/ --layout 600x600 --only 12,10,14,15 --name more
node tools/visit.mjs --url http://localhost:4180/ --layout hd --only 16 --name first
node tools/visit.mjs --url http://localhost:4180/ --layout 600x600 --only 4,5,7 --name stir
node tools/visit.mjs --url http://localhost:4180/ --layout phone --only 13 --name turn
node tools/visit.mjs --url http://localhost:4180/ --layout 600x600 --only 16 --name firstsq
node tools/visit.mjs --url http://localhost:4180/ --layout 600x600 --only 5 --name look
node tools/standstill.mjs --url http://localhost:4180/ --gap 50 --name plain
node tools/standstill.mjs --url http://localhost:4180/ --gap 50 --press 1000 --seconds 70 --name press
node tools/standstill.mjs --url http://localhost:4180/ --gap 50 --shakes 5 --name shakes
node tools/standstill.mjs --url http://localhost:4180/ --gap 50 --layout phone --seconds 20 --name hint-phone
npx vitest run tests/collider-file.test.ts tests/governor-making.test.ts
```

Each walk writes its pictures, `facts.jsonl` and `result.json` to `out/work/visit/<name>/`. Read `result.json` whole:
the line a walk prints leaves `ERR_ABORTED` out of its count of failed requests.

The scratch tools on this branch (`scratch-tools/`) reach the repo's `tools/lib/browser.mjs` three folders up, so they
run from `out/work/p6s/` of a checkout. Each says in its first line how it is called.

- `serve.mjs <tree> <port>`: that tree's `dist/` on its own static server.
- `req-cdp.mjs <url> [seconds] [size] [press ms]`: what the browser's record of requests says of each grid file, beside
  what the page's fetch got (section 1).
- `gl-count.mjs <url> <name> [shakes] [size] [first press]`: what the page hands the GPU and when, apart for each rest
  and each shake (section 5).
- `gl-big.mjs <url> [seconds]`: every WebGL call of 20 ms or more, with what it was given.
- `kit-steps.mjs <tree>`: the pieces of each season's set timed in Node (section 4, item 8). It needs the tree built.
- `field-try.mjs <tree> [file of lines]`: summer's field timed in its three parts and counted; with a file of lines to
  put in place of the march, both ways compared byte for byte (section 4, item 3).
- `dim-clock.mjs <url> [size] [rounds] [scale] [ms to wait after the controls]`: the dimming by the page's own clock,
  beside what a tool counts that sends two moves and then asks (section 3, line 9).
- `keys-walk.mjs <url> [size] [folder for the pictures]`: the arrows with no control in focus and with a mark in focus,
  a key held through a landing, and `s` with no sound (section 3, line 10).

## 9. Next: the two jobs you gave me at 05:12

1. The three warnings of the fifth publish's security reviewer, on `agent/p6-steps`: a capture address with a format the
   config does not name; a view or a shot named in the address that is not a known one; lookups by a name from outside
   that go through inherited properties. Begun once this file is pushed. With the same push, in my own
   `tools/visit.mjs`: the three faults of the tool in section 3 (lines 11 to 13). The commits and the proof go to you by
   message, and this file is brought up to date then, with the walk on that head.
2. Summer's dressing made in steps, once you send the head that holds the sand's third push.
