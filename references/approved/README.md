# Approved images

Brandon approved these on 2026-11-23, as round 2 of the reference run kept them. They are the target for the build. `kit/06-ASSETS.md` says how each is used.

Each is a byte for byte copy of a file in `references/drafts/round2/keep/`. All eight were made with Seedream 5 Pro at 2816 x 1584.

| File here | Copied from | What it shows |
| --- | --- | --- |
| `winter-rest.png` | `keep/01-winter-rest.png` | Winter at rest. The anchor of the set |
| `spring-rest.png` | `keep/02-spring-rest.png` | Spring at rest |
| `summer-rest.png` | `keep/03-summer-rest.png` | Summer at rest |
| `fall-rest.png` | `keep/04-fall-rest.png` | Fall at rest |
| `winter-shake.png` | `keep/05-winter-shake.png` | Winter an instant after a shake, the liquid still turning |
| `spring-shake.png` | `keep/06-spring-shake.png` | Spring an instant after a shake |
| `summer-shake.png` | `keep/07-summer-shake.png` | Summer an instant after a shake |
| `fall-shake.png` | `keep/08-fall-shake.png` | Fall an instant after a shake |

`contact-sheet.jpg` shows all eight on one sheet. It was made for the first status of the build and is not a target.

`MANIFEST.sha256` pins every file. The build checks it at the start of every task and refuses to start if a hash does not match. Nothing in this folder is ever regenerated, replaced or retouched.

The prompts, the other takes, the faults the reference run found in these images and the real photographs it studied are in `references/drafts/round2/NOTES.md`. The faults that the build must not copy are listed as settled differences in `config/showcase.json`.

Round 1 of the reference run, with the globe in a room by a window, is in `references/drafts/`. It was not approved and is not a target.
