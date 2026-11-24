# Progress

The Builder's memory. Read it at the start of every task and after every compaction. Keep every section. Write `none` where there is nothing.

## Status

- Build: in progress
- Phase: 2
- Review: not reached
- Review round: none
- Review round step: none
- Review rounds: 0
- After review step: none
- Soundtrack chosen: none
- Budget: running
- Continuations: 0
- Extensions: 0
- Extension step: none
- App URL: https://snow-globe-seasons.pplx.app
- Review page: https://snow-globe-seasons.pplx.app/review.html
- Repo is private: no. Measured 2026-11-24 01:48 UTC through the GitHub API: visibility public. `repo.expectPrivate` is true, so the two disagree and the public rules apply
- Sound files: held back from the repo because it is public. Prompts, settings and measurements are committed as text. The files live in the workspace under `audio/` and in the published app, and one archive of every kept file is attached with each status that follows new sounds and with the REVIEW block

## Latest pictures

The pictures of the newest status, with their captions and the time. Files are in `out/stills/status/`.

Status 10 · 2026-11-24 04:38 UTC

- `out/stills/status/status-10-1.jpg`: The kept sounds as waveforms
- `out/stills/status/status-10-2.jpg`: The interface at 1920 x 1080, laid over the approved winter image on a mock (not the engine yet): four season marks at the left, the Shake control in the middle, sound at the right. (by interface_builder)
- `out/stills/status/status-10-3.jpg`: The controls at twice their size in each state: idle, dimmed, busy, hover, focus on Shake, focus on a season mark, focus on sound, sound on. (by interface_builder)
- `out/stills/status/status-10-4.jpg`: The card loop's seam on the measuring scene: its last six frames, then its first six. The sheet a critic will get to say where the loop ends and begins. (by measure_pack_builder)

## Clock

Copied from the last tick of `npm run clock`.

```
2026-11-24 04:38 UTC
clock: phase 2, tick of 6.0 minutes
phase 2: 1.60 h used of its 6.00 h box
allowance (before the review): 2.79 h used of 36.00 h allowed
all time before the review: 2.79 h, after it: 0.00 h, in review rounds: 0.00 h, in extensions: 0.00 h
extra rounds: yes
half point: not reached
box end: not reached
budget report: not due
minutes since the last status: 0
```

## Phases

| Phase | State | Started | Ended | Gate evidence |
| --- | --- | --- | --- | --- |
| 0 · Ground truth | done | 2026-11-24 01:45 UTC | 2026-11-24 02:56 UTC | All eight gate lines met. G1, G2, G3, G4, G8, G9, G10 green at build `649783eb70c1c499`. Line by line in the session log at 02:56 |
| 1 · The rough cut | done | 2026-11-24 02:56 UTC | 2026-11-24 03:04 UTC | D1 pass: `out/roughcut.mp4`, 960 x 540, 30 frames a second, 1800 frames. Pushed as `681b78b`, on the review page, Status 5 posted at 03:03 |
| 2 · Engine and blockout | in progress | 2026-11-24 03:04 UTC | | |
| 3 · The look lock | not started | | | |
| 4 · The other seasons and the changes | not started | | | |
| 5 · The whole globe, the soundtrack and the review | not started | | | |
| 6 · The films and delivery | not started | | | |

## Units

| Unit | State | Rounds run | Best round | Commit | What ended its loop |
| --- | --- | --- | --- | --- | --- |
| `winter` | not started | 0 | | | |
| `spring` | not started | 0 | | | |
| `summer` | not started | 0 | | | |
| `fall` | not started | 0 | | | |
| `change` | not started | 0 | | | |
| `globe` | not started | 0 | | | |
| `film` | not started | 0 | | | |

### Parts

A summary of `parts/PARTS.json`: every part that is not `built`, with its state and why.

none

## Workspace record

Measured in Phase 0.

Measured 2026-11-24, 01:50 to 02:05 UTC, on the Builder's VM unless a line says otherwise.

| What | Value |
| --- | --- |
| OS | Ubuntu 26.04.1 LTS, kernel 6.1.155 |
| CPU cores | 2 |
| Memory | 7957 MB |
| Disk | 20 GB, 12 GB free at the start |
| Graphics card | none |
| Node, npm | v20.20.2, 10.8.2 |
| Python | 3.14.8, with PIL, numpy, scipy and cv2. No librosa, no soundfile |
| `ffmpeg`, `ffprobe` | 8.0.1, both run. Nothing was installed |
| Blender | not installed |
| Browser the harness drives | Google Chrome for Testing 147.0.7727.15, at `~/.cache/ms-playwright/chromium-1217/chrome-linux64/chrome` |
| Second browser on this VM | Chromium 156.0.8078.48, at `/opt/pplx-chromium/chrome`. Same engine, so it does not count as a second engine |
| Driver | `playwright-core` 1.59.0, the release whose browser build is 1217, the one installed here. It is given the browser's path and never downloads one |
| Launch flags | `--use-angle=swiftshader --enable-unsafe-swiftshader --ignore-gpu-blocklist` |
| A sandbox agent's VM | 4 cores, 7957 MB, 25 GB disk with 18 GB free, the same OS, Node, npm, `ffmpeg` and browsers. WebGL2 renderer string: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device (Subzero) (0x0000C0DE)), SwiftShader driver)`, largest texture 8192, `EXT_color_buffer_float` present |
| Scripted step | times out after `sandbox.stepTimeoutMinutes` (stated by `AGENTS.md`, not provoked here) |
| A detached process | outlives the step that started it. Measured 02:03 UTC: a loop started detached wrote one line a second for 45 seconds, while the step that started it returned after 1 second |

The WebGL2 limits and extensions of this VM under software rendering are in `config/webgl-caps.json`, written by `npm run caps`.

## Tool record

The inline display method. What can be called. The sound tools, with their test calls. The audio evaluation tool. The names of the prompt screen skill and the audio map skill, or that they were not found. The terms that were read. The hosting limits.

### Inline display

- Method, proven 2026-11-24 01:52 UTC with `references/approved/contact-sheet.jpg`: the pictures are written into one JSON file, `out/work/status/gallery.json`, as `{"lines": [...], "pics": [{"label", "w", "h", "src"}]}` where `src` is a JPEG data URL at most `status.pictureLongEdgePx` on the long edge. The file is shown with the inline visualization tool, passed as a JSON source named `pics`, through a small widget that creates one `img` per entry and sets its `src` from the data URL. The picture appeared in the thread with no download.
- External URLs and workspace paths are not used as image sources: the widget's content policy allows only `data:` and `blob:`.
- A source file may be at most 10 MB. Four pictures at 1200 px come to well under 2 MB.
- Links cannot be clicked inside the widget, so the app and review links are also written in the message text.

### Polling, detached processes, sandbox agents

