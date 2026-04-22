Atelier
=======

Atelier is an AI studio for filmmakers. Give it a company name and a
website, and it produces a finished advertising video — research,
script, storyboard, visuals, voice, music, and edit — in one guided
workflow.

You stay in the director's chair at seven checkpoints. Everything
between them is automated. Nothing ships until you approve.


WHAT YOU GET
------------

- Research on the company (scraped from their website and socials)
- A proposed campaign direction and tone
- A 30-second script with narration, core line, and call-to-action
  (or longer — duration is variable, see COSTS below)
- A shot-by-shot storyboard with camera angles and composition
- Generated visuals, voice-over, music, and per-shot video
- A finished edited video, ready to send to the client


FIRST-TIME SETUP
----------------

1. Double-click   Atelier.exe

   Windows may say "Windows protected your PC" — click More info →
   Run anyway. One-time.

2. On the setup screen, click   Install everything.
   Atelier downloads and installs Claude Code + FFmpeg, then opens
   a browser for a one-time Claude sign-in. Accept the single UAC
   prompt. This takes a few minutes.

3. In the same setup screen, paste API keys for the paid services
   you want to use:

      Replicate token  — image generation
      ElevenLabs key   — voice-over
      Suno key         — music
      Runway key       — video scenes

   Each field has a link to the service's signup page.

   You can skip keys. Steps without keys produce placeholders so you
   can still walk the pipeline end to end; you come back and add
   keys when you want real output.

4. Done. Atelier switches to the project screen and waits for your
   first company.


MAKING A VIDEO
--------------

1. Enter the company name, website URL, and desired length. Atelier
   researches the company (reads the site, socials, available media).

2. Review at each checkpoint. You can always:
      - APPROVE to continue, or
      - REQUEST REVISION with a short note; the agent redoes that
        step with your feedback.

3. The seven checkpoints:
      1. Research & campaign direction
      2. Script
      3. Storyboard (shot list)
      4. Visuals (per shot)
      5. Voice-over
      5a. Music
      6. Video scenes
      7. Final cut

4. When you approve the final cut, Atelier exports the video and
   (if you want) drafts an outreach email to the company.


COSTS
-----

Atelier uses your subscription for Claude (free, part of what you
already pay). The other APIs charge per call. Rough ranges at
current provider pricing, including one automatic internal retry
per shot (see RETRIES below):

   Length   Shots   Total cost (typical)
   30 sec   ~10     $45 – 75
   60 sec   ~20     $90 – 150
   3 min    ~60     $270 – 450
   10 min   ~200    $900 – 1500

Breakdown per shot (the video generation dominates):
   - Image gen  (Replicate):  $0.02 – 0.05
   - Video clip (Runway 5s):  $3 – 5
   - Voice line (ElevenLabs): ~$0.01 per second
   - Music     (Suno):        $0.02 – 0.10 per 30 s

Atelier shows you a live cost estimate at the storyboard checkpoint
so you can cut shots or change scope before spending anything.


RETRIES
-------

Atelier tries hard to minimise your cost.

Two levels of retry exist:

   1. INTERNAL (you don't see it, doesn't cost extra time):
      After every generated shot, an internal reviewer checks the
      output against the script, storyboard, and continuity kit
      (character descriptions, set, palette). If the output drifts,
      Atelier regenerates it quietly, up to 3 times, before showing
      you anything. This typically catches 60–80% of quality
      problems before they reach a human eye.

   2. REVISION (you initiate it at a checkpoint):
      If the output clears the internal gate but you still want it
      changed, click Request revision and type a short note. That
      re-runs the agent with your feedback. Every revision adds one
      full generation to the cost.

The cost table above assumes one internal retry per shot on
average. If you request user revisions you add one more generation
per revision per affected shot.


CONTINUITY ACROSS SHOTS
-----------------------

Long videos are assembled from many short shots, like a real film.
Atelier keeps the set, characters, and style consistent across
cuts by building a "production bible" (continuity kit) at the
first checkpoint. Every shot prompt pulls the same character
descriptions, set description, palette, and lighting notes.

For longer pieces (over 3 minutes), some cross-shot drift is
expected with current AI models — faces shift subtly, set details
rearrange between takes. Atelier surfaces this with a small warning
at the storyboard checkpoint and lets you choose: accept the drift,
shorten the piece, or mark specific shots to use company-supplied
footage instead of generation.


CO-PILOT
--------

Click the ? icon in the sidebar. A second window opens with a chat
aware of what step you're on. Ask it:

   - "How should I word revision feedback for a script that feels
     too salesy?"
   - "Give me three opening lines warmer than this."
   - "Is this voice-over pacing right for 30 seconds?"
   - "What's the storyboard agent looking for in composition?"

It can see the current agent output and answer specifically. It
does not edit the app — it helps you use it.


AUTO-UPDATE
-----------

Atelier checks github.com/pat2114/atelier every 30 minutes. When a
new version exists, it downloads in the background and offers a
Restart button. Project state is preserved.


SELF-MAINTENANCE
----------------

Atelier is a prototype. When something crashes, a friendly
maintenance screen replaces the technical error. Crashes are
reported anonymously so bugs get fixed and shipped back to your
install as updates.


TROUBLESHOOTING
---------------

"Not logged in" after the Claude sign-in finished:
   Open settings (gear icon) and click Sign in to Claude again.

Research fails with a fetch error:
   Some websites block automated fetches. Continue anyway — the
   research agent will work from the company name alone.

The app does not open:
   Delete %APPDATA%\Atelier and try again. This clears cached state
   but keeps your API keys.

SmartScreen keeps blocking:
   Right-click Atelier.exe → Properties → Unblock → Apply.


PRIVACY
-------

Atelier runs locally. Your API keys are encrypted with the Windows
credential store before being written to disk. They are only sent
as headers on calls YOU make to the services you provided keys for.

Outbound traffic beyond those calls: (1) a version check to GitHub
every 30 minutes, (2) anonymous crash reports when something
breaks. No project content is sent in telemetry — only the
technical error and recent log lines.
