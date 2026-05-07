# Manual / Exploratory Test Scenarios — Edge Cases

These scenarios complement the automated suite. Run them manually after a
release candidate is built. Each scenario lists Steps / Expected / Pass-Fail.

Legend: 🟢 = automated also covers this, 🟡 = automated partially, 🔴 = manual only.

---

## EC-01 🟢 Click on an occupied cell
**Steps:**
1. P1 places X on cell 4.
2. P2 clicks cell 4.

**Expected:** P2's click is ignored. No `make_move` is sent OR server replies
`CELL_OCCUPIED`. UI shows no flicker, no double-symbol.

---

## EC-02 🟢 Click out of turn
**Steps:**
1. P1 places X on cell 0.
2. P1 immediately clicks cell 1 (still their turn? No — it's O's turn).

**Expected:** Click is rejected client-side (board disabled) or server replies
`NOT_YOUR_TURN`. P1's UI status reads "Opponent turn".

---

## EC-03 🟡 Opponent disconnects mid-game
**Steps:**
1. P1 and P2 are mid-game (3 moves played).
2. P2 closes their browser tab.

**Expected:**
- Within ~5s, P1 sees a banner: "Opponent disconnected".
- P1's board becomes read-only.
- P1 has the option to leave or start a new room.

**Failure modes to look for:**
- P1 board still accepts clicks (allows ghost moves)
- P1 gets no notification at all
- Server console crashes or leaks the room

---

## EC-04 🔴 Host disconnects before guest joins
**Steps:**
1. P1 creates room.
2. P1 closes the tab before P2 joins.
3. P2 attempts to join with the room code.

**Expected:** P2 sees "Room not found".

---

## EC-05 🔴 Two browsers on same machine
**Steps:**
1. P1 in Chrome creates room.
2. P2 in Firefox joins with the room code.

**Expected:** Game runs as normal. Symbols are correctly assigned (X to first,
O to second). No state leak between tabs.

---

## EC-06 🔴 Refresh during game
**Steps:**
1. P1 and P2 mid-game.
2. P1 refreshes the page (F5).

**Expected:** Server treats this as a disconnect (since no session token /
auth). P2 is notified. P1 lands on the home screen — they cannot rejoin.

> NOTE: If the spec is later extended to support reconnect, add a session
> token and update this scenario.

---

## EC-07 🔴 Network blip (dev tools "offline" toggle)
**Steps:**
1. P1 and P2 mid-game.
2. Toggle P2 to offline for ~3 seconds, then back online.

**Expected:** Socket.IO auto-reconnect either:
- (a) restores the same socket → game continues seamlessly, OR
- (b) treats as disconnect → P1 is notified and game ends.

Either is acceptable, but the BEHAVIOR MUST BE CONSISTENT — no half-state
where P2's UI thinks game is live but server has dropped them.

---

## EC-08 🔴 Race: both players click "reset" simultaneously
**Steps:**
1. Game finishes.
2. P1 and P2 click "Play again" within ~50ms of each other.

**Expected:** Server processes one reset. The other is a no-op or returns OK
on an already-fresh game. Board ends up empty, P1 (X) to move.

**Failure mode:** Board flickers or ends up with stale symbols.

---

## EC-09 🟢 Move attempted while waiting for second player
**Steps:**
1. P1 creates room.
2. P1 clicks a cell before P2 joins.

**Expected:** Click is rejected. Server replies `GAME_NOT_IN_PROGRESS` or
client suppresses it. UI clearly says "Waiting for opponent".

---

## EC-10 🔴 Spam clicks on the same cell
**Steps:**
1. P1 rapidly clicks cell 0 ten times within ~200ms.

**Expected:** At most ONE X is placed. Subsequent clicks are no-ops. No
"NOT_YOUR_TURN" error spam in the UI.

---

## EC-11 🔴 Very long room idle
**Steps:**
1. P1 creates a room and waits 30 minutes without joining.
2. Try to join with the code.

**Expected:** Either:
- (a) Room still alive, P2 joins normally, OR
- (b) Server has GC'd it, P2 sees "Room not found".

> Document which behavior is implemented in the README so users aren't surprised.

---

## EC-12 🔴 Mobile / responsive
**Steps:**
1. Open on iPhone SE viewport (375×667).
2. Play a full game.

**Expected:**
- Board is square, all cells tappable.
- Status banner is readable.
- No horizontal scroll.
- Tap targets ≥ 44×44px.

---

## EC-13 🔴 Accessibility smoke
**Steps:**
1. Tab through the page with keyboard.
2. Use Enter / Space to place a symbol.

**Expected:**
- All cells reachable via Tab.
- Screen reader announces "Cell 1, empty" or "Cell 1, X".
- Status changes are announced (`aria-live="polite"`).
