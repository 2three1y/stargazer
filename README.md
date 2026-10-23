# Stargazer

Hear all of Carter's GitHub stars. Every starred repo becomes a sound: the note gets higher the more stars it has, and each license family has its own sound, so you can tell by ear which repos are safe to mash up.

Live: https://2three1y.github.io/stargazer/

Made by Carter (2three1y), built only from repos he starred.

## How to use it

- Press Start listening. Nothing plays before you press a button.
- Move with Next star and Previous star, or swipe up and down on the Position slider with VoiceOver.
- Arrange the stars by year starred, language, license or star count, then pick a group.
- Turn on Only mash-up safe licenses to hear just the permissive and public domain repos.
- Details opens a dialog with the full info and a plain-English summary of what the license lets you do, plus a Read details aloud button.
- Audio graphs play stars per year, top languages, license families and the star counts in a group.

## What the sounds mean

- Glass chime: permissive (MIT, Apache, BSD, ISC). Safe to mash up.
- Bright chime: public domain (CC0, Unlicense). Safe to mash up.
- Pluck: weak copyleft (LGPL, MPL, EPL).
- Bell: copyleft (GPL, AGPL).
- Question sound: unrecognized or content license.
- Buzz: no license. Look and link, never copy.

## Keyboard

- Right or Left arrow (or J and K): next or previous star
- Down or Up arrow: next or previous group
- D: details
- Space or P: play again
- S: sweep the group
- Slash: find
- Escape: stop sounds and close details

## Data

The page never calls the GitHub API, so it never hits a rate limit. `data/stars.json` is a snapshot, and the Refresh stars GitHub Action rebuilds it every Monday (or when run by hand) with star dates, then checks that every credited repo is still starred.

## Files

- `index.html`, `styles.css`, `app.js`: the app
- `sonify.js`: audio graphs, adapted from athersharif/sonifier (BSD-3-Clause)
- `data/stars.json`: the stars; `data/licenses.json`: license summaries from github/choosealicense.com
- `sounds/`: CC0 Kenney sounds from kapishdima/soundcn
- `vendor/`: a11y-dialog, tabbable, web-haptics, speakable
- `credits.json`: the source for `CREDITS.md` and `credits.html` (run `node scripts/build-credits.mjs`)

## Credits

Built only from repos starred by 2three1y. Each one is listed with its license and what it does here.

### sonifier
- Repo: https://github.com/athersharif/sonifier
- Author: Ather Sharif
- License: BSD-3-Clause
- Used for: the audio graphs: value-to-frequency mapping, note timing and the AM square tone, ported to plain Web Audio in sonify.js
- Notice: Copyright (c) 2023, Ather Sharif. BSD 3-Clause text in licenses/sonifier.txt. sonify.js is a changed version (marked in its header).
- Starred: checked Oct 23, 2026 (GitHub says starred by 2three1y)

### soundcn
- Repo: https://github.com/kapishdima/soundcn
- Author: kapishdima
- License: MIT (code); CC0 (Kenney Interface Sounds used)
- Used for: the license sounds and interface sounds (13 Kenney Interface Sounds, converted from OGG to MP3 so iPhone can play them). No World of Warcraft sounds are used.
- Notice: Copyright (c) 2026 KapishDima, MIT text in licenses/soundcn.txt. Sounds CC0 by Kenney (kenney.nl), see sounds/KENNEY-LICENSE.txt.
- Starred: checked Oct 23, 2026 (GitHub says starred by 2three1y)

### choosealicense.com
- Repo: https://github.com/github/choosealicense.com
- Author: GitHub, Inc. and contributors
- License: MIT
- Used for: the plain-English summary of what each license lets you do (data/licenses.json, built from its _licenses and _data/rules.yml)
- Notice: Copyright (c) GitHub, Inc. and contributors, MIT text in licenses/choosealicense.com.txt.
- Starred: checked Oct 23, 2026 (GitHub says starred by 2three1y)

### speakable
- Repo: https://github.com/tollwerk/speakable
- Author: tollwerk GmbH
- License: MIT
- Used for: the Read details aloud player in the details dialog (vendor/spkbl.min.js and spkbl.css, restyled)
- Notice: Copyright (c) 2020 tollwerk GmbH, MIT text in licenses/speakable.txt.
- Starred: checked Oct 23, 2026 (GitHub says starred by 2three1y)

### a11y-dialog
- Repo: https://github.com/KittyGiraudel/a11y-dialog
- Author: Kitty Giraudel
- License: MIT
- Used for: the accessible details dialog (focus trap, Escape to close, focus return). Its published build includes Kitty Giraudel's focusable-selectors list.
- Notice: Copyright (c) 2026 Kitty Giraudel, MIT text in licenses/a11y-dialog.txt.
- Starred: checked Oct 23, 2026 (GitHub says starred by 2three1y)

### tabbable
- Repo: https://github.com/focus-trap/tabbable
- Author: David Clark and contributors
- License: MIT
- Used for: finding a safe place to return keyboard focus when the details dialog closes
- Notice: Copyright (c) 2015 David Clark, MIT text in licenses/tabbable.txt.
- Starred: checked Oct 23, 2026 (GitHub says starred by 2three1y)

### web-haptics
- Repo: https://github.com/lochie/web-haptics
- Author: Lochie Axon
- License: MIT
- Used for: a haptic tick on each star you pass, on phones that support it
- Notice: Copyright (c) 2025 Lochie Axon, MIT text in licenses/web-haptics.txt.
- Starred: checked Oct 23, 2026 (GitHub says starred by 2three1y)


## License

MIT. Upstream notices are in NOTICE and licenses/.
