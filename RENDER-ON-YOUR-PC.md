# Render the film on this computer

This file is for a coding agent working on Brandon's own computer. Follow it from the top, alone.
Another agent leads the project from far away and cannot see this machine.

The film is Snow Globe Seasons. Its release files are drawn at 3840 x 2160, 60 frames a second, on the
graphics card of this computer. This file makes four files on the Desktop:

| file | what it is |
| --- | --- |
| `Snow Globe Seasons - With Prompt - 3840x2160.mp4` | the film with its opening, 4,467 frames, with sound |
| `Snow Globe Seasons - Without Prompt - 3840x2160.mp4` | the film alone, 3,600 frames, with sound |
| `Snow Globe Seasons - Portfolio Looping Video - 3840x2160.mp4` | the loop, 480 frames, no sound |
| `Snow Globe Seasons - Portfolio Screenshot - 3840x2160.png` | the first frame of the loop |

With Brandon's yes, step 2 also sends copies of them to the remote team (2.5).

On Windows, Chrome draws the film through Direct3D 11. Before this file existed, the film's pictures had been
measured on Linux only, drawn in software. Step 1 is the first time this film is drawn by a Windows graphics
card. That is why step 1 draws a little, compares it, reports and stops.

## What Brandon says to the agent

Brandon saves this file into a folder of his choice, starts the agent in that folder and says: "Follow the file
RENDER-ON-YOUR-PC.md in this folder from the top, alone and exactly as written. Do step 1 only, then stop and give
me its report."

If an agent ends in the middle of the work (its window was closed, it stopped answering, the computer was
restarted), nothing is lost. Brandon starts a new agent in the same folder and says: "Read the file
RENDER-ON-YOUR-PC.md in this folder. Do what its part If you are started in the middle says, and nothing else."

Which copy of this file rules. Brandon's saved copy starts you. The clone of 1.2 holds its own copy, in the folder
`Snow-Globe-Perplexity`. Once the clone is there, its copy rules: read it there, and read it again after the pull
of 2.1, which may bring a newer one. Carry on in the newer copy at the step you had reached.

## Rules for the agent

1. Do not edit any file of the repo. Do not repair code, shaders, settings or tests. A fault is mended by the remote
   team. A shader that does not compile is such a fault: copy its message whole into what you give Brandon.
2. Do not commit and do not push. One line of this file writes to GitHub: the upload of 2.5. Run it only after
   Brandon has said yes to it and his yes is recorded by the approve line of 2.5.
3. Run only the commands written in this file, exactly as written, one line at a time. Use no other switches,
   set no variables, and do not join lines with `&&` or `;`. Two lines hold the place `<his words>`, the approve
   lines of 2.2 and 2.5: there you put the words Brandon wrote in the chat, and nothing of your own. Beyond these
   lines you do one thing only: you may open a report file this file names with your own file reader, to give
   its text to Brandon.
4. Ask Brandon only for a password, a sign in, or a system prompt that asks for his leave, and for what this file
   tells you, word for word, to ask him. Ask him nothing else and decide nothing for him.
5. When a line ends in `FAIL:`, look for its sentence in the table of the step you are in, and do the one thing
   that row names, as often as the row says and no more. If no row fits, or the row says stop: stop. Give Brandon
   the report whole, from the file whose whole path the tool printed in its line `THE REPORT`, and wait. Do not try
   another way.
6. Do step 1, then stop. Do step 2 only when Brandon says so in his own words, after step 1 has passed. You never
   decide that for him and you never write his words for him.
7. While a line answers `RUNNING:`, do not end your turn and do not start another line beside it. Run the same line
   again until it answers `PASS:` or `FAIL:`. If your turn ends against your will, nothing is lost: the work goes
   on, and the part "If you are started in the middle" brings a new agent back to it.
8. Change no setting of Windows, of the graphics driver or of Chrome, and no registry value. Where a report names a
   setting, it is for Brandon to change.
9. Never mix the work of two computers. Copy nothing from another machine into the clone's folder `out`. The tool
   refuses frames that another graphics card drew.

## How every command here behaves

- Work in Windows PowerShell: it is on every Windows machine. Git Bash does as well once Git is installed, and
  every line is the same in both.
- Give every command a time limit of 10 minutes (600000 ms). No command here needs more in one go.
- Each `node tools/handoff.mjs` line answers inside that limit, and its last line is one of three words and a
  sentence:

| last line starts with | exit code | what it means | what to do |
| --- | --- | --- | --- |
| `PASS:` | 0 | the step is done and good | go to the next line of this file |
| `RUNNING:` | 3 | the work goes on in the background and nothing is wrong | run the very same line again, as often as it takes. Start nothing else in between |
| `FAIL:` | 1 | the step did not pass | rule 5: the row that fits, or stop and give Brandon the report |

- Just above its last line each line prints where its files are, each by its whole path: always `THE REPORT`, and
  after the short test also `THE TEST FILM`, `THE SHEET OF PICTURES` and, when it failed, `THE FOLDER TO SEND`.
  When you tell Brandon where a file is, give him the path as it was printed. Never give a name or a folder you
  assume.
- The report is also printed, between `===== REPORT: ... =====` and `===== END OF REPORT =====`. The tool writes
  its reports itself, as plain UTF-8 text. Do not send a command's output into a file of your own.
- Long work (setup, test, render, check, upload) runs in a process of its own. If a line is cut off by a time
  limit, or the terminal is closed, the work goes on. The same line run again follows it. Nothing is started
  twice and nothing finished is done again.
- Every `node tools/handoff.mjs` line is run inside the clone's folder `Snow-Globe-Perplexity`. If node answers
  `Cannot find module` with a path that ends in `tools\handoff.mjs` or `tools/handoff.mjs`, you are not inside
  the clone. Do what "If you are started in the middle" says; it finds the folder or tells you to stop. If your
  shell forgets the folder between two commands, name the clone's folder as the working folder of each command
  in your own tool. Do not join lines to get there.
- Do not use WSL. The tool refuses to run in any Linux layer on Windows, because the film must be drawn by the
  Windows graphics driver.

### Stop and recovery, one rule

A word was stopped when its last line says `FAIL: "<word>" was stopped before it ended` (the computer slept or
restarted, a window was closed, a process was ended), or when your own command was cut off before any last line
came. For each word this table is the whole rule. The tables of the steps name the same acts.

The tool counts the stops of a word itself, and it never starts stopped work again in silence: the line that
finds the work gone says so with this `FAIL:`, and the same line run again carries on. When a word was stopped
as often as its row allows, the `FAIL:` ends with `Do not run the line again: stop and give Brandon the report`.
That sentence rules. `status` then names no next line.

When a line finds stopped work, it first ends what that work left behind, and says so in a line that begins
`MEASURED: ended` and ends `left by the handoff`. When the tool clears stopped work, it only ends a tool it
started itself and a browser it recorded with this clone's own profile, each known by its process number and
the time it was started. Do not close another Chrome window or process yourself.

Every start of the tool ends with one last line, `RUNNING:`, `PASS:` or `FAIL:`, inside ten minutes. Work that
died without a last word of its own leaves a `FAIL:` too, and the line `THE REPORT` beside it names a report that
holds the last lines the work wrote. A word that does its work inside the line itself (doctor, approve, deliver,
clean) and has not ended after 9 minutes ends itself with `FAIL: "<word>" did not end within 9 minutes ...`. That
is a stop: give Brandon its report.

