# Game Room

Classic games for phone and iPad, played in the browser. Open `index.html` to get the game-select screen. Swipe (or use the arrows or arrow keys) to browse the covers, then tap **Play**.

## Games

| Game | Players | Notes |
| --- | --- | --- |
| Checkers | 2, or vs Computer (Easy / Medium / Hard) | Forced captures, multi-jumps, kings, undo, hints |
| Backgammon | 2, or vs Computer (Easy / Medium / Hard) | Full rules: bar, bearing off, doubles, must-use-both-dice rule, gammons and backgammons, match score. No doubling cube yet. |
| Farkle | 1–6, any mix of humans and computer | |
| Mancala | 2, or vs Computer | Kalah rules |
| Dots & Boxes | 2, or vs Computer (Easy / Medium / Hard) | 3×3, 5×5 or 7×7 boards |
| Dominoes | 2, or vs Computer (Easy / Medium / Hard) | All Fives: double-six set with a spinner, scoring on multiples of 5, played to 100, 150 or 200 |
| Chess | 2, or vs Computer (Easy / Medium / Hard) | Full rules: castling, en passant, promotion and every draw. Hard is capped at roughly 1500 strength |

Each game saves the game in progress to the browser, so closing the tab doesn't lose it.

## Structure

```
index.html              game-select carousel (the game list lives in the GAMES array near the bottom)
assets/kit.css, kit.js  shared look and helpers (buttons, dialogs, sounds, confetti) used by the newer games
assets/covers/*.svg     300×400 cover art for the carousel
games/<id>/index.html   one self-contained page per game
```

Plain HTML, CSS and JavaScript. There's no build step and nothing to install.

## Adding a game

1. Create `games/<id>/index.html`. Link `../../assets/kit.css` and `../../assets/kit.js` if you want the shared look, and add a `← Games` link to `../../index.html`.
2. Add a 300×400 cover at `assets/covers/<id>.svg` (or `.png`, then update the `img` path in `index.html`).
3. Add an entry to the `GAMES` array in `index.html`, with a title, theme colours, chips and a blurb.

## Running it

- **Locally:** run `python3 -m http.server` in this folder and open http://localhost:8000. Opening the files directly also works.
- **Online:** turn on GitHub Pages for the repo (Settings → Pages → deploy from the `main` branch, root folder). On an iPad, open the site in Safari and use **Share → Add to Home Screen** to get a full-screen, app-like icon.
