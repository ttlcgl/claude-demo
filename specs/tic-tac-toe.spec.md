# Tic Tac Toe — Product Specification

**Author:** Product Manager
**Status:** Draft v1 — ready for Tech Lead architecture review
**Last updated:** 2026-05-07

---

## 1. Product Summary

A real-time, two-player multiplayer Tic Tac Toe game played in the browser. Two
people, on different devices, share a room code to play a single match against
each other on a 3x3 grid. The server is the source of truth for all game state;
clients render and submit moves but do not arbitrate rules.

The MVP is intentionally narrow: one game, one room, two players. No accounts,
no matchmaking, no spectators, no chat, no persistence beyond the lifetime of a
room.

---

## 2. Goals & Non-Goals

### Goals
- Enable two friends to play Tic Tac Toe in real time using only a shared room
  code, with zero signup.
- Provide unambiguous status feedback at every step (waiting, your turn, win,
  lose, draw, opponent disconnected).
- Make the game fair: turns, moves, and outcomes are validated server-side.
- Recover gracefully from common failure modes (refresh, brief disconnect,
  opponent leaves).

### Non-Goals (explicitly out of scope for v1)
- User accounts, profiles, avatars, persistent stats.
- Matchmaking, public lobbies, rankings, ELO.
- Spectator mode, replays, move history beyond the current game.
- AI / single-player mode.
- In-game chat or emotes.
- Boards larger than 3x3 or rule variants.
- Mobile native apps (responsive web only).

---

## 3. Personas & User Stories

**Persona — "The Inviter" (Player A):** wants to start a quick game with a
specific friend; needs a code/link to share.

**Persona — "The Joiner" (Player B):** receives the code from a friend; wants
to join with one action and start playing.

### Core stories
1. As Player A, I can create a new room and receive a short, shareable room
   code so I can invite Player B.
2. As Player B, I can enter that room code and immediately join Player A's
   game.
3. As either player, I can see whose turn it is and the current board state at
   all times.
4. As either player, I can place a mark on an empty cell only on my turn.
5. As either player, I can see immediately when the game ends and how (win,
   loss, draw) with the winning line highlighted on a win.
6. As either player, I can request a rematch after the game ends; the game
   resets only when both players agree.
7. As either player, I am told clearly when my opponent disconnects and what
   options I have (wait / leave).

---

## 4. Game Rules

- Board: 3x3 grid, 9 cells, all empty at start.
- Players: exactly two per room. Player A is assigned mark `X`, Player B is
  assigned mark `O`. `X` always moves first.
- A turn consists of placing the player's mark on any empty cell.
- Players alternate turns. A player may not move on the opponent's turn.
- A player may not place a mark on an occupied cell.
- The game ends when:
  - A player has three of their marks in a row, column, or diagonal — that
    player wins, the other loses.
  - All 9 cells are filled with no winner — draw.
- The 8 winning lines are: 3 rows, 3 columns, 2 diagonals.
- On a win, the three winning cells must be visually highlighted.
- After the game ends, the board is frozen. No further moves are accepted
  until a rematch starts.

---

## 5. Room Model

- A **room** is a transient game session identified by a **room code**.
- Room code: 6 characters, uppercase alphanumeric, omitting visually ambiguous
  characters (`0`, `O`, `1`, `I`, `L`). Generated server-side. Must be unique
  among active rooms.
- A room holds at most 2 players. The first to arrive is `X`, the second is
  `O`.
- A third connection attempting to join a full room is rejected with a clear
  "Room is full" error.
- A room is destroyed when:
  - Both players have disconnected and the grace window (see §7) has elapsed,
    or
  - A player explicitly leaves and the other leaves or times out, or
  - The room has been idle (no moves, no presence) for 30 minutes.
- Room codes may be reused after the room is destroyed.

---

## 6. User Flows

### 6.1 Create Room (Player A)
1. Player A lands on the home screen.
2. Player A clicks **Create Room**.
3. Server creates the room, assigns Player A as `X`, returns a room code.
4. Player A is taken to the game screen with status **"Waiting for opponent —
   share code `ABC123`"**.
5. A **Copy code** button copies the code to the clipboard.

