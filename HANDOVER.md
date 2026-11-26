# Handover: `opening_builder`, Phase 6, the prompt opening of film A

Branch `agent/p6-opening`, head `90881ea8` (with `origin/main` `6133867c` merged in; pushed at 07:08). Looks on `agent/p6-opening-looks`. Times are UTC, November 26, 2026.

## What is there now

Film A opens on the product's own prompt screen: the empty composer at rest, the pointer comes in and opens the reasoning control, the menu of three levels stands open, the pointer presses `High`, the menu goes, the prompt is typed at 14 characters a second, the pointer goes to the send control and presses it, and the build screen follows with its four lines. 867 frames at 60 a second, 14.45 s (`intro.maxSeconds` is 16).

The page shows it from a pack of lossless pictures, `public/opening/manifest.json` and `public/opening/opening.bin`, 1,862,020 bytes together (the limit is 12 MB). The stand-in file and its flag are gone.

## Which package draws what

- `synthetic-ui` 2.1.0 (`~/.perplexity/skills/space/synthetic-ui`) draws both screens: its composer page and its sequence page in `thinking` mode with no `result`.
- `synthetic-query-typing` 2.1.0 (`~/.perplexity/skills/org/synthetic-query-typing`, from `synthetic-query-typing-2.1.0-effort.tgz`) gives the change of the reasoning level and nothing else. Its code for the change is carried at run time into the work copy of `synthetic-ui`. It is not used for the whole opening: by its own `references/spec.md` its composer follows the product as read on October 13, and `synthetic-ui`'s follows the product as read on November 23. With only `synthetic-query-typing` on the machine the tool stops and says so.
- Nothing of either package is in the repo, in `public/` or in `dist/`. The tool holds only short anchors and the build's own replacements. The work copy is `out/work/opening/skill/`.

## The lines changed in the work copy

Every edit is an exact replacement at an anchor that must be in the source exactly once. The tool stops and names the edit when it is not. The names are the tool's own.

In `synthetic-ui`'s `scripts/composer.mjs`:
- "the film's clock read in", "typing starts on the first key", "a character for every key", "the pointer leaves for the send", "the pointer is on the send", "the send is pressed": the film's frames in place of the skill's own pacing.
- "the level change read in", "the menu, its rows and its check mark", "the level shown on the control", "the control's box, the pointer and the fill", "the level written on the control", "the menu drawn over the composer": where the carried code meets the composer's own. Two guards on measures: `const cy = 436;` and `const selectorRightX = 975;`.
- "the state of the level change", "the measures of the level change", "the measures reported": what the tool reads back to check frames.

In `synthetic-ui`'s `scripts/sequence-model.mjs`: `let at = .45;` becomes `let at = c.thinking.first;` (the wait before the first line comes from the plan).

In `synthetic-ui`'s `scripts/composer.mjs` and `scripts/sequence.mjs`, one line each, "the composer's text in grey levels" and "the build screen's text in grey levels": `getContext("2d", { alpha: false })` becomes `getContext("2d")`. See "Found late" below.

Carried from `synthetic-query-typing`'s `scripts/composer.mjs`, each between a start anchor and an end anchor: the menu, the rows and the check mark, the pointer's path, the level shown, the control's hover and pressed fill, the menu and the pointer drawn. Two names differ between the packages and are mapped: `C.pill)` to `C.pillBg)` and `shadowCard(` to `shadowMenu(`. Its `scripts/sequence-model.mjs` is copied in whole as `scripts/effort-model.mjs` for the timeline of the change.

Fitted measures, all three shown early and accepted by `/root`: the menu sits 8 px higher than in its own package (3 px under the control, as there); its right edge is on the right edge of the control's fill (987); its colours are `synthetic-ui`'s own tokens (row tint and hover `#f3f7f8`, pressed `#ebf2f3`). Card: x 787, y 458, 200 x 136, radius 14. Rows: x 795, y 466, 506, 546, 184 x 40. Labels at x 809, check at x 959.

## Found late: colour fringes on the type, and what was done

At 06:10, setting a master frame beside the hd frame, the hd type showed orange and blue edge pixels. The cause is this VM, not the skill's design: its font settings ask for RGB sub-pixel rendering (`/etc/fonts/conf.d/10-sub-pixel-rgb.conf`), and the skill's pages open their canvas with `alpha: false`, which lets the browser use it. The first pack (the one pushed up to `9f4ddf31`, sha `8a0965cb...`) had such pixels on every line of text but the heading, about 3,000 to 12,000 a frame; the first master had them on one small label only. A film frame is not a desktop screen: the fringes turn into colour noise when a frame is scaled or coded, and the two packs did not agree.