| word | the one line that carries on | how often | stop and report when |
| --- | --- | --- | --- |
| `setup` | `node tools/handoff.mjs setup` | once more | it is stopped a second time, or it ends in any other `FAIL:` |
| `doctor` | `node tools/handoff.mjs doctor` | once more | it is stopped a second time, or its `FAIL:` has no row in 1.4 |
| `test` | `node tools/handoff.mjs test` | once more, and only when it was stopped | it is stopped a second time. A test that ended in any other `FAIL:` is not run again, but for the one case 1.5 names, and then only on Brandon's word |
| `approve` | `node tools/handoff.mjs approve render <his words>` or `node tools/handoff.mjs approve upload <his words>`, with the words Brandon wrote in the chat (2.2, 2.5). It draws nothing and sends nothing | once for each yes of Brandon's, and once more when it was stopped | it is stopped a second time, or its `FAIL:` has no row in 2.2 or 2.5 |
| `render` | `node tools/handoff.mjs render`. It carries on from the last finished frames | once more after each stop | it is stopped twice with no more frames done in between (every `RUNNING:` line says how many are done), or a row of 2.2 says stop |
| `check` | `node tools/handoff.mjs check` | once more | it is stopped a second time, or it ends in any other `FAIL:` |
| `deliver` | `node tools/handoff.mjs deliver` | once more, and once more after Brandon has closed a player (2.4) | any other `FAIL:` |
| `upload` | `node tools/handoff.mjs upload`. It sends only what is missing | up to two more times | it fails three times in a row, or a row of 2.5 says stop |
| `clean` | `node tools/handoff.mjs clean` | once more, and once more after the delivery line when a row of 2.6 says so | any `FAIL:` that has no row in 2.6 |
| `status` | `node tools/handoff.mjs status`. It only reads, and may be run at any time | as often as needed | it answers `Cannot find module` inside the folder `Snow-Globe-Perplexity` |

Two answers are no stop:

- `RUNNING:` is the answer of work that goes on. Run the same line again.
- `FAIL: "<word>" is still at work in the background` says that another word of the tool is still at work, which
  can happen after a restart of the agent. Nothing is wrong. Run the line that sentence names until it ends, then
  go on where you were. This is the one `FAIL:` that needs no report.

## If you are started in the middle

Do this when you are a new agent and the work was begun before you (Brandon tells you so), or when you do not
know where the work stands. Start nothing by a guess: not the render, not the setup.

```
node tools/handoff.mjs status
```

- It ends with `PASS: this is the clone of the film, at ...`. You are inside the clone. Its report says how each
  word last ended here, and its line `NEXT LINE:` names the one line that carries on. Read the clone's copy of
  this file, go to the step that holds that line, and carry on there by its rules. If it says `NEXT LINE: none`,
  do what the sentence beside `WHERE THE WORK STANDS:` says. Mostly that is: give Brandon a report and wait.
- node answers `Cannot find module`. You are not inside the clone. Run the line below once, then the status line
  again.

```
cd Snow-Globe-Perplexity
```

- The `cd` line fails because there is no such folder: nothing was cloned here. Begin at 1.1.
- The status line answers `Cannot find module` inside that folder too: the folder is no whole clone. Stop and
  report. Delete nothing.

## Step 1 on Windows: install, check, short test, report, stop

Step 1 draws about two seconds of the film and nothing more. It may be run before the film is released.

### 1.1 The two programs everything else needs

```
git --version
node --version
```

Good: `git version 2.25` or newer, and `v20.19` or newer of 20, `v22.12` or newer of 22, or `v24` and up.

Bad, and what to do:

- git is not found or too old. Run:

```
winget install --id Git.Git -e --source winget --accept-package-agreements --accept-source-agreements
```

- node is not found or too old. Run:

```
winget install --id OpenJS.NodeJS.LTS -e --source winget --accept-package-agreements --accept-source-agreements
```

A winget line is good when its last line is `Successfully installed`, or
`No newer package versions are available from the configured sources.` (the program was there already; winget
ends with an exit code that is not 0 then, and that is no failure). Windows may show a prompt that asks for leave
to install: that is for Brandon to answer.

After a good winget line, ask for the version again. A program installed a moment ago is found only by a terminal
opened after the install. If `git --version` or `node --version` still finds nothing, or still answers with a
version that is too old, do not install again and do not look for another copy. Stop and tell Brandon, word for
word: "Git or Node was installed just now, and this terminal does not see the new one yet. Close this terminal
window, open a new one, start the agent again and give it the same task. Nothing is lost." Then wait.

If the version is still not found or still too old after that new start, an older copy on this machine comes
first. Stop and report the line and its answer. Do not remove or move anything.

If a winget line ends in anything else than the two good last lines, stop and report its last lines. If `winget`
itself is not found, stop and report that.

### 1.2 The clone

First find out where you stand:

```
node tools/handoff.mjs status
```

- node answers `Cannot find module` with a path that ends in `tools\handoff.mjs` or `tools/handoff.mjs`: you are
  not inside a clone yet. At a first start that is the answer to expect. Go on with the three lines below.
- It ends with `PASS: this is the clone of the film, at ...`: you are inside the clone already, because you were
  started again. Skip the three lines below and go to 1.3.

```
git clone --filter=blob:none --single-branch --branch main https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git Snow-Globe-Perplexity
cd Snow-Globe-Perplexity
node tools/handoff.mjs status
```

Good, all three together: the clone line ends with exit code 0 (it takes a minute or two), the `cd` line gives
no error, and the status line ends with `PASS: this is the clone of the film, at ...` and the folder. That last
line is the proof that the tool stands in the folder. The clone is not judged by the words git prints.

Bad, each with the one thing to do:

| what you see | do this |
| --- | --- |
| the clone line says `fatal: destination path 'Snow-Globe-Perplexity' already exists and is not an empty directory` | the folder is here from an earlier start. Run the `cd` line and the status line. The status line says whether it is whole |
| the status line, run inside the folder, answers `Cannot find module` | the folder holds no tool: a clone that was cut off, or a folder of another kind. Stop and report. Delete nothing and do not clone again |
| the clone line says `fatal: Authentication failed`, `fatal: repository ... not found` or `fatal: could not read Username` | the sign in, below |
| the clone line ends with any other `fatal:` line or any other exit code than 0 | stop and report its last lines. Delete nothing |
| the `cd` line fails | there is no folder, so the clone did not happen. Stop and report |

Run the clone in the folder you were started in. A folder with spaces in its name is fine. Everything the render
writes goes into the clone, so the clone must lie on a drive with room: the doctor of 1.4 says how much is needed
and how much is free there. If it is too little, that is for Brandon: he starts you again in a folder on a larger
drive, and you begin at 1.2 there.

The sign in. The repo may be private by the time you read this. Then git needs Brandon's GitHub account once:

- Git for Windows opens a small window by itself that says `Connect to GitHub`. Tell Brandon, word for word:
  "A GitHub sign in window has opened. Please sign in." Wait for the clone to end. Git keeps the sign in, and no
  later line asks again.
- If no window opens and the clone ends with one of the three `fatal:` lines of the table, stop and tell Brandon,
  word for word: "The clone needs your GitHub sign in and no window opened here. Please open a PowerShell window
  of your own in this folder, run the clone line below, sign in when it asks, and tell me when it has ended."
  Give him the clone line and the whole path of the folder you are in. When he says it is done, run the `cd` line
  and the status line, and judge them as above.
