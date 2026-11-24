# Audio notes · planning

Status: superseded on 2026-11-23 by the build kit in `kit/`. Kept as a record of the planning. Where this note and the kit differ, the kit wins. The music is now made by the build and approved by Brandon at the review stop, as `kit/01-FILM.md` says.

## ElevenLabs

Brandon has ElevenLabs available for this project. It generates sound effects, ambient soundscapes, instrumental music and voiceover from text prompts. Whether the connector is live in the Computer workspace has not been verified. The kit's first phase checks it with one short test call. Audio never blocks a build gate.

## Planned use in the snow globe film

- The shake: a liquid swirl with glass and particle detail, one version per season.
- The landing: a sound when the particles settle and the new season is revealed.
- Ambient bed per season:
  - Winter: wind and distant bells.
  - Spring: birds and light rain.
  - Summer: crickets and warm air.
  - Fall: wind, dry leaves and a low eerie tone.
- Small details: a glass clink, a music box mechanism.

## Music

- Four tracks, one per season, joined together. Each shake whiteout is the splice point.
- The film is cut to a map of the audio, with the shakes on the beat.
- Source is open. Brandon has not found tracks yet and is leaning toward generating all four with ElevenLabs if the quality holds up. Supplied tracks remain the fallback.
- Direction per season, from Brandon:
  - Winter: Christmas sounding music.
  - Fall: a Halloween track with eerie sound effects in it.
  - Spring and summer: something in the same spirit that fits each season.
- If generated: instrumental, all four at a matching tempo so every shake lands on the same rhythm, each cut to the exact length of its season.

## Rules for generated sounds

- At most 3 takes per sound. Keep the best.
- Each file is stored with its prompt beside it and listed in ASSETS.md.
- A sound that fails after 3 takes becomes an open item and the build continues.

## Render

- Frame rate in the live page does not matter. The final video is rendered frame by frame at 60 fps in 4K, as on the PC builder film.
- So the film can carry heavy motion, especially dense particles inside the globe.
