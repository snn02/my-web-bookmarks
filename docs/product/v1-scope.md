# V1 Scope

## Goal

Create a local-first Windows application for collecting and processing Chrome bookmarks saved from Android for later reading.

## Fixed Technical Choices

- Frontend: Vue 3 + TypeScript
- Backend: Node.js + TypeScript
- Database: SQLite
- Integration for AI: OpenRouter

## Product Boundaries

### Included in V1

- Import bookmarks from Chrome on Windows
- Store imported items in a local database
- Show bookmark list in a web UI
- Support statuses: new, read, archived
- Support manual tagging
- Support AI-generated tags
- Support AI-generated summaries with manual editing
- Search and filtering

### Not Included in V1

- Reading open mobile tabs directly from Chrome sync
- Editing Chrome bookmarks from the app
- Multi-user mode
- Mandatory cloud backend
- Local LLM inference

## Architecture Principles

- Frontend works only through a stable backend boundary so the local backend can later be replaced or extended by a remote one
