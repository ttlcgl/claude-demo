# Tic Tac Toe — Multiplayer (AI-Native Demo)

An **AI-native demonstration project** showcasing a real-time, two-player Tic Tac Toe game. Built end-to-end with **Claude**, this project demonstrates how modern AI assistants can architect, implement, test, and document full-stack web applications.

**Frontend:** React 18 + TailwindCSS  
**Backend:** Node.js + Express + Socket.IO  
**Built with:** Claude (Anthropic) + Claude Code  

Players create or join a room via a short room ID, take turns on a 3×3 grid, and see live updates (moves, win/draw, disconnects) over WebSockets.

---

## What Makes This AI-Native?

This project demonstrates how AI can handle the entire software development lifecycle:

- **Architecture & Design** — Comprehensive product spec, technical design, and project planning
- **Full-Stack Implementation** — Backend game logic, frontend UI, real-time synchronization
- **Testing** — 95+ automated tests (unit, integration, and end-to-end)
- **Documentation** — Clear specs, guides, QA reports, and deployment instructions
- **DevOps-Ready** — Infrastructure-as-code (Render), deployment guides, environment configuration
- **Project Management** — Task tracking, memory systems, development workflows

**Learning Value:** Study how Claude approaches system design, code organization, testing, and documentation. Use this as a reference for AI-assisted development practices.

---

## Table of Contents

