# My Web Bookmarks

Локальное desktop-first приложение для работы с закладками Chrome: импорт, статусы, теги и AI-сводки через OpenRouter.

## Что умеет

- Импортировать закладки из локального профиля Chrome
- Хранить данные локально в SQLite
- Управлять статусами (`new` / `read` / `archived`)
- Создавать глобальные теги и назначать их на конкретные закладки
- Генерировать и редактировать одну актуальную AI-сводку для каждой закладки
- Предлагать теги через AI без автосохранения (только после подтверждения пользователем)

## Технологии

- Frontend: Vue 3 + Vite + TypeScript
- Backend: Node.js + Express + TypeScript
- Monorepo: npm workspaces
- Хранилище: SQLite (локально)

## Требования

- Windows
- Node.js `>=24`
- npm `>=11`

## Быстрый старт

```powershell
npm install
```

Запуск в двух терминалах из корня репозитория:

Терминал 1:

```powershell
npm run dev:api
```

Терминал 2:

```powershell
npm run dev:web
```

- API: `http://127.0.0.1:4321`
- Web (Vite): `http://127.0.0.1:5173`

## Запуск через launcher (Windows)

```powershell
npm run launcher:start
npm run launcher:status
npm run launcher:restart
npm run launcher:stop
```

Опционально можно создать ярлык на рабочем столе:

```powershell
npm run launcher:create-shortcut
```

## Проверки качества

```powershell
npm run typecheck
npm run lint
npm test
npm run smoke
```

Дополнительные smoke-команды:

```powershell
npm run e2e:smoke
npm run smoke:v2
```

## Полезные npm-скрипты

- `npm run dev:api` — локальный backend
- `npm run dev:web` — локальный frontend
- `npm run test` — базовые и workspace тесты
- `npm run test:launcher` — тесты launcher-скрипта
- `npm run e2e:smoke` — e2e smoke-проверка
- `npm run smoke` — smoke runner проекта

## Структура репозитория

```text
apps/
  desktop-api/   # локальный API (/api/v1)
  web/           # UI (Inbox + Settings)
packages/
  shared/        # общие типы/DTO/контракты
docs/
  api/
  architecture/
  development/
  product/
  release/
dev_management/  # планы версий, action logs, tracking
scripts/         # launcher, smoke, e2e и служебные скрипты
data/            # локальные runtime/log/sqlite/cache директории
```

## Документация

- Локальная настройка: [`docs/development/local-setup.md`](docs/development/local-setup.md)
- Архитектура: [`docs/architecture/overview.md`](docs/architecture/overview.md)
- API-контракт: [`docs/api/local-api.md`](docs/api/local-api.md)
- Ручные smoke-сценарии: [`docs/development/manual-smoke-scenarios.md`](docs/development/manual-smoke-scenarios.md)
- Release checklist (Windows): [`docs/release/windows-release-checklist.md`](docs/release/windows-release-checklist.md)
- План V3: [`dev_management/v3_plan.md`](dev_management/v3_plan.md)

## Разработка и трекинг

Проект следует правилам `agents.md`:

- каждое изменение делается маленьким проверяемым slice
- для каждого slice должен быть GitHub Issue
- статус выполнения ведется в Issue, а roadmap/решения — в `dev_management/v3_plan.md`
- lessons learned фиксируются в `dev_management/action_log_v3.md`
