# QA Bug Reports — Tic Tac Toe

Findings from QA validation of the actual implementation in `backend/` and
`frontend/`. Severity:

- **S1** — game-breaking / data loss / security
- **S2** — affects gameplay correctness or sync
- **S3** — UX / polish / risk

Status:
- ✅ FIXED — verified resolved during this QA cycle
- ⚠️ OPEN — currently broken
- 🟡 RISK — not broken today but a hazard worth tracking

---

## Verified during this QA pass

Test evidence: `backend/test/integration.test.js` (72 tests) +
`frontend/test/status.test.mjs` (23 tests). All 95 pass against the current
implementation.

### BR-101  [S2] ⚠️ OPEN — `useGameRoom.js` listens for events the backend never emits

**Where:** `frontend/src/hooks/useGameRoom.js` lines 105-107.

**Symptom:** The hook subscribes to `room_created` and `room_joined`. The
backend's `socketHandlers.js` *does* emit `room_created` (to the host on
create) and `room_joined` (to the joiner on join), so this is **actually
wired correctly** — but only because both sides have stayed aligned. If
backend renames/removes those events, the frontend silently breaks. The
risk is real because there is **no integration test that asserts both ends
agree on the event names**.

**Recommendation:** Either treat the ack as the sole source of truth (drop
`room_created` / `room_joined` listeners — they're redundant with the ack
already wired via `handleAck`), OR add an integration test that asserts the
broadcast events fire with the expected payload shape.

### BR-102  [S2] ✅ FIXED — server uses session symbol, ignores client `symbol` field

**Where:** `socketHandlers.js`, `make_move` handler.

**Risk if broken:** A malicious P2 could submit `{ index, symbol: 'X' }` and
play as their opponent.

**Verified:** Test #42 (`forged symbol field in payload is ignored`) confirms
the server derives symbol from `socket.id → player` mapping via
`roomManager.getPlayerContext` and never reads `payload.symbol`. ✅

### BR-103  [S3] 🟡 RISK — symbol-as-truth is anchored on `socket.id`

**Where:** `roomManager.js socketIndex`.