### 6.2 Join Room (Player B)
1. Player B lands on the home screen.
2. Player B types the room code into the **Join Room** input and clicks
   **Join**.
3. Validation: code must be 6 characters; otherwise show inline error.
4. Server looks up the room:
   - Not found → "No room with that code."
   - Already has 2 players → "Room is full."
   - Found and has 1 player → Player B joins as `O`.
5. Both clients transition to **In-Game**. Player A's status changes from
   "Waiting" to "Your turn" (X moves first). Player B sees "Opponent's turn".

### 6.3 Play Game
1. The current player clicks an empty cell.
2. Client sends the move to the server. Cell shows an optimistic
   loading/disabled state until server confirms (target < 200ms on healthy
   connection).
3. Server validates: correct player, correct turn, cell empty, game not over.
   Invalid → server rejects with reason; client reverts and shows toast.
4. Server updates state, checks for win/draw, broadcasts updated state to both
   clients.
5. Both clients render the updated board. Status flips ("Your turn" /
   "Opponent's turn").
6. On win/draw, both clients transition to **Game Over** with the appropriate
   result and (on win) the winning line highlighted.

### 6.4 Rematch / Restart
1. After **Game Over**, each player sees a **Rematch** button and a **Leave**
   button.
2. Clicking **Rematch** marks that player as ready; status shows "Waiting for
   opponent to accept rematch".
3. When both players have clicked **Rematch**, the server resets the board.
   Marks are swapped: previous `O` plays `X` in the new game (so the loser /
   second player gets first move next round). `X` always moves first.
4. If one player clicks **Leave**, the room is closed and the remaining player
   is returned to the home screen with a "Opponent left" notice.

### 6.5 Leave / End Session
- A player can click **Leave** at any time to exit the room.
- Closing the tab is treated as a disconnect (see §7), not a deliberate leave,
  for a short grace period.

---

## 7. Edge Cases & Error Handling

### 7.1 Disconnects
- **Mid-game disconnect (network blip / refresh):**
  - Server marks the player as `disconnected` but retains room state for a
    **15-second grace window**.
  - Remaining player sees status: **"Opponent disconnected — waiting up to
    15s..."** with a countdown.
  - If the player reconnects within the window (same session token), they
    resume in the same role with the same board state. Status returns to
    normal.
  - If the window elapses, the room transitions to **Game Abandoned**. The
    remaining player sees "Opponent left" and is offered **Return to home**.
- **Pre-game disconnect (creator leaves before opponent joins):** room is
  destroyed; if anyone tries to join with that code, they get "No room with
  that code."
- **Both players disconnect:** room is cleaned up after the grace window.

### 7.2 Reconnection
- Each client receives a session token on create/join. Storing it in
  `sessionStorage` allows reconnection within the grace window to restore the
  player's seat.
- On reconnect, the server replays the current authoritative game state to the
  client.

### 7.3 Invalid Moves
The server rejects and the client surfaces a brief toast with the reason:
- Move on an occupied cell → "That cell is taken."
- Move when it's not your turn → "It's not your turn."
- Move after game over → "Game is already over."
- Move with no opponent present → "Waiting for opponent."

Invalid moves never mutate state. The client must reconcile to server state on
any rejection.

### 7.4 Simultaneous / Race Conditions
- The server processes moves in arrival order on a per-room queue; only the
  first valid move from the correct player on a given turn is accepted.
- Because turns alternate and only one player is "active" at a time, a true
  simultaneous-move conflict should be impossible — but the server must still
  defend against it (e.g. a buggy/tampered client).

### 7.5 Malformed Input
- Non-existent room codes, malformed payloads, oversize messages, or
  unauthenticated events are rejected with a generic error and logged
  server-side. Clients show a friendly "Something went wrong" message.

### 7.6 Idle Games
- If neither player has moved for **5 minutes** during an active game, both
  clients show an "Are you still there?" nudge. After **30 minutes** total
  idle, the room is destroyed.

---

## 8. UI Requirements

### 8.0 Visual Theme — Dark Theme (Hard Requirement)

