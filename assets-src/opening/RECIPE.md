# The prompt opening of film A: recipe

`public/opening/` holds the pictures of film A's opening: the product's prompt screen with the prompt typed out, the reasoning level opened and set, the send, and the build screen. They are drawn frame by frame from the product's own look with the team's skill. The opening is not a recording: no prompt was sent by it, and its timings are the film's own, not a claim of speed.

## public/opening/manifest.json and public/opening/opening.bin
Made by: `tools/opening.mjs` with `tools/lib/openingpack.mjs`, in Node 20.20.2, drawn in the pinned browser of `tools/browser.json` (Google Chrome for Testing 147.0.7727.15, headless, through playwright-core 1.59.0); the pictures are coded through sharp 0.35.5 (libvips 8.18.7, libwebp 1.6.0) as lossless WebP.
From: two packages of the team's skill for the product's interface, both read where they are installed and never copied into the repo, and the film's own plan and words:
- `synthetic-ui` version 2.1.0, looked for in `~/.perplexity/skills/space/synthetic-ui`. Its composer page draws the prompt screen. Its sequence page, in `thinking` mode with no `result`, draws the build screen.
- `synthetic-query-typing` version 2.1.0, the package with the change of the reasoning level seen on screen (`composer.effortTo`), looked for in `~/.perplexity/skills/org/synthetic-query-typing`. Only that change is taken from it: the menu under the control with its three rows and its check mark, the pointer's path, the control's hover and pressed fill, and the timeline of the change.
- Every time is from `openingPlan()` in `src/film/opening.ts`. Every word is from `intro` in `config/showcase.json`: `prompt`, `model` (the name on the control), `reasoningFrom`, `reasoning`, `reasoningLevels`, `buildTitle`, `steps` and `charsPerSecond`.
Prompt or command: `npm run opening`. There is no prompt: nothing here is generated, the skill's pages are code that draws on a canvas, and the tool asks each page for the picture of an exact time.
Takes: 1. The command is deterministic. It was run twice in this VM after its last change (the text in grey levels, below) and gave the same bytes both times, as three runs before that change had among themselves: sha256 of the manifest followed by the bin `664b265ee9776700db6e131d4e25e3c9440b572a5d51e4099fce0a860ce19029`, the manifest alone `15ca80d5b352a8aee8afffe66f7c33a70a3e350ea8223c8b5e911e41545268cc`, the bin alone `27b5ecd27487421f5a951ba973ba439102c843eb8e6f3556854964531339f88a`.
Why this one: the rule for this film is that the product's interface is exact every time it is shown, and the skill is the team's own drawing of it, with the product's typeface and measures. The change of the level is the design that was directed and accepted for it on November 23, taken whole: its geometry, colours, rows, check mark, pointer path and timings.
Date: 2026-11-26 (UTC)

## What the pack holds
867 frames at 60 a second (14.45 s), 1920 x 1080: 1280 x 720 logical pixels at a device scale of 1.5. 493 different pictures, stored once each however many frames show them, in 437 images of 1,862,020 bytes together (1.86 MB; the limit is 12 MB). Every picture is lossless. Seven are stored whole (frames 0, 160, 545, 593, 596, 597 and 757). Every other one is stored as the boxes in which it differs from a picture before it, and the tool builds each picture again from the pack and compares it, byte for byte, with what was drawn before it writes anything.

`manifest.json` holds the size, the frame rate, the frame count, the ground colour (`#fbfbfb`), the place of each image in `opening.bin`, how each picture is made (`{key: image}` or `{from: picture, patches: [[image, x, y]]}`), which picture each frame shows, and for each frame what the skill's own state said when it was drawn: `screen` (`prompt` or `build`), `typed` (characters), `level` (the level the control shows), `menu` (how far the menu is open, 0 to 1), `sent`, `pressed`, `lines` (on screen) and `done`.

## What was set
- The composer page: the prompt, the model's name, the level in force (`intro.reasoningFrom`), the typing speed, the skill's capture mode, and the film's frames for the pointer coming in, every key, the pointer leaving for the send, the pointer on the send and the press.
- The sequence page: `mode: thinking`, the prompt, the heading, one step for each line with its title only and the time it works, the time before the first line and the hold at the end. No `result`.
- A viewport of 1280 x 720 at a device scale of 1.5 (3 for the master). Both pages are served from this machine by the tools' server, and any request that would leave the machine is refused and fails the run.
- The browser named in `tools/browser.json`, drawing with SwiftShader, which was the tools' renderer when the pack was drawn. The pack was not drawn with any other renderer, so "the same bytes" is shown for SwiftShader only: `SHOWCASE_RENDERER=swiftshader npm run opening` asks for it. Under another renderer the browser may draw a canvas another way; compare the sha256 after the first run there.
- For frame `i` the composer is asked for the time `i / 60`, and the build screen for `(i - build.first) / 60`. One second of the film is one second of every motion the skill draws.

