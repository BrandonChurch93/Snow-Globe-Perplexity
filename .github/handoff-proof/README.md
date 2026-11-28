# The helpers of the proof workflow

`.github/workflows/handoff-proof.yml` proves `RENDER-ON-YOUR-PC.md` on real Windows and macOS machines.
It starts by hand. While the handoff was being proven it also started on every push to `agent/p6-handoff`; the
last commit of that branch takes that one line out of the workflow, so in what reaches main it starts by hand only.
The words for a push further down belong to that time.

| file | what it does |
| --- | --- |
| `proof.ps1`, `proof.sh` | run one line of the handoff file exactly as written, again while it answers RUNNING, and note what came of it |
| `flow.ps1`, `flow.sh` | the lines of the handoff file in their order, in Windows PowerShell and in bash (Git Bash on Windows, Terminal on macOS) |
| `engine-hash.mjs` | prints the engine hash of a clone |
| `released.mjs` | says yes or no: whether the stamp of a clone is released for the final render |
| `after.mjs` | lists the Desktop and gathers the reports for the uploaded artifact |
| `verdict.mjs` | reads what the lines did, checks that every line run is written in the handoff file, and writes the verdict |
| `shader-warnings.mjs`, `shaders.sh` | list what the shader compiler of the machine writes about every program of the film, and what the card answers to the maths probe, for one head |
| `still.sh` | in the job of the shader list, draws the guard still of fall at rest in the same clone through Direct3D and keeps the picture and its record in the artifact (folder `looks`), with the walk's two pictures of fall. A step of its own with its own time limit |
| `failed-test.mjs` | after a short test that was made to fail, looks for the one folder it leaves on the Desktop for the build thread and says what it holds; after the test that passes next, makes sure the folder is gone |
| `held-file.mjs` | on Windows, proves that the tool's rename waits for a file another program holds, where a plain rename fails |
| `upload-test.ps1` | the upload's own test in the job `windows-upload-test`: stand-in files to a draft release, read back, the draft removed by its id |
| `other-head.txt` | one line, a branch and a full commit: the head the job `windows-shaders` lists instead of this branch. Comments only means this branch |

The film's clone is made by a plain `git clone` into a folder with a space in its name, under the git defaults of
the machine. These helpers come from a second checkout beside it, so that the clone under test holds nothing the
handoff file did not put there.

The switches of the tool's own tests are set here through one variable. The handoff file never names it.

A word in the message of a push chooses the jobs. `[proof small]` leaves the 3840 jobs out, `[proof 3840]` leaves
the others out, `[proof shaders]` runs only the list of shader messages, `[proof upload]` runs only the upload's
own test, and `[skip ci]` starts no run. A job that is left out still starts, does nothing and ends green.

Hosted macOS machines update Chrome while a job runs. When that stops a render line, `flow.sh` does what the row
of step 2.2 of the handoff file says, as the agent would: the short test again, then the render line again, three
times at most in one job. The verdict lists those lines under names that end in `after-update` and
`test-after-real-update`. The update that the tool's own test makes up (job `windows-gitbash-small`) is a line of
its own and proves the same row on Windows. It is met in the middle of the render, with finished chunks on disk.

The calibration picture is drawn once for a build on the machine and kept. Every small job proves that with
chunks on disk: the first render call is ended when at least two chunks of film B are finished, the short test is
run again (the line `test-in-mid-render`), and the render line then goes to its end, where the films are joined
and proven. The flow notes the sha256 of the kept picture before and after that test, and a test that replaced it
is a `PROBLEM` of the verdict. In a small run the renderer keeps the render's chunks where the test keeps its
own, so the tool sets them aside while a small test runs and puts them back; a real render has a folder of its
own that the test never touches.

A short test that fails is made up too, by a switch that raises the floors of the comparison out of reach. Every
small job runs such a test first (the line `test-fails`), looks into the folder it leaves on the Desktop, runs the
test that passes and makes sure the folder is gone. The job `windows-3840-direct3d11` does it with real pictures
at 3840 x 2160 and runs no passing test: that the same frames pass on the same renderer is proven by the job
`windows-3840`. The 3840 jobs also keep the whole frames the machine drew in the artifact (folder `frames`).

The 3840 jobs end with the render line, which must refuse a stamp that is not released. Once the stamp is released
that line would start the real render on the test machine, so the flows ask `released.mjs` first and leave the line
out then, with a note, and the verdict does not want it. That branch was tried by hand on Linux and in the unit
tests; no run of the workflow has met a released stamp.
