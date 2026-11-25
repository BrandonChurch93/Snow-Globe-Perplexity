# The fresh review before the review stop (project standard, extra final pass)

- Reviewer: `final_pass_reviewer`, a fresh agent in its own VM (Claude Fable 5.2 at max effort), started 22:12 UTC Nov 25, answered 23:15 UTC.
- Given: the request, the project standard's rules, and the delivered output of the frozen build (the built app, the review cut, the card loop, the app's sound files). Not given: the log, the scorecards, the open items.
- Not a kit critic and not part of any round: its score opens no round and closes no gate.
- Its six pictures are kept beside this file's unit in `out/stills/phase-5/final-pass/`.
- What the Builder checked of it afterwards is in the session log of `kit/PROGRESS.md` (the note after 23:15 UTC Nov 25) and in open items 214 to 220.

Its message, word for word, but for the six picture paths at its end, which pointed into its own VM and are given here by file name:

---

FINAL PASS REVIEW from /root/final_pass_reviewer. Written 23:15 UTC, Nov 25 (limit 23:45). One message, complete.

What I judged and how
- The app, opened as a visitor in live mode (no dev hooks, no capture mode), from the local `dist/` build of commit 0f167f9, because the published link https://snow-globe-seasons.pplx.app answers 401 from my machine. Stills at 1920x1080 and 390x844.
- `out/review-four-tracks.mp4`: every frame pulled; the four shakes and arrivals looked at frame by frame in lossless extracts, the rest at 5 a second, at full size and at 400 px wide.
- `card-loop.mp4`: all 240 frames, and the seam.
- I cannot hear. Everything below about sound is measurement, not listening.
- No tracked file changed, nothing pushed, no agents started.

SCORE: 6 / 10

- Rule 1 (product experience, not a marketing site): met, the best of the four. The app is the globe and one bottom bar (four season marks, a Shake pill, a sound button); the only visible word is "SHAKE". No header, tagline, hint text, branding, footer or end card in the app, the film or the loop. Names are in hidden text and ARIA; a status region announces the season.
- Rule 2 (massive credits, highest-quality path): not shown by what was delivered. The app shows the spend (four complete scenes, about 63 MB a session). But the film exists only as the 960x540, 30 fps preview with one of the kit's two soundtrack candidates, the card loop is 960x540 where the kit's setting is hd (1920x1080), and the app's sound set holds 10 of the kit's 20 cues.
- Rule 3 (extremely high quality, everything really works): not met. Every control did its job and no run logged a console error or a failed request. But the season change in the film is a one-frame replacement in all four shakes, the app loads on a blank page, the globe is cut by the screen edge during the shake on a phone, the Shake control was not drawn in two stills where it should be, and the film's sound ends in 0.46 s of digital silence.
- Rule 4 (attractive for social media): partly met. At rest all four seasons are striking, one focal point, readable at 400 px; the arrivals are a real payoff (spring clearing out of the petal mist is the best); the film shows the whole globe by about 2.5 s; hero and controls sit in one desktop viewport and stack cleanly on a phone. Against that: the app's first visible frame is blank, summer reads as snow at feed size, the hero leaves the phone frame in its biggest moment, and a 540p film cannot be posted.

MUST-FIXES, worst first

1. The film is a preview, not something that can be posted. Where: `out/review-four-tracks.mp4`, whole file. 960x540, 30 fps, H.264 at 2.56 Mbps, transfer and primaries untagged. At full size it is soft, with mild contouring in the dark backdrop. In the shakes the globe moves 20 to 27 px a frame while its edges stay almost sharp, so the shake strobes. The kit says the review stop uses the preview format, so this is the expected state of this stop; it still means nothing delivered can go out. Fix: render at `formats.master` (3840x2160), 60 fps, 180 degree shutter, `final` tier; tag bt709 throughout; encode at a high bit rate; make the hd copy from that; then review the shakes again frame by frame at 60 fps.

2. The season change in the film is a one-frame replacement, in all four shakes. Where: same file, lossless extracts. Frames 336 to 337 (11.200 to 11.233 s), 696 to 697 (23.200 to 23.233 s), 1056 to 1057 (35.200 to 35.233 s), 1416 to 1417 (47.200 to 47.233 s). The old base is whole in one frame and gone in the next (brass to moss, moss to shell, shell to woven, woven to brass); the new one arrives under a faint glow that covers nothing. In shake 1 the backdrop lights turn from blue to pink on the same frame. The table dressing is out of step: the winter frost star on the table is gone in one frame at 333 to 334 (11.133 s), three frames before the base; the summer sand goes the same way at 1053 to 1054; the petals appear over frames 338 to 342. The kit asks for the swap "under motion blur, inside a short bloom" and says "Across those few frames the old base gives way to the new". Fix: have both bases present across several frames under real blur and a bloom bright enough to cover the change, or hide it behind the glare at the turn of a stroke; drive base, dressing and backdrop from one window; check it frame by frame at 60 fps. Picture 1.

