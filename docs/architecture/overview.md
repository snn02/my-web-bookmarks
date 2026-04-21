# Architecture Overview

## Purpose

The system is a desktop-first, local-first application for importing Chrome bookmarks, organizing them with tags and statuses, and generating AI summaries on demand.

## High-Level Modules

- `web`: Vue 3 frontend application
- `desktop-api`: Node.js backend running locally
- `shared`: shared types, DTOs, and constants
- `sqlite`: local persistence for items, tags, summaries, and settings

## Core Principle

The frontend uses a stable backend contract defined separately from the local implementation.

## Main Flows

### Bookmark Import

1. Backend reads Chrome bookmarks from the local profile.
2. Backend normalizes URLs and removes duplicates.
3. Backend stores new or updated items in SQLite.
4. Frontend refreshes the inbox view through API calls.

### AI Processing

1. User requests an AI action for an item.
2. Backend extracts or reuses article text from the source URL.
3. Backend sends content to OpenRouter.
4. Backend stores the generated result in SQLite when needed.
5. Frontend displays the result for review or use.

Supported AI actions:

- Summary generation with one editable stored version per item
- Tag suggestion

## Proposed Repository Layout

```text
apps/
  web/
  desktop-api/
packages/
  shared/
docs/
  architecture/
  product/
  api/
data/
  sqlite/
  logs/
  cache/
```
