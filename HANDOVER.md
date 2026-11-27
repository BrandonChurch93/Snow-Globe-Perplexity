# Handover: `controls_finisher`, the steps, the governor line, two late mends (branch `agent/p6-steps`)

Written 06:10 UTC Nov 27, when main was at `a7f9032b` (chain 17). Brought up to date 08:37 UTC with section 9 (where
the jobs of 05:12 and 06:12 stand), section 10 (job 1) and section 11 (job 2). Main is now at `82d0b882` (chain 24),
which holds `agent/p6-steps` at `7a863f7f`. Sections 1 to 8 stand as written at 06:10; where a later job changed what
they say, sections 10 and 11 say so.

- Branch `agent/p6-steps`. At 06:10 its last commit pushed was `75e5403f` (holds main `fe261991`), which you took into
  chain 16 as it stood. Now it is `7a863f7f` (holds main `d2013ce3`).
- Walked for this handover: `eb7db90d`, which is `75e5403f` with main `d13d29c6` merged in and nothing else. It is on
  my disk only. I did not push it, so that the branch stays as you took it.
- Pictures: this branch, `agent/p6-steps-looks`.
- Brought up to date again at the close of round two (22:50 UTC Nov 27) with section 12 (job 3), section 13 (job 5)
  and section 14 (round two). The branch is then `2765d9b3`, which holds main `ed9180da`. Where sections 1 to 11 name
  an older head, sections 12 to 14 say what came after.

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
- `job1-page.mjs <base url> <out dir> [wait seconds]`: the built page at addresses that name things the app does not
  know, and the capture interface asked for names every object carries (section 10).
- `own-keys.py <tree>`: every `in` and every index by a name in `src`, to be read by eye (section 10).
- `kit-order.mjs <tree>`: each season's set made in Node in the page's order, the dressing and the miniature in steps
  with a clock round each step (section 11). It needs the tree built.
- `field-same.mjs <tree before> <tree after>`: summer's five arrays made in one piece and in steps, compared byte for
  byte (section 11).
- `step-page.mjs <url> <name> [size]`: the page of a scratch build that carries a clock round each step
  (`step-probe.py <tree>` puts the clock into a copy of the tree, never into one you push); it reads each step as the
  page's own clock has it (section 11).
- `walk910.sh <tag> [port]`: the hint and the presses walked again, one walk after the other (section 11).
- `prof-load.mjs <url> <name> [seconds after the controls] [press after ms] [size]`: the processor profile of the
  page's thread from its start. `prof-stops.mjs <name> [over ms]`: where the thread was in each long stop after the
  controls, by the innermost function (section 11).

## 9. The jobs you gave me at 05:12 and 06:12: where each stands

1. Job 1, the three warnings of the fifth publish's security reviewer: done, `3e6e0a6d`, on main since chain 22.
   Section 10.
2. Job 2, summer's dressing made in steps: done, `7a863f7f`, on main since chain 24. Section 11.
3. Job 3, under way, not pushed. What it holds, by your words of 06:12, 07:32 and 08:10:
   - the early press (section 4, item 2): a season made before the press and not yet handed, pressed early, waits for
     its hand, and no program is linked in the middle of the shake. In `src/scene/stage.ts`, `src/scene/steps.ts` and
     `src/app/session.ts`, with your leave for lines 76 and 77 of `src/core/stage.ts` and line 322 of `src/app/app.ts`;
   - `spring-soft.patch` tried (section 4, item 5), with spring's two guard stills as on main or the pair shown;
   - `put()` and line 74 of `index.html`: the first still where the live picture stands at 600 x 600 (section 3,
     line 7), and the first still for a capture address that fell back to the live page (section 10);
   - `setDiagnostic` checked against the app's views, if it is three lines;
   - in my own `tools/visit.mjs`: the three faults of the tool (section 3, lines 11 to 13);
   - a test that says what the music loops are: a loop of 21.6 s with a seam of 2.4 s comes round every 19.2 s.
   A section 12 follows with its report.

## 10. Job 1: the three warnings of the fifth publish's security reviewer

Pushed 07:16 UTC as `3e6e0a6d` (holds main `35d00e1b`). You took it into chain 22. Its commits: `e894607e` (the mend),
`14adcd82` (chain 19 brought one more lookup of the same kind, `tierTravelRule`; by own key as well), and the merges
`bcde303b` (main `07178847`), `48d59fcb` (`6909766b`) and `3e6e0a6d` (`35d00e1b`). Against main the branch differed in
seven files: `src/core/params.ts`, `src/config.ts`, `src/capture/showcase.ts`, `src/scene/cameras.ts`,
`src/audio/index.ts`, `tests/params.test.ts` and `tests/own-keys.test.ts` (new). `src/app/app.ts` and `src/main.ts`
were not touched.

(a) A capture address with a format the config does not name. It threw in `readParams`, so the page stopped before
anything was drawn. Now `readParams` reads such an address as the live page at hd. `src/main.ts` hands out
`window.showcase` only where the mode it reads is `capture`, so after the fallback the capture interface is absent, and
`tools/lib/page.mjs` checks the format id before it opens the page and then waits for `window.showcase`: a tool that
names a format the config does not hold gets no picture, never one in another format. No camera is named in the
address. A tier named in the address has no reader in `src`. `quality` goes through `isLevel`. Tests
(`tests/params.test.ts`): "opens the live page, not a dead one, for a capture address whose format the config does not
name", "hands out the capture interface only on a page whose address still reads as a capture" (it reads `src/main.ts`
for that), "stops for nothing a visitor can type".

(b) A view or a shot named in the address that is not a known one. An unknown `diag` flattened the picture (no
backdrop, no depth of field) and handed out `window.liveSim`; an unknown `shot` played the whole film without its sound.
Now `readParams` takes a shot only if the film has it (`shots` of the config) and a view only if the app has it (`VIEWS`
of `src/diagnostics/views.ts`, and `none`); anything else is read as absent. The readers (`src/app/app.ts` 288, 311 and
538, `src/main.ts` 110 and 141 on `e894607e`) are as they were and now only ever see a known name. Test: "takes a shot
only if the film has it and a view only if the app has it", with "knows the shots the film player can start from and
the views the menu offers".

(c) Lookups by a name from outside that went through inherited properties. Changed to own keys:

- `src/config.ts`: `cameraById`, `tierSamples`, `tierMotion`, `tierEvenFromPx`, `tierTravelRule`, `particleKinds`, all
  through one private `own()`.
- `src/capture/showcase.ts`: `setAssets` (`Object.hasOwn`).
- `src/scene/cameras.ts`: the lens of a camera (`lensOf`), which `poseById` and `poseWith` ask by the camera's name.
- `src/audio/index.ts`: the bar a landing enters the music at (`landingEntry`).