The product ships with a **dark theme only**. This is non-negotiable for v1:
not toggleable, no light-mode fallback, no system-preference override. The
Tech Lead and Frontend Engineer must design around this from day one.

**Color tokens (Tailwind palette names are normative):**

| Role                      | Token / Value                                  |
|---------------------------|------------------------------------------------|
| App background            | `slate-900` (or `zinc-950` for deeper variant) |
| Elevated surfaces (cards, board, modals) | `slate-800`                       |
| Primary text              | `slate-100`                                    |
| Muted / secondary text    | `slate-400`                                    |
| Player **X** mark & accent | `cyan-400`                                    |
| Player **O** mark & accent | `fuchsia-400`                                 |
| Winning cell highlight    | `emerald-400` with a subtle outer glow         |
| Error / destructive       | `rose-400` (suggested; FE may finalize)        |
| Focus ring                | `cyan-400` at 60% opacity (suggested)          |

**Constraints:**
- The `X` and `O` accent colors are part of the gameplay grammar — they must
  be used consistently for player chips, status banner highlights, and the
  marks themselves so a player's color identity is unambiguous.
- The winning-cell highlight (`emerald-400` + glow) must be visually
  distinguishable from the player accents and from focus/hover states; it is
  reserved exclusively for win celebration.
- All foreground/background pairings must meet **WCAG AA** contrast (4.5:1
  for body text, 3:1 for large text and non-text UI). The Frontend Engineer
  is responsible for verifying contrast on the chosen tokens.
- Color is never the sole signal (per §8.3). The dark theme palette must
  coexist with the typographic and shape cues already required.
- No flashing, no neon, no gradient backgrounds. Glow on the winning line
  should be subtle (e.g. soft shadow / outer ring), not pulsing or animated.

### 8.1 Screens
1. **Home / Lobby**
   - App title.
   - **Create Room** button (primary).
   - **Join Room** input (6-char code, auto-uppercased) + **Join** button.
   - Inline validation errors.
2. **Waiting Room** (creator only, before opponent joins)
   - Large room code display.
   - **Copy code** button with copied confirmation.
   - "Waiting for opponent..." status with subtle animation.
   - **Cancel / Leave** button.
3. **In-Game**
   - 3x3 board, large tap targets, clearly distinguishable `X` and `O`.
   - Status banner (see §8.2).
   - Player chips: "You (X)" / "Opponent (O)" with connection dot
     (green = connected, amber = reconnecting, gray = gone).
   - **Leave** button.
4. **Game Over**
   - Result banner: **You win!** / **You lose.** / **Draw.**
   - Winning line highlighted on the board (subtle background or stroke on
     the 3 winning cells).
   - **Rematch** button (shows "Waiting for opponent..." after click if the
     other has not yet accepted).
   - **Leave** button.

### 8.2 Status Indicator (always visible during In-Game)
Exactly one of:
- "Waiting for opponent..."
- "Your turn"
- "Opponent's turn"
- "You win!"
- "You lose."
- "Draw."
- "Opponent disconnected — waiting 15s..." (with live countdown)
- "Opponent left."
- "Reconnecting..." (own connection lost)

### 8.3 Visual & Interaction
- Clean modern look using Tailwind on the dark palette defined in §8.0.
  Generous whitespace, large touch targets (min 44x44 px on the cell hit
  area).
- Responsive: works on a 320px-wide phone and on desktop. Board is square and
  centered; controls stack vertically on narrow screens.
- The active player's cells should show a hover/focus affordance only when it
  is their turn and the cell is empty. Cells must be visibly disabled
  otherwise.
- Keyboard accessible: cells are focusable, Enter/Space places a mark on your
  turn. `Tab` order is left-to-right, top-to-bottom.
- Color is not the sole signal: `X` and `O` are typographically distinct; the
  winning line uses both color and a shape change (e.g. ring/border).
- No flashing or rapid animations. Transitions under 300ms.

### 8.4 Copy
All user-facing strings are short, friendly, and unambiguous. Avoid jargon
("session", "socket"). Errors say what happened and what to do.

---

## 9. Functional Acceptance Criteria

The product is acceptable when **all** of the following hold:

### Room lifecycle
- [ ] Creating a room returns a unique 6-char code in under 500ms on a healthy
      connection.