- After a sign in that failed, git takes its unfinished folder away by itself. If a folder is left all the same,
  the first two rows of the table say what you see and what to do. You delete nothing; a broken folder is for
  Brandon to remove.
- What is known of this: the clone of the public repo was run on Windows and macOS test machines and asked for no
  sign in. The sign in of a private repo was tried on no test machine, because it needs Brandon's own account.

### 1.3 Setup: the packages and the build

```
node tools/handoff.mjs setup
```

Good: `PASS: the packages are installed and the build is made, engine <16 signs>, the stamp's`. A few minutes.
The 16 signs are the engine hash: a sum over everything that draws the film. `the stamp's` says it is the same
hash that `render/STAMP.json` in the clone records, so this clone draws the film the references were made from.

The setup works in the background. While it works it answers `RUNNING:`: run the same line again each time,
until its last line is `PASS:` or `FAIL:`.

Bad, each with the one thing to do:

| the last line says | do this |
| --- | --- |
| `FAIL: "setup" was stopped before it ended` (sleep, a restart, a closed window), or your command was cut off | run the same line once more. If it is stopped a second time, stop and report |
| any other `FAIL:` with the reason | stop and report |

### 1.4 The doctor: what this machine is

```
node tools/handoff.mjs doctor
```

It reads the processor, the memory, every video card with its driver, the system, the tools, the free disk on the
drive of the clone and on the drive of the Desktop, and whether Windows waits for a restart, from the machine
itself and prints them. It opens Chrome in a window, as the render will, and prints what draws the page.
A Chrome window opens and closes by itself. Do not touch it.

Good: `PASS: this machine can draw the film: ...` with the name of the graphics card that draws.

The doctor reads the video cards from Windows and the name of what draws from the page itself. The page must draw
on the strong card of this machine (an NVIDIA card before an AMD one, and of two cards of one maker the one with
more memory), named by the model words the system gives it. Nothing about the card is written into the tool.

A report may end with a block `TO LOOK AT`, each of its lines beginning with `LOOK`. That is no failure and you go
on. Give the block to Brandon with the report, as it is.

Four of these lines bear on a render of hours. You mend none of them and change no setting for them. Brandon
reads them, and his yes for the full render (2.2) covers the ones that are still open then:

- `this machine runs on its battery now ...`. A render of hours needs mains power.
- `Windows waits for a restart ...`. A restart in the middle stops the render. Brandon restarts the computer when
  he chooses. After a restart a new agent begins at "If you are started in the middle".
- `the Desktop of this machine is inside OneDrive ...`. The test film, the sheet of pictures and the four files
  are written into a folder that OneDrive copies to the cloud.
- `the version of the card's driver could not be read ...`. The tool then cannot see a driver that is updated
  between the test and the render.