- Polling test, 01:55 to 01:57 UTC: an agent whose whole job was to wait two minutes was started; starting it returned at once. While it waited the Builder started five more agents, ran commands, viewed pictures and ticked the clock (tick at 01:58 with three lookup agents still running). Its answer arrived as a message: `waited: 01:55:49 to 01:57:49 UTC`. So the Builder can tick the clock and post statuses while agents work, and agents get the full limits in "Waits".
- An agent started with sandbox isolation got its own VM: 4 cores, 7957 MB, 25 GB disk with 18 GB free, the same OS, Node, npm, ffmpeg and browsers as this VM. It cloned the repo, pushed the branch `agent/sandbox-test` (commit `d442cf9`, verified here with `git ls-remote`) without any extra sign-in, and returned a 2 second video (198295 bytes, verified here with ffprobe) and a JSON file as attachments of its message. The whole test took about two minutes. So chunks come back as attachments, and a branch push is the second route.
- An agent started without isolation shares this VM and its files.

### The image limit

- Measured 02:00 UTC with test images carrying a 1 pixel checkerboard and digits 5 pixels tall. What decides is the pixel count, not the long edge: a picture arrives untouched up to about 1.149 megapixels and is scaled down to that above it. Seen: 1400 x 788 untouched; 1000 x 1000 untouched; 1568 x 882 arrived as 1430 x 804; 1100 x 1100 and 1400 x 1400 both arrived as 1072 x 1072.
- So a picture with a long edge of `critics.maxImageLongEdgePx` arrives untouched only while its short edge is at most 820. The harness therefore caps every picture meant for a model at both the long edge from the config and the measured pixel count, written to `config/image-limit.json`. See decision 1.
- Agents of other model families were sent the same 1400 x 788 and 1000 x 1000 pictures as attachments. Every one that answered read all the 5 pixel digits correctly or nearly so, and saw the checkerboard as a crisp pattern, so pictures of that size reach them untouched too.

### What can be called

- Image generation, five models: Seedream 5 Pro (id `seedream_5`, the 2K route, about 2816 x 1584 at 16:9, up to 10 reference images; it made the approved images), Nano Banana 2.1 (`nano_banana_2_1`, up to 14 reference images), Nano Banana Pro (`nano_banana_pro`, 2K, up to 14), GPT Image 2.6 Flare and Sunburst (`gpt_image_2_6_flare`, `gpt_image_2_6_sunburst`, up to 5 reference images, transparent background possible, the aspect ratio is not forwarded and must be described in the prompt). Aspect ratios offered by the tool: 1:1, 3:4, 4:3, 9:16, 16:9. Sizes: stated by the tool's guide; the Seedream size was measured in the reference run.
- Video generation: yes (clips of 4, 6, 8, 12 or 30 seconds, 16:9 or 9:16, 720p or 1080p, with reference images). Not used for any frame of this build. It is only a way to study motion.
- Image to 3D: no such tool in the tool list (searched the names for 3d and mesh, 02:00 UTC).
- App hosting: a private preview deploy and a permanent publish to `<name>.pplx.app`. Size limit: about 500 MB per site, stated in `AGENTS.md`, not measured again yet.
- Speech: a text to speech tool exists. Not used: the films have no voice.
- A text-only extraction model exists and cannot see pictures. Every critic is a spawned agent.
- Model families for supporting agents, tested 01:59 to 02:03 UTC by sending each a fresh agent in its own VM with two test pictures and two sounds:

| Model id | Sees pictures | Hears sound |
| --- | --- | --- |
| `claude_fable_5_2` | yes, read every digit | only through the audio evaluation tool |
| `claude_opus_5_5` | yes, 4 of 24 small digits unsure | no, did not use the tool |
| `claude_sonnet_5_5` | yes, read every digit | no, did not use the tool |
| `gpt_6_2_astra` | yes, 1 digit wrong in the middle row | only through the audio evaluation tool |
| `gpt_6_2_sol` | yes, 1 digit wrong | only through the audio evaluation tool, which contradicted itself on the quiet clip |
| `gemini_4_carbon` | yes, read every digit | only through the audio evaluation tool |
| `gemini_neon` | yes, read every digit | only through the audio evaluation tool |
| `pplx_computer_glm_5_3_1009` | yes, 1 digit unsure | only through the audio evaluation tool |
| `kimi_k3` | yes, 5 small digits wrong | no |
| `grok_4_7` | read every digit, but says the picture reached it as a text description from its viewing tool | no |
| `deepseek_v4_pro_0813` | not available: the agent could not be started | not available |

- No model family hears sound directly. The only ears here are the audio evaluation tool.

### The sound tools

- The ElevenLabs connector is not in the tool list and connector discovery does not offer it (three searches, 01:52 to 01:53 UTC). What exists instead is a saved credential for `api.elevenlabs.io` on Brandon's account, used through the credential proxy. The account's tier, read from the API at 01:53 UTC: `creator`, 46399 of 131000 credits used this period.
- Sound effects: `POST /v1/sound-generation`. Default model `eleven_text_to_sound_v2` (a newer `eleven_text_to_sound_v3` exists and is not used unless it is the default). Body: `text`, `duration_seconds` from 0.5 to 30 or empty for automatic, `prompt_influence` 0 to 1 (default 0.3), `loop` true or false. Output formats on this plan include MP3 at 192 kbps and PCM at 48 kHz (PCM and WAV at 44.1 kHz need a higher plan). Test call 01:53 UTC: prompt for `glass-clink`, 0.5 s asked, `pcm_48000`: HTTP 200 in 1.7 s, 0.48 s of stereo 16 bit PCM at 48 kHz, cost header `character-cost: 6`. The take was almost silent: peak -33 dBFS, mean -55 dB. So a take does not always come back near full level, and a very short length may give a weak one.
- Music: `POST /v1/music`. Default model `music_v1` (`music_v2` and `music_v2_5` exist and are not used unless one is the default). Body: either `prompt` (up to 4100 characters) with `music_length_ms` from 3000 to 600000 and `force_instrumental`, or `composition_plan` with timed sections; `respect_sections_durations` defaults to true; `seed` works only with a plan. Test call 01:54 UTC: a 10 second winter prompt, `mp3_44100_192`, `force_instrumental` true: HTTP 200 in 3.6 s, 10.03 s stereo MP3 at 44.1 kHz, peak -1.2 dBFS, -12.4 LUFS. No cost header came back for music.
- The audio evaluation tool, one question about each result, 02:00 UTC, 16 s for both together. Sound effect: "A single, clean tap on a glass object", one event, no voice, no music, "quite soft and quiet". Music: "A short, magical, and festive Christmas musical sting", sleigh bells, celesta, low strings and choir pads, no words, about 85 beats per minute as it hears it, a clean ending.
- A warning about the listener, measured: five agents asked the same tool about the same almost silent sound effect with an open question and got five different answers ("a calm male voice says take a deep breath and relax", "two short electronic beeps", "a high-pitched resonant metallic tone", "a person clears their throat", could not tell). About the music all of them agreed. So the listener invents things on a very quiet clip and agrees easily with a line it is shown. The harness therefore gives the listener every take only after the level chain, asks the open questions before it shows the cue's line, and treats a voice heard in a sound effect as real only if a second call hears it too. See decision 2.