- [ ] Joining a valid, non-full room places the joiner as `O` and starts the
      game with `X` to move.
- [ ] Joining a non-existent code shows "No room with that code."
- [ ] Joining a full room shows "Room is full."
- [ ] Room codes do not collide with any other active room.

### Gameplay
- [ ] `X` always moves first in a fresh game.
- [ ] A player can only place a mark on an empty cell on their own turn.
- [ ] All 8 winning lines are correctly detected and end the game with the
      correct winner.
- [ ] A full board with no line is correctly detected as a draw.
- [ ] On a win, the 3 winning cells are visually highlighted on both clients.
- [ ] After game over, no further moves are accepted on the board.
- [ ] Both clients always see the same board state within 500ms of any move
      on a healthy connection.

### Rematch
- [ ] Rematch starts only after both players accept.
- [ ] On rematch, the board is empty and `X` moves first.
- [ ] Marks are swapped between players on rematch.
- [ ] If one player chooses Leave instead, the room ends cleanly for both.

### Disconnects
- [ ] A player who refreshes the page within 15 seconds resumes their seat
      and game state.
- [ ] After 15 seconds disconnected, the remaining player is told the
      opponent left and offered "Return to home".
- [ ] If the creator leaves before anyone joins, the code becomes invalid.

### Validation
- [ ] An attempt to play out of turn is rejected with a clear message and no
      state change.
- [ ] An attempt to play on an occupied cell is rejected with a clear message
      and no state change.
- [ ] An attempt to play after game over is rejected.
- [ ] Server is the source of truth: a tampered client cannot place an `O` on
      `X`'s turn or claim a fake win.

### UI / Status
- [ ] Exactly one status indicator from §8.2 is visible at all times during
      In-Game.
- [ ] All four screens (Home, Waiting, In-Game, Game Over) render correctly
      on a 320px-wide viewport and on a 1440px desktop viewport.
- [ ] All interactive elements are reachable via keyboard and have visible
      focus states.
- [ ] App is rendered exclusively in the dark theme defined in §8.0; no
      light-mode flash on first paint, no theme toggle present in the UI.
- [ ] `X` is rendered in `cyan-400` and `O` in `fuchsia-400` on every
      surface where a mark or player accent appears (board, player chips,
      status banner).
- [ ] On a win, the three winning cells are highlighted with `emerald-400`
      and a subtle glow, distinguishable from focus/hover styles.
- [ ] All text passes WCAG AA contrast on the chosen surface colors.

### Performance
- [ ] Move round-trip (click → server ack → both boards updated) under 200ms
      on localhost; under 500ms on a typical residential connection.
- [ ] Initial page load under 2 seconds on a typical residential connection
      (uncached).

---

## 10. Open Questions for Tech Lead

These are deliberately left for the Tech Lead to decide; flagged here so they
are not lost:

1. **Session tokens** — opaque server-generated string vs. signed JWT? PM only
   requires that a player can resume their seat across a refresh within the
   grace window.
2. **Room code collision strategy** — generate-and-retry vs. coordinator? PM
   only requires uniqueness among active rooms.
3. **Transport** — the brief specifies Socket.IO; PM has no objection. Plain
   WebSockets would also satisfy the spec if there is a strong reason.
4. **Persistence** — PM does not require any database. In-memory room state
   is acceptable for v1.
5. **Auth** — none required for v1. Consider a simple per-room token to
   prevent a malicious third party who guesses the code from hijacking a
   seat.

---

## 11. Out-of-Scope but Worth Tracking (v2 candidates)

- Shareable join URL (e.g. `/r/ABC123`) in addition to code entry.
- Display name entry on home screen ("Mehmet" instead of "Opponent").
- Sound effects for moves and game-over.
- Best-of-N series with score tracking across rematches.
- Spectator links.
- Light theme / theme toggle. (v1 is dark-only by design — see §8.0.)

---

**End of spec.** Tech Lead: please use §4 (rules), §5 (room model), §6 (flows),
§7 (edge cases), and §9 (acceptance criteria) as the contract. Architecture,
event names, payload shapes, and folder structure are yours to define.