Under its table the doctor also prints what the shader compiler of this machine wrote about the film's shaders,
and what the graphics card answers to a list of small sums (the maths probe). Both are for the remote team. They
are marked `noted` and fail nothing: a shader that warns still compiles and draws. Only a shader that does not
compile fails the doctor, and then its message is in the report in full.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| ffmpeg or ffprobe is missing or too old | run the ffmpeg line below, then the doctor again |
| Chrome is missing or too old | run the Chrome line below, then the doctor again |
| the page draws in software | stop and report. The film is never drawn in software |
| the page draws on another card than the strong one | stop and report. The report says which Windows setting Brandon can change. When Brandon says he has changed it, run the doctor line again and go on from there |
| too little free disk, on the drive of the clone or on the drive of the Desktop | stop and report. The report says how much is needed and on which drive |
| the engine hash differs from the stamp's | stop and report. Do not pull, reset or edit anything |
| this is WSL or another Linux layer | stop and report. Open PowerShell or Git Bash on Windows itself |
| `"<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the doctor again |
| anything else | stop and report |

```
winget install --id Gyan.FFmpeg -e --source winget --accept-package-agreements --accept-source-agreements
winget install --id Google.Chrome -e --source winget --accept-package-agreements --accept-source-agreements
```

The doctor names one missing program at a time. If both are missing, it names ffmpeg first and Chrome after it:
install what it names, then run the doctor again, each time.

The tool looks in the places winget installs to, so after a good winget line run the doctor again in the same
terminal. If the doctor says the same thing again after a good winget line (the program is still not found, or an
older copy still comes first), do not install a second time: stop and report. A winget line that ends in anything
else than the two good last lines of 1.1 is also a stop and report.

### 1.5 The short test

```
node tools/handoff.mjs test
```

It draws a few single frames and about two seconds of the film at 3840 x 2160, at the quality of the final
render and through the same code. It compares the frames with reference pictures, joins the two seconds into a
short film, and measures how long the whole render will take here. Before it draws it prints how long the test
itself is expected to take. Chrome windows open and close by themselves. Do not touch them. The tool keeps the
computer awake by itself while it draws; you change no power setting.

It answers `RUNNING:` every few minutes: run the same line again each time.

Before you run it, tell Brandon, word for word: "The test opens Chrome windows for some minutes. Please do not
minimize them, do not lock the screen and do not start a game until I say it is done."

How the frames are compared, and why so:

- The reference pictures were drawn on a Linux machine in software. A graphics card under Direct3D 11 (Windows)
  or Metal (macOS) rounds its sums a little differently, so the same frame comes out a level or two apart in many
  pixels and further apart along thin bright edges. A frame is therefore never asked to be equal to its reference.
- Each frame is measured three ways. The whole picture at half size, and two cuts of 960 x 540 at full size, must
  each reach a floor in PSNR (how close the pixels are, in dB, higher is closer). The same pieces must reach a
  floor in a coarser measure, the PSNR of the means of 8 x 8 pixel blocks, which a shift of one pixel hardly
  moves. A region of the glass must keep its mean brightness and must not turn white.
- The floors are written in `render/STAMP.json` and printed in the report beside every number: 38 dB for the
  whole picture and 40 dB for it in blocks, 40 dB for a cut and 44 dB for it in blocks. The glass region may lie
  0.01 from its reference in brightness (on a scale of 0 to 1) and may hold half a percentage point more of near white
  (of every 1,000 pixels of the region, 5 more than in the reference).
- Why these: the same frames were drawn at 3840 x 2160 on two test machines, through Direct3D 11 on Windows and
  through Metal on macOS, and compared with the references. Each of the four floors in dB is the midpoint,
  rounded to a whole dB, between a wrong picture and the careful case of a right one, both at film B frame 720:

  | measure, in dB | wrong picture | careful case | midpoint | floor |
  | --- | --- | --- | --- | --- |
  | the whole picture | 36.83 | 39.15 | 37.99 | 38 |
  | the whole picture in blocks | 38.44 | 42.08 | 40.26 | 40 |
  | a cut | 38.42 | 41.84 | 40.13 | 40 |
  | a cut in blocks | 40.68 | 46.99 | 43.84 | 44 |

  The wrong picture is that frame from an engine one small mend apart. It fails all four floors. The careful case
  is a card that stands as far from one test machine as the other test machine does, with that distance on top of
  the one measured to the reference. On the two test machines themselves a right picture reached 40.5 dB or more
  for the whole picture, 43.1 in blocks, 43.1 for a cut and 47.9 for a cut in blocks, and its glass lay within
  0.001 of the reference. A frame that is wrong in a bigger way (a layer missing, white glass, a flat or empty
  picture) falls far under the floors. Every measure behind the table, the run that made it and how the careful
  case is worked out stand in `render/STAMP.json` under `floorsFrom`, so the floors can be worked out again.
- Some fine noise in the film (the runs of water on spring's glass, the grain of moss, the lumps of the table,
  sparkles) is worked out by the graphics card itself, and each kind of card works it out a little differently.
  Such a place looks the same in kind on every machine and has its streaks and grains at other places. So the
  film this computer renders carries its own card's pattern there, not the cloud's. Of the frames measured, the
  one with spring's wet glass stood nearest its floors, on both test machines.
- Those two test machines have no real graphics card, so no NVIDIA card was measured. No real graphics card has
  drawn a reference of this film yet: step 1 on this computer is the first time, and that is not known to go well.
- Which frames this test compares is written in `render/STAMP.json`, and the test prints it in two lines of its
  report, which begin `references kept:` and `what a pass of this test rests on:`. Give Brandon those two lines as
  they are printed. Put no number of your own in their place.
- On the two test machines these frames were measured: film B frame 120, film B frame 720, and the first frame
  of the loop on macOS alone. Every other frame was compared on Linux alone, or stands under `still to be drawn`
  in those lines and was compared nowhere. When a frame fails here by a little, the floor may be at fault and not
  the picture. You do not decide that: do what stands under `Bad` below, and the remote team reads the numbers
  and the sheet of pictures.
- What was run where. The Windows and macOS test machines last ran the commands of this file in run 46130923210
  of the workflow `handoff-proof`, at commit 463ed0cd of the repo, whose engine hash is 74660360c1965b4f. The
  setup line of 1.3 prints the engine hash of this clone. If it prints that same hash, this very build ran
  there. If it prints another, this clone holds a newer build, which was drawn and compared on Linux only and
  ran on no Windows and no macOS test machine. The remote team has said that it runs the test machines once more
  on the final build before it releases the full render.
  A green run there means only that the machines ran. The verdicts named here are read from the table of the
  run or from the reports of its jobs, never from its colour.
- What was added after that run. The two approve lines (2.2, 2.5), the record of Brandon's yes, the reading of
  the card's driver, the `LOOK` lines for a restart that Windows waits for and for a Desktop inside OneDrive,
  and the rule that a finished chunk counts only as the build of the approved test: all of these were run on
  Linux only, with a small picture drawn in software. On a Windows or macOS machine they have not run yet.
- The report also says, for every frame, how far the picture stands from its reference: the largest and the mean
  difference in levels of 255, how many pixels are more than 8 levels apart, and where in the picture they lie.
  These lines are marked `noted` and fail nothing. They tell the remote team where to look.
- What this machine drew is kept in `out/work/handoff/compared`, and a sheet of pictures shows each frame beside
  its reference: the reference on the left, this machine on the right, with a row of cuts at full size.
- While the frames are drawn the test asks the NVIDIA card every two seconds how busy it is (with `nvidia-smi`,
  which comes with the driver) and prints the busiest reading and the most memory in use. A card that stayed idle
  while the page says it draws there is written as a `LOOK` line.
- After the two seconds of film are drawn, the test reads from each chunk's own record what drew it. It must be the
  card the doctor named. So a test that drew nothing, or drew elsewhere, cannot pass as proof of the card.
- The calibration picture. Before the test draws anything else it looks for one still picture that this machine
  draws once for a build of the film and keeps in `out/work/master`. Every finished piece of the film (a chunk)
  names that picture, and the films are joined only from chunks that all name the same one. So it is drawn once,
  by the first test, and kept. No later test and no render draws it anew or replaces it, however often the lines
  of this file are run, in whatever order, and after a restart of the computer too. You never delete it.
- The test also says, in one line of its report, whether this machine draws that picture the same twice. It draws
  a second one into its own folder, compares it with the kept one, and prints how many pixels differ and the
  largest difference in levels of any channel. The line is marked `noted`. It is no pass and no fail, and the
  second picture never replaces the kept one. What is known of it:
  - Measured: on the Windows test machines (Direct3D 11, in software) the picture came out the same every time,
    24 drawings on ten machines. On the macOS test machines (Metal) it came out another one every time, 8
    drawings and 8 different pictures. That is why it is kept and not drawn again.
  - Measured: on both kinds of test machine the short test was run again in the middle of a render, with
    finished chunks on disk, and the render line then went to its end and its films were joined and proven. On
    Windows the row for a Chrome that updated itself (2.2) was followed the same way, with chunks on disk.
  - Not known: whether an NVIDIA card or the MacBook's own card draws it the same twice. The line of this test
    says it for this machine. Whatever it says, the film is whole, because the kept picture is the one in use.

Good: the last line is one of these two.

- `PASS: the short test passed on <the graphics card>: ...`. The picture is proven and nothing stands in the way
  of the render but Brandon's word.
- `PASS: the picture passed on <the graphics card>: ... and the render is not ready: ...`. The picture is proven,
  and the full render could not start yet. The sentence says why: the film is not released yet, references are
  still to be drawn, or a final sound mix is not in the clone or is not the one the stamp names. Before the
  remote team has released the film this is the answer to expect. Say the sentence to Brandon as it is.

Above the last line the tool prints `THE TEST FILM` and `THE SHEET OF PICTURES`, each with its whole path. They
are on the Desktop. If an older one was open in a player, the new one lies beside it with `(new)` in its name,
and the printed path names it.

The sound. The two final sound mixes come with the clone: the remote team puts them into the repository when it
releases the film. The test checks both against the stamp and prints one line for each, and its film says which
sound it carries. You never ask Brandon to put a file into the clone, and you put none there yourself.

Bad, each with the one thing to do:

| the last line says | do this |
| --- | --- |
| `FAIL: "test" was stopped before it ended` (sleep, a restart, a closed window), or your command was cut off | run the same line once more. If it is stopped a second time, the sentence ends with `Do not run the line again`: stop and report |
| `FAIL: "<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the test line |
| any other `FAIL:` | the test has failed. Do what stands under this table. Change no floor and no file. Do not run the test again to see whether it passes. Step 1 ends here, and you do not go on to 1.6 |

When the test has failed, the tool has put what the remote team needs into one folder and printed its whole path
in the line `THE FOLDER TO SEND`. It is one folder on the Desktop, `Snow Globe Seasons - Test - Failed`. If the
Desktop could not be written, it is the folder `out/work/handoff/test-failed` inside the clone, and the printed
path says which of the two it is. The report says the same in its block `TO SEND`. The folder holds the report,
the numbers of the test (`test.json`) and, when the test got as far as drawing, the sheet of pictures and what
this machine drew. If the tool printed no line `THE FOLDER TO SEND`, no folder could be written: give Brandon
the report alone.

In that folder the tool replaces only the files it wrote there itself, each known by its sha256. If the named
folder already holds other files or a file has changed, the tool leaves it alone, says
`left ... alone: it has other or changed files: ...` with their names, and puts the new report into the folder
`out/work/handoff/test-failed` inside the clone. The line `THE FOLDER TO SEND` then names that folder. Give
Brandon the path the test printed. Do not remove or rename the old folder.

Give Brandon the whole text of the report (its path is the line `THE REPORT`) as one block. Then say to him,
word for word, with the printed path in the place of the three dots: "The short test failed. No full render was
started. Please bring this folder into the build thread: ... Whether the picture or the floor is at fault is
ruled on there." Then stop and wait.