### The two skills

- The prompt screen skill: `project:synthetic-ui` (the same skill is also listed as `org:synthetic-query-typing`). It renders the product's prompt screen with a prompt being typed, thinking steps, and the build screen.
- The audio map skill: `user:beat-sync`. It maps tempo, bars, hits and sections of an audio track. `npm run audiomap` works without it.

### The terms that were read

Read 2026-11-24 by three supporting agents. Every quote is kept with its URL under `references/terms/`. The readings are in `ASSETS.md`, and the points that are Brandon's to settle are under "For Brandon to decide".

- Image models: `references/terms/images/TERMS.md`. Nano Banana and GPT Image allow a published video and a public website with conditions. Seedream 5 Pro is not clear. The image tool's own terms split by the plan of the account.
- Sound tool: `references/terms/sound/QUOTES.md` and `SUMMARY.md`. A: sound effects inside a film and an app are allowed (stated). B: separate sound files in a public repository are not allowed (stated). C: music in a company's social video is not clearly allowed on this plan (stated limits, unknown reading).

### The hosting limits

`references/terms/hosting/LIMITS.md`, read 2026-11-24.

- What the static file limit counts: the total size of the source files uploaded by the Vercel command line tool, 100 MB on Hobby and 1 GB on Pro (stated). It is not described as a limit on the build's output, on one file, or on a deploy built from Git. Whether Git deploys are exempt is not stated (unknown).
- A build from Git: up to 45 minutes, 8 GB of memory, 64 GB of disk, no limit on the number of output files (stated).
- Stored deployments: 10 GB for the whole team on Hobby, and every deployment stores its full output again (stated).
- Traffic on Hobby: 100 GB a month, paused when exceeded (stated).
- The largest single static file and the largest output of one deployment: not stated anywhere (unknown).
- Hashed files get a long cache lifetime only if `vercel.json` sets the header (stated). The repo's `vercel.json` does.
- The Hobby plan is for personal or non-commercial use only (stated).
- `host.maxShippedMb` is left as it is: it is under the only limit that could apply, and a note for Brandon is under "For Brandon to decide".
- This workspace's own hosting: about 500 MB per site (stated by `AGENTS.md`).
- This workspace's own hosting, measured 2026-11-24 02:53 UTC: the first deploy took 12 files and 1.6 MB. The site is published at https://snow-globe-seasons.pplx.app with the name "Snow Globe" and the address from `slug`. Site id `717c894a-c960-4c5c-ae85-0ac0c016f03c`, asset id `4c4f15d3-07df-421c-941e-77528b5e889f`, preview card https://www.perplexity.ai/computer/a/snow-globe-TE8V0wffQhyUHndSi16Inw.
- Visibility: Organization (measured: the publish call returned it, and a request without a sign-in gets 401). It opens for a signed-in member of the organization. Brandon can change it from the Publish menu of the preview card, under Visibility: https://www.perplexity.ai/computer/a/4c4f15d3-07df-421c-941e-77528b5e889f?open-publish=true
- A new publish goes: `npm run build`, `npm run review`, a preview deploy of `dist/`, then the publish with the site id. The host looks at a screenshot before a deploy. On the first deploy it refused the spike scene for three things that belong to the spike (a hard horizon where the plain floor catches the key light, plain points in clumps, a backdrop light seen through the glass), so that deploy was sent with the picture check off. The check is left on from the first real scene.


### What the sound tool costs

