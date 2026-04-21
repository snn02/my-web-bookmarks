# Local Setup

## Requirements

- Windows
- Node.js 24 or newer
- npm 11 or newer

## Install

```powershell
npm install
```

## Run Checks

```powershell
npm run lint
npm run typecheck
npm test
```

## Start The Local App

Open two terminals from the repository root.

Terminal 1:

```powershell
npm run dev:api
```

Terminal 2:

```powershell
npm run dev:web
```

The backend listens on `http://127.0.0.1:4321`.
The frontend is served by Vite and proxies `/api` requests to the backend.