1. [Tech Stack](#tech-stack)
2. [Project Structure](#project-structure)
3. [Prerequisites](#prerequisites)
4. [Quick Start](#quick-start)
5. [Run Commands](#run-commands)
6. [Environment Variables](#environment-variables)
7. [Developer Workflow](#developer-workflow)
8. [Testing](#testing)
9. [Cloud Deployment](#cloud-deployment-optional)
10. [Known Issues](#known-issues)
11. [Troubleshooting](#troubleshooting)

---

## Tech Stack

| Layer    | Tech                                           |
| -------- | ---------------------------------------------- |
| Frontend | React 18, Vite 5, TailwindCSS, socket.io-client |
| Backend  | Node.js 20+, Express 4, Socket.IO 4             |
| Tooling  | npm, concurrently, `node --test`, `node --watch` |

> No external test runners or process managers. Both apps use Node's built-in `--watch` (hot reload) and `node:test` runner — keeps the toolchain small.

---

## Project Structure

```
tic-tac-toe/
├── frontend/                # React + Vite + Tailwind client
│   ├── src/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   ├── index.css
│   │   ├── components/
│   │   ├── hooks/
│   │   └── lib/
│   ├── test/                # node:test suites (.test.mjs)
│   ├── index.html
│   ├── package.json
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── vite.config.js
│   ├── vercel.json          # SPA rewrites for Vercel
│   └── .env.example
│
├── backend/                 # Node + Express + Socket.IO server
│   ├── server.js            # entrypoint (HTTP + Socket.IO bootstrap)
│   ├── src/
│   │   ├── gameLogic.js     # board state + win/draw detection
│   │   ├── roomManager.js   # in-memory room registry
│   │   └── socketHandlers.js
│   ├── test/                # node:test suites (.test.js)
│   ├── package.json
│   └── .env.example
│
├── tests/                   # QA-authored cross-app scenarios + reports
├── specs/                   # Product spec
├── plans/                   # Original team plan
├── render.yaml              # Render.com deploy spec for backend
├── package.json             # Root: orchestration scripts
└── README.md
```

---

## Prerequisites

- **Node.js** `>= 20.0.0` — install via [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org)
- **npm** `>= 10.0.0` (bundled with Node 20)
- A modern browser (Chrome, Firefox, Safari, Edge)

Verify your versions:

```bash
node -v   # v20.x.x or higher
npm -v    # 10.x.x or higher
```

> The backend's own `package.json` declares `engines.node >= 18`, but the root workspace requires Node 20 because the frontend tests use `node --test` with ESM `.mjs` files that benefit from Node 20's improved test runner.

---

## Quick Start

Clone, install, and run both apps with three commands:

```bash
git clone <repo-url> tic-tac-toe
cd tic-tac-toe
npm run setup && npm run dev
```

Then open:

- **Frontend (game UI):** http://localhost:5173
- **Backend health check:** http://localhost:3001/health

To play, open the frontend in **two browser windows** (or one regular + one incognito). Create a room in the first; copy the room ID and join from the second.

---

## Run Commands

The root `package.json` orchestrates both apps using [`concurrently`](https://www.npmjs.com/package/concurrently). Stopping the dev session (Ctrl-C) kills both processes; if either crashes, the other is killed with it (`--kill-others-on-fail`).

| Command                  | What it does                                                                |
| ------------------------ | --------------------------------------------------------------------------- |
| `npm run setup`          | Install root, backend, and frontend dependencies                            |
| `npm run dev`            | Run backend (port 3001) **and** frontend (port 5173) together               |
| `npm run dev:backend`    | Run only the backend (`node --watch server.js`)                             |
| `npm run dev:frontend`   | Run only the frontend (`vite`)                                              |
| `npm run build`          | Build the production frontend bundle to `frontend/dist/`                    |
| `npm run preview`        | Preview the production frontend build at http://localhost:5173              |
| `npm start`              | Run the backend in production mode (`node server.js`)                       |
| `npm test`               | Run all backend + frontend tests                                            |
| `npm run test:backend`   | `node --test` against `backend/test/`                                       |
| `npm run test:frontend`  | `node --test` against `frontend/test/`                                      |
| `npm run clean`          | Remove all `node_modules/` directories and the frontend `dist/`             |

### Backend-only

```bash
cd backend
npm install
npm run dev      # node --watch server.js — restarts on file changes
npm start        # node server.js — production mode
npm test         # node --test test/
```

### Frontend-only

```bash
cd frontend
npm install
npm run dev      # vite — dev server with HMR on http://localhost:5173
npm run build    # vite build → frontend/dist
npm run preview  # serve the production build locally
```

---

## Environment Variables

Both apps ship with `.env.example` files. Copy them before first run:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

> `.env` files are gitignored. Only `.env.example` is tracked.

### Backend (`backend/.env`)

| Variable        | Default                  | Purpose                                              |
| --------------- | ------------------------ | ---------------------------------------------------- |
| `PORT`          | `3001`                   | Port the Express + Socket.IO server listens on       |
| `CORS_ORIGIN`   | `*`                      | Allowed origin(s) (comma-separated). Tighten in prod |
| `NODE_ENV`      | `development`            | `development` \| `production` (prod trims log noise) |

### Frontend (`frontend/.env`)

Vite requires the `VITE_` prefix for variables exposed to the browser.

| Variable           | Default                  | Purpose                                  |
| ------------------ | ------------------------ | ---------------------------------------- |
| `VITE_SOCKET_URL`  | `http://localhost:3001`  | Socket.IO endpoint the client connects to |

---

## Developer Workflow

A typical session:

1. **Pull latest:** `git pull`
2. **Install if `package.json` changed:** `npm run setup`
3. **Start everything:** `npm run dev`
4. **Open two browser tabs** at http://localhost:5173 — create a room in one, join with the room ID in the other.
5. **Edit code** — backend and frontend both hot-reload automatically.
6. **Run tests** before pushing: `npm test`

### Recommended VS Code extensions

- **ESLint** (`dbaeumer.vscode-eslint`)
- **Tailwind CSS IntelliSense** (`bradlc.vscode-tailwindcss`)
- **Prettier** (`esbenp.prettier-vscode`)

### Hot reload

- **Backend:** `node --watch server.js` restarts the server on file changes (no nodemon needed).
- **Frontend:** Vite's HMR pushes updates without a full page reload.

---

## Testing

Both apps use Node's built-in `node:test` runner — no Jest, Mocha, or Vitest required.

### Backend (`backend/test/`)

```bash
npm run test:backend
# or:
cd backend && npm test
```

Covers: room creation/joining, move validation, turn enforcement, win/draw detection, integration round-trips against a live Socket.IO instance.

### Frontend (`frontend/test/`)

```bash
npm run test:frontend
# or:
node --test frontend/test/
```

Covers: pure phase-derivation logic in `src/lib/status.js` (status messages, opponent detection, draw/win formatting).

### End-to-end smoke test (manual)

1. `npm run dev`
2. Open two browser windows.
3. Window A: click **Create Room** → copy room ID.
4. Window B: paste room ID → click **Join**.
5. Alternate moves — verify state syncs in both windows.
6. Force a win → verify winning cells highlight in both windows.
7. Close one window → verify the other shows "Opponent disconnected".

QA's full scenario suite lives under `tests/scenarios/` and has been validated against the live system (95 automated tests passing).

---

## Cloud Deployment (Optional)

The frontend deploys to **Vercel** as a static SPA. The backend deploys to **Render** as a long-running Node service. Render is used over serverless platforms because Socket.IO requires long-lived WebSocket connections, which serverless functions break.

### Backend → Render

A `render.yaml` is provided at the repo root for one-click IaC deploys:

```yaml
services:
  - type: web
    name: tic-tac-toe-backend
    runtime: node
    rootDir: backend
    plan: free
    buildCommand: npm install
    startCommand: npm start
    healthCheckPath: /health
    envVars:
      - key: NODE_ENV
        value: production
      - key: CORS_ORIGIN
        sync: false   # Set in Render dashboard after frontend deploys
```

Steps:
1. Push the repo to GitHub.
2. In Render: **New → Blueprint** → select the repo → confirm `render.yaml`.
3. After deploy, set `CORS_ORIGIN` in the Render dashboard to your Vercel URL (e.g. `https://tic-tac-toe.vercel.app`) and redeploy.
4. Note the public URL, e.g. `https://tic-tac-toe-backend.onrender.com`.

### Frontend → Vercel

A `frontend/vercel.json` is provided:

```json
{
  "framework": "vite",
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "installCommand": "npm install",
  "rewrites": [{ "source": "/(.*)", "destination": "/index.html" }]
}
```

Steps:
1. In Vercel: **Add New → Project** → import the repo.
2. Set **Root Directory** to `frontend`.
3. Add environment variable: `VITE_SOCKET_URL=https://tic-tac-toe-backend.onrender.com`.
4. Deploy.

### Post-deploy checklist

- [ ] Backend `/health` returns `{ "status": "ok", ... }`.
- [ ] Render's `CORS_ORIGIN` matches the Vercel domain (no trailing slash).
- [ ] `VITE_SOCKET_URL` points at the Render URL with **`https://`**.
- [ ] Two-window smoke test passes against the deployed URLs.

> **Free-tier note:** Render's free instances sleep after 15 minutes of inactivity and take ~30s to wake on the first request. Upgrade to a paid plan for production use.

---

## Known Issues

The QA team validated the system as production-ready with the following caveats:

- **`restart_game` / `leave_room` ack-signature bug** *(low impact, backend pending fix)*
  Specific ack callbacks for these two events return a non-standard signature. The frontend has a workaround in place — gameplay is unaffected. Fix tracked for a future backend patch.
- **S3 backlog items (non-blocking):**
  - Rate limiting on Socket.IO events (DoS hardening)
  - Tighter CORS defaults (currently permissive `*`)
  - Automatic reconnect-and-rejoin flow for transient drops
  - Draw-message literal copy refinement

None of these block local play or the documented deployment path.

---

## Troubleshooting

| Symptom                                                | Likely cause / fix                                                                                                  |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------- |
| `EADDRINUSE: address already in use :::3001`           | Another process is on port 3001. Kill it (`lsof -ti:3001 \| xargs kill`) or change `PORT` in `backend/.env`.        |
| Client connects but no events fire                     | `VITE_SOCKET_URL` is wrong, or `CORS_ORIGIN` doesn't include the client URL. Restart both apps after changing.      |
| `CORS` error in browser console                        | Add the client origin to `CORS_ORIGIN` (comma-separate multiple values) and restart the backend.                    |
| Tailwind classes don't apply                           | Confirm `tailwind.config.js` `content` globs cover `./src/**/*.{js,jsx}` and Vite was restarted after edits.        |
| `npm run dev` exits immediately                        | One sub-process crashed — `--kill-others-on-fail` brings the other down. Run `npm run dev:backend` and `npm run dev:frontend` separately to see which. |
| Disconnect not detected on Render                      | Free-tier Render idles WebSockets after inactivity. Upgrade plan or add a heartbeat ping.                           |
| `node: command not found`                              | Install Node 20+ via nvm: `nvm install 20 && nvm use 20`.                                                           |

If you're still stuck, set `NODE_ENV=development` (verbose backend logs) and check the browser DevTools **Network → WS** tab for the Socket.IO frames.

---

## Using This as an AI-Native Reference

This project demonstrates best practices for AI-assisted development. Study these aspects:

### Code Organization
- **Clear separation of concerns** — backend logic, frontend UI, shared types
- **Minimal dependencies** — Leverages built-in Node.js features (`node:test`, `node --watch`)
- **Readable code** — Well-named functions, single responsibility, no over-engineering

### Testing Strategy
- **Test coverage** — 95+ tests covering happy paths and edge cases
- **Integration tests** — Tests that verify Socket.IO communication works end-to-end
- **No mocks for critical paths** — Real Socket.IO server for integration tests

### Documentation
- **Product spec** — Clear goals, personas, and user stories (in `specs/`)
- **QA reports** — Comprehensive test coverage matrix and known issues (in `tests/`)
- **Deployment guides** — Step-by-step instructions for production deployment
- **Memory system** — Structured notes for context sharing (in `.claude/`)

### Development Tools (`.claude/` folder)
- **Custom commands** — Slash commands for frequently-used tasks
- **Skills & agents** — Reusable workflows and specialized tools
- **Hooks** — Automated pre-commit checks and validation
- **Templates** — Boilerplate for consistent code generation

### AI Development Practices
- **Iterative refinement** — Code evolved through multiple rounds of testing
- **Error handling** — Graceful failures with clear error messages
- **Security-first** — Input validation, CORS configuration, no hardcoded secrets
- **DevOps parity** — Production deployment mirrors local development environment

---

## License

MIT

---

**Built with [Claude](https://claude.ai) by Anthropic**