The work copy now opens each canvas with its alpha channel (two guarded edits, one line each). On every frame measured no pixel is redder than it is blue (the interface has no warm colour), and the tool checks that on nine frames across the opening, with a check that every pixel is painted. Against the first pack, frame by frame: over all 867 frames at most 32,954 pixels of a frame differ, all in the bands of text; the largest step of an 8 x 8 block in luma is 7.41 of 255 (frame 484), so nothing moved and no weight changed. Two pictures fewer are stored (437 images, not 439) and the pack is 396,445 bytes smaller.

What this means for what was looked at: the frames and strips named under "Frames read" below were read from the first pack. After the change these were read again from the new pack at their own size: the composer on frames 0, 89, 104, 112, 330, 484, 509, 545 and 558, and the build screen on 597, 732 and 866 (left part and right edge), each cut one to one; the three judged frames again as the looks 05 to 07; the sheet of twelve frames; and the old and the new pack one above the other on frames 104, 330 and 732. The strips of every frame across the presses were not cut again from the new pack.

## The plan, frame by frame (60 a second)

| Frame | What |
| --- | --- |
| 0 to 23 | The empty composer at rest (0.4 s) |
| 24 | The pointer comes in |
| 57 | The pointer is on the control (0.55 s of travel), hover fill |
| 65 | The control is pressed, the menu starts to open (`reasoning.open`) |
| 77 | The menu is fully open (0.2 s) |
| 84 | The pointer leaves for the row `High` |
| 105 | The pointer is on the row (0.35 s of travel) |
| 112 | The row is pressed (`reasoning.choose`): the check moves, the control reads `High` |
| 124 | The menu starts to go (0.2 s after the press) |
| 134 | The menu is gone (`reasoning.last` is 134); the pointer is gone by 135 |
| 150 | The first key. 84 keys, the last on 506 (`typing` is 150 to 509) |
| 510 | The pointer comes in for the send |
| 545 | The pointer is on the send |
| 558 | The send is pressed (`send`): the control is at its smallest and the ring starts on this frame |
| 597 | The first frame of the build screen (`build` is 597 to 866, 4.5 s) |
| 633, 687, 741, 795 | Lines 1 to 4 arrive (`steps`), 0.9 s apart |
| 843 | The last line is done (`lastDone`), 0.4 s before the cut |
| 866 | The last frame |

`PAUSES`: lead 0.4, toControl 0.55, rest 0.12, menuIn 0.2, read 0.12, toLevel 0.35, settle 0.2, menuOut 0.16, pointerOut 0.18, beat 0.25, restOnSend 0.22, sendPress 0.65, beforeFirstStep 0.6, doneBeforeCut 0.4. The times of the level change are the accepted package's own, and the tool fails when the plan and the package disagree by one frame.

Judged frames: `opening-typing` 330, `opening-reasoning` 89, `opening-build` 732.

## Where the opening departs from the brief's rules, and why

The second mail put the accepted design of the level change above section 5 and above the pauses it touches. These follow from it:
- The level is set before the prompt is typed, not between the typing and the send.
- The pointer's travel to the row takes 0.35 s. The rule asked for at least 0.5 s.
- The menu stands fully open for 0.78 s (frames 77 to 123). The rule asked for at least 0.9 s.
- The pointer of the level change fades out after the choice, and the skill's pointer comes in again for the send. The rule asked for one pointer that stays.
- The menu stays for 0.2 s after the press and then fades, as in the package. The brief's check said the menu is open up to `reasoning.choose` and on no other frame; the check in the tool is restated: on screen from `reasoning.open` to the frame before `menu.gone`, fully open from `menu.full` to `menu.fade`.
- The levels are `Standard`, `High`, `Max`, not five.

Two things that are the skill's own motion and are left as they are:
- The skill's state says line `n` is on screen from `steps[n]`, and the line before it is done on that frame. Its first visible pixels come a frame or two later, because the skill fades a row in from nothing while it rises. So on frames 687, 741 and 795 the picture shows no working line for one frame. At 30 frames a second those frames are not shown.
- The send control eases down from frame 551 and is at its smallest on 558. The state in the manifest says `pressed` from 557.