Left as they are, because the name is checked where it comes in or never comes from outside (line numbers of
`3e6e0a6d`): `src/seasons/index.ts` 11 (`kitOf`: every entrance checks the season against the config first),
`src/film/moves.ts` 156 to 158 (cameras of the film's own shots), `src/shake/change.ts` 82 (parts named in the code),
`src/shake/table.ts` 769 and 780 (channels named in the code), `src/probe/index.ts` 19 (a level that went through
`isLevel`), `src/audio/index.ts` 700 and 701 (cue ids named in the code), `src/app/app.ts` 287 (one of the two films),
`src/core/assets.ts` (names from the code and the host's own index), `src/scene/surface.ts` 631 and
`src/scene/backdrop.ts` 150 (a season that was checked), `src/particles/**` (kinds of the config),
`src/core/models.ts` 94 and `src/scene/stage.ts` 164 and 457 (names the code made). I found them with
`scratch-tools/own-keys.py <tree>`, which lists every `in` and every index by a name (153 places), and read each by eye.
Tests: `tests/own-keys.test.ts`, six.

The new tests on the old code: 8 failed | 10 passed (18). On the merge of chain 19 before `14adcd82`: 1 failed |
17 passed. On `3e6e0a6d`: 18 passed.

The built page, 960 x 540, `?quality=low`, lavapipe (`scratch-tools/job1-page.mjs <url> <folder>`):

- Before, main `07178847`'s build (engine `60d39792f3f3d6c1`). `?mode=capture&format=bogus`: 1 page error, "no such
  format: bogus", no first picture, a black page. `?diag=bogus`: the picture 28.28 apart from the plain page (mean of a
  channel, 0 to 255), `window.liveSim` handed out. The capture page (`?mode=capture&format=hd`) took
  `setAssets('constructor')` and `setAssets('__proto__')`, answered `dev.pose('constructor')` with a pose of nulls, and
  drew a picture for the tier `constructor` and for the camera `toString`.
- After, `3e6e0a6d`'s build (engine `274ef2230825a86c`). Seven addresses (format `bogus`, `constructor` and empty; diag
  `bogus` and `constructor`; shot `bogus`; every name at once): 0 page errors, the first picture and the controls in 5.8
  to 9.9 s, the capture interface absent, `liveSim` absent, the six still pages 0 to 0.67 apart from the plain page. The
  address with every name stands 4.62 apart: it also asks for a quality that is not one, so the page picks its own and
  does not draw at low. The film with an unknown shot runs (41.61 apart from the still page, as a film is). The capture
  page refuses all six asks ("no such asset set", "no such camera", "no such format", "no such tier", "no such season")
  and stays at assets `full`, format `hd`.
- Picture: `job1/unknown-names-before-after.jpg`.