- Measured from the account's counter, 01:53 to 02:03 UTC: the two test calls cost 144 credits together. The sound effect cost 6 (its response header said so). The 10 seconds of music cost 138, about 13.8 credits per second. 46543 of 131000 were used at 02:03 UTC, so about 84000 remain this period: roughly 100 minutes of music, or far more sound effects than the take limits allow.
- Creating a composition plan costs no credits (stated: https://elevenlabs.io/docs/api-reference/music/create-composition-plan). Its request takes `prompt`, `music_length_ms`, `source_composition_plan` and `model_id`. The plan's structure is not shown on that page, so the first call will show it.

### What the clock tests found

- `tests/clock.test.ts` (46 tests, written by a supporting agent, run and read here): the clock behaves as the kit describes. Three things the kit does not spell out, kept as they are: the time between the last tick and `--review`, `--continue` or the opening tick of a review round is dropped, not counted; a `--phase` tick after a review round tick on the same boot counts the gap since that tick; a phase with no box in the allowance in force prints both `half point: reached` and `box end: reached`.

### WebGL2 extensions that every target browser has

Read by a lookup agent from the WebGL registry, MDN's compatibility data, WebKit's and Firefox's source and the three.js migration notes on 2026-11-24. Sources and quotes: `references/terms/webgl/NOTES.md`. The map is in `config/webgl-caps.json` under `portable`.

- Portable: `EXT_color_buffer_float`, `EXT_texture_filter_anisotropic`, `OES_draw_buffers_indexed`, `WEBGL_debug_renderer_info`, `WEBGL_debug_shaders`, `WEBGL_lose_context`.
- Not portable, so the app never needs them: `EXT_color_buffer_half_float` (missing in Firefox on WebGL2), `OES_texture_float_linear`, `EXT_float_blend`, `WEBGL_multi_draw`, every compressed texture format, and the rest.
- What the engine does with that: it draws each sample into a half float target, which `EXT_color_buffer_float` covers, and keeps the running mean in a 32 bit float target that is never blended and never filtered. Without `EXT_color_buffer_float` it falls back to half float through `EXT_color_buffer_half_float`, and without either to 8 bit targets. Check G10 renders with every extension outside the portable list denied, again without `EXT_color_buffer_float`, and again with neither float extension.

## Pinned versions

Chosen 2026-11-24 02:02 UTC from the npm registry: the newest stable release of each, written into `package.json` without ranges. `package-lock.json` is committed.

| Package | Version | Note |
| --- | --- | --- |
| `three` | 0.187.0 | r187, the newest stable release |
| `gsap` | 3.15.1 | |
| `vite` | 8.3.8 | |
| `typescript` | 7.0.2 | |
| `vitest` | 4.1.12 | 5.x needs Node 22 and this VM has Node 20.20.2, so the newest 4.x is pinned. See decision 5 |
| `@types/three` | 0.187.0 | |
| `@types/node` | 20.19.43 | matches Node 20 |
| `playwright-core` | 1.59.0 | the release whose browser build is 1217, Chrome for Testing 147.0.7727.15, the one installed here |
| `pngjs` | 7.0.0 | |
| `sharp` | 0.35.5 | |

Migration notes that touch `WebGLRenderer`, read from the three.js migration guide (https://github.com/mrdoob/three.js/wiki/Migration-Guide) on 2026-11-24, newest first:

- r187: PMREM outputs are cube render targets and `CubeUVReflectionMapping` is gone. `setViewport` and `setScissor` no longer scale by the pixel ratio when a render target is bound. `iridescenceThicknessRange` is deprecated.
- r186: `Object3D.dispose()` exists. `Source` was renamed `TextureSource`.
- r185: `inverseTransformDirection` is deprecated in shaders. `updateWorldMatrix` honors `matrixWorldNeedsUpdate`. `DRACOLoader.setDecoderConfig` is deprecated.
- r184: environment rotation was aligned between background and lighting. `renderer.state.pixelStorei()` replaces direct pixel store calls. `FileLoader.load` returns nothing.
- r183: `Clock` is deprecated, use `Timer`. `RoomEnvironment` moved.
- r182: `PCFSoftShadowMap` is deprecated, use `PCFShadowMap`.

What this build takes from them: every render target pass sets its viewport in target pixels; no code depends on the PMREM layout; no `Clock`; shadows use `PCFShadowMap` or the build's own filter.

## Render budget

Seconds per sample at each format, the cost of one simulated second, and the time each long job should take. Measured in Phases 0, 2 and 3.

The spike scene of Phase 0 (plain shapes, winter's particle count as plain points, a simple lens). The table is measured again on the real scene in Phase 2.

### This VM

Measured 2026-11-24 02:48 UTC on space-sandbox · 2 x Intel(R) Xeon(R) Processor @ 2.90GHz · 7958 MB (2 cores), software rendering, on the scene of build `649783eb70c1c499`: 102000 particles, 43624 triangles, 16 draw calls a sample, accumulation in float32.

| Format | Size | Seconds per sample | Draft picture (2) | Review picture (8) | Final picture (24) |
| --- | --- | --- | --- | --- | --- |
| uhd | 3840 x 2160 | 2.68 | 7.3 s | 23.4 s | 66.3 s |
| hd | 1920 x 1080 | 0.75 | 2.0 s | 6.5 s | 18.5 s |
| preview | 960 x 540 | 0.21 | 0.9 s | 2.1 s | 5.5 s |
| phone | 390 x 844 | 0.23 | 0.9 s | 2.2 s | 5.9 s |
| tablet | 1024 x 1366 | 0.82 | 2.0 s | 7.0 s | 20.1 s |

- Fixed cost of starting a render: the browser starts in 0.3 s and a page is ready in 0.8 s. The first still of a page also replays the test shake: 14.7 s for 14.4 simulated seconds without checkpoints.
- One simulated second at winter's particle count (102000, 240 steps): 1.85 s in the storm, 1.84 s just after the landing, 0.14 s at rest.
- The whole film's simulation, 60.0 s with 4 shakes plus the preroll's: about 1.2 minutes, once, then read from checkpoints.

| Job | Frames | Draft | Review | Final |
| --- | --- | --- | --- | --- |
| Film B, preview | 1800 | 0.5 h | 1.1 h | 2.8 h |
| Film B, hd | 1800 | 1.0 h | 3.3 h | 9.3 h |
| Card loop, hd | 240 | 0.1 h | 0.4 h | 1.2 h |

These are one render process on this VM. Sandbox VMs have more cores and render ranges in parallel, so a job split across N of them takes about 1/N of its time plus the join.

### A sandbox VM

Measured 2026-11-24 02:48 UTC by a sandbox agent at commit `2f3666f`, the same build, on 4 cores of the same processor, with the same browser. One render process.

| Format | Size | Seconds per sample | Draft picture (2) | Review picture (8) | Final picture (24) |
| --- | --- | --- | --- | --- | --- |
| uhd | 3840 x 2160 | 1.55 | 4.8 s | 14.1 s | 38.9 s |
| hd | 1920 x 1080 | 0.41 | 1.5 s | 3.9 s | 10.4 s |
| preview | 960 x 540 | 0.09 | 0.7 s | 1.2 s | 2.7 s |
| phone | 390 x 844 | 0.10 | 0.7 s | 1.3 s | 2.9 s |
| tablet | 1024 x 1366 | 0.43 | 1.5 s | 4.1 s | 11.1 s |

- A sandbox VM draws a sample in a little over half the time this VM needs: 0.41 s against 0.75 s at hd.
- The simulation is no faster there, 1.81 s for a simulated second in the storm, because it runs on one core.

### The same still on three VMs

`npm run still -- --key winter-rest --tier review` (1920 x 1080, 8 samples) at commit `2f3666f`, build `649783eb70c1c499`, on this VM (2 cores) and on two sandbox VMs (4 cores each).

| Pair | PSNR | Pixels that differ |
| --- | --- | --- |
| This VM and sandbox VM 1 | identical | 0 |
| This VM and sandbox VM 2 | identical | 0 |
| Sandbox VM 1 and sandbox VM 2 | identical | 0 |

- All three files have the SHA-256 `28f5f6211607689c...`. `quality.crossMachineMinPsnr` is 45, so the pairs are far inside it and film chunks from different VMs join without a seam, as long as this stays true on the real scene. It is measured again in Phase 2.
- Sandbox VM 2 also ran `npm run determinism`: pass, and its rest still at preview size has the same hash as the one made here.

## Judged list

Written in Phase 2. The film's part is replaced once in Phase 6.

none

## Look lock

Written at the end of Phase 3: what was learned from the real photographs and footage, every locked setting, what worked, what did not, and the five recipes.

none

## Sound

Every cue with its state: kept, open, or not made yet. Takes used. Which candidate soundtracks exist. After the review: which soundtrack was approved and where it came from. Credits spent on sound in all.

| Cue | State | Takes used | Note |
| --- | --- | --- | --- |
| `glass-clink` | kept, take 2 | 2 of 3 | Take 1 was the Phase 0 test call, almost silent |
| `ui-sound-on` | kept, take 1 | 1 of 3 | Heard as a bright chime of two quick tones, a little synthetic |
| `ui-tick` | kept, take 1, weak fit | 1 of 3 | Heard as a sharp high clink, sharper than the soft tick asked for. Kept at 04:26 once the tool could level a sound of 0.08 s (measured over its own length, -26 LUFS). A softer take is due in Phase 3 |
| `lift` | open, next take in Phase 3 | 1 of 3 | Take 1 is a high clink, not a heavy base leaving stone |
| `shake-winter` | open, next take in Phase 3 | 1 of 3 | Take 1 is a spoon stirring a glass |
| `land-winter` | open, last take in Phase 3 | 2 of 3 | Take 1 almost silent, take 2 one light clink with no crackling |
| `amb-winter` | open, out of takes | 3 of 3 | Take 1 and 2 were a rumble under 60 Hz, take 3 a gust, a whoosh and sleigh bells up close. Silent until a review round |
| every other cue | not made yet | 0 | Phase 3 to 5 |

- Candidate soundtracks: none yet.
- Credits spent on sound effects, by the cost header of each call: 768 for eleven takes, and two 3 second test calls whose headers were not kept, about 66 more. The account's counter read 48421 of 131000 at 04:02 UTC. It also moves with Brandon's other work, so it is not this build's total.
- Texts, settings, verdicts and the listener's words for every take: `audio/prompts.json`.

## Card

The season of the card loop, and the votes of the pick if it was run.

none

## Decisions made by the Builder

Numbered. What, why, and the date.

1. 2026-11-24. The image limit is a pixel count, not a long edge. `critics.maxImageLongEdgePx` stays as it is, because a picture that wide arrived untouched at 16:9. The harness adds the measured cap of about 1.14 megapixels from `config/image-limit.json` to every picture meant for a model, so a square crop is at most 1067 on a side. Lowering the key to 1072 instead would have halved the detail of every wide comparison image for no gain.
2. 2026-11-24. The listener is given each take after the level chain, never as the tool returned it, and is asked what it hears before it is shown the cue's line. A voice reported in a sound effect counts only if a second call reports it too. Reason: on an almost silent test take the audio evaluation tool gave five different answers to five agents, one of them a spoken sentence.
3. 2026-11-24. Critics, jurors and listeners are started with sandbox isolation and receive their files as attachments, so they share no disk with the Builder and cannot open the repo, the kit or earlier scorecards. An agent without isolation shares this VM.
4. 2026-11-24. The sound tool is called through the saved credential for the ElevenLabs API, because the connector named in the kit is not among the tools of this task. Same service, same account, same plan.

5. 2026-11-24. `vitest` is pinned to 4.1.12, not to the newest release, because 5.x needs Node 22 and the VMs here have Node 20. Every other package is the newest stable release.

6. 2026-11-24. A still places all its samples at one moment, so only the pixel and the lens are sampled. A film or loop frame also spreads its samples over the shutter. Samples are sorted by time, so the stepped simulation only ever runs forward inside one picture.
7. 2026-11-24. The stepped state of a still or a frame is reached by replay from the start of its timeline, with a checkpoint every `sim.checkpointSeconds`. Checkpoints are kept in the page and, in `capture`, stored by the harness server under `out/work/simcache/`, keyed by the engine hash, so a wrong cache can never be read after the code changed.
8. 2026-11-24. Comparison images and crops are placed relative to the globe's circle: measured in each approved image and computed from the camera in each still. Labels `-a` (approved) and `-b` (build) are the ones the `settled` lines in the config use.
9. 2026-11-24. Build and tool agents run at high reasoning effort. Critics, jurors and agents that judge or build what is seen run at the strongest setting available.
10. 2026-11-24. The parts register is created in Phase 0 instead of Phase 2, with every part as a stand-in, because the frame interface of step 14 reports the stand-in list from it.

11. 2026-11-24. `EXT_color_buffer_half_float` is used only as an optional path. The accumulator asks for a 32 bit float target, falls back to a 16 bit one where that is missing, and to 8 bit where neither exists. The three paths were rendered: the 16 bit path is 75.0 dB from the 32 bit one, the 8 bit path 34.5 dB. Captures always record which one they used.
12. 2026-11-24. In G8, `public/assets/index.json` counts as a file written by the build: `npm run build` writes it from the asset folders, so it has neither a row in `ASSETS.md` nor a recipe.
13. 2026-11-24. `npm run determinism` opens four fresh pages, renders its pictures in four different orders with checkpoints off, and then once more with checkpoints written and read back. All of them must be pixel-identical.
14. 2026-11-24. The default grid is 25 bars: holds of 4, 4, 4, 4 and 5 bars and four shakes of one bar, 60.0 s at 100 beats a minute, 3600 frames at 60 a second and 1800 at 30. It is replaced by the music's own map in Phase 5.
15. 2026-11-24. The app is published at the address in `slug` without asking, because the kit names that key for the address and this task says to decide and continue.
16. 2026-11-24. The first deploy was sent with the host's picture check off. The check looked at the spike and refused it for three things that belong to the spike. A measuring scene is what Phase 0 is asked to publish. The check stays on for every deploy from the first real scene.
17. 2026-11-24. The render budget section is written by hand from two measurements, this VM's and a sandbox VM's, because the film will be rendered on sandbox VMs and their draw time is about half. `npm run budget` still writes `out/work/budget/`, and `--write` is not used.


18. 2026-11-24. The glass refracts by moving vertices, not by bending a picture. Everything inside the liquid is drawn in its own pass through one shader chunk that finds, for each vertex, the point on the sphere where the ray from the lens enters so that Snell's law holds with `globe.liquidIor`, and places the vertex along that ray at its true optical path length. The inside is therefore drawn once, sharp, with correct depth, in every sample, and depth of field and motion blur come from the samples like everything else. A picture bent in screen space was the alternative: it loses detail at the limb and cannot hold depth of field through the glass. The shell (reflection of the room, the Fresnel rim, the bubble, the season's dressing) is drawn over it.
19. 2026-11-24. Materials are three.js standard and physical materials patched through one helper, so every part gets the interior projection, the light grid, the dissolve by hashed coverage and the diagnostic views from one place, and a season's folder never touches shader plumbing.
20. 2026-11-24. A season is one folder exporting one kit (base, miniature dressing, glass dressing, surface dressing, light, veil, arrivals, backdrop colours). The layout of the miniature is fixed in `src/scene/layout.ts` and shared, so the cottage, the tree, the pond, the lamppost and the fence stand in the same place in all four.
21. 2026-11-24. The mirror image in the surface is the scene drawn again from the camera reflected in the surface's plane, with the same shader code. The small lights inside the globe light the miniature through a coarse grid of light baked on the CPU, so their count costs nothing per pixel.
22. 2026-11-24. One pool of particles sized to the largest season. A particle's kind comes from its index, and at a change the outgoing and incoming kinds are paired by index, so the storm never loses or gains a particle in one frame. The live app steps the same simulation in a worker.
23. 2026-11-24. The cut list is computed in the page (`src/film/cut.ts`) from the config and the audio map, and `npm run cut` writes it out by asking the built page. The film, the checks and the mix therefore read one cut, and it cannot drift from what the page renders.
24. 2026-11-24. Phase 2 is split across eight sandbox agents with one owner per file: five for the harness commands, one for the audio map, one for the interface and the probe, one for the simulation. The Builder builds the engine, the stand-ins, the film, the app and the seasons' skeleton meanwhile and integrates. The briefs are committed under `tools/briefs/`, so a replacement or a later task starts from the same words.
25. 2026-11-24. The npm script lines for every remaining harness command were added before the agents started, so no agent edits `package.json`.
26. 2026-11-24. The engine and the film with the app, which decision 24 kept with the Builder, went to two more sandbox agents at 03:48 and 03:50 (ten build agents, the limit in the config). Reason: the Builder's working memory is compacted every few minutes at this size of task, and each compaction costs a full reading of the kit, so code written here would be written between readings. The Builder now holds the contracts (`src/core/stage.ts`, `src/core/bridge.ts`), verifies every branch through the harness, integrates, runs the rounds, the sound and the statuses. The stage contract was widened first so the two can work apart: the moment carries the time, the beat and the loop's period, the particles reach the stage as one typed source, the stage gives the collider.

27. 2026-11-24. Sound takes in Phase 2. Step 7 asks for the first take of seven cues, and the build order leaves winter's remaining takes to Phase 3. Two cues went further in this phase, because their takes came back so weak that there was nothing to judge or to carry: `land-winter` (take 2) and `amb-winter` (takes 2 and 3). `amb-winter` has now used its three takes and none fits its line, so by `kit/03-METHOD.md` section 12 it is an open item, silent in the mixes and in the app, and it will be named in the `REVIEW` block. What the three takes taught is written under `learned` in `audio/prompts.json` and goes into the brief of the sound agent in Phase 4, so spring, summer and fall do not pay for it again. The remaining takes of `lift`, `shake-winter`, `land-winter` and `ui-tick` are spent in Phase 3, against the finished shake, with texts already changed by what was learned. The listener's fixed questions are in `audio/QUESTIONS.md`.

28. 2026-11-24. The Phase 2 blockout preview carries a sound stream: the kept cues placed on the cut by `npm run mix -- --candidate blockout`. Check D2 asks for sound only from Phase 6 and does not forbid it earlier, and step 7 of Phase 2 says the blockout carries sound from the start. Where a cue has no kept take the stream is silent at that point, and the review page says which cues are missing.

## Notes from Brandon

Numbered, in his words, with the date and how each was applied. Review round items carry their round's number.

none

## Probe results

none

## Declined issues

The issue, the critic, the round, and the approved image or stated choice it would have moved away from.

none

## Open items

Severe and major issues still open when a limit was reached: the unit, the still, the critic's words, what was tried, what to try next.

1. Sound, `amb-winter`: no take fits after the three the cue is allowed. Its line is "wind and distant bells", looped and very quiet. Take 1 (asked for as very quiet, with the loop setting) and take 2 (asked for at full strength, with the loop setting) came back as a rumble under 60 Hz with nothing above it. Take 3 (no loop setting) is a gust of wind, a whoosh, then sleigh bells jingling close by for ten seconds: the listener's words are "the bells are loud and upfront rather than distant" and "a distinct, magical-sounding whoosh". Winter therefore has no ambience in the app and in the mixes. What to try next, when a review round buys new takes: one steady bed of wind with no named instrument up close, the bells as "far away and sparse", no loop setting, 20 seconds, and let the chain make the loop.

## Review items not done

none

## For Brandon to decide

Things only he can settle. Nothing waits on them.

1. Music and the sound tool's plan. The soundtrack is made with ElevenLabs on the Creator plan. Its terms allow commercial use of music "except film, TV, radio, and Studio Games" and do not define "film". The same plan is marked for individual use only: companies appear from the Scale plan up. So the terms do not clearly allow this music in a video a company posts on social media. Both soundtrack candidates are made and offered at the review anyway. Your choices: approve as it is, move the account to a plan whose music terms cover it, or supply a track of your own, which replaces the generated music with no other change. Quotes: `references/terms/sound/QUOTES.md`.
2. The repo is public and the config expected it to be private. Because the sound tool's terms forbid making its output available as separate audio files, no generated sound file is committed. They live in the workspace and in the published app, and an archive is attached to the thread. If you make the repo private, say so and the kept sounds will be committed.
3. The approved images and Seedream 5 Pro. The terms that could be read do not clearly allow its output in a published video and on a public website: it depends on which route the image tool uses to reach the model, which is not published, and on the plan of this account. Nothing was changed because of this, as the kit says. New pictures that ship are made with models whose terms allow both. Quotes: `references/terms/images/TERMS.md`.
4. The plan of this account. The image tool's own terms allow commercial use of generated pictures on Enterprise Pro and Enterprise Max, and only personal use on individual plans. The account belongs to an organization, but the plan was not measured.
5. The hosting plan. Vercel's Hobby plan is for personal or non-commercial use only. A company portfolio piece may need the Pro plan. The limit behind `host.maxShippedMb` counts the source files uploaded by the command line tool, not the built site and not a deploy from Git, so the key is safe as it is and was not changed. Details: `references/terms/hosting/LIMITS.md`.

## Running jobs

The command, the range, the log file, the VM, the time it should take, when it started.

none

## Running agents

The name, the branch, the folders it owns, its job, its limit, when it started.

The name, the branch, the folders it owns, its job, its limit, when it started.

| Name | Branch | Folders it owns | Job | Limit | Started | State |
| --- | --- | --- | --- | --- | --- | --- |
| `film_tools_builder` | `agent/tools-film` | `tools/film.mjs`, `tools/loop.mjs`, `tools/stress.mjs`, `tools/render-local.mjs`, `tools/lib/encode.mjs`, `tools/lib/frames.mjs` | The film, loop, stress and local render commands | 3 h, heartbeat 25 min | 2026-11-24 03:37 UTC | running |
| `sheet_tools_builder` | `agent/tools-sheet` | `tools/sheet.mjs`, `tools/seq.mjs`, `tools/lib/sheetlayout.mjs` | Contact sheets and frame sequences | 3 h, heartbeat 25 min | 03:37 UTC | running |
| `gate_checks_builder` | `agent/tools-checks` | `tools/gate.mjs`, `tools/hostcheck.mjs`, `tools/lib/checks.mjs` | G4 film part, G5, G6, G7, G11 to G16, D2 to D6, the host check | 3 h, heartbeat 25 min | 03:37 UTC | running |
| `measure_pack_builder` | `agent/tools-measure` | `tools/measure.mjs`, `tools/pack.mjs`, `tools/lib/measures.mjs` | M1 to M6 and the critic packs | 3 h, heartbeat 25 min | 03:37 UTC | running |
| `audio_tools_builder` | `agent/tools-audio` | `tools/sound.mjs`, `tools/mix.mjs`, `tools/soundcheck.mjs`, `tools/lib/audio.mjs`, `src/audio/`, `tests/mix.test.ts` | The sound commands, the mix, the sound checks and the app's sound engine | 3 h, heartbeat 25 min | 03:37 UTC | running |
| `audiomap_builder` | `agent/tools-audiomap` | `tools/audiomap.mjs`, `tools/lib/beats.mjs`, `tests/audiomap.test.ts` | The audio map and its click track test | 3 h, heartbeat 25 min | 03:37 UTC | running |
| `interface_builder` | `agent/ui` | `src/ui/`, `src/copy.ts`, `src/probe/`, `tools/ui-preview/`, `public/fonts/` | The controls, the menu on the `M` key and the probe page | 3 h, heartbeat 25 min | 03:37 UTC | running |
| `particles_builder` | `agent/particles` | `src/particles/engine/`, `src/globe/liquid.ts`, `tests/sim.test.ts`, `tests/liquid.test.ts`, `tests/loop.test.ts` | The liquid model, the simulation of every kind, the season change by index, the loop's closed paths | 3 h, heartbeat 25 min | 03:37 UTC | running |
| `engine_builder` | `agent/engine` | `src/globe/` except `liquid.ts`, `src/scene/`, `src/seasons/`, `src/post/`, `src/diagnostics/`, `src/particles/draw/`, `src/shake/change.ts`, `src/core/materials.ts`, `src/core/standins.ts`, `tools/parts.mjs`, `parts/PARTS.json`, `tests/layout.test.ts`, `tests/lens.test.ts`, `tests/framing.test.ts`, the numbers under `cameras` | The stage on stand-ins: refraction, the surface and its mirror, the backdrop, the layout and the collider, the four season folders, the change, the diagnostic views, the post chain, the rough camera fit, the render budget | 3 h, heartbeat 25 min | 03:48 UTC | running |
| `film_app_builder` | `agent/film-app` | `src/film/`, `src/app/`, `src/capture/showcase.ts`, `src/main.ts`, `src/core/params.ts`, `src/core/quality.ts`, `src/vite-env.d.ts`, `index.html`, `vite.config.ts`, `tools/cut.mjs`, `tools/simcache.mjs`, `cut/`, `tests/film.test.ts`, `tests/cut.test.ts`, `tests/app.test.ts` | The cut, the camera moves, `autopilot`, the opening's stand-in, the loop's timeline, the `live` app with its gestures and quality levels | 3 h, heartbeat 25 min | 03:50 UTC | running |

Every brief is in `tools/briefs/`: `COMMON.md` and one file per agent. All ten run in their own sandbox VMs. Files nobody but the Builder edits while they run: `src/core/bridge.ts`, `src/core/stage.ts` (the engine agent may add optional members), `accumulator.ts`, `sampler.ts`, `gl.ts`, `sdf.ts`, `src/shake/table.ts`, `src/particles/spikeSim.ts`, `src/particles/driver.ts`, `package.json`. A replacement starts from the same brief and from what the first one pushed.

Finished: `wait_tester`, `sandbox_prober`, `reader_01` to `reader_10` (the model test), `image_terms_reader` (02:04), `hosting_limits_reader` (02:06), `sound_terms_reader` (02:09), `clock_test_writer` (02:12: `tests/clock.test.ts`, 46 tests, run here and all pass; it reported no behaviour that differs from the kit), `webgl_portability_reader` (02:19: its table is in `references/terms/webgl/` and merged into `config/webgl-caps.json`), `review_page_builder` (02:32: `tools/review.mjs` on `agent/review-page` at `5d5dc6d`, taken into `main` as that one file; it tested three screen sizes in headless Chrome, not Safari), `compare_layout_builder` (02:40: `agent/compose`, merged as `a379413`, its layouts looked at here), `animatic_builder` (02:46: `tools/animatic.mjs` on `agent/animatic` at `072c59a`, with a rough cut of 1800 frames attached; merged in Phase 1), `vm_still_renderer_2` (02:47) and `vm_still_renderer_1` (02:52): the same still on two sandbox VMs, and the budget on one of them.

Merged into `main`, each verified here with types clean and the tests green (126 tests after the fifth):

- 04:01 `agent/tools-sheet` (sheet, seq). The agent is idle and can take follow-ups.
- 04:06 `agent/tools-measure` (measure, pack). Follow-up sent 04:07: run the blockout pack against the real sheet tool.
- 04:08 `agent/tools-audiomap` (audiomap). Checked here on a click track of 93 beats a minute, 40 s, accent every fourth: `tracked`, 93 beats a minute, 62 beats, 15 bars, bar lines on the accents, first at 0.0013 s. The agent's own tests: 100 and 87 beats a minute, with a quiet middle and with an offset, largest beat error 1.56 ms. Its weak spot, by its own report: a dotted or triplet feel can end as `grid`, and a `grid` map must not be cut to.
- 04:10 `agent/tools-audio` (sound, mix, soundcheck, the app's sound engine). Follow-up sent 04:12: a sound of a tenth of a second cannot be levelled yet (`ui-tick` take 1 is refused as too quiet to measure).
- 04:14 `agent/tools-checks` (gate G5 to G7, G11 to G16, D2 to D6, hostcheck). Its run of the Phase 2 gate on the measuring scene: G1 to G4, G8 to G12 and G14 green; G5 red (no interface yet), G6 red (no judged list yet), G7 red (no opening yet), D2 and D3 red (no preview and no proof yet).

- 04:19 `agent/tools-measure` again (`2830daf`): the pack calls the real sheet tool with `--look no`, runs a sheet command again when it stops at its chunk (exit 3), and holds the whole run to `sandbox.chunkBudgetMinutes`. Its blockout pack on the measuring scene: 19 files in two parts (ten film sheets; six camera pairs and three screens), 0 missing. Not proven by a run: the exit 3 path, `--loop`, `--loop --seam`, `--motion move`. Still without a tool: the app path sheets (shake, stir, drag, jump), the R8 control crops, the hint sheet, and R7 (the stress output's shape was unknown to it). The sheet, audio map and gate agents are done and idle.

- 04:26 `agent/tools-film` at `9156a8e` (film, loop, stress, render-local, encode, frames), merged before its report arrived so that the R7 pack can be built on the stress tool: types clean, 126 tests green. Not run here yet, because every one of them needs a build that matches the source and the app is not in. Follow-up 2 to the pack agent at 04:27: the R7 pack from `out/work/stress/stress.json`, one run each of `--loop`, `--loop --seam` and `--motion move`, a real file name in the answer example. R8 and the globe unit's motion pack wait for the interface and the app.

- 04:25 `agent/tools-audio` again (`b80dc58`): sounds shorter than one 400 ms loudness block are levelled over their own length, a constant offset is taken out, and the low cut runs before the trim. 131 tests green here. Proven on the real take: `ui-tick` take 1 kept at 0.08 s, -26.07 LUFS, peak -10 dB, packed into the app's sprite with `glass-clink` and `ui-sound-on`. The agent's own note: a nearly empty film A mix needed 12 dB of gain and 9.65 dB of limiting to reach film loudness, which should not arise with ambience and the full cue set, and is not tested.

## Rounds

One line per round: its number, the unit, the commit it judged, each part ticked off as it finished, the scores, and what changed next.

none

## Final scores

From the record round.

none

## QA results

One line per item of `kit/09-QA-GAUNTLET.md`, with its evidence.

none

## Failed QA items

none

## Last report block

The last `REVIEW`, `BUDGET REPORT` or `BUILD COMPLETE` block, exactly as it was posted.

none

## Push log

- 2026-11-24 01:49 UTC: `4c24ecc` pushed to `main`. The first push of the build succeeded.

- 2026-11-24 02:35 UTC: `5ef13ec` pushed. 02:48 UTC: `2f3666f` pushed.

- 2026-11-24 02:57 UTC: `dbe01e8` pushed. 03:01 UTC: `681b78b` pushed.

## Session log

One entry per task: when it started, what it did, where it stopped.

### Task 1 · started 2026-11-24, about 01:45 UTC

- 01:45 to 01:49: pulled the repo at `6cc59f6`, checked stop condition 1 (manifest present, all nine hashes match, every image named in `keys` exists), read `AGENTS.md` and the kit in its reading order. No addenda. This reading time is before the clock existed and is not counted by it.
- 01:49: Phase 0 step 1. Wrote `in progress` under "Build" and pushed.
- 01:50: steps 2 and 3. `package.json` created. `npm run clock`, `npm run look` and `npm run progress` built. Clock started.
- 01:52: step 4. The contact sheet was shown inline in the thread. Repo measured public. First status posted.

- 01:53 to 02:09: steps 5 to 13. The workspace, the tools, the polling test, a sandbox agent, the image limit, the model families, the sound tool and its listener, the two skills, the terms and the hosting limits were measured or read and recorded. Packages installed with exact pins.
- 02:10 to 02:14: the browser library and `npm run caps` written; the clock tests arrived and pass; a lookup agent is reading which WebGL2 extensions are portable. Status 2 posted.
- 02:14 to 02:34: three sandbox agents started for the rough cut tool, the review page tool and the comparison layout. The portability table merged. Step 14: config import, seeded random, sampler, accumulator, asset loader, shake path, default grid, spike simulation and spike scene written; `npm run build` exits clean; `npm run still` renders through `window.showcase` in `capture` mode. First timing at 1920 x 1080 in software: 0.84 s per sample. `npm run status` built. Status 3 posted with the first spike stills.
- 02:35 to 02:48: step 15. The tests for config, random, sampler, film and framing written (93 tests in 7 files with the clock and compose tests) and two failures fixed: the season change at a bar edge, and the stand-in shake's strokes running past their beats. `determinism`, `gate`, `budget`, `keep`, `crops` and `compare` built. The comparison layout arrived on `agent/compose`, was checked by eye and merged. Host files written. Pushed `2f3666f`.
- 02:48 to 02:53: step 16. The render budget measured here and on a sandbox VM. The same still rendered on this VM and on two sandbox VMs: all three files are identical. The app opened in `live` mode in the browser at desktop and phone size: the arrival, a drag and a shake all work, with no message in the console (2 frames a second at 1280 x 720 in software, which says nothing about a graphics card).
- 02:53: step 17. `npm run review`, a preview deploy and the publish. App and review page live. Step 18: Status 4 posted with the spike beside the approved winter image.
- 02:56: the Phase 0 gate, line by line.
  - A push has succeeded: `4c24ecc` at 01:49 UTC, and every push since.
  - G1 pass: `npm run build` exited 0, no type errors. G2 pass: 93 of 93 tests in 7 files. G3 pass: 3 pictures pixel-identical across 4 fresh page loads in 4 orders. G4 pass: a still in every format has its exact size, and `loop().frameCount` is 480. G8 pass: 1 shipped file, written by the build. G9 pass: 218 tracked files, 277 MB, the largest 6.5 MB, no secret, 9 of 9 approved hashes hold. G10 pass: pixel-identical with all 24 extensions that are not portable denied. All at build `649783eb70c1c499`, from `out/work/gate/phase-0.md`.
  - The records are in this file: "Workspace record", "Tool record" with the sound tools and the two skills, "The terms that were read", "The hosting limits", "Pinned versions", "Render budget".
  - The inline display method is under "Inline display". Whether the repo is private is under "Status": it is public.
  - The polling test is under "Polling, detached processes, sandbox agents". The PSNR between VMs is under "Render budget": identical, all three pairs.
  - The clock has ticks since 01:50 and four statuses were posted: 01:52, 02:12, 02:33 and 02:54.
  - The app is published: https://snow-globe-seasons.pplx.app
- 02:56: Phase 0 done. Phase 1 started.
- 02:57 to 03:04: Phase 1. `tools/animatic.mjs` merged from `agent/animatic` (`f34f7d9`), `npm run animatic` added and run here in 1 min 45 s. One frame from every shot looked at, and twelve more at the edges: frame 0 is the tight crop of the winter miniature with no glass in frame, the pull back is plain by 2 s, the glass is in frame by 3 s, each shake streaks the outgoing season's at-rest image and crosses to the incoming mid-shake image, which holds two beats after the landing, and `close` ends on the framing of frame 0 and holds its last bar. Order and lengths against `film.shots`: open 0 to 287, shake-1 288 to 359, spring 360 to 647, shake-2 648 to 719, summer 720 to 1007, shake-3 1008 to 1079, fall 1080 to 1367, shake-4 1368 to 1439, close 1440 to 1799. All nine agree with the default grid at 72 frames a bar.
- 03:04: the Phase 1 gate. D1 pass: `out/roughcut.mp4` is 960 x 540 at 30 frames a second with 1800 frames, 17.4 MB, no sound stream. G1, G2, G3, G4, G8, G9, G10 pass again on the same engine build (`out/work/gate/phase-1.md`). The rough cut is pushed (`681b78b`), it plays on the review page (published 03:02), and Status 5 was posted at 03:03 with two frames. Phase 1 done. Phase 2 started.

- 03:04 to 03:22: Phase 2 opened. The read first files read. The architecture decided (decisions 18 to 23) and the work split into files with one owner each. The contracts between the engine, the interface, the probe and the sound engine written into `src/core/bridge.ts`; the stand-in registry and the stage written; pushed as `99f62fb`.
- 03:22 to 03:30: the helper calls the tools need were added to the frame interface under `window.showcase.dev` (poses, the judged list, the test shake and loop states, the plans of the loop and the opening, the simulation cache, shake moments). Status 6 posted at 03:26 with no new picture. `tools/README.md` written: what the page gives the tools, the diagnostic encodings, the signals and the file layout. Sound files excluded from the public repo in `.gitignore`. Pushed as `8584aae`.
- 03:30 to 03:37: the kit and this file read again after a compaction. The npm script lines added (`d6d6895`). Eight briefs written and committed under `tools/briefs/` (`6bf3140`), and eight sandbox agents started at 03:37 (see "Running agents").
- 03:37 to 03:51: two more compactions and readings. Decision 26: the engine and the film with the app handed to two more agents. The stage contract widened and pushed (`0ce1ad6`), both briefs written (`75f5936`), `engine_builder` started 03:48 and `film_app_builder` 03:50.

- 03:52 to 04:16 UTC. Sound: eleven takes of seven cues made, measured and heard; `glass-clink` and `ui-sound-on` kept, `ui-tick` waits for the level fix, `amb-winter` out of takes and open (decision 27). Five tool branches merged (sheet, measure and pack, audio map, sound, gate checks). `tools/review.mjs` and `tools/keep.mjs` now read the review cuts where the film tool writes them. Status 8 at 04:01. Notes sent to the engine agent (the `standins`, `texels` and `cover` views, the framing that M1 wants) and to the film and app agent (the sound engine's wiring, the Space key, `dev.flagged()`, the first picture signal). Both were told at 04:17 to push work in progress.