## What was checked, and what it showed

- `npm run opening`: pass. Drawn four times at this state of the tool (twice before the commit, twice after it), the same bytes each time: sha256 of the manifest then the bin `664b265ee9776700db6e131d4e25e3c9440b572a5d51e4099fce0a860ce19029`, 160 to 178 s a run. Checks, all true: 8 of the skill's own, 23 of the film's, 5 of the pack's (two of them new, see "Found late"). No page error, no refused request. The first pack was drawn three times to the same bytes as well.
- `npm run opening -- --master`: pass, drawn again after the change of the type's edges: 867 frames at 3840 x 2160, 493 pictures in 488 stored images, 3,847,412 bytes, in `out/work/opening/master/` (never committed), every check passes (the same 8, 23 and 5), sha256 `803d882e22f50ccff1648e4ae7b753825f2bf6c885bb893d081c15488ef71f60`, 531 s. No pixel redder than blue on frames 0, 104, 330, 732 and 866. Frame 330 of it beside the same frame of the hd pack enlarged two times shows the finer type (picture 11). The first master (sha `33848be7...`) is replaced by it.
- `node tools/opening.mjs --page`: pass, with the new pack and the new master: the page at hd shows the hd pack, 104 frames asked out of order and in a run, 0 differ from the pack; the page at uhd shows the master pack, 26 frames, 0 differ. A frame the opening does not hold is refused in words.
- `npm run sheet -- --opening --format hd`: one sheet of 12 frames across the opening, looked at. `--first N --last M` gives every frame of a range.
- `npm run film -- --which a --shot opening --format hd --tier draft` then `--join`: from the new pack: 434 frames, 30 a second, 1920 x 1080, 14.466 s, h264 yuv420p, 1.77 MB (`ffprobe` with the frames counted). The clip is `out/work/opening/clips/opening-hd-30.mp4`.
- The same with `--fps 60`: from the new pack: 867 frames, 60 a second, 1920 x 1080, 14.450 s, h264 yuv420p, 2.33 MB. Frames 104, 330 and 732 of the clip set against the same frames of the pack: mean difference 0.21, 0.20 and 0.14 of 255, which is the coder's loss; frames 104 and 732 of the clip were read at their own size.
- `npm run determinism`: `determinism: pass · 3 pictures, 4 page loads, preview, draft, 397 s`. Run from 06:09 to 06:16 on the build of `9f4ddf31` (the same `src/` and `config/` as `428e8a76`). It was not run again after `origin/main` was merged at 06:26, 06:42, 06:45, 06:59 and 07:05.
- `npm run hostcheck`: pass, on a clean copy of `428e8a76`: `dist/` is 62.57 MB in 102 files; 13.84 MB in 32 requests are fetched before the first complete picture (the limit is 16), and the pack is not among them, because it is fetched only when film A plays; all 10 links open. It took 15 minutes in this VM and was not run again after the merges of `origin/main`.
- A still with `--diag standins`: black. `winter-rest`, preview, draft: 960 x 540, the largest colour value in the picture is 0. Same build as the determinism run. Its record still counts two stand-ins, `opening` and `loop`, because it reads the register (see the first line for `/root` below).
- `?mode=autopilot&which=a` in the built app: shown in a window of 192 x 108 on the build of `3eb53a38`, because this VM has no GPU: a page frame of the film takes it about 1.6 s at that size, and 15 to 30 s at 960 x 540. Run 1 (06:59, stopped by its own limit of 170 s): the page asked for `/opening/manifest.json` and `/opening/opening.bin` (200 both) among 71 requests; no request failed, none was answered with an error, no console message. The opening came up 23.9 s after the page opened, was on screen for 92 page frames, in which the page drew 64 different pictures of the pack, and was taken away again 170.0 s in, on the last look before the limit, so that run has no picture of the film. Two shots of the opening were looked at: the prompt 10 and then 62 characters long. Run 2 (07:12, limit 205 s, ended by itself at 188.5 s): again 71 requests, none failed, none answered with an error, no console message; the opening came up after 24.1 s, was on screen for 93 page frames (67 pictures of the pack drawn) and was taken away 171.3 s in. Two shots of the film were then made and looked at: the winter globe from near, and seven page frames later the whole globe on its table (picture 12). Before these, a run in a window of 960 x 540 on the build of `428e8a76` was stopped after four minutes: its four shots show the first 2.3 s of the opening at a size that can be read (the composer at rest, the pointer on the control, the menu open, `High` set; picture 10). Not seen: the opening and then the film at full size.
- The eight judged keys: 4 of 8 compared: `winter-rest`, `spring-shake`, `summer-rest` and `fall-shake`, each rendered at preview (960 x 540), draft, once from main `fa562bd0` and once from the branch at `3eb53a38` (which holds that main), each from its own fresh build (07:03 to 07:12). All four are the same files, byte for byte (0 pixels differ). Two of them were looked at (`fall-shake`, `winter-rest`) and show the globe. The hash of the build differs between the two (`365e27f8ae66164f` and `73e6815f0696c03b`), because the page-side files of the opening are in the build; the pictures do not differ. The other state of each season (the other four keys) was not compared: there was no time left for it. Of `src/` the branch changes only `app/app.ts`, `capture/showcase.ts`, `configCheck.ts` and the opening's files in `film/`.
- The pack's path on a page of its own at the display's rate: not run. The script for it is written (`out/work/opening/scratch/live.mjs`) and there was no time left for it, so how the pack keeps up at a display's own rate is not measured.
- `npx tsc --noEmit` and `npx vitest run` before every push: every push passed both. The last: `tsc` exit 0 and `vitest` 51 files passed and 1 skipped, 598 tests passed and 7 skipped, on the merge `dffe3231` (main `6133867c`); the tip `90881ea8` adds one line of the recipe to that merge (no test reads the recipe), and `npm run build` passes on the tip. Before it, on `3eb53a38`: `tsc` exit 0; `vitest` 50 files passed and 1 skipped, 584 tests passed and 7 skipped.

