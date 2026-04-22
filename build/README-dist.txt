Atelier
=======

Turns a company into a finished 30-second ad video through a guided,
checkpoint-by-checkpoint workflow. You approve each step; the AI does
the work.


FIRST-TIME SETUP
----------------

Double-click   Atelier.exe   (in this folder).

Windows may show "Windows protected your PC" — click "More info"
then "Run anyway". Only needed the first time.

The app opens to a setup screen. Click **Install everything** and
Atelier handles the rest:

   - Downloads and installs Claude Code
   - Opens a one-time browser sign-in for your Claude subscription
   - Installs FFmpeg

You'll see a UAC prompt once for the Claude Code install — accept it.
You'll see a browser for the Claude sign-in — log in with the account
that holds your Claude subscription (Pro or Max).

When all checks are green, Atelier switches to the project screen
automatically.


API KEYS (optional)
-------------------

Some steps of the video pipeline need keys for third-party services:

   * Image generation  (Replicate)
   * Voice-over        (ElevenLabs)
   * Music             (Suno)
   * Video scenes      (Runway)

Paste any you want to use in the onboarding panel. Skip them and the
corresponding steps produce placeholder media until you come back and
add a key.

Your keys are encrypted with the Windows credential store before
being written to disk.


USING ATELIER
-------------

- Enter a company name and website URL.
- Atelier fetches the site, summarises it, and proposes a campaign.
- Seven checkpoints: research, script, storyboard, visuals, voice-over,
  music, final cut. Approve or Request revision with a short note.
- Chat box at the bottom adjusts the app's look on command:
  "make it pink", "warmer", "dark mode", "bigger text".


CO-PILOT
--------

Click the **?** icon in the top-left sidebar (next to the gear).
A second window opens with a chat aware of the step you're on.
Ask it anything: "how should I word revision feedback for a script
that feels too salesy?", "three opening lines warmer than this", etc.


AUTO-UPDATE
-----------

Atelier checks for a new version every 30 minutes. When one exists,
it downloads in the background and shows a **Restart now** button.
Restart to apply. Your project state is preserved.


SELF-MAINTENANCE
----------------

Atelier is a prototype. When something hiccups, you see a friendly
"maintenance" screen instead of a technical error. The app reports
itself for repair and (when the fix ships) quietly updates.


TROUBLESHOOTING
---------------

- "Not logged in" after sign-in finished:
    Re-open setup (gear icon) and click Sign in to Claude again.

- Research fails with a fetch error:
    Some sites block automated fetches. Continue anyway — the agent
    will do its best from the company name alone.

- The app doesn't open:
    Delete %APPDATA%\Atelier and try again. Clears cached state
    but not your API keys.

- SmartScreen keeps blocking:
    Right-click Atelier.exe → Properties → Unblock → Apply.


PRIVACY
-------

Atelier runs locally. Your keys never leave your machine except as
headers on calls YOU make. The only unsolicited outbound traffic is
a version check to GitHub every 30 minutes, plus anonymous crash
reports when something breaks.
