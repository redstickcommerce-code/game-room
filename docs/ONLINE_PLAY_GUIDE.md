# Adding online play to a game

How to add online play to the games that don't have it yet. Snakes & Ladders, Hot Dice and Slide & Bump already have it. **`games/slide/index.html` is the reference implementation**: copy its structure, not just its ideas. Everything below matches that file as of commit `8396f89`.

## Which games are left, easiest first

| Order | Game | Players | Hidden info? | Randomness | Notes |
|---|---|---|---|---|---|
| 1 | Dots & Boxes | 2 | No | None | Smallest file (~390 lines). Good warm-up. |
| 2 | Checkers | 2 | No | None | Also has a `rec` store key (records); only the host should update it. |
| 3 | Chess | 2 | No | None | Guests work out the legal moves from the board, as in Slide. Watch promotion choice and draw offers. |
| 4 | Backgammon | 2 | No | Dice | The host rolls. Guests send the chosen move index; doubling cube decisions are separate intents. |
| 5 | Yacht | 1–4 | No | Dice | Very close to Hot Dice: the host rolls, guests toggle holds and pick categories. Copy `games/hotdice`. Only the host updates `best`. |
| 6 | Mancala | 2 | No | None | **No setup pop-up**: its settings are inline, so it needs the Same device / Online toggle and a join box added to that inline panel. |
| 7 | Dominoes | 2 | **Yes**, hands and boneyard | Shuffle | Needs per-player masked state (below). |
| 8 | Last Card | 2–4 | **Yes**, hands and deck | Shuffle | Masked state. 2–4 seats, like Slide. |
| 9 | Gin Rummy | 2 | **Yes**, hands and stock | Shuffle | Masked state. Knock and gin decisions are intents. |
| 10 | Cribbage | 2 | **Yes**, hands, crib and deck | Shuffle | Masked state. The discard-to-crib step has **both** players acting at once, so it's the hardest. |

Do one game per session. Commit and push only when asked.

## The model, in one paragraph

The **host's browser owns the game state `S`**. Guests never change `S` themselves. A guest sends an *intent* (`{t:'move', idx, seq}`, `{t:'draw', seq}` and so on). The host checks that it's that guest's turn and that `seq` matches, applies it exactly as if a local player did it, and broadcasts the new state `{t:'state', S, fx}`. Guests replace their `S` with what arrives and re-render. `fx` says what just happened, such as `'roll'`, `'draw'`, `'start'` or `'new'`, so guests can play the right sound or animation. Where every device can work out the same list of legal moves (Slide, Chess, Checkers), the host also sends `{t:'apply', idx, seq}` *before* the state, so guests animate the move rather than jump to the result.

The shared module is `assets/online.js` (Supabase Realtime, broadcast and presence, no database tables). Its API is documented at the top of the file:
`Online.host / join / newCode / cleanCode / linkFor / codeFromUrl / clearUrl / share / me`, and `room.send(msg)` (add `to: cid` to address one guest), `room.present` (a Set of client ids), `room.code`, `room.link` and `room.close()`.

## Step by step

Use `games/slide/index.html` as the template for each step; the line numbers are approximate.

### 1. HTML
- Before the game's own script, add `<script src="../../assets/online.js"></script>`; it must come after `kit.js`.
- **Setup sheet:**
  - Under the title, add the `segMode` toggle (*Same device / Online*).
  - Add a `<p class="hint" id="setupHint">`.
  - Add a `<p class="err" id="setupErr" hidden>`.
  - After the Start button, add the *Join an online game* `joinForm` (5-char code input plus a Join button).
- **Top bar:** add `<button class="btn room" id="btnRoom" hidden>`, which shows the live dot and code.
- **Overlays:** add the `lobby` overlay, the `quitBox` overlay and `<div class="toast" id="toast" hidden>`. Copy them verbatim.
- Add an *Online* bullet to the rules list.

### 2. CSS
Copy the `/* Online */` block from slide (about lines 74–98): `.hint`, `.err`, `.seatRow .fixed`, `.joinRow`, `.code`, `.seatList`, `.btn.room`, `.live` and `.toast`. Change colours to the game's own variables if they clash.