Frames read at their own size, 1920 x 1080, cut one to one from the first pack (before the change of the type's edges): 0, 89, 104, 112, 330, 506, 509, 545, 596, 597, 687, 700, 732, 741, 760, 795, 820, 843. Every frame, one to one, across each press and the switch: 56 to 67 (the control), 104 to 115 (the level), 122 to 136 (the menu going), 148 to 181 (the first keys), 550 to 561 (the send), 590 to 601 (the switch), 795 to 818 (a line arriving). Nothing clipped, nothing overlapping, no picture out of order. What was read again from the new pack is under "Found late" above.

In a 400 px wide copy of the frame the heading, the build's title and its lines can be read. The prompt and the menu's rows are 5 px tall there and at the limit of reading; the level change is seen as the menu opening and the label changing.

## For `/root`: lines in files that are not mine

- The register: `npm run parts -- --set opening=built --note "the real opening, drawn by the team's skill and shown from the pack in public/opening/"`. Until then `info().standIns` still names `{name: 'opening', unit: 'film'}`, because it is read from `parts/PARTS.json`. The flag and the stand-in file are gone.
- The cut: run `npm run cut` after the merge. `cut/CUTLIST.json`, `CUES.md` and `JUDGED.md` still hold the stand-in's opening (870 frames, typing 30 to 389, judged 210, 438, 708). The new judged frames are 330, 89 and 732. `tools/mix.mjs` reads its cues from `cut/CUTLIST.json`.
- The renderer: from main `80e0f02d` the tools draw with lavapipe unless `SHOWCASE_RENDERER=swiftshader` is set. The pack on the branch and the master pack were drawn under SwiftShader, and this VM has no lavapipe, so nothing of the opening was drawn or shown under it: not `npm run opening`, not the page showing the pack, not the film's frames of the opening. The page puts the pack's pixels on the picture one to one at hd, so the film should not change. The tool draws type on a canvas in the browser, so its bytes may. Run `npm run opening` once under lavapipe and compare the sha256 with the one in the recipe. If it differs, either keep the committed pack and draw with `SHOWCASE_RENDERER=swiftshader`, or commit the new pack with its sha256. The recipe says which renderer the committed pack was drawn with.
- `tools/hostcheck.mjs`: `opening-master/` and `__opening` could join `OUTSIDE`, so a hosted page that asked for the master pack would be caught.
- `tools/lib/sheetlayout.mjs` matches kept frames by the engine's hash, which does not cover `public/`. A sheet of the opening therefore always draws again (`force`); a `seq` of the opening kept from an older pack would be reused.
- `src/app/app.ts` paints the globe under the opening on every frame of the live player.
- `tools/film.mjs` renders at `film.previewFps`, 30. The brief's command gives 434 frames at 30. `--fps 60` gives all 867.

The hunks in others' files: `src/app/app.ts` (the import; `play(what)` and the start line wait for the pack for `film-a` only; `drawOpening`), `src/capture/showcase.ts` (the import; `await renderOpening(opening, i, format.width)` in `renderOpeningFrame`).

### The row for `ASSETS.md`

| File | What it is | Made by | Source | Model and prompt | Date | sha256 |
| --- | --- | --- | --- | --- | --- | --- |
| `public/opening/manifest.json`, `public/opening/opening.bin` | The pictures of film A's opening: 867 frames at 60 a second, 1920 x 1080, 493 lossless pictures in 437 stored images, 1,862,020 bytes | `tools/opening.mjs` (`npm run opening`), recipe in `assets-src/opening/RECIPE.md` | The team's skill for the product's interface, `synthetic-ui` 2.1.0, with the change of the reasoning level of `synthetic-query-typing` 2.1.0. Nothing of either is in the repo | None. Nothing is generated: the skill's pages are code that draws on a canvas | 2026-11-26 | manifest then bin: `664b265ee9776700db6e131d4e25e3c9440b572a5d51e4099fce0a860ce19029` |

### The lines for `README.md`

The opening of film A is a pack of pictures in `public/opening/`, drawn by `npm run opening` with the team's skill for the product's interface (`synthetic-ui` 2.1.0, and `synthetic-query-typing` 2.1.0 for the change of the reasoning level). The skill is not in this repo. On a machine that has it, `npm run opening` draws the pack again to the same bytes under the renderer it was drawn with (SwiftShader, `SHOWCASE_RENDERER=swiftshader`), and `npm run opening -- --master` draws it at 3840 x 2160 for the master of film A. On a machine without it the tool stops with one plain line and changes nothing, and the app, the films and every other tool use the committed pack. `assets-src/opening/RECIPE.md` has every step.

### The sentence for a viewer

The opening is drawn frame by frame from the product's own look with the team's skill. It is not a recording: no prompt was sent by it, and its timings are the film's own, not a claim of speed.

## What was not tested

- The film at master size: only the page path was checked there (26 frames of the master pack through the page at uhd, 0 differ). No film frame was rendered at 3840 x 2160 through `tools/film.mjs`.
- The opening with sound: the cut list still holds the stand-in's opening, so the cues of the typing, the level change and the send are not placed on the new frames.
- The live rate on a real display: this VM has no GPU. `out/work/opening/scratch/live.mjs` was written for a page of its own and not run.
- The opening then the film in autopilot at full size: seen only as told under "What was checked" (a window of 192 x 108 for the whole run, 960 x 540 for the first 2.3 s).
- A phone or a tablet held upright: the pack is fitted inside the surface on the ground colour; the arithmetic is tested (`tests/opening.test.ts`), no picture of it was made.
- The renderer of decision 139 (lavapipe): this VM does not have it. Pack and master were drawn under SwiftShader.
- Another machine: the same bytes were shown on this VM only (four runs of the hd pack, one of the new master).
- `npm run determinism`, the `--diag standins` still and `npm run hostcheck` after the merges of `origin/main` that followed them.
- The judged keys of the globe that are not named under "What was checked".
- The strips of every frame across the presses (56 to 67, 104 to 115, 122 to 136, 148 to 181, 550 to 561, 590 to 601) were read from the first pack only. From the new pack single frames were read: 0, 89, 104, 112, 330, 484, 509, 545, 558, 597, 732, 866.
- The skill at another version than 2.1.0: every edit is guarded (`once` in `tools/opening.mjs` stops and names the edit when its anchor is not there exactly once). That stop was not tried against a changed skill.

## Where things are in this VM

- `out/work/opening/checks.json`, `checks-master.json`, `page.json`, `autopilot/` (four shots) and `autopilot2/` (shots and `report.json`), `keys/` (`compare.json`), `clips/opening-hd-30.mp4` and `opening-hd-60.mp4`, `master/` (the master pack, same layout as `public/opening/`).
- For `master_tool_builder`: `tools/lib/openingpack.mjs` exports `openPack(dir)`, which gives `{width, height, fps, frameCount, background, frame(i)}` with `frame(i)` the exact RGB of a frame.