One thing Brandon may try himself first, and it is his act and not yours. Settings of the NVIDIA app that are
forced for all programs change what the card draws, and can bring a drawn frame under its floor. If the first
line of the report names a frame and a number in dB (a drawn frame is too far from its reference), say to him
also, word for word: "If the NVIDIA app on this computer has 3D settings that are forced for all programs, such
as image sharpening, antialiasing or anisotropic filtering, you can set them to application controlled, or back
to their defaults, and tell me. Then I run the short test once more." When he writes that he has done so, run
`node tools/handoff.mjs test` once more and judge it as the first one. This is the one case in which a failed
test is run again, and only on his word. It was tried on no test machine: none has an NVIDIA card.

### 1.6 Report and STOP

Give Brandon the whole text of the report of the test (its path is the line `THE REPORT`) as one block, with its
`TO LOOK AT` block if it has one. Its first three lines say in plain words whether the test passed, what that
means and what he does next. Then give him the two printed paths, of `THE TEST FILM` and of
`THE SHEET OF PICTURES`, and ask him to open both and look. Say to him, word for word: "The short test is done.
No full render was started."

On the sheet each frame stands twice: on the left the picture drawn in the cloud, on the right the one this
computer drew. Tell Brandon what to look for, word for word:

"Left is the cloud's picture, right is what this computer drew. Some things differ and that is expected: where
the runs of water stand on spring's glass, and the fine grain of the moss, of the lumps on the table and of the
sparkles. They look the same in kind and stand at other places. Four things are not expected: stripes or blocks
in that grain, an area that is flat or blank, a thing that is missing, a colour cast over the picture. If you see
one of the four, the render is not started: bring the sheet and the test film into the build thread."

If Brandon says he sees one of the four, do not go on to step 2. Whether the render is started is then ruled on
in the build thread, and you wait for his word after that.

Tell Brandon also what step 2 does first, so that he does not walk away from it. Say to him, word for word:
"When you tell me to do step 2, the render does not start at once. I first bring the clone up to date and run the
checks and the short test once more, which takes about as long as it did just now. Then I stop and ask you
whether the full render may start. No frame of the full render is drawn before you have written yes to that."

If the report holds a line that begins `MORE THAN 10 HOURS`, say that line to Brandon first, before the block.
The test has passed all the same. Whether a render that long is started on this machine is for the remote team
to decide, not for you.

If the test could not put the test film or the sheet of pictures where it names them, it ends in `FAIL:` and
says which one. That is the last row of the table in 1.5.

STOP here. Do not go on to step 2 by yourself, whatever the report says.

## Step 2 on Windows: the full render, only on Brandon's word

Run step 2 only when Brandon has said to, and only after step 1 passed on this machine.
The render takes hours. The report of the short test says how many. Keep the computer on mains power.

### 2.1 Bring the clone up to date, then check again

First find the clone. You may have been started in the folder that holds it, and not inside it:

```
node tools/handoff.mjs status
```

- It ends with `PASS: this is the clone of the film, at ...`: you are inside the clone. Go on with the four lines
  below. One thing first: if its line `at work` names a word and does not say `nothing`, work is going on here
  already. Then do not pull, and do what "If you are started in the middle" says.
- node answers `Cannot find module` with a path that ends in `tools\handoff.mjs` or `tools/handoff.mjs`: you are
  not inside the clone. Run the line below once, then the status line again, and judge its answer by these rows.

```
cd Snow-Globe-Perplexity
```

- The `cd` line fails because there is no such folder: the clone of step 1 is not in the folder you were started
  in. Stop and tell Brandon so. Do not clone here: step 2 is run in the clone that step 1 passed in.
- The status line answers `Cannot find module` inside that folder too: the folder is no whole clone. Stop and
  report. Delete nothing.

Then the four lines, inside the clone:

```
git pull --ff-only
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
```

Good: the pull ends with exit code 0, the setup line and the doctor line each end with `PASS:`, and the test
line ends with `PASS: the short test passed on ...`. The setup line prints the engine hash of the build the pull
brought; the test is then a test of that build.

After the pull, read the clone's copy of this file again from "Step 2" on, and follow that copy from here. The
pull may have brought a newer one than the copy you were reading.

When the pull brought a new build of the film, this test draws the calibration picture (1.5) for that build,
once, and keeps it. When it brought none, the test keeps the one it has.

Every run of the test takes away a yes for the full render that was recorded before it. Brandon's yes covers one
test and its report, so after this test 2.2 asks him again.

Bad, each with the one thing to do:

| what you see | do this |
| --- | --- |
| the pull ends with another exit code than 0 (it says `fatal`, `error`, `Not possible to fast-forward`, or it asks to merge) | stop and report its last lines. Do not merge, stash, reset or pull in another way. The remote team mends a clone that has gone apart from the repo; you do not |
| git asks for a sign in | that is for Brandon, as in 1.2 |
| setup, doctor or test end in `FAIL:` | the tables of 1.3, 1.4 and 1.5 hold here too |
| the test ends with `... and the render is not ready: ...` | do not run 2.2. Say that sentence to Brandon as it is, and that the remote team has not released the film or has not put the sound mixes into the repository yet. Wait for his word. When he says the remote team has done it, begin 2.1 again |

If the test film of step 1 is still open in a player, this test writes its film beside it with `(new)` in the
name and says so in a `LOOK` line. That is no failure.

### 2.2 Brandon's yes, then the render

The render starts only on Brandon's own yes, written in the chat after the test of 2.1. First give him the whole
report of that test as one block (its path is the line `THE REPORT`), with its `TO LOOK AT` block if it has one,
and the two printed paths of `THE TEST FILM` and `THE SHEET OF PICTURES`. Then ask him, word for word: "The test
passed again on this machine. Its report says how many hours the full render takes and how much disk it needs.
May the full render start now?"

Only when he has written in the chat that it may, copy what he wrote into the line below, in the place of
`<his words>`. Copy his own words and change none. Leave out every sign that is no letter, no digit and no space.
The words go on one line, with no quotes around them and one space between them. If he wrote them on two lines,
join the second line to the first with a space.

```
node tools/handoff.mjs approve render <his words>
```

You never write these words for him. Do not run this line on a yes he gave before the test of 2.1, on a yes he
gave for something else, or on what you think he would say. If he has not written it, wait.

The line draws nothing. It prints a block that begins `WHAT THIS YES COVERS`: the machine, the graphics card, its
driver, the browser, the engine, the report of the test and its two previews (the test film and the sheet) by
path and sha256, the projected hours, the disk, and every `LOOK` line that is still open. It writes a record of
all that, and the render line refuses without a record that fits this machine, this build and this test. Give
Brandon the printed block as it is.

