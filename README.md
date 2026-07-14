# RoundBell 🥊

Boxing round timer as an installable, offline-capable PWA. Plain HTML/CSS/JS, no build step, no dependencies.

- Configurable rounds, round length, rest, and get-ready countdown (persisted in localStorage)
- Synthesized bells via Web Audio: single bell on round start, triple on round end, clacker warning at the final 10 seconds
- Pause, resume, skip phase, reset; settings lock mid-session
- Screen wake-lock during sessions; wall-clock timing so background throttling can't drift it
- Service worker caches everything, so once installed it works fully offline

## Run locally

```sh
python3 -m http.server 8643 --directory .
```

## Install on a phone

Serve over HTTPS (GitHub Pages works as-is), open the URL, then Add to Home Screen (iOS Safari) or Install app (Android Chrome).

## Updating

Bump `VERSION` in `sw.js` whenever any file changes, so installed phones fetch the new version.