Checks on `3e6e0a6d` with main `35d00e1b`: tsc exit 0; build exit 0; vitest 68 files passed, 1 skipped, 936 tests
passed, 8 skipped; the eight guards equal to your list of 07:03; M3 summer-rest 0.8379 at review; the stand-ins of the
four rest keys max 0; "determinism: pass · 3 pictures, 4 page loads, preview, draft, 161 s"; miniatures "pass: sha256
1541a867759c17d08c105336622d3a6d4dbdc5b4da9e898219b99bf3b7e05bec"; the strict run on the four rest keys: "strict: pass,
4 keys under pow, all+smooth, all+smooth+noguard, each row read against the plain picture, where that one differs by
its answers (no number, 0, 0.577 and 1e30), and where those differ against its own --same picture (engine
274ef2230825a86c, drawn by lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move".

What it leaves, with your rulings of 07:32:

1. `index.html` line 74 leaves the first still out for every address with `mode=capture`, so the page that fell back
   is black until the live picture comes (5.9 s here). Ruled: made in job 3 with `put()`.
2. A capture address with a known format shows a visitor the tools' page, black, with no error. Ruled: left as it is.
3. The capture interface's `setDiagnostic` takes any name from a tool. Ruled: checked against the app's views in job 3
   if it is three lines.

Not seen or heard: the film's sound with an unknown shot. This VM has no sound files; the test holds that such a shot
is read as absent, and `src/app/app.ts` 288 plays the film's sound where no shot is named.

## 11. Job 2: summer's dressing made in steps, as the miniatures are

Pushed 07:50 UTC as `7a863f7f` (holds main `d2013ce3`); you took it into chain 24. Its commits: `a2485c63` (the
change) and the merges `88aa10d9` (main `5fc1ed1f`) and `7a863f7f` (`d2013ce3`). Files: `src/seasons/summer/slab.ts`,
`src/seasons/summer/arrival.ts`, five lines and an import in `src/seasons/summer/index.ts` (the `dressing:` entry; you
gave leave for one line, it took five), `src/scene/stage.ts`, `src/scene/steps.ts`, `tests/steps.test.ts`,
`tools/miniatures.mjs`.

What it was. Summer's field of sand, its skin and its grains were made in one piece: 225 to 250 ms of the page's own
script in one go in Node here, 192.8 and 256.5 ms in the page, on a page that was drawing. The 700 ms I told you of was
`eb7db90d`, before the sand's third push made the field cheaper.

What it is now. The kit hands the stage a dressing in steps (`dressing` of the kit, taken by the stage through
`inPieces` of `src/scene/steps.ts`, as it takes the miniature), with a place to stop after the glass, after the pool of
light, after each row of the field and of the skin, and after each lot of grains: 3935 steps. The statements run in the
order they ran in, so nothing is computed otherwise.

The five arrays. `scratch-tools/field-same.mjs <tree before> <tree after>` makes the field in the tree before in one
piece and in the tree after whole, in steps, twice in turn and with a grain asking in between, and compares the bytes
(`d2013ce3` against `7a863f7f`): the same every way, 281 x 305; sha256, first 16: heights `3d42f4894987f084`, shade
before the blur `4ae673a09d81b2fe`, sun before the blur `8fc796a7e1cc3cc2`, shade `ebc95dab05a692bf`, sun
`d4318fc272e33f06`. In steps: 3661 steps for the field alone, the longest 4.27 ms.

The stills. On `7a863f7f` all eight guards are the hashes of your 07:48 list for `d2013ce3` (summer-rest
`57d003259ae188a2`, summer-landed `30a9e0f8c2e5aa00`). `node tools/miniatures.mjs`: `pass: sha256 36f254d08ede387e...`
as on main, and the new line `dressings: sha256 2a22418270e93bee...`, "summer, the dressing: 10 objects; whole 240 ms;
3935 steps, 230 ms in all, the longest 4.7 ms (step 3816); the same all three ways".

How long the longest piece is, measured as the 700 ms was.

- Node, the first making in the process, in the page's order (`scratch-tools/kit-order.mjs`), three runs on `7a863f7f`:
  summer's dressing 3935 steps, 258, 235 and 228 ms in all, the longest step 6.6, 6.0 and 4.1 ms. The miniatures'
  longest steps beside it: winter 9.4 to 11, spring 15 to 16, summer 14 to 19, fall 5.2 to 9.0 ms. So no piece of
  summer's dressing holds the thread longer than the miniatures' steps do.
- In the page (`scratch-tools/step-page.mjs`, a scratch build with a clock round each step, low, 320 x 320, two loads
  each): before, one piece of 256.5 and 192.8 ms; after, 3935 steps, 190.1 and 216.8 ms in all, the longest 2.6 and
  8.0 ms.

What is still one piece, longest first, none of it in my files: the grid (`bakeGrid`, `src/scene/lightgrid.ts`), in
the page 117 to 150 ms for spring, 123 to 133 for summer, 92 to 122 for fall; in Node winter's lights 89 to 101 ms,
fall's dressing 92 to 103 (51 to 71 in the page), fall's lights 45 to 49 (25 to 28), winter's arrival 38 to 40,
spring's dressing 25 to 27 (24 to 57). The grid is now the longest single piece in every season. It can be made in
steps the same way; say the word and name the owner of `lightgrid.ts`.

Not in the leave, said so that nobody is surprised: `grainRows()` on a page without the baked grain file works the
grains out in one piece (1.6 s in Node). The built page has the file.

Tests. `tests/steps.test.ts`: the new tests on the old code 7 failed | 47 passed (54); with the change 54 passed. On
`7a863f7f`: tsc 0; build 0 (engine `f2d93f209234841d`); the whole vitest 68 passed | 1 skipped (69), 943 passed | 8
skipped (951); M3 summer-rest 0.8377; four `--diag standins` stills, the most 0; "determinism: pass · 3 pictures, 4
page loads, preview, draft, 162 s"; the strict run's last line: "strict: pass, 4 keys under pow, all+smooth,
all+smooth+noguard, each row read against the plain picture, where that one differs by its answers (no number, 0, 0.577
and 1e30), and where those differ against its own --same picture (engine f2d93f209234841d, drawn by lavapipe): no pixel
moves by more than 1 level, at most 0.01% of pixels move".

Your items 9 and 10 (lines 5 and 6 of section 3), walked again after job 2 as you asked at 06:12, on `7a863f7f`'s
build (engine `f2d93f209234841d`), `?quality=low`, 08:09 to 08:33 UTC (`scratch-tools/walk910.sh`). The three walks:
0 not ok, the console 0 lines, 0 requests failed.

- The hint, phone, in the walk: 6.217 s after the controls for 5 asked. Before, on `eb7db90d`: 7.039.
- A press by pointer on the mark of fall, from the press to the busy control: 1.224 s. Before: 1.982.
- The first of four presses in a row: 0.003 s. Before: 1.052. The eleven other timed presses: 0.004 s at most.
- The hint in the standstill runs at phone, tablet and hd: 5.781, 9.941 and 8.755 s. Before: 5.005, 9.698 and 7.939.
  A stop lay across the fifth second each time (2.9 s on phone, 5.2 s on tablet, 6.4 s on hd), and the hint came 40, 16
  and 31 ms after it ended.

So the two presses are bettered, the hint is not, and none of the three can be read as more than this machine's spread.
Job 2 took one stop of about 0.2 s away. The stops that hold the hint and the press are ten to thirty times that long,
and they are not the page's own script: in the processor profile of the page after job 2 (`scratch-tools/prof-load.mjs`
and `prof-stops.mjs`, low, 320 x 320, the 34.6 s after the controls) the thread stood in 16 stops of half a second or
more, 29.8 s in all, and of those 18.9 s were inside the wait for a linked program (three's `onFirstUse`), 4.9 s inside
`texSubImage2D` and 1.8 s inside `bufferSubData`; no function of the page's own had more than 0.2 s. On the page before
job 2 it was 17.1, 6.3 and 1.2 s. This renderer links and uploads in the page's thread (section 4, item 4). Whether the
hint or a press is ever late on a real card is UNKNOWN: walk it there, the ring round Shake 5 s after the controls and a
press in the first seconds.

What job 2 changes in the sections above: section 3, line 3 (the stop while summer's set is made) and section 4, item 3
are mended as far as the dressing goes; section 4, item 8 has summer's surface no longer in one piece.

Not seen: nothing at 60 a second, no real card, no sound. No fresh reviewer read this job (I start no agents).

## 12. Job 3: the early press, spring's soft copy, the first still's place, and the smaller things

Your words of 06:12, 07:32, 08:10 and 10:36 UTC Nov 27. Pushed with job 5 (section 13) in one push. Every walk and
reading in this section is on `59f5e1c6`, which holds main `06954500` (chain 31 and two status commits), against main
`06954500` built beside it in a second worktree, on the same machine, one walk at a time. The head that was pushed is `15c27670` (20:18 UTC, main `680ad25b` in it), which you merged in chain 38. What ran on it and on `16d9a86a` under it is in 12.10; what ran after the push is in section 14.3.

Commits, oldest first: `b8c3a4ca` and `0f2ac32f` (the early press), `a7700d79` (`setDiagnostic`), `a86c283a` (the
music loop's test), `f5f86e8f` (spring's soft copy), `ed0c35cc` (line 74), `92b84e57` and `4e79ff1f` (`put()`),
`a24fc410` (the line in `tools/README.md`), `8576ae67` (my tool). `bf2635e4` is job 5.

### 12.1 The early press (section 4, item 2): mended in the change, the wait before it is longer here

- What was wrong: a season made before the press and not yet handed to the GPU was shown by the first frame of its
  shake's change, and that frame linked the season's programs and uploaded its buffers: a stop in the middle of the
  shake.
- What is changed: the hand of the season pressed for begins at the press, beside the chain (`Hands`,
  `src/scene/steps.ts`), at the pace the making of a season pressed for has, and the press waits for it. The stage
  gives the hand back from `expect()` (lines 76 and 77 of `src/core/stage.ts`, by your leave of 08:10), and the page
  holds the season as not ready until the hand is over (`SeasonLoader.hold`, `src/app/session.ts`; line 322 of
  `src/app/app.ts`, by the same leave), so the storm of the shake is held as it is for a season that has not loaded.
  What is left of the hand when the press is `LAST_S` old is done in one piece, so the press never gives up for it.
  Where the browser links nothing aside the press is old by the clock as well (`0f2ac32f`): there each draw step of a
  hand waits for its program and a frame, and the session counts a quarter of a second of a frame at most, so by the
  session alone the change came 45.7 s after the press on this machine.
- The walk on low you asked for (`scratch-tools/hand-walk.mjs`, 320 x 320, `?quality=low`, the plain address, the left
  arrow pressed 40 s after the controls came, when the page said `data-detail=ready` and `data-made=making`: winter
  into fall, whose hand had not begun). What the page said in its own messages, both builds: Shake busy 1 to 2 ms
  after the press, `data-target=fall` at once, the lit mark winter until the landing and fall at it, the console empty.

  | | `59f5e1c6` | main `06954500` |
  |---|---|---|
  | the change first drawn, after the press | 11163 ms | 4191 ms |
  | programs linked from the press to the change | 25 | 0 |
  | programs linked from the change to the landing | 0 | 25 |
  | the thread stood from the change to the landing | never | once, 9914 ms |
  | landed, after the press | 18537 ms | 23391 ms |

- The same with the space bar (winter into spring, pressed 36 s after the controls): `59f5e1c6` the change at 6360 ms,
  0 programs linked from the press to the landing, landed at 15780 ms; main the change at 6739 ms, 1 program linked
  in the change, the thread stood 5707 ms in it, landed at 20212 ms. In this walk of `59f5e1c6` the thread stood once
  in the change, 1213 ms, inside one `bufferSubData` (12.9: on both builds, not from this job).
- Not mended, said plainly: on this machine the wait moved, it did not go. From the press to the change of the left
  arrow's walk the thread of `59f5e1c6` stood 5 times, 7909 ms in all and 4590 ms at most, while the hand linked
  fall's 25 programs: the storm is on show and the control is busy, and the change comes 7.0 s later than on main.
  What is gained is that the change and the landing play without a stop, and that the press lands 4.9 s sooner. Where
  a browser links aside the wait does not hold the thread; no browser here does, so that path was not seen (12.11).
- Tests: `tests/steps.test.ts`, "the hands of the seasons", "the steps of a hand", "the wait for what a browser links
  aside", "the seasons a frame shows", "a press for a season that is built and not yet in the GPU's hands" (a visit to
  a page with a clock for a GPU: no frame shows the season before the GPU has it, the press lands in it, the picture
  draws on while it waits; the same visit with the press as it was shows the fault). `tests/app.test.ts`, "a season
  that is loaded and still owed something".

### 12.2 Spring's soft copy (section 4, item 5; `spring-soft.patch` tried inside job 3, as you said): mended

- What was wrong: the trails on spring's glass draw a soft copy of the frame before their own draw
  (`onBeforeRender`). The hand leaves out what a mesh draws of its own, so the soft pass's program was first linked
  in the first frame of the first shake into spring, and the shake stood for it.
- What is changed (`f5f86e8f`): a mesh may give the stage what it draws of its own before a draw (`userData.warm`,
  `src/scene/stage.ts`), and the hand draws that once too. The glass of spring gives its soft pass
  (`src/seasons/spring/glass.ts`, yours for this trial), drawn into one pixel of the kind of the frame that is bound.
  It draws into no picture the page shows and leaves the renderer as it found it.
- Spring's two guard stills did not move: all eight equal your list for `b22b5be4` (12.10).
- Four shakes round the seasons on the built page, each once the page is at rest (`scratch-tools/round-walk.mjs`,
  320 x 320, low): `59f5e1c6` "ok: 4 of 4 presses taken; 0 with a program linked in the shake or not landed", 109
  programs linked before the seasons are made. Main `06954500`: "NOT ok: 4 of 4 presses taken; 1 with a program
  linked in the shake or not landed": one program in the first shake into spring, 4920 ms after the press, the thread
  stood 4425 ms (`getProgramInfoLog` 2463 ms, `getShaderInfoLog` 1915 ms); 108 programs linked before. On the head
  before the last merge (`448d6b8a`, main `21ebbe2d`) I walked this three times each: ok in 3 of 3, main NOT ok in 3
  of 3. On `59f5e1c6` once each.
- The hash `tools/miniatures.mjs` prints over the four dressings moves, as it must: the tool hashes a function by its
  text, and spring's dressing now holds one more. `59f5e1c6`: dressings `50c49ff328a92248`; main: `528474499f8193ad`.
  The lines of winter's, summer's and fall's dressing are the same as main's to the last digit; spring's alone
  differs. The miniatures' hash is main's (`4f125e6ec2e5a361`).
- Tests: `tests/steps.test.ts`, "what the glass of spring draws of its own before a draw".

### 12.3 The first still's place: `put()` in `index.html` (section 3, line 7): mended in Chromium

- What was wrong: the page gave a still its place as left, top, width and height. A browser lays such a box on whole
  pixels, so a still whose place fell between two pixels stood up to half a pixel beside the live picture that comes
  in over it. At 600 x 600 the place is -59.5046, -0.0003, 719.0093 x 600.0078.
- Two commits. `92b84e57` laid every still in the corner and moved it by a matrix. That put the still in its place
  but cost sharpness, which I found only after it was committed: at 600 x 600 the still is drawn at half its file's
  size, and moved by half a pixel the browser draws its own halved copy of the file, smeared over two pixels
  (sharpness 0.766 of the file's); and where the place is on whole pixels the pixels were no longer main's (1920 x
  1080: mean 0.442, most 25 of 255 apart). `4e79ff1f` mends both. It is the form on the branch:
  - a place on whole pixels of the screen (every edge within 0.1 of a pixel) is laid as main lays it, with no matrix:
    main's pixels, mean 0 and most 0 apart at 1920 x 1080, the phone at a ratio of 3 and the tablet at 2;
  - any other place is laid in the corner, in a box whole in the pixels of the page and of the screen, and moved and
    sized by the matrix;
  - a still at half its file's size, half a pixel aside and without a mask also gets a layer of its own
    (`will-change: transform`) and is drawn a hair (one part in 100,000) over half, about its own centre. The browser
    then halves the file itself where the still stands. The hair moves an edge by 0.004 of a pixel;
  - a picture put before its file has come is put again once it has, because the rule reads the file's size.
- Why the rule is that narrow. All of this was read in Chromium 147 (`scratch-tools/put-lab.mjs` and
  `put-lab-read.py`: the page's own script with `put()` swapped, the picture read against the file drawn in place).
  A picture with a layer of its own is drawn from the smallest halving of its file that is not under its drawn size:
  at half, or a hair under, that is the browser's halved copy (soft, 0.766); a hair over half it is the whole file,
  halved where it stands (exact). Without the layer the hair does nothing (0.752), and without the hair the layer does
  nothing (0.766). On quarter pixels a layer is worse than none, under a mask it softens, and a layer under another
  picture changes how the one over it is drawn (590 x 590 with a wider rule: 0.715 where it is 0.861 without). So the
  layer is given to the one case it mends.
- Read on the built page, the page's own `put()` against main's (place in screen pixels beside where the app puts the
  still; "apart": the mean difference, of 255, from the file drawn in place; sharpness: the mean step from a pixel to
  its neighbour as a share of the same in the file drawn in place). The table was read on the build of `2071f160` (main `6922e017`), 18:20 UTC. The page's table of stills on `15c27670` differs from that build's only in the ten hashes and the small pictures: every place is the same number.

  | window | main: place, apart, sharpness | `92b84e57` | now |
  |---|---|---|---|
  | 600 x 600 | +0.5, 5.642, 1.007 | +0.1, 2.861, 0.766 | 0.0, 0.312, 1.003 |
  | 600 x 481 | +0.5, 4.976, 0.999 | +0.2, 3.071, 0.738 | 0.0, 0.291, 1.002 |
  | 500 x 720 | +0.5, 4.840, 1.002 | +0.1, 2.379, 0.789 | 0.0, 0.311, 1.002 |
  | 1920 x 1080 | 0.0, 0.029, 1.002 | +0.1, 1.005, 0.943 | 0.0, 0.029, 1.002 (main's pixels) |

  The same as 600 x 600 at 640 x 600, 598 x 600, 480 x 600, 700 x 600, 560 x 481, 700 x 481 and 600 x 720 (place 0.0,
  apart 0.28 to 0.32, sharpness 1.002 to 1.003), with the card's raster too, and in a browser started at a ratio of 1.
  Other windows and ratios (1280, 1366, 640, 590, 560, 500, 320 and 2560 wide, phones and a tablet, ratios 1.1, 1.25,
  1.5, 1.65, 1.75, 2, 2.625 and 3, emulated and in a browser started at the ratio) stand in place and are as sharp as
  on main.
- On the walk (`tools/visit.mjs`, step 16, 600 x 600): `59f5e1c6` "ok 16 first-look", the still fits the live picture
  best with no shift (`fine: [0, 0]`), 7.16 apart. Main `06954500`: "NOT 16 first-look", best moved half a pixel to
  the left (`fine: [-0.5, 0]`), 9.04 apart. What is left apart is the live picture itself: at 600 x 600 the page
  draws it on a lower tier than the still was rendered on, and its snow moves. On hd, phone and tablet, `15c27670`, 20:24 to 20:55 UTC: each "3 lines, 0 not ok · console 0 lines · 0 requests failed" (`first-settle`, `first-look`, `controls-watched`).
- The picture: `job3/first-still-600-before-after-x4.jpg` on this branch.
- Not mended, as on main: where a ratio is only emulated (DevTools' device mode, and tools that emulate) a place whole
  in screen pixels but not in page pixels is laid 0.7 of a pixel aside (600 x 600 at a ratio of 2: apart 7.892 on
  main and here). A browser started at that ratio draws it exactly, on main and here (apart 0.076). I tried the matrix
  for that case: it mends the emulated 600 x 600 and softens 600 x 481 at a real ratio of 2 (0.932), so it is not in.
- `tests/first-frame.test.ts`, two hunks, by your leave of 10:36 (in `92b84e57`): the test read a still's place from
  left, top, width and height alone. It now reads the place from those and from the matrix, so it reads main's
  `put()` and the new one alike: 25 passed on each, the second run with main `06954500`'s `index.html` put in place
  on `59f5e1c6` and taken out again.
- Tests: `tests/app.test.ts`, "where the page puts a picture of the first still", eight tests that run the page's
  own script. Twelve changes to `put()` that each break the rule (no hair, no layer, a smaller search for the box, a
  tighter or no test for whole, a listener that adds itself again, a stale place, no test for a mask, no test for the
  half pixel, not about the centre, the ratio left out, a rounded box) each fail one of them.

### 12.4 Line 74 of `index.html`: a capture address that fell back has its first still (your ruling of 07:32): mended

- What was wrong: the page lays its first still before the app runs, from the address alone, and laid none for any
  address with `mode=capture`. But a capture address that names a format the app does not have is the live page
  (job 1), so that page was black until its first live picture.
- What is changed (`ed0c35cc`): the page reads such an address as the app does and lays the still as for the plain
  address. A capture page, a film and the loop have no still, as before.
- On the walk (`tools/visit.mjs`, step 10, 600 x 600): on the head that is pushed (`2765d9b3`, 22:33 UTC) "visit 600x600: 9
  lines, 0 not ok · console 0 lines · 0 requests failed". `link-unknown-format` came to its first picture after 9.7 s
  with the still laid first, as the plain page does.
- Tests: `tests/params.test.ts` runs the page's own script against the app's reading of the same addresses and holds
  the page's list of formats against `config.formats`.

### 12.5 `setDiagnostic` takes a view only if the app has it (your ruling 3 of 07:32): done, two lines

`a7700d79`, `src/capture/showcase.ts`: the capture interface handed any name to the stage, which drew a flat picture
for a name it did not know. It now refuses a name that is neither `none` nor one of the app's views, as the address is
read. Held by its text in `tests/own-keys.test.ts`, because no test can call a capture page. Your ruling 2 is left as
it is.

### 12.6 The music loops (item 12 of 06:12: a test only)

`a86c283a`, `tests/audio.test.ts`: a loop of 21.6 s with a seam of 2.4 s comes round every 19.2 s, which is eight
bars. The pack writes each loop one bar longer than it is heard. The seam is as it was. Nothing was heard here: this
VM has no sound files.

### 12.7 My tool, `tools/visit.mjs` (`8576ae67`): the three faults of section 3, lines 11 to 13, and what job 3 needed

- Line 11: step 5 after step 4 read snow still in the air. Step 4 now ends when the picture has stopped changing
  (a new line, `stir-settled`). On `16d9a86a`: "visit 600x600: 6 lines, 0 not ok · console 0 lines · 0 requests failed". The stir was taken for settled after 75.2 s, the picture then 1.69 from the one before the stir. At 17 s it was 1.7 from the last picture and 14.06 from the one before the stir, which the old bound took for rest.
- Line 12: the dim is timed by the page's own clock, from the last thing that woke the controls to the bar being told
  to dim. Last seen on `59f5e1c6`.
- Line 13: a request cut off on a page that stays is written apart from one the tool cut off by leaving, and counts
  with the requests that did not come. NOT RUN on the head that is pushed
  (`2765d9b3`): the walk against a server that cuts a request off. The close of round two came first.
- New in step 10: three links that name what the app does not know (12.4). New in step 16: where the still stands
  is read from its box on the screen, however the page wrote it there.

### 12.8 Two files that are not mine, by your leave of 10:36

- `tests/first-frame.test.ts`, two hunks (12.3).
- `tools/README.md`, line 87 (`a24fc410`): the miniatures tool's line says what the tool holds since job 2.

### 12.9 Found on the way, not from this job: a shake stands inside one `bufferSubData` now and then

In some shakes one frame stands 0.9 to 1.2 s inside a single `bufferSubData`, on both builds: in the walks of this
section once in `59f5e1c6`'s space bar walk (1180 ms, in the change), once in its round (1132 ms, first press), and in
main's walks before the change (912 and 1221 ms). On the head before (`448d6b8a` and main `21ebbe2d`) I counted them:
3 of 12 shakes on mine, 2 of 12 on main, each one call of 1,632,000 bytes. I did not find which buffer it is. On a
real card UNKNOWN. It is the worst thing left in a shake on this machine.

### 12.10 Checks, and what they printed

On `16d9a86a` (main `f56da1a6`, engine `97ea843eb66a6612`), one after the other and alone, 19:24 to 20:08 UTC. First what you asked for the level's lines of `src/post/post.ts`:
- npx tsc --noEmit: exit 0.
- npx vitest run: "Test Files  68 passed | 1 skipped (69)" and "Tests  1029 passed | 8 skipped (1037)". No sound files here.
- The eight guards, hd draft, against your list of 19:23: "8 of 8 equal the list". winter-rest 0cab5cd137ba09d9,
  winter-landed a7ab4af383606ed0, spring-rest caa42db060e03278, spring-landed bfda838820e392ab, summer-rest
  ac0bba01734380a6, summer-landed 261877d76a8ca74d, fall-rest 274efc38a42f2dec, fall-landed 1742e5bdd5f7c2b7.
- The round of four (built page, 320 x 320, ?quality=low, Space four times, each once the page is at rest):
  "ok: 4 of 4 presses taken; 0 with a program linked in the shake or not landed". 110 programs linked before the
  seasons are made. The first shake: the change first drawn 4346 ms after the press, landed 12449 ms after it, the
  thread stood 3 times from the press to the landing, 165 ms in all and 59 ms at most. Console empty.
  Main 6922e017 at 18:41 UTC (its src differs from f56da1a6's only in fall's and spring's own files and two files of
  src/particles/draw): "NOT ok: 4 of 4 presses taken; 1 with a program linked in the shake or not landed", two programs
  in the first shake, the thread stood 4 times in it, 10100 ms in all, landed 23111 ms after the press.
- npm run determinism: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 167 s".
- Film frames 660 and 690 at draft with the lines (16d9a86a) and without (3023d46e, the merge under it, engine
  358ace792c91150e): the same bytes. sha256 53766c3a809f5e3f... and ab44590e373bdf44... on both.

Then jobs 3 and 5, on the same head:
- put(): 70 changes to put() that each break its rule, each fails a test: "lived: 0 []".
- tests/first-frame.test.ts: "Tests  25 passed (25)" with this index.html, and "Tests  25 passed (25)" with main's
  index.html put in its place and taken out again. The test reads main's put() and the new one alike.
- Visit, step 16, 600 x 600: "ok  16 first-look", the still fits the live picture best with no shift (fine [0, 0]),
  7.19 apart as it came; the still's box by the page [-59.5, 0, 719.01, 600.01], the same as by the app, 0.24 apart.
  "visit 600x600: 3 lines, 0 not ok · console 0 lines · 0 requests failed". Main 6922e017: "NOT 16 first-look",
  fine [-0.5, 0], 9.11 apart, 5.01 between the still by the page and by the app.
- Job 5, the frames in a script's hand (320 x 320, low, 36 frames from the live mark on, 17 ms apart by the page's
  clock): "ok: at no frame was the still gone and the canvas under full opacity". 0 of 36 frames; the still left 1599 ms
  after the mark by the wall and 17.1 ms by the page's clock, when the wait was over, the canvas at 1.0000, its own
  transition none. Main 6922e017: 28 of 36 frames without a still under a canvas short of full sight, the canvas at
  0.0194 when the still left, "NOT ok: the still was gone under a canvas short of full sight, or it did not leave".
- The early press (320 x 320, low, the left arrow 44 s after the controls, the page then saying data-detail=ready and
  data-made=making). The page's own messages: Shake busy 2 ms after the press, data-target=fall at 2 ms, the lit mark
  winter until the landing and fall at it, console empty. The change first drawn 10853 ms after the press; 25 programs
  linked from the press to the change, 0 from the change to the landing; the thread stood once in the change, 94 ms;
  landed 18356 ms after the press. Main 6922e017: the change at 6177 ms, 0 programs before it and 26 in it, the thread
  stood twice in it, 17779 ms in all, landed 32579 ms after the press.
- One still of each season at rest with --diag standins, hd draft: "max 0" for winter, spring, summer and fall. Black.
- npm run strict -- --keys winter-rest,spring-rest,summer-rest,fall-rest: "strict: pass, 4 keys under pow, all+smooth,
  all+smooth+noguard, each row read against the plain picture, where that one differs by its answers (no number, 0,
  0.577 and 1e30), and where those differ against its own --same picture (engine 97ea843eb66a6612, drawn by
  lavapipe): no pixel moves by more than 1 level, at most 0.01% of pixels move".
- Visit, steps 4 and 5, 600 x 600 (the stir's mend in my tool, c84e0b7a, not walked before today's head):
  "visit 600x600: 6 lines, 0 not ok · console 0 lines · 0 requests failed". The stir was taken for settled after
  75.2 s, the picture then 1.69 from the one before the stir. At 17 s it was 1.7 from the last picture and 14.06 from
  the one before the stir, which the old bound took for rest. look-returned ok, 1.38 from the picture at rest.

On the two merges of main over it, which bring status text only:
- 2794f8c1, the merge of origin/main 50c72767: no conflict. npx tsc --noEmit: exit 0. npx vitest run:
  "Test Files  68 passed | 1 skipped (69)" and "Tests  1029 passed | 8 skipped (1037)".
- 15c27670, the merge of origin/main 680ad25b: no conflict. npx tsc --noEmit: exit 0. npx vitest run: "Test Files  68 passed | 1 skipped (69)" and "Tests  1029 passed | 8 skipped (1037)".
- The 25 commits of the push that are not on main: each by Brandon Church, each ending with the one trailer.

### 12.11 What I did not see

- Safari and Firefox. `put()`'s layer was read in Chromium 147 only, with the processor's raster and the card's. In
  a browser that draws a layered picture otherwise, the worst case is the matrix alone: in place, soft at 600 x 600.
- A browser that links aside. No browser here does, so the wait of the early press was seen only where it holds the
  thread, and the `until` wait for a link was never taken on a page (held by tests only).
- A real card, a real screen, anything at 60 a second, a finger, sound.
- No fresh reviewer read this work: my rules say I start no agents.

## 13. Job 5: the first still leaves only from under a canvas in full sight (`bf2635e4`)

Your word of 10:19 UTC Nov 27. In the same push as job 3. Everything read here is on `59f5e1c6` (holds main
`06954500`) against main `06954500` built beside it.

- What was wrong: `reveal()` in `src/app/app.ts` ended the first still at the end of the canvas's fade or, if that end
  was not heard, after a wait of 1500 ms (`REVEAL_MS`). The fade keeps the time of the page's frames, the wait keeps the
  wall. Where frames come late and carry old times the wait was over early in the fade: the still left from under a
  canvas at 0.02 of its sight and the page was nearly black until the fade had run out.
- What is changed: `done()` takes the canvas's transition away (`canvas.style.transition = 'none'`) before it ends the
  still, as you wrote it. So the canvas stands in full sight in the first frame that has no still. Where the fade ends
  in time nothing is changed: the fade is 0.5 s by the sheet as before, and a film or the loop has no still and starts
  at once. `reveal()` is moved out of `startApp` as it was, so that a test can hold it.
- The test: `tests/app.test.ts`, "the canvas over the first still", five tests. The one of the wait's path with no
  `transitionend` (after `done` the canvas's own style gives no transition and the mark is set) fails on the old form.
- Read on the built page with the frames in a script's hand (`scratch-tools/reveal-frames.mjs`: the browser's begin
  frame control, 320 x 320, `?quality=low`, 36 frames from the live mark on, each 17 ms after the last by the page's
  clock and 1.0 to 1.7 s by the wall):
  - main `06954500`: the still left 1556 ms after the live mark by the wall and 0 ms by the page's clock, the canvas
    at 0.0000. 29 of the 36 frames showed no still under a canvas short of full sight, over 39.0 s of the wall, the
    canvas at 0.020, 0.052, 0.098, 0.157 and so on to 0.999. The reading's last line: "NOT ok: the still was gone
    under a canvas short of full sight, or it did not leave".
  - `59f5e1c6`: the still left 1638 ms after the mark by the wall and 17.1 ms by the page's clock, when the wait was
    over, the canvas at 1.0000, its own transition none. 0 of the 36 frames showed no still under a canvas short of
    full sight. "ok: at no frame was the still gone and the canvas under full opacity".
- Read as the browser paces it (`scratch-tools/reveal-read.mjs`: opacity, still count, frames counted and the clock
  against the wall, every 3 s for 24 s), one run each. These differ from run to run on this machine, because which
  comes first, the fade's end or the wait's, hangs on how long the thread stands after the live mark:
  - 1920 x 1080, main: the wait was over first, 7483 ms after the mark by the wall (700 ms by the page's clock), the
    canvas at 0.0000; the fade then ran out within 3 ms, and no frame was drawn in between. The reading says NOT ok for
    those 3 ms. `59f5e1c6`: the thread stood 14.0 s after the mark, the fade's end came first, the canvas at 1.0000. ok.
  - 320 x 320 on low, main: the fade's end came first in this run (2563 ms by the wall, 16 ms by the page's clock). ok.
    `59f5e1c6`: the wait was over first (1619 ms by the wall, 616 ms by the page's clock), the canvas at 1.0000, its own
    transition none. ok.
- What it costs, by your ruling: where the wait is over before the fade, the picture goes from the still to the live
  picture in one frame, with no fade between them. The still is a render of a tier and the live picture at 320 x 320
  on low is not, so that frame is a visible change (the fourth picture on this branch shows the frames). On a page at
  pace the fade is over in 0.5 s and the wait of 1.5 s never comes first.
- The first pictures, the 0.5 s of the fade on a healthy clock, a film and the loop are not changed: the eight guard
  stills equal your list for `b22b5be4`, and "starts a film or the loop at once: no still, no fade and no wait" holds
  it for the two that have no still.
- Not seen: a page at 60 a second, where the fade's end comes first. A browser other than Chromium 147. The frame
  times in the frames reading are given by the script, not by a display.

## 14. Round two: the stall in a shake, the dead capture page (open item 263), and the checks owed

Your words of 20:23, 20:56, 21:18, 21:27, 21:54, 22:02 and 22:19 UTC Nov 27. The head is `2765d9b3`: `15c27670` (which
main holds since chain 38), main `5b76c959` merged in as `9327c9a5` (no conflict), the mend of item 263 (`d484bb49`),
the village's mend merged in (`4481f6c5`, section 14.5), main `ed9180da` merged in (`818bcf37`, the main you named at
22:19), and my own mend on top (`2765d9b3`, section 14.6). Sections 14.1 and 14.2 were read on `d484bb49`; 14.3 says
what was run on `2765d9b3`.

### 14.1 Item 2, open item 263: a capture address on a host that is not this machine (`d484bb49`): mended

- What `15c27670` did. Its built page on a host that holds `dist/` and nothing else (files by GET and HEAD, 404 for
  what it lacks, 405 for every other method), opened as `http://snow-globe.example:4191/`:
  - `?mode=capture`, alone or with `simcache=1` or `format=phone`: black for good. No still, no controls, no word.
    `window.showcase` was handed out. 8 GETs to `assets-full/` answered 404 and "asset did not load" was thrown.
  - `?mode=capture&assets=web`, with or without `simcache=1`: black too, the interface handed out, 73 requests, all
    files.
  - Driven as a tool drives it (`dev.simcache('stills', 3)`): a GET of `__simcache/<key>/index` answered 404 and two
    PUTs of checkpoints answered 405. Never driven, never asked.
  - `?simcache=1` alone: the plain page.
  - Its own last line: "5 of 6 addresses did not end in the plain page; the capture interface was handed out on 5; 6
    requests refused with 405 while driven; over the whole run 6 refused with 405, 9 to __simcache, 32 to
    assets-full, 35 answered 404".
- The mend. A capture address is a capture page only where a tool serves it: the host is `localhost`, `127.0.0.1` or
  `[::1]` (`TOOL_HOSTS` in `src/core/params.ts`) and the format is one the config names. Anywhere else it reads exactly
  as the same address without its mode: the live page with its first still, the web set, no interface, and `simcache`
  false. `simcache` is armed on a capture page alone, so no live page, film, loop or probe can ask for a checkpoint.
  `index.html` lays its first still by the same reading (the capture rule, line 76, its comment 75).
- Files: `src/core/params.ts`, `index.html`, `tests/params.test.ts`, `tools/visit.mjs`, and by your leave of 21:18
  line 148 of `tests/first-frame.test.ts` (the location handed to the page's script has the host name `localhost`)
  and one sentence at the end of line 3 of `tools/README.md`.
- After, the same host and the same name, the built page of `d484bb49` (engine `a78bc347d56a92dd`): every one of
  `?mode=capture`, `&simcache=1`, `&assets=web`, `&assets=web&simcache=1`, `&format=phone&simcache=1`,
  `&assets=full&simcache=1` and `?simcache=1` alone ended in the plain page: the still laid before the live picture,
  the first picture and the controls after 13.0 to 14.7 s (the plain page: 17.8 s), winter lit, the interface absent,
  the picture 0.5 to 0.64 from the plain page where two plain pages stand 0.12 apart (the snow moves). 93 requests
  each, all files by GET. Its own last line: "0 of 7 addresses did not end in the plain page; the capture interface
  was handed out on 0; 0 requests refused with 405 while driven; over the whole run 0 refused with 405, 0 to
  __simcache, 1 to assets-full, 1 answered 404".
- The one request left: an address that names `assets=full` asks the host once, by HEAD, whether it holds the first
  file of that set, is answered 404, and draws from the web set (one line in the console). That is the live page's own
  rule for a set the host does not hold (`src/core/assets.ts`, `held()`, the first frame's file), as on main for
  `?assets=full`. It is not a refusal and `simcache` does not arm it. Not changed.
- Your condition (a), the addresses that are handed out, each opened as written on the same host under
  `snow-globe.example`, 640 x 360, the page choosing its own level:
  - `?mode=autopilot`: the first picture after 12.4 s, then the film goes on (32 frames in 38 s here, the pictures
    69.77 and 22.28 apart from one to the next): the close view of winter's globe, then the wide one. No controls, as a
    film has none. 0 errors, 77 requests, all files.
  - `?mode=autopilot&which=a`: the first picture after 14.0 s: the film's opening (the question typed into the
    composer), 43 frames in 38 s, the pictures 0.48 and 0.57 apart as the words are typed. 0 errors, 79 requests, all
    files.
  - `?mode=loop`: the first picture after 9.6 s, then the loop goes on (21 frames in 39.5 s, 36.69 and 40.82 apart):
    the globe at rest, the storm, at rest again. 0 errors, 67 requests, all files.
  - `?mode=probe`: ended after 89.6 s, status "Done", 10 lines of text, the first "Snow Globe: frame rate probe", 56
    frames drawn. 0 errors, 79 requests, all files.
  - On none of the four was the capture interface handed out, and none asked for `__simcache/` or `assets-full/`.
  - By the reading: `readParams` gives the same for each of these addresses under every host name (a test in
    `tests/params.test.ts`, which a change that lets the host decide any mode but capture fails).
- Your condition (b), every tool that opens a capture page, read in `tools/`:
  - All of them go through `Session.page()` of `tools/lib/page.mjs` (line 120, `${this.server.url}?mode=capture...`)
    on the address `serve()` hands out, `http://127.0.0.1:<port>/` (`tools/lib/server.mjs`, lines 85 and 86, which
    listens on 127.0.0.1 alone). `tools/master.mjs` (line 190) and `tools/hostcheck.mjs` (line 85) start that same
    server. The farm's helpers (`tools/farm/`) run the same tools in their own clone on their own 127.0.0.1.
    `tools/render-local.mjs` does the same with the installed Chrome.
  - No helper's own name, no `0.0.0.0` and no LAN address anywhere. `os.hostname()` (`tools/lib/browser.mjs`, line 57)
    is a label in records.
  - `tools/ui-preview/shots.mjs` and `check.mjs` serve vite on 127.0.0.1 and open `/tools/ui-preview/`.
    `tools/miniatures.mjs`, `tools/lib/grids.mjs` and `tools/poster.mjs` use vite without listening.
    `tools/visit.mjs`, `tools/walk.mjs` and `tools/standstill.mjs` take `--url` (default `http://localhost:4173/`) and
    open the live page; the visit's two capture links are the ones that must be the live page (`unknown-format`, and
    the new one under another name).
  - A test holds the tools' server to the list: the host in `tools/lib/server.mjs` must be one of `TOOL_HOSTS`.
- Tests. `tests/params.test.ts`, 19 tests (13 on main): the hosts, the formats, the checkpoints, the handed out
  addresses under every host name, the page's rule run against the app's reading of the same addresses on every host,
  that `src/main.ts` hands out the interface and the store of checkpoints only on a page whose address still reads as
  a capture, and that the page, the app, the tools' server and the visit read one list of hosts.
- Seven changes that each undo a part of the mend, each fails a test: main's `params.ts` (7 fail), main's
  `index.html` (1), the host not asked (6), `simcache` armed in any mode (3), the page's list one host short (1), the
  visit's other name set to `localhost` (1), the host deciding the films and the loop too (2).
- The walk: `tools/visit.mjs`, step 10, has a new line, `link-capture-elsewhere`. It opens
  `?mode=capture&simcache=1` on this machine's server under `snow-globe.invalid` (the browser alone takes that name
  for this machine) and wants the live page: the first picture, the controls, the still, no interface, no page error,
  near the plain page, and no request to `__simcache/` or `assets-full/`.
- Pictures: `r2/item263-960.jpg`, `r2/item263-400.jpg`, `r2/handed-out-elsewhere.jpg` on this branch.
- Not seen: the published host itself (`snow-globe-seasons.pplx.app` answers 401 from here). A host that answers a
  missing file with the page itself: not run, before or after.

### 14.2 Item 1, the stall inside one `bufferSubData`: found, not mended, a patch for the owner, not proven

- The buffers. They are the four lists of the particles, written by `fill()` of `src/particles/draw/points.ts`:
  `aNow` (the places now, 1,224,000 bytes), `aPrev` (the places before, 1,224,000), `aData` (size, kind, opacity,
  phase, 1,632,000) and `aState` (408,000). All four are written whole every frame: 4,488,000 bytes for all 102,000
  particles of the pool, whatever the level draws (low draws 30,600, medium 61,200).
- It is not one buffer's fault. The stall falls in whichever write finds the browser's transfer ring full: seen in
  `aData`, in `aState` and in `aNow` (939.9, 888.1 and 934.2 ms in one warm-up, `scratch-tools/buf-walk.mjs`). The
  ring is 16 MiB at most and a write waits on its oldest block when there is no room, so 3.7 frames of these writes
  fill it. Here the software renderer needs 0.9 s a frame at rest at 320 px on low (llvmpipe on 2.1 to 2.5 of 4
  cores) and more in a shake, so the page is always a frame or more ahead of it.
- The proof. When the page asks the GPU process for one answer before a frame's first write, no write stalls at all
  and the answer takes the time instead: 120 of 135 frames 100 ms or more, the middle 926 ms, the most 1729 ms.
- Counts, one run each, so weak: the page as it is, 3 writes of 888 to 940 ms in one warm-up (101 frames); with only
  the drawn part written, 1 of 942 ms (122 frames). In a walk of eight shakes on `15c27670`: none in the shakes, none
  in the rests between. The page's own time in the four writes at rest: 1.6 to 2.7 ms a frame whole, 0.6 ms with the
  drawn part.
- No mend inside my files. The wait is the renderer's backlog and only fewer bytes make it rarer.
- The patch, for the owner of `src/particles/draw/points.ts` (the engine brief's file; both air builders hold it in
  round two): `points-drawn.patch` on this branch. A level that draws a part of the list sends that part alone: 70 %
  fewer bytes a frame on low, 40 % on medium, none on high, and nothing in a film.
- Your ruling of 21:18: not on `agent/p6-steps` until main holds the air builders' parts and you say so; then main
  merged, the patch as its own commit, and the proof there (the eight guards equal, the stills of low and medium equal
  to those without it, the whole vitest, the stalls with and without over three runs each).
- NOT BUILT AND NOT PROVEN at the close. Your line that main holds the air parts had not come, and the time before
  22:50 went to the fault of 14.5 and the checks on the head that is pushed.
- NOT SEEN: a real card. There a frame takes milliseconds and the ring should never fill. I cannot say Brandon will
  not meet it.

### 14.3 Item 3, the checks on `2765d9b3`

On the built page of `2765d9b3` (engine `100499a29f66e980`), main `ed9180da` in it. The renders ran one after the
other; the whole vitest ran beside them at a lower priority, so every time here is a slow one.

- tsc: exit 0.
- The whole vitest: "Test Files  70 passed | 1 skipped (71)", "Tests  1045 passed | 8 skipped (1053)", exit 0. Main
  `ed9180da` reads 1036 passed and 8 skipped; the nine more are six of item 263 and three of 14.6.
- The eight guards: "8 of 8 equal the list" (winter-rest 0cab5cd137ba09d9, winter-landed a7ab4af383606ed0, spring-rest
  c5cd17d91bc346bc, spring-landed 066fa33e081d9d26, summer-rest 17a943f21ee9c1cc, summer-landed 682537c019d386eb,
  fall-rest 2d560947ef218eb4, fall-landed d6cc4fb84a82a611).
- Visit 10, the links: "visit 600x600: 9 lines, 0 not ok · console 0 lines · 0 requests failed". `link-summer` after
  10.6 s, `link-capture-elsewhere` ok: the first picture after 9.6 s, the capture interface absent.
- M3 of summer: "pass M3 summer-rest: 0.8624 (threshold 0.75, detail.minSharpnessRatio)", base 0.862, miniature
  0.863, as on main. M4 and M5 not touched. No triangles added.
- Stand-ins, summer at rest: "max 0", black.
- Determinism: "determinism: pass · 3 pictures, 4 page loads, preview, draft, 169 s"
- The round of four at low: "ok: 4 of 4 presses taken; 0 with a program linked in the shake or not landed"
- Strict on winter-rest, spring-rest, summer-rest, fall-rest: NOT COMPLETE: it began last, at 22:44:48, and runs as I write; its last line follows in one line when it ends
- My fault in the running of them: from 22:27 to 22:38 UTC an older chain of mine, held at a pause that I lifted,
  ran a walk of the page beside the guards, the visit and M3, against the rule of one render at a time. Its other
  stages stopped at once ("dist/ does not match the source") and its walk wrote nothing; I ended it. The guards are
  hashes and the visit passed under that load, so I let them stand; nothing of that walk is used.

Not run on this head, said plainly:

- The strict run on winter-rest, spring-rest, summer-rest, fall-rest (running at the close).
- The walk from spring into summer at low and medium.
- The stand-ins of winter, spring and fall (summer alone was made).
- Visits 4, 7, 11, 13, 14 and 16.
- The page at addresses it does not know.
- A request cut off.
- The early press.
- The reveal as the browser paces it.
- The miniatures tool.
- Item 263 on its host and the four handed out addresses (read on d484bb49 only).
- The points patch (not built).

### 14.5 Found on the way: summer was not made at quality low or medium on main `5b76c959` (open item 269): mended

- How it showed. Visit 10 on the head of 14.1: ok link-winter, ok link-spring, then "NOT 10 link-summer", no first picture in
  300 s. On the built page `?quality=low&season=summer` and `?quality=medium&season=summer` never came to a first picture
  and every frame threw "Cannot read properties of undefined (reading 'kit')". `?quality=high&season=summer` and
  `?season=summer` were whole. The tree was main's own (`git diff 5b76c959 9327c9a5` is empty).
- The cause. `withBlades` of `src/seasons/summer/mini/village.ts` (new in `402924c1`) read the lawn's index at the level
  the page draws. At low and medium that is a lighter list of the `LevelIndex` (`src/core/models.ts`): 44,577 corners
  over 113,607 vertices at low. The guard threw "village-summer: a blade no longer has three corners of its own". No
  still shows it: the capture page reads the full set, which has no lighter lists.
- The mend, by your decision 217, as its own branch: `agent/p6-village-low`, commit `551baa07` off `5b76c959`, merge
  `16e0dd29` of main `be7560a6`. Main holds it as `ed9180da`. Every blade is read from the fullest list whatever level the
  page draws. `tests/summer-village-levels.test.ts` makes the village from the web set at every level and fails on the
  old lines with that error.
- Proof on `16e0dd29`: tsc exit 0; the whole vitest 1036 passed, 8 skipped; the eight guards equal the list; the built
  page at low, medium and high for summer each reached the first picture with 0 errors; the shake from spring into
  summer at low and at medium landed in summer; winter, spring and fall at low and medium each reached the first
  picture with 0 errors. Lawn faces drawn: high 37,869, medium 22,125, low 14,859, each a whole face of the full list.
- No other maker under `src/seasons` throws on the size of an index list (the readings by file and line are in the
  report of 22:16 UTC).

### 14.6 My own mend: a making that throws keeps its failure (`2765d9b3`)

- What was wrong, in my files. A step of a making that threw was lost from its set. The frame that needed the season
  then took the steps after it, built the set without the part and threw something else in every frame, so the console
  never named the failure. That is why the fault of 14.5 read "reading 'kit'" and not the village's own words.
- The change. `take(steps)` in `src/scene/steps.ts` does the step at the front and leaves it there when it throws; a
  part made in pieces (`inPieces`) throws the same error again once one of its pieces has thrown. `runFor`, `workIn`
  and the stage's `make()` and `set()` take every step through it.
- What a visitor sees of a season that cannot be made is not changed: the console now says why, each time.
- Tests: three in `tests/steps.test.ts`. Taken out one by one, each part fails a test: `take` that forgets the step
  (2 fail), the kept error (1), the stage shifting on its own (1).

### 14.7 Found by the walks of 14.5, NOT MENDED: one program is linked inside the shake into summer at low and medium

- What the walks read (built page of `16e0dd29`, 320 x 320, each from `?quality=<level>&season=spring`, Space once
  the page said every season was made): one program linked inside the shake into summer, 1998 ms after the press at
  low and 2423 ms at medium. The thread stood 2.8 s (low) and 5.0 s (medium) at most in that shake on this machine,
  and 0.06 s at most in the shake into fall, where no program was linked. Test runs of mine ran beside both walks.
- It could not show before the mend of 14.5: summer was not made at low or medium at all.
- On `2765d9b3` the round of four at low from the plain address (winter first, nothing running beside it) linked no
  program in any of its four shakes: "ok: 4 of 4 presses taken; 0 with a program linked in the shake or not landed".
  In its shake into summer the thread stood 58 ms at most. So the fault either shows only when the page starts in
  spring, or it left with what came after `16e0dd29`. The walk from `?season=spring` was NOT RUN again on this head,
  and WHICH PROGRAM IT IS WAS NOT FOUND by the close. `scratch-tools/round-walk-id.mjs` on this branch names each
  program linked in a shake; `scratch-tools/round-walk.mjs` is the walk without the names.
- The same round on `2765d9b3` reads the stall of 14.4 again: the thread stood 1123 ms at most in the shake into
  spring, 1695 ms into fall and 1799 ms into winter, each time in `bufferSubData` (2 calls of 1943 ms in all, 5 of
  3936 ms, 1 of 1770 ms). The shakes landed 15.6, 14.7, 16.8 and 25.8 s after the press, at 320 x 320 on this machine.
- The stall in `bufferSubData` stays the worst thing I know of in a shake; this one comes next until it is found.

### 14.8 `village.ts` line 1169, read for you, no change made

- After the making nothing can go wrong: `merged` (line 1161) is a plain list made from the lists of the level at
  that step, and `keep`, the mirror's draw range, is a plain number. Neither follows a later change of level.
- During the making it can. Line 1169 reads `shared.index.count` four steps or more after the merge (the making
  yields at 1162, 1164, 1166 and 1168 and inside `dressed`, `surfacing` and `withPools`), and the level may change
  between two steps: the governor in a frame (`src/app/app.ts` 487) or the menu (391). The mirror would then draw the
  other level's count over this level's list for the life of the page: a part of the cottage missing in the
  reflection, or decor drawn in it. Deduced from the code, not seen. One line would end it: read the count where the
  merge is made.

### 14.9 What I did not see

- A real card, a real screen, 60 frames a second, a finger, sound. Every page here was drawn by the processor.
- The published host. Safari itself.
- The stall on a real card, and the patch at work anywhere.
- No fresh reviewer has read this work: my rules say I start no agents.
