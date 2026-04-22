# My Web Bookmarks

Local desktop-first app for managing Chrome bookmarks: import, statuses, tags, and AI summaries via OpenRouter.

## Features

- Import bookmarks from a local Chrome profile
- Store data locally in SQLite
- Manage item statuses (`new` / `read` / `archived`)
- Create global tags and assign them to specific items
- Generate and edit one current AI summary per item
- Suggest tags with AI without auto-saving (saved only after user confirmation)

## Tech Stack

- Frontend: Vue 3 + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Monorepo: npm workspaces
- Storage: SQLite (local)

## Requirements

- Windows
- Node.js `>=24`
- npm `>=11`

## Quick Start

```powershell
npm install
```

Run in two terminals from the repository root.

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm run dev:web
```

- API: `http://127.0.0.1:4321`
- Web (Vite): `http://127.0.0.1:5173`

## Run With Launcher (Windows)

```powershell
npm run launcher:start
npm run launcher:status
npm run launcher:restart
npm run launcher:stop
```

Optionally create a desktop shortcut:

```powershell
npm run launcher:create-shortcut
```

## Quality Checks

```powershell
npm run typecheck
npm run lint
npm test
npm run smoke
```

Additional smoke commands:

```powershell
npm run e2e:smoke
npm run smoke:v2
```

## Useful npm Scripts

- `npm run dev:api` - run local backend
- `npm run dev:web` - run local frontend
- `npm run test` - root and workspace tests
- `npm run test:launcher` - launcher script tests
- `npm run e2e:smoke` - browser smoke checks
- `npm run smoke` - project smoke runner

## Repository Structure

```text
apps/
  desktop-api/   # local API (/api/v1)
  web/           # UI (Inbox + Settings)
packages/
  shared/        # shared types/DTOs/contracts
docs/
  api/
  architecture/
  development/
  product/
  release/
dev_management/  # version plans, action logs, tracking
scripts/         # launcher, smoke, e2e, utility scripts
data/            # local runtime/log/sqlite/cache directories
```

## Documentation

- Local setup: [`docs/development/local-setup.md`](docs/development/local-setup.md)
- Architecture: [`docs/architecture/overview.md`](docs/architecture/overview.md)
- API contract: [`docs/api/local-api.md`](docs/api/local-api.md)
- Manual smoke scenarios: [`docs/development/manual-smoke-scenarios.md`](docs/development/manual-smoke-scenarios.md)
- Release checklist (Windows): [`docs/release/windows-release-checklist.md`](docs/release/windows-release-checklist.md)
- V3 plan: [`dev_management/v3_plan.md`](dev_management/v3_plan.md)

## Development And Tracking

The project follows `agents.md`:

- Each change is shipped as a small, testable slice
- Each slice must be linked to a GitHub Issue
- Execution status lives in the Issue; roadmap and decisions live in `dev_management/v3_plan.md`
- Lessons learned are recorded in `dev_management/action_log_v3.md`
