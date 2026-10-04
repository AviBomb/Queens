## Learned User Preferences

- Keep a "cross these cells" hint highlighted until every hinted cell is crossed; already-crossed cells drop their highlight, and the rest stay visible.
- Pause the solve timer when the tab is hidden or the window loses focus, and resume it when the player is back on the page.
- Ask for confirmation before restarting a puzzle. Restart clears marks and the timer.
- Undoing a queen returns that cell to empty in one step, not back to an X.
- The next hint is available after 10 seconds, not 15.
- Use the custom crown-on-region-grid icon for the tab, home screen, and install icon. Do not ship the Angular favicon.
- Sound effects, ambient music, and haptics must work on mobile browsers of the GitHub Pages site, including after a fresh deploy.

## Learned Workspace Facts

- This repo is an Angular Queens puzzle, shipped as a PWA to GitHub Pages.
- `public/sw.js` serves the cached app first. Bump `CACHE_NAME` when a deploy must replace cached scripts on phones.
- Region borders are one SVG overlay on the board (square line caps, 3px stroke), not per-cell thick CSS borders, so corners join in both themes on phone and desktop widths.
- Audio and haptics are synthesized in the browser. Mobile Safari and Chrome leave `AudioContext` suspended unless it is created and resumed inside the user's tap. iOS browsers do not implement `navigator.vibrate`.