## What was changed in the work copy, and why
The tool copies `synthetic-ui` to `out/work/opening/skill/` and changes only that copy. Each change is an exact replacement at an anchor that must be in the source exactly once. If it is not, the tool stops and names the change. The names below are the ones it says.

The film's clock in place of the skill's own pacing (`kit/03-METHOD.md`: "replace its timers with the film's clock. That is the one change you make to it"):
- "the film's clock read in": the composer reads the film's frames from its address.
- "typing starts on the first key", "a character for every key": the typed text on a frame is the characters whose key is on or before that frame, so the picture and the key sounds agree on every frame.
- "the pointer leaves for the send", "the pointer is on the send", "the send is pressed": these three times come from the plan.
- "the first line arrives on the film" (in the sequence's model): the wait before the first line comes from the plan and is no longer a fixed number.

The change of the reasoning level, which `synthetic-ui` 2.1.0 does not draw and `synthetic-query-typing` 2.1.0 does. Its code is carried at run time, from marked starts to marked ends of that package's composer, into the same places of the work copy:
- "the level change read in": that package's timeline of the change, copied beside the work copy's own model.
- "the menu", "the rows and the check mark", "the pointer's path", "the level shown", "the control's hover and pressed fill", "the menu and the pointer drawn": the drawing, as that package has it.
- "the control's pressed colour" and "the menu's card": two names that differ between the two packages. The fill and the card take `synthetic-ui`'s own colour and its own menu shadow and border.
- "the level shown on the control", "the level written on the control", "the control's box, the pointer and the fill", "the menu drawn over the composer": where the carried code meets the composer's own.
- "the state of the level change", "the measures of the level change", "the measures reported": what the tool reads back to check the frames.

Text in grey levels on every machine:
- "the composer's text in grey levels" and "the build screen's text in grey levels": each page opens its canvas with `alpha: false`, and on a canvas without an alpha channel the browser may draw text with the colour fringes of the machine's sub-pixel setting. This VM's setting is RGB, so the first pack had orange and blue edge pixels on every line of text but the heading, and the master had them on one small label only. The work copy opens the canvas with its alpha channel. Every pixel is still painted, the layout does not move, and the edges of the type are grey levels in both packs.

The two packages place the control a few pixels apart, so three measures are fitted, and each was shown and accepted before the opening was drawn: the menu sits 8 px higher than in its own package, 3 px under the control as there; its right edge is on the right edge of the control's fill; its colours are `synthetic-ui`'s own tokens. The times of the change are that package's own, unchanged (travel 0.55 s, rest 0.12, menu in 0.20, read 0.12, to the row 0.35, settle 0.20, menu out 0.16, pointer out 0.18, beat 0.25), and the tool fails if the plan and the package disagree by a frame.

## The checks
A pack is written only when every check passes. They are kept in `out/work/opening/checks.json`.
- The skill's: the typeface is loaded on every frame, no error and no refused request, the framing is fixed, the sequence's layout checks pass, at most one line works at a time, the pale card is on the working line only, the same time asked twice gives the same picture, nothing is really submitted.
- The film's: the control shows `intro.reasoningFrom` on every frame before `reasoning.choose` and `intro.reasoning` on every frame from it; the menu is on screen on the frames from `reasoning.open` to the one before `menu.gone` and on no other, and fully open from `menu.full` to `menu.fade`; the row under the pointer is the chosen level; the typed text is right on every frame and is the whole prompt from the last key on; the prompt stays inside its field; the send is pressed on `send`; line `n` is on screen from `steps[n]`; every line is done before the last frame; the last frame shows no working line; the menu is inside the frame and covers no control (it is gone before the first key, so it never covers a character of the prompt); the level names and every time of the change agree with the package.
- The pack's: built again it equals what was drawn, it is under 12 MB, the corners of the first frame, of the first build frame and of the last frame are one ground colour, and on nine frames across the opening every pixel is painted and no pixel is redder than it is blue by more than 6 of 255 (the interface has no warm colour, so a warmer pixel is a colour fringe on type).

## To make it again
1. Have both packages where the tool looks, or name them: `npm run opening -- --skill DIR --effort DIR`. The tool needs only their files: it draws in the repo's pinned browser and serves the work copy itself. Run `npm run build` once before, so the page's plan can be read.
2. `npm run opening` writes `public/opening/` and, when `dist/` exists, copies the pack into `dist/opening/`.
3. `npm run opening -- --master` writes the same frames at 3840 x 2160 into `out/work/opening/master/`. It is never committed and never hosted. The tools' server offers it, and the page takes it for a surface wider than the hd pack.
4. `npm run opening -- --page` asks the built page for frames out of order and in a run and compares each with the pack, pixel for pixel.
5. `npm run opening -- --stills 0,330,558 --only-stills` writes single frames as PNG into `out/work/opening/stills/` without making a pack.

On a machine without the skill the tool stops with one plain line and changes nothing, and the build, the page and every other tool use the committed pack.

## What is not in the repo
Nothing of either package: not its code and not its typeface, which is the product's interface font and is for private use. The tool holds only the short anchors it needs and the build's own replacements. The work copy is under `out/work/`, which is never committed.
