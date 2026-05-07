# Manual Test Scenarios — Multiplayer State Synchronization

The single most important property of this app: **what P1 sees and what P2
sees must agree at all times.** These scenarios stress-test that invariant.

---

## MS-01 Symmetric move broadcast
**Steps:** P1 places X. **Expected:** Both clients render X on the same cell
within 200ms.

## MS-02 Turn indicator flips on both clients
**Steps:** P1 moves. **Expected:** Both clients update status: P1 → "Opponent
turn", P2 → "Your turn".

## MS-03 Win highlight is identical
**Steps:** P1 plays a winning move. **Expected:** Both clients highlight the
*same three cells* with the *same color/style*.

## MS-04 No move smuggling
**Steps:** Open dev tools on P2. Manually emit a `make_move` from P2's socket
while it's P1's turn. **Expected:** Server returns `NOT_YOUR_TURN`. The board
remains unchanged on both clients. (Authoritative server check.)

## MS-05 Index injection
**Steps:** Manually emit `make_move` with `index: 4` for a cell P2 doesn't
own (i.e., when it's not their turn) AND with a forged `symbol: 'X'` field.
**Expected:** Server ignores client-supplied symbol; uses the server-bound
symbol for the socket. Move rejected with `NOT_YOUR_TURN`.

## MS-06 Reset synchronization
**Steps:** After game ends, P1 clicks "Play again". **Expected:** Both
clients clear their boards; P1 starts as X again (or rotate if spec says so —
**document the choice**).

## MS-07 Late game_update arrival
**Steps:** Throttle P2's network to "Slow 3G". P1 makes 3 moves rapidly.
**Expected:** P2 eventually sees all 3 in correct order; no missing symbols.
(Socket.IO guarantees order on a single connection.)

## MS-08 Two rooms isolation
**Steps:** A/B (room 1) and C/D (room 2) play simultaneously. **Expected:**
A move in room 1 must NOT trigger any updates in room 2's clients. (Verify
via dev tools: no rogue `game_update` arrives.)
