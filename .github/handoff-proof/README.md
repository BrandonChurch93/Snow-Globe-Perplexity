# The helpers of the proof workflow

`.github/workflows/handoff-proof.yml` proves `RENDER-ON-YOUR-PC.md` on real Windows and macOS machines.
It runs only on a push to `agent/p6-handoff` and by hand, never on main.

| file | what it does |
| --- | --- |
| `proof.ps1`, `proof.sh` | run one line of the handoff file exactly as written, again while it answers RUNNING, and note what came of it |
| `flow.ps1`, `flow.sh` | the lines of the handoff file in their order, in Windows PowerShell and in bash (Git Bash on Windows, Terminal on macOS) |
| `engine-hash.mjs` | prints the engine hash of a clone |
| `after.mjs` | lists the Desktop and gathers the reports for the uploaded artifact |
| `verdict.mjs` | reads what the lines did, checks that every line run is written in the handoff file, and writes the verdict |

The film's clone is made by a plain `git clone` into a folder with a space in its name, under the git defaults of
the machine. These helpers come from a second checkout beside it, so that the clone under test holds nothing the
handoff file did not put there.

The switches of the tool's own tests are set here through one variable. The handoff file never names it.