3. The app's first visible frame is a blank page. Where: local build, 1920x1080 and 390x844, from first paint until the first picture. The page is flat #07080a with nothing on it, plus a pure black 300x150 box in the top left corner (the canvas before it is sized; faint, black on near black, and 77 percent of a phone's width). About 15 MB in 30 to 40 files (14.6 to 16.5 MB by season) arrives before the first picture, so on a phone connection this is seconds of nothing, and it is the opening of any screen recording. Fix: paint a still of the season at rest in the same framing at once (small, as the page background), fade the live picture in over it, keep the canvas hidden until its first frame, and push everything not needed for the first picture behind it. Picture 2.

4. On a phone the globe leaves the screen during the shake. Where: 390x844, Shake press and Space bar, stills mid stroke. The glass reaches about x 418 of 390: the right limb of the glass and the right end of the base are cut by the screen edge; in the second shake the glass is hard against the edge again. At 1920x1080 my three stills of the shake stay in frame, with the top of the glass about 15 px from the top edge. Fix: on narrow screens scale the stroke to the free margin, or pull the camera back for the bar of the shake, so glass and base keep a margin at the extremes; check the top of the lift on desktop too. Picture 3.

5. The Shake control goes missing. Where: 390x844, two separate stills. (a) With keyboard focus on Shake (Tab five times), the pill, its label and its focus ring are not drawn at all, while the marks and the sound button beside it are. (b) After the landing that followed a press on the Winter mark, the Shake pill is again not drawn; one still later it is back. In two more runs, one at 1920x1080, its computed opacity read 0 at rest after the first picture. What I measured in the page: when the hint pulse ends, the control's animation falls back to its arrival animation (700 ms, opacity 0 to 1), which starts again from 0. On my machine one frame lasts 20 to 60 s, so I cannot say how long it lasts on a GPU; I expect the primary control to blink out and fade back over about 0.7 s, about 7 s after the first picture, and again after some landings. At 1920x1080 the focus ring on Shake did show in one still. Fix: stop the arrival animation from running a second time (clear it when it ends, or run the pulse on an inner element), then record the first 15 s and a mark change on a real device. Picture 4.

6. Summer reads as snow at feed size. Where: the film at 26 to 34 s (for example 33.0 s) at 400 px; the app at `?season=summer`, both sizes. The dandelion seeds are large white six-armed starbursts; small, they are snowflakes over a summer garden, and the app has more of them than the film. The approved summer image has fine green-gold points and a pool of caustic light on the table; the delivered caustic is a thin bright scribble. Fix: make the seeds smaller, fewer and warmer, with a shape that cannot be read as a flake, let the firefly points carry the air, and rebuild the caustic toward the approved image. Picture 5.

7. The film's sound (measured, not heard). Where: the sound stream of `out/review-four-tracks.mp4`.
   (a) 59.556 s to the end is exact digital zero, 0.455 s: a hole if the film loops or is cut tight.
   (b) The shake bars into fall and into winter run down to nothing: the last 0.2 s before landings 3 and 4 measure -53 and -71 dB, with 27 ms of exact zero at 47.969 to 47.996 s, where landings 1 and 2 hold -35 to -40 dB. The kit lets the music thin out there, but it also puts a shake sound and crossfading ambience under every shake bar. The shake bar into spring carries 7 to 12 dB more energy above 8 kHz than the other three, which fits with only spring having a shake sound (see 8).
   (c) Landings 3 and 4 start 8 to 10 dB lower than 1 and 2 (-20 and -18 dB against -11 and -10 dB in the first 50 ms).
   (d) The first 2.6 s measure -28 dB RMS, about 10 dB under the holds (-17 to -18.5 dB): regular ticks 0.26 s apart and no music until about 2.7 s. That is a quiet opening in the seconds that decide a feed view.
   (e) True peak -0.8 dBTP against the kit's ceiling of -1. The left channel is 1.4 dB hotter than the right over the whole film.
   (f) Only `four-tracks` exists; the kit's `audio.candidates` are `one-piece` and `four-tracks`.
   What is right: -14.0 LUFS integrated, range 4.7 LU, no clipped samples, and a clear new sound starts at each landing (11.95, 24.00, 36.00, 48.00 s).
   Fix: let the last bar ring to the last frame; keep ambience and each season's shake sound under every shake bar; match the four landings in level; bring the music in on frame 0; limit to -1 dBTP after encoding; centre the mix; make the second candidate; have a person listen. Picture 6.