### 3. State and helpers (slide about lines 410–445)
- `cfg.mode` is `'local'` or `'online'`. `cfg.oseats = ['h','o','o','o']`: seat 0 is always the host; the others are `'o'` (online) or `'c'` (computer).
- Each seat or player gets `kind: 'local' | 'cpu' | 'remote'` and `cid`, the guest's client id. Keep the old `cpu` boolean in step so saved games and existing code still work.
- Globals: `net`, `pending`, `waiting`, `hostAway`, `shownOver`, and `const gone = new Set()`.
- Helpers to copy:

  | Helper | What it does |
  |---|---|
  | `isHost` / `isGuest` | Which side of the room this device is on. |
  | `kindOf(t)` | The seat's kind. |
  | `present(cid)` | Whether that guest is connected right now. |
  | `mine(t)` | A guest owns the seat whose `cid === Online.me`; locally it's any `'local'` seat. |
  | `myCount` / `nameOf` | Show "You" only when this device has exactly one seat. |
  | `canAct()` | Whether this device can act for the seat whose turn it is. |
  | `isAuto()` | The host plays a cpu seat, **or a remote seat whose player is not present**. |
  | `save(fx)` | Stores locally (not on guests); on the host, broadcasts the state. |

- `S` gains `seq`, a counter bumped on every state change and checked on intents; `lobby` (true while waiting for players); and `online: {code}`, which tells the host it can rejoin after a reload.
- **Notes and status text** that name a player must use `@<seat>` tokens, expanded per device by `noteText()`. Otherwise the host's "You rolled a 6" shows up as "You" on the guest's screen too.

### 4. Turn flow
- `beginTurn()` returns early on guests. On the host it runs the computer when `isAuto()`.
- Every place a human acts (tap, button) goes through a single function. On a guest it sets `waiting = true`, sends the intent with `seq`, and sets a 4-second timer that, if nothing has come back, clears `waiting` and sends `{t:'hello'}` to resync. On the host or locally, it applies the action directly. See `commit()` and `mainAction()` in slide.
- The computer's turn re-checks `isAuto()` after every `await`, because a guest may come back mid-think.

### 5. Online section (slide about lines 859–1060)
Copy these and rename `'slide'` and the share title:
`toast`, `hostRoom`, `closeRoom`, `onHostMsg`, `joinRoom`, `onGuestMsg`, `applyState`, `leaveRoom`, `endOnline`, `showLobby`, `renderLobby`, `startFromLobby`, and the lobby, share, join and quit handlers.

Things that are easy to get wrong:
- **Seat claiming.** A seat is free only if `!x.cid || gone.has(x.cid)`. The host adds to `gone` on presence `leave` and removes from it on `join` or `hello`. Without this, two guests joining at once are given the same seat and the lobby hangs.
- **`hello`.** A guest sends it on join and whenever it's unsure. In the lobby the host seats an unseated guest; otherwise it replies with the state `to: from`.
- **Guest intents.** The host rejects them unless the game is not in the lobby and not over, it isn't `busy`, the turn seat is `'remote'`, its `cid === from`, and `m.seq === S.seq`.
- **Busy guests.** While a guest is animating (`busy`), it queues an incoming state in `pending` and applies it when the animation ends.
- **`quit` from a guest.** In the lobby their seat reopens; mid-game it becomes `cpu`. Show a toast and call `beginTurn()` if it was their turn.
- **Host `leave` during a guest's turn.** Call `beginTurn()` so the computer covers for the guest. When the guest returns, they rejoin automatically (`store.get('guest')`) and take over again.
- **`btnNew` becomes Quit** while `net` is set; render sets its text. The host quitting sends `{t:'closed'}` and clears the saved game; a guest sends `{t:'quit'}`. Both go to `../../index.html` after 400ms.
- **Start anyway.** `btnLobbyNow` turns absent remote seats into cpu seats and starts.
- **The ✕ on the setup sheet** (`Kit.sheetClose`) is already wired in every game, and so is the backdrop tap. Keep the existing `Kit.sheetClose($('setup'), () => !!(COND))` line as it is.

### 6. Setup sheet logic
- `seatRows()`:
  - In online mode, seat 0 is a fixed "You · this device" label and the others get an *Online player / Computer* toggle.
  - In local mode, keep the existing Person / Computer controls.
- `syncHint()` sets the hint text, and the Start button reads **CREATE ONLINE GAME** when at least one seat is online.
- `syncLevel()`: show computer difficulty whenever any seat is cpu **or online**, because the computer covers for players who drop out.
- **Start handler:** with no remote seats, start a normal game. Otherwise, `await hostRoom()` (on error, show it in `setupErr`), then `newGame(seats, true)` and `showLobby()`.
- **2-player-only games** (most of the rest): the online version has one toggle for seat 1. If both choices make it confusing, drop the toggle and show "Online player" as fixed.