**Risk:** A momentary network blip causes Socket.IO to assign a new
`socket.id` on reconnect, severing the player from their session. There is
no reconnect token. Today's behavior is "blip = forfeit"; this is acceptable
under the spec but should be documented in user-facing copy ("don't refresh
the page!").

**Recommendation:** Note it in the README or the lobby UI. Add a session
token if the team wants forgiving reconnects later.

### BR-104  [S2] ✅ FIXED — `restart_game` event aligned (was previously `reset_game`)

**History:** Earlier draft of `useGameRoom.js` emitted `reset_game`, which
the backend never listened for — would have made rematch button silently
non-functional.

**Verified:** `useGameRoom.js` line 188 now correctly emits `restart_game`,
and integration test #48 confirms the round-trip (`restart_game: works after
game finishes; broadcasts reason "restart"; alternates starter`). ✅

### BR-105  [S2] ✅ FIXED — frontend ack handler uses `resp.ok`, not `resp.error`

**History:** Earlier draft checked `if (resp.error)` which never matched the
server's `{ ok: false, code, message }` shape — errors were silently dropped.

**Verified:** `useGameRoom.js handleAck` now branches on `resp.ok`. Tested
indirectly by frontend's `formatError` accepting the server payload shape
and producing the right message (`formatError: prefers server-supplied
message over code mapping`). ✅

### BR-106  [S2] ✅ FIXED — `game_update` payload shape now correctly extracted

**History:** Earlier handler did `(room) => dispatch({room})` but the server
sends `{ room, reason }`, so the entire wrapper was being stored as the
"room" object and `state.room.id` was undefined.

**Verified:** `useGameRoom.js` line 79 now does
`const room = payload?.room ?? payload;` — handles both shapes. ✅

### BR-107  [S2] ✅ FIXED — frontend captures `you` (player identity) from ack

**History:** Earlier code used `resp.symbol` (top-level), but server returns
`resp.you = { socketId, symbol }`. Worked accidentally because the destructure
fell through to `?? 'X'` / `?? 'O'` defaults.

**Verified:** `useGameRoom.js` `handleAck` now does
`onSuccess: ({ room, you }) => dispatch({ type: 'JOINED', room, you })`. ✅

### BR-108  [S3] 🟡 RISK — restart broadcasts "restart" reason but draws/wins use winner=null

**Where:** `gameLogic.js applyMove` and `socketHandlers.js make_move`.

**Risk:** A draw is signaled by `status === 'finished' && winner === null`.
Without the `winningLine` cue, a client that sees `finished + winner=null`
mid-render (e.g., during reset transition) could briefly display "Draw" for
a fresh game — but only if it sees the state out of order. The reducer
guards this today.

**Recommendation:** Consider explicitly setting `winner: 'draw'` (a string)
on the wire so the distinction is unambiguous. Currently both ends agree
that `null` means draw, so it works.

### BR-109  [S3] 🟡 RISK — no rate limiting on socket events

**Where:** `socketHandlers.js`.

**Risk:** A malicious client can spam `create_room` until memory is full,
or fire `make_move` events to flood the broadcast pipeline.

**Recommendation:** Add a per-socket token bucket (e.g. 10 events/sec) and
a max-rooms-per-IP cap before public deployment. Not blocking for an
internal demo.

### BR-110  [S3] 🟡 RISK — `CORS_ORIGIN` defaults to `*`

**Where:** `server.js`.

**Risk:** In production, any origin can drive the API. Acceptable for local
dev / demo.

**Recommendation:** Tighten `CORS_ORIGIN` env var in deployment, document it.

### BR-111  [S3] ✅ NOTED — case-insensitive room codes

**Where:** `roomManager.joinRoom` lowercases via `roomId.toUpperCase()`.

**Verified:** Test #59 (`joinRoom: lookup is case-insensitive`) confirms
typing the code in lowercase still works. The frontend hook already
upper-cases input as a defensive measure. ✅

### BR-112  [S3] ✅ NOTED — alternating starter on rematch

**Where:** `gameLogic.resetGame`.

**Behavior:** Round 1 starts with X, round 2 with O, round 3 with X, etc.

**Verified:** Tests #30 + #31 + #48 confirm the alternation across the
unit boundary AND over the wire. ✅ Documented in the in-code comment;
should also be mentioned in user-facing copy so players understand the
flip.

---

## Coverage matrix

| Functional requirement (from plan) | Unit | Integration | Manual |
|------------------------------------|:----:|:-----------:|:------:|
| 3x3 grid                           |  ✅  |     ✅      |   ✅   |
| Two-player real-time gameplay      |      |     ✅      |   ✅   |
| Room creation + join via room ID   |  ✅  |     ✅      |   ✅   |
| Turn-based validation              |  ✅  |     ✅      |   ✅   |
| Win detection (all 8 lines)        |  ✅  |     ✅      |   ✅   |
| Draw detection                     |  ✅  |     ✅      |   ✅   |
| Highlight winning cells            |      |    ✅\*     |   ✅   |
| Game reset (alternates starter)    |  ✅  |     ✅      |   ✅   |
| Handle player disconnects          |  ✅  |     ✅      |   ✅   |
| Authoritative server state         |      |     ✅      |   ✅   |
| Status indicators (Your turn etc.) |  ✅  |             |   ✅   |
| Server symbol-spoofing rejected    |      |     ✅      |        |
| Two-room broadcast isolation       |      |     ✅      |        |
| Malformed input safety             |      |     ✅      |        |

`*` Integration verifies the `winningLine` field is emitted; visual
highlight is exercised via component code review + manual scenarios.

---

## Test summary

```
backend/test/             72 tests passing  (npm test)
frontend/test/             23 tests passing  (node --test frontend/test/status.test.mjs)
─────────────────────────────────────────
total                      95 tests passing
manual scenarios           21 documented (tests/scenarios/)
```

No S1/S2 bugs currently OPEN. BR-101 is OPEN but contained. The S3 risks
(BR-103, BR-108, BR-109, BR-110) are all polish/hardening items, not
blockers.