8. The app's sound set is short of the kit's list (measured, not heard). Where: `public/audio/`, 7 files, 3.02 MB (under the 8 MB cap). Of the kit's 20 cues, 10 are there. Missing: `shake-winter`, `shake-summer`, `shake-fall`, all four `land-<season>`, `amb-winter`, `amb-fall` (and `key-tap`, which is for film A). So only spring has its own shake sound, no landing has its own sound, and winter, the first thing a visitor sees, has no ambience. Two loops change level at the seam: `music-winter` ends at -17.8 dB (last second) and restarts at -32.0 dB (first second), a 14 dB dip every 19.2 s; `music-summer` ends at -35.1 dB and restarts at -15.7 dB (50 ms each side). No clipping (peaks -3.1 to -3.4 dBFS), and no sample jump at any loop seam large enough to click. Fix: make the missing cues; shape each loop so its last bar hands back to its first at the same level.

9. The card loop is half the specified size. Where: `card-loop.mp4`: 960x540, 30 fps, 240 frames, no sound. The kit's setting is hd (1920x1080) plus a 1280 web copy. The content is right (winter at rest, shake at 0.8 s, storm, settling), with no text. I see no jump at the seam: the last frame against the first differs about twice as much as neighbouring frames (2.64 against 1.1 to 1.4 grey levels on average), spread evenly over still detail, which looks like the encoder's key frame, not a jump in the picture. Fix: render at hd at the `final` tier, make the web copy from that, and prove the seam on rendered frames.

Smaller things
- App, 390x844: `?mode=autopilot` and `?mode=loop` show the 16:9 picture as a 390x219 band, with about 37 percent of the screen empty above and below.
- App: the controls dim to 36 percent when the pointer is still (the kit asks for this). In a feed recording the unselected marks and the sound button nearly vanish; raise the floor.
- App, 390x844: the top quarter of the screen is flat dark, with one backdrop light cut in half by the left edge at y 237.
- App: the time step is capped, so on a slow machine a shake takes 17 to 20 frames however long each takes; there is no fallback when frames take seconds.

What worked when I tried it (stills and page state)
- Each season by link at 1920x1080 (spring, summer, fall; winter as the default load) and `?season=winter` at 390x844.
- Shake press and Space bar: controls disable and dim, lift, storm, base and dressing change, landing, the mark moves, the status region announces the season.
- A season mark pressed from another season plays a shake to that season; a second mark pressed during the shake is ignored.
- A drag outside the glass turns the camera around the globe, and it returns on release.
- The sound control flips `aria-pressed` and its icon changes to a muted speaker and back.
- Tab order: winter, spring, summer, fall, Shake, sound, then wraps; a 2 px light ring shows on the marks.
- `?mode=probe` shows a clean frame-rate panel.

WHAT I COULD NOT CHECK, AND WHY
- Sound by ear, anywhere. Measured only.
- Live motion, smoothness, the automatic quality step-down and real animation timing: no GPU, one frame every 20 to 60 s. Interaction stills were taken with Quality set to low in the owner menu (M) so that a shake would finish; the at-rest stills of each season were taken at auto.
- The published link (401). Everything about the app is from the local build of 0f167f9.
- The stir: after a touch drag across the glass at 390x844, three stills show the scene settling and no swirl I can attribute to the stir. My machine gives the app at most one pointer sample a frame, so this proves nothing either way; check it on a device.
- Reduced motion: a press gave no lift and no shake and started a speckled dissolve; nine frames later the controls were still disabled and the season had not changed, so I did not see it finish.
- `?mode=autopilot` and `?mode=loop`: two stills each, at 390x844 only; not watched through, not at 1920x1080.
- Loading on a slow network: not run; judged from an unthrottled local load and the byte counts.
- At 1920x1080: the shake from three stills and its landing only; season marks, stir, drag, the sound control and reduced motion were tried at 390x844 only.
- Device motion, real touch, and the 1024x1366 tablet size.
- The masters, film A with the prompt opening, and the second soundtrack candidate: not delivered.
- Whether the loop's seam is exact to the pixel: the file is lossy.
- Disclosure: I resolved the kit's keys from `config/showcase.json`. And a text search I ran over `kit/` for one of those keys printed about a dozen truncated lines of `kit/PROGRESS.md` into my terminal; some of them concern the base change in the shake. I did not open the file. Finding 2 was already recorded from the frames before that search, and rests on Picture 1.

PICTURES (six, attached)
1. `film_shake_swap_one_frame`: film, shakes 1 and 3, consecutive frames, lossless: frost star gone 333 to 334, base replaced 336 to 337 and 1056 to 1057.
2. `app_loading_blank`: app while loading at 1920x1080 and 390x844, as shown and brightened 12 times: blank page, black 300x150 box.
3. `phone_shake_clipped`: app at 390x844, live shake: lift; mid stroke with glass and base cut by the right edge; second shake against the edge.
4. `phone_shake_control_missing`: app at 390x844, bottom bar at 2x: focus on Winter (ring shown); focus on Shake (control not drawn); after a mark change (Shake not drawn).
5. `cmp_summer_rest`: summer at rest: approved image, film at 33.0 s, live app.
6. `film_sound_spectrograms`: film sound around the four landings, the start, and the silent end.