### 7. Boot (slide about lines 1062–1100)
In this order:
1. **A saved hosted game** (`saved.online && !saved.over`), and no different `?room=` in the URL: restore it and call `rehost()`, which reopens the same code.
2. **A `?room=CODE` in the URL, or a saved `guest` code:** call `offlineBoot()` behind the scenes, then `joinRoom(code)`.
3. **Otherwise:** `offlineBoot()`. It must ignore saved games that have `online` set, and turn remote seats into cpu seats for the sample board.

### 8. Hidden-information games (Dominoes, Last Card, Gin, Cribbage)
A guest's browser can read everything it's sent, so **never broadcast the full `S`**:
- Write `viewFor(cid)`. It returns a copy of `S` in which every hand except that guest's own is replaced by an array of placeholders of the same length, and the deck, stock or boneyard order is masked the same way (slide does `deck: S.deck.map(() => 0)`). A spectator, who has no seat, sees every hand masked.
- `save(fx)` on the host loops over the guests who hold seats and sends `{t:'state', S: viewFor(cid), fx, to: cid}` to each. It also sends one fully masked broadcast for spectators. Answer `hello` the same way, with `viewFor(from)`.
- Guests can't work out the legal-move list for other players. For their own turn they work it out from their own hand, which they can see. The `{t:'apply'}` replay trick only works if the move is safe to reveal, such as a card being played face-up. Draws must come from the host as state.
- Reveals at the end of a hand, such as gin layoffs or the cribbage show, are just states where the host leaves hands unmasked.
- **Cribbage discards:** both players choose at once. Let each guest send `{t:'discard', cards, seq}` whenever it's ready, and have the host advance once both seats have discarded. Don't require it to be that seat's turn.

### 9. Site listing and README
- `index.html`: in that game's `GAMES` entry, add `'Play online'` to `chips`.
- `README.md`:
  - Add "and **online** players" to the game's row.
  - Add the game to the list in the *Online play* section, along with how its sync works.
  - Add it to the `assets/online.js` line in the structure listing.

## Testing

Use two headless Chromes driven over the DevTools protocol with Node 22+ (built-in `WebSocket` and `fetch`), against a local server. Steps:

1. Run `python3 -m http.server 8765` from the repo root, in the background.
2. Launch two Chromes, one for the host and one for the guest:
   ```
   google-chrome --headless=new --remote-debugging-port=PORT --user-data-dir=$(mktemp -d)
   ```
3. Get each Chrome's page WebSocket from `http://127.0.0.1:PORT/json`.
4. Use `Runtime.evaluate` with `awaitPromise` and `returnByValue` to click buttons and read the DOM.
5. Emulate `prefers-reduced-motion: reduce` so animations don't slow the run.
6. On the host, set the mode **through the UI**: click `segMode`, then the seat toggles, then `btnStart`. Writing `localStorage` `cfg` beforehand does not work.
7. Read the code from `#lobbyCode`. Open the guest at `/games/<game>/?room=CODE`.
8. Wait in polling loops that tolerate thrown errors while pages navigate.

Check every one of these:
1. The guest joins, the host's Start button turns on, and the game starts on both devices.
2. Play a full game by whichever side `canAct()`, comparing a board snapshot from both devices after each move. Expect **0 mismatches**, and **both devices must never be able to act at once**.
3. **Play again** from the host reaches the guest.
4. The guest navigates to `about:blank` mid-game. Within about 6s the host shows "Away" and the computer plays that seat. The guest reopens the plain game URL, rejoins its seat on its own, and the boards match.
5. Two guests join a 3–4 seat game at the same moment and get **different** seats. For 2-player games, a second guest becomes a spectator.
6. **Quit:** a guest quits and the computer takes their seat. The host quits and the guest gets a toast and drops back to offline.
7. **Hidden-info games:** run `JSON.stringify(S)` on the guest and confirm it contains no opponent cards and no deck order.
8. Take screenshots at **390×800** (phone) of setup in online mode, the host and guest lobbies, and the game on the guest. Look at them.

Don't leave screenshots or scripts in the repo. Put them in the session scratchpad.

## Gotchas found so far
- **Back/forward cache.** Without the `pagehide` handling in `online.js`, a guest navigating away never fires presence `leave`. It's already handled; don't remove it.
- **Phones cache pages for up to 10 minutes** (GitHub Pages sends `max-age=600`). "I don't see the change" right after a push is usually just that.
- **Host name.** Don't show the host's own label ("You") to guests. Use `@seat` tokens, or a typed name as Hot Dice does (blank becomes "Host").
- **Computer difficulty.** Keep it visible when any seat is online, because the computer covers for players who drop out.