Good: `PASS: the full render is approved on this machine, by Brandon's words "..." ...`.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `the film is not released for its final render yet; step 1 only` | stop and tell Brandon. The remote team releases the film; nothing here can |
| the approve line `carries the words Brandon wrote in the chat ... and it was given none`, or its words `are letters, digits and spaces only` | run the line again with his words as he wrote them, without the other signs. If he has written no yes, wait for it |
| `this is new since the test, and the report Brandon read does not say it: ...` | give Brandon the printed `LOOK` lines word for word. If he then writes that the full render may start, copy his words into the same line and run it again. If he does not, stop |
| `the build changed since the test: run step 1's test again, give Brandon its report, stop` | run `node tools/handoff.mjs test` once, give Brandon its report as in 1.6, and stop |
| `the short test has not passed on this machine ...`, or the report, the test film or the sheet of the short test `is not ... any more` | run `node tools/handoff.mjs test` once, give Brandon its report as in 1.6, and stop |
| `the doctor does not pass on this machine now: ...` | the table of 1.4 holds |
| `the drive of the clone has ... GB free, and what is still to do of the render needs ...` | stop and report. When Brandon says he has made room, run the same line again |
| `"<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the approve line |
| anything else | stop and report |

Then the render:

```
node tools/handoff.mjs render
```

It answers `RUNNING:` every few minutes with a line that says how many frames are done and when it expects to
end. Run the same line again each time, for as long as it takes. Do nothing else on this machine with the
graphics card meanwhile, and leave the Chrome windows alone.

Before you run it, tell Brandon, word for word: "The render opens Chrome windows for hours. Please do not minimize
them, do not lock the screen and do not start a game until I say it is done. If Chrome asks to restart for an
update, choose later. Do not switch off or unplug a monitor while it renders. Do not close and reopen your own
Chrome windows while it renders. If you can, pause Windows updates for tonight, so that Windows does not restart
the computer in the middle. If I stop answering, nothing is lost: start a new agent in this folder and say to it:
Read the file RENDER-ON-YOUR-PC.md in this folder. Do what its part If you are started in the middle says, and
nothing else."

The tool keeps the computer awake by itself while it draws and lets it sleep again when it ends. It changes no
power setting. If it cannot keep the computer awake, it says so in a `LOOK` line that Brandon's yes must cover.
It draws no finished frame twice, but for the chunks named below, and it never joins frames of two graphics
cards, two drivers or two versions of Chrome into one film.

Before the first frame of every part it draws, the tool reads the card, its driver and the browser from the
machine again and holds them against the test Brandon said yes to. A finished chunk counts only when its own
record names that build and its bytes have the sha256 its record names.

The render draws no new calibration picture: it uses the one the test kept (1.5), on every start. Three lines of
its output say that it mended something by itself. They are no failures and need nothing from you. Give each to
Brandon in the report of 2.7 if you see it:

- `the record of the calibration picture was gone or could not be read ...: the record is written again from them`.
  The record was lost while finished chunks lay on disk. The tool wrote it again from what those chunks say and
  drew no new picture, so every chunk goes on naming one picture.
- `... finished chunks (...) on disk name another build or another calibration picture, and are drawn again
  before the films are joined`. This is the one case in which finished chunks are drawn again: they do not
  belong to this build and its kept picture. It costs their time once more, and the film comes out whole.
- `... on disk did not count for this render and ... drawn again`, with a line `the chunk ... on disk is not
  taken: ...` for each. A finished chunk was not drawn by the build the approved test passed on (the engine, the
  calibration picture, the card, its driver, Chrome), or its bytes are not the ones its record names. The tool
  deletes its film, lists it in `out/work/handoff/chunk-ledger.json` and draws it again. A chunk the tool has
  rejected is never taken again.

Good: `PASS: the two films, the loop and the screenshot are made in ...`.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `the film is not released for its final render yet; step 1 only` | stop and tell Brandon. The remote team releases the film; nothing here can |
| `the full render is not approved on this machine ...` | do the first half of 2.2: Brandon's yes in the chat, the approve line, then the render line |
| `the full render is not started, and nothing was drawn: ...` (the short test was run again since his yes, his yes was given for another machine or another build, it was given before the film was rendered, delivered and cleaned here, or something `is new since his yes`) | give Brandon the report of the short test and that sentence, word for word. If he then writes that the full render may start, do the first half of 2.2 with his new words. If he does not, stop |
| `the build changed since the test: run step 1's test again, give Brandon its report, stop` (a pull, another card, a driver that was updated) | run `node tools/handoff.mjs test` once, give Brandon its report as in 1.6, and stop. Nothing drawn is deleted by you. The render starts again only on a new yes |
| `the chunk ... that was just drawn is not taken: ...` | stop and report. Do not run the render line again |
| a final mix is missing or is not the one the stamp names | stop and tell Brandon that the remote team has not put the sound mixes into the repository yet, or that the file in the clone is not the one the stamp names. Do not ask him for the files |
| `"render" was stopped before it ended` (sleep, a restart, a closed window) | run the same line again. It carries on from the last finished frames. If it is stopped a second time with no more frames done in between, the sentence ends with `Do not run the line again`: stop and report |
| `the render stopped at ...` with `browser has been closed`, `the browser went away` or `the page crashed or closed` (a Chrome window was closed or Chrome ended) | run the same line again, once. It carries on from the last finished frames, and what was drawn is kept. If it stops a second time with no more frames done in between, stop and report. Change no setting (rule 8) |
| `the render stopped at ...` with `the WebGL context was lost ... (the graphics card dropped the drawing: close other programs that use the card and run the same line again, it carries on where it stopped; if it happens twice in a row, stop and give Brandon the report)` | the card dropped the drawing and the tool refused that frame, which is right. Tell Brandon in the chat that other programs that use the card are best closed; close none yourself and do not wait for his answer. Run the same line again, once. It carries on where it stopped. If it happens twice in a row, stop and give Brandon the report. Change no setting (rule 8) |
| `Chrome is now version ...: the browser was updated` | Chrome updated itself in the middle. Run `node tools/handoff.mjs test` once, give Brandon its report as in 1.6, and stop. The render starts again only on a new yes (the first half of 2.2). It then draws again what the older Chrome drew, because one film is drawn by one tested browser, and the test keeps the calibration picture (1.5) for it |
| the page draws in software, or on another card | stop and report. Nothing drawn is lost |
| too little free disk (`only ... GB of disk is free ...`) | stop and report. Nothing drawn is lost. When Brandon says he has made room, run the same line again |
| `"<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the render line |
| anything else | stop and report |

The tool itself tries nothing a second time: when a picture cannot be drawn it stops at once, keeps every
finished frame and says where it stopped. The second try is yours, by the rows above, and never more than they
say.

### 2.3 Check the four files

```
node tools/handoff.mjs check
```

The check reads the whole screenshot, makes sure it has the size and bit depth the stamp names, and compares it
against the first frame in the encoded loop.

Good: `PASS: the two films, the loop and the screenshot pass every check ...`.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| `the stamp is older than the plan and must be made again by the remote team` | stop and tell Brandon, word for word: "The remote team needs to remake the stamp for the screenshot check. Nothing was delivered." Do not make a stamp yourself |
| the checks that fail name `screenshot: against the loop film's first frame is MEASURED: ... dB in luma (brightness)` | stop. Give Brandon the report of the check (its path is the line `THE REPORT`) and say to him, word for word: "The check stopped at one measure. The screenshot and the first frame of the loop film are less alike than the floor in the stamp asks. That floor comes from one measure on a Linux test machine, so this does not say that the render is bad. Everything that was drawn is kept. Please bring the report of the check into the build thread, where the floor is ruled on." Do not run the clean line, delete nothing and do not render again |
| `"check" was stopped before it ended`, or your command was cut off | run the same line once more. If it is stopped a second time, stop and report |
| `"<word>" is still at work in the background` | no stop: run the line that sentence names until it ends, then the check line |
| any other `FAIL:` with the checks that failed | stop and report. Do not render again by yourself |

