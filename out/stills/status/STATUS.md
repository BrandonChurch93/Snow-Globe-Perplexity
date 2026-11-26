# Status 145

2026-11-26 07:56 UTC

- Rough draft 1 of the film is shared in this thread: 74 seconds, 960 x 540 at 30 frames a second, with the prompt opening and sound. Eight machines drew its 60 seconds of globe in about 10 minutes each.
- What is wrong in it and already being worked on: at each change of season a pale disc hides the globe for about a quarter of a second; the grain and rough edges of the fastest quality setting; a pale haze in summer for about a second after it lands.
- Merged since the last status: particles near the lens are drawn whole under the new renderer (their sides were being cut off), the stricter shader check, and the tool that renders the 4K films. Types are clean and 613 tests pass.
- The 4K films keep 24 samples on every frame. Measured cost: 129 seconds for a frame at rest, more in a change of season, so film B is on the order of 150 machine hours once the build is frozen. Their encode is being rebuilt so the picture cannot pulse twice a second: each film is encoded once, whole, from near lossless pieces.
- Next: the mends of the change of season, the first frame, the framing on phones and the controls are due between 08:15 and 08:45 UTC. Then the app is published again and fresh critics judge the changed parts.
- phase 6: 5.11 h used of its 12.00 h box
- allowance (after the review): 5.11 h used of 12.00 h allowed
- App: https://snow-globe-seasons.pplx.app
- Review page: https://snow-globe-seasons.pplx.app/review.html

- `out/stills/status/status-145-1.jpg`: Rough draft 1, the four seasons at rest: winter, spring, summer, fall. Fastest quality setting, 960 x 540.
- `out/stills/status/status-145-2.jpg`: Rough draft 1, eight seconds in: the prompt being typed.
- `out/stills/status/status-145-3.jpg`: The fault in this draft, six frames across the first change of season: the pale disc hides the globe for a quarter of a second. Its mend is due at 08:15.