What the screenshot row measures. The screenshot is the first frame of the loop as this machine drew it, a PNG.
The loop film holds the same frame after it was encoded twice by the FFmpeg of this computer. The check decodes
both and measures how alike they are in brightness (PSNR in dB, higher is closer). The floor is 44.74 dB. It was
set from one measure of 47.74 dB, on a Linux test machine that draws in software, on a loop of four frames
encoded by FFmpeg 8.0.1, less a margin of 3 dB that was chosen and not measured. On this computer the whole loop
is encoded, by another build of FFmpeg, from frames that carry this card's own fine noise. A pair that falls
under the floor here may therefore have nothing wrong in what was drawn. A `FAIL:` of this row is a question for
the remote team and no verdict on the render.

### 2.4 Deliver to the Desktop

```
node tools/handoff.mjs deliver
```

Good: `PASS: the four files and the report are in ...` with the whole path of the folder `Snow Globe Seasons` on
the Desktop. Give Brandon that path as it is printed.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| a file on the Desktop `could not be written, because another program holds it open` | tell Brandon, word for word: "A film from an earlier run is open in a player on your Desktop. Please close the player and tell me." When he has, run the same line again, once |
| `the drive of the Desktop ... has ... free, and the four files and their report need ...` | stop and report. Nothing was copied. When Brandon says he has made room on that drive, run the same line again |
| `left the Desktop folder alone at ... It contains other or changed files: ...` | stop and give Brandon the full folder path and the files the tool named. Do not delete, rename, or replace them |
| `"deliver" was stopped before it ended`, or your command was cut off | run the same line once more. If it is stopped a second time, stop and report |
| anything else | stop and report |

This line does its work inside itself and does not answer `RUNNING:`.

The tool writes into the folder `Snow Globe Seasons` only when every file in it is one it delivered there
itself, known by its sha256. A file of the same name that is not the checked copy is never replaced.

What the files weigh: each film at most 500 MB, the loop under 2,000 MB (2.3 checks it), the screenshot some tens
of MB. They stay in that folder. 2.5 sends copies of them, and only if Brandon says yes.

### 2.5 Send the files to the remote team, only when Brandon says yes

The upload writes to Brandon's repo on GitHub. Before anything is run, ask Brandon, word for word: "The files are
on your Desktop. May I send the two films, the loop, the screenshot, the file sums, and the render records as a
draft release in this private repository? Everyone with write access to the repository can see the draft. Its
name and description use the platform and the graphics card when known, not the computer name. The records can
still name the computer, card, driver, browser and folders outside your home. Your home folder is written as ~
in the records text, and the local approval records are left out." If he says no, go on with 2.6.

Only when he has written yes in the chat, copy what he wrote into the line below, in the place of `<his words>`.
Copy his own words and change none. Leave out every sign that is no letter, no digit and no space. The words go
on one line, with no quotes around them and one space between them. If he wrote them on two lines, join the
second line to the first with a space. You never write these words for him.

```
node tools/handoff.mjs approve upload <his words>
```

The line sends nothing. It asks GitHub whether the repo is private and prints a block that begins
`WHAT THIS YES COVERS`: the repository by owner and name, that it is private, who can see the draft, the four
files with their sizes and sha256, and what goes with them: a file of sums and one zip of the records. The block
says what the draft is named by and what the records can still name. It writes a record of that, and the upload
line refuses without a record that names this repository and these very files. It refuses too before 2.4 has
passed. Give Brandon the printed block as it is. The record of his yes stays on this computer: it is in no file
that is sent.

Good: `PASS: the upload is approved on this machine, by Brandon's words "..." ...`. Then:

```
node tools/handoff.mjs upload
```

It makes a draft release in the repo, named for the day, the engine hash, the platform and the graphics card
when it is known. The name of the computer is not in it. Into it go the two films, the loop, the screenshot, a
file of sums (sha256, bytes, frames, seconds and size in pixels of each) and the records of the render as one
zip. A draft is published to no one and makes no tag. The line answers `RUNNING:` while it sends; run the same
line again each time.

The upload downloads each file from the draft and checks its SHA-256 against what was sent. If any file cannot
be verified, it says FAIL.

Good: `PASS: the draft release "..." holds the files`. The same line says how many files were downloaded and
that their SHA-256 sums matched, and it ends with the address of the draft. Give Brandon the draft address.

Bad, each with the one thing to do. The table holds for the approve line and for the upload line; "the same
line" is the one that gave the answer. The approve line begins these sentences with
`no yes for the upload is recorded:`.

| the FAIL says | do this |
| --- | --- |
| `the four files are not delivered to the Desktop yet ...` | run the line of 2.4, then the same line again |
| `the upload is not approved on this machine ...` | do the first half of 2.5: Brandon's yes in the chat, the approve line, then the upload line. After the clean of 2.6 his yes is gone too, and is asked for again |
| `the upload is not started, and nothing is sent: ...` (his yes names another repository or other files) | ask Brandon the question of 2.5 again. If he writes yes, do the first half of 2.5 with his new words. If he does not, go on with 2.6 |
| a file `is not on the Desktop any more as it was delivered` | run the line of 2.4, then the same line again |
| the approve line `carries the words Brandon wrote in the chat ... and it was given none`, or its words `are letters, digits and spaces only` | run the line again with his words as he wrote them, without the other signs. If he has written no yes, wait for it |
| `gh, the GitHub program that sends the files, is not on this machine` | run the install line below, then the same line again |
| `gh, the GitHub program, is not signed in on this machine` | tell Brandon, word for word: "The upload needs your GitHub sign in. Please open a terminal yourself, run `gh auth login`, answer what it asks, and tell me when it is done." Then run the same line again |
| the sign in `does not see the repo` or `may not write to it` | the same words to Brandon, and add: "It must be the account that owns the repo." Then run the same line again |
| `the repo ... is not private, so nothing is sent` | stop and tell Brandon. The remote team makes the repo private; nothing here can |
| `the check has not passed` or a file `is not the file that was checked` | run the line of 2.3 again, then the upload line. If it says the same again, stop and report |
| a file `did not go through`, or GitHub `could not be asked` (the connection dropped) | run the same line again. It sends only what is missing or short. If it fails three times in a row, stop and report |
| a file is 2,000 MB or more | stop and report. The remote team names another way |
| `the release read back is not what was sent (...)` | stop. Give Brandon the upload report and the draft address if there is one (it ends that sentence). Do not publish it or remove it, and do not run the upload line again |
| `the earlier draft has an old or changed name or description. It is left alone and nothing is sent ...` | stop and give Brandon the upload report and the draft address if it was printed. Do not change or delete the draft. Ask the remote team to review it |
| anything else | stop and report |

```
winget install --id GitHub.cli -e --source winget --accept-package-agreements --accept-source-agreements
```

This winget line is judged as those of 1.1 are. It is good when its last line is `Successfully installed`, or
`No newer package versions are available from the configured sources.` (gh was there already; winget ends with an
exit code that is not 0 then, and that is no failure). After a good line run the same line of 2.5 again, in the
same terminal: the tool looks in the places winget installs to, and its answer decides. If it says again that gh
is not on this machine, do not install a second time: stop and report. A winget line that ends in anything else
is also a stop and report.

What was tried: sending, carrying on after a cut connection and reading back were run with stand-in files of a
few bytes, on Linux and on a hosted Windows machine. The refusal for a missing sign in was run on the hosted
Windows and macOS machines, after a small render there. The refusal for a repo that is not private was run on
Linux only, while the repo was public. `gh auth login` was run on no test machine, and no whole film was sent by
this line before Brandon's own run. The approve line of the upload was run on Linux only, where it refused
because the repo was public. Its `PASS:` was run on no machine, because the repo of the tests is public.

### 2.6 Clean up, only after the delivery passed

```
node tools/handoff.mjs clean
```

Good: `PASS: the work files are deleted and ... GB of disk is regained ...`. The files on the Desktop, the reports
and the clone stay.

The clean takes away both of Brandon's recorded yeses. After it the render line does not begin the film again
from nothing by itself: it refuses, and the approve line of 2.2 first prints that the film was rendered,
delivered and cleaned here already, as a `LOOK` line for Brandon. Do not render a second time unless Brandon
asks for it in the chat.

Before it deletes render work, the tool reads the copies on the Desktop again and checks their SHA-256. If a
copy does not match the delivery, the work stays.

Bad, each with the one thing to do:

| the FAIL says | do this |
| --- | --- |
| a file `does not match the last delivery by SHA-256, so the work files stay. Run the delivery again`, or `the last delivery does not name all the checked files` | run the delivery line once more (`node tools/handoff.mjs deliver`), then the clean line. If the tool leaves the folder alone or the delivery still fails, stop and give Brandon the report. Do not remove or replace files yourself |
| `nothing is deleted before the delivery has passed` | run the line of 2.4, then the clean line |
| `"clean" was stopped before it ended`, or your command was cut off | run the same line once more. If it is stopped a second time, stop and report |
| any other `FAIL:` | stop and report. Delete nothing by hand |

This line does its work inside itself and does not answer `RUNNING:`.

### 2.7 Report

Give Brandon the whole text of `Snow Globe Seasons - Render Report.txt` as one block. It lies in the folder
whose path the deliver line printed. Give him the last line of each command of 2.1 to 2.6 that was run. If 2.5
was run and passed, give him the address of the draft release too. If 2.5 was not run because Brandon said no,
say so in these words: "The files were not sent, by your word." A skipped upload is no failure. If 2.5 was run
and did not pass, say that its last line was a `FAIL:` and give him its report: what was sent so far stays in
the draft release, which only the remote team removes.

## macOS: the fallback, same commands

Use this only if Brandon says to render on the MacBook Pro. The rules, the two steps, the tables and the answers
are the same as on Windows. What differs stands here. Work in Terminal.

### What a prepared Mac has

Five things. Check them in this order, one line at a time:

```
git --version
brew --version
node --version
```

| what | its check | good | if it is missing or too old |
| --- | --- | --- | --- |
| the Command Line Tools of macOS, which bring git | `git --version` | `git version 2.25` or newer | see "The Command Line Tools" below |
| Homebrew, which installs the rest | `brew --version` | a line that begins `Homebrew` | see "Homebrew" below |
| Node | `node --version` | `v20.19` or newer of 20, `v22.12` or newer of 22, or `v24` and up | `brew install node` |
| ffmpeg with the picture encoder libx264 and the sound encoder aac | the doctor of 1.4 reads it | the doctor's row for ffmpeg passes | `brew install ffmpeg`, then the doctor again |
| Google Chrome | the doctor of 1.4 reads it | the doctor's row for Chrome passes | `brew install --cask google-chrome`, then the doctor again |

The install lines, one for each thing that is missing or too old:

```
brew install git
brew install node
brew install ffmpeg
brew install --cask google-chrome
```

A brew line is good when it ends with exit code 0. After it, ask for the version again (or run the doctor
again). If the version is still not found or still too old, an older copy on this Mac comes first, or this
terminal was opened before the install. Do not install again and do not look for the other copy. Stop and tell
Brandon, word for word: "A program was installed just now, and this terminal does not see the new one yet.
Close this Terminal window, open a new one, start the agent again and give it the same task. Nothing is lost."
If it is the same after that new start, stop and report the line and its answer. A brew line that ends with
another exit code than 0: stop and report its last lines.

The Command Line Tools. On a Mac that never had them, `git --version` opens a window of macOS that says the
command needs the command line developer tools. That is a system prompt, and it is for Brandon. Tell him, word
for word: "macOS asks to install the command line developer tools. Please click Install, wait until it says it is
done, and tell me." Then run `git --version` again.

Homebrew. If `brew --version` answers `command not found`, Homebrew is not on this Mac. Installing it is
Brandon's own act, with his password, and you do not run its install line. Stop and tell him, word for word:
"This Mac needs Homebrew. Its install line stands at the top of the page https://brew.sh, under the words
Install Homebrew. Please copy that line from the page into a Terminal window of your own, give your password
when it asks, and do what its last lines under Next steps tell you. Then open a new Terminal window, start the
agent again and give it the same task." Then wait.

### What of the Windows part does not hold on the Mac

- 1.1: the winget lines and the sentences about winget. The brew lines above stand in their place.
- 1.2: the window `Connect to GitHub` of Git for Windows. The sign in on the Mac stands below.
- 1.4: the rows for WSL and for a Windows graphics setting. A MacBook with Apple's own chip has one card. If the
  doctor says the page draws in software or on another card there: stop and report.
- 1.4: the line `restart` says that it is not read on a Mac. The line `driver` names the version of macOS,
  because on a Mac the driver is a part of the system. An update of macOS between the test and the render is
  therefore a changed build (2.2). The `LOOK` line for a Desktop in the cloud reads
  `the Desktop of this Mac is kept in iCloud Drive ...` there.
- 1.5: the reading of an NVIDIA card with `nvidia-smi`. The test prints no such reading on a Mac.
- 2.2: the words to Brandon about Windows updates. Say in their place: "Please keep the MacBook on its charger
  and its lid open until I say it is done."
- 2.5: the winget line for `gh`. On the Mac the line is `brew install gh`.

The sign in on the MacBook, if the repo is private: the first clone can fail in the agent's own shell, because no
sign in window can open there. If the clone line below ends with `fatal: Authentication failed`, with
`fatal: repository ... not found` or with `fatal: could not read Username`, stop and tell Brandon, word for word:
"The clone needs your GitHub sign in. Please open Terminal yourself, run `gh auth login`, then `gh auth setup-git`,
and tell me when both are done." If he says `gh` is not found, he runs `brew install gh` first. Then run the clone
line again. This was tried on no test machine, because it needs Brandon's own account.

### The lines, in their order

Step 1, with the same good and bad answers as in 1.2 to 1.6:

```
node tools/handoff.mjs status
git clone --filter=blob:none --single-branch --branch main https://github.com/BrandonChurch93/Snow-Globe-Perplexity.git Snow-Globe-Perplexity
cd Snow-Globe-Perplexity
node tools/handoff.mjs status
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
```

STOP here and report as in 1.6. Then, only on Brandon's word, step 2 as in 2.1 to 2.7. It begins, as 2.1 does,
with the status line that finds the clone. If node answers `Cannot find module` there, you are not inside the
clone: run `cd Snow-Globe-Perplexity` once and the status line again, and only then the pull.

```
node tools/handoff.mjs status
git pull --ff-only
node tools/handoff.mjs setup
node tools/handoff.mjs doctor
node tools/handoff.mjs test
node tools/handoff.mjs approve render <his words>
node tools/handoff.mjs render
node tools/handoff.mjs check
node tools/handoff.mjs deliver
node tools/handoff.mjs approve upload <his words>
node tools/handoff.mjs upload
node tools/handoff.mjs clean
```

Each approve line is run only with the words Brandon wrote in the chat, as in 2.2 and in 2.5: on one line, with
no quotes around them. You never write them for him. The two lines of the upload are run only after Brandon has
said yes to it, as in 2.5. If he says no, leave both out.

Keep the MacBook on its charger and its lid open for the whole render.
