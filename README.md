# Rasuva

OSS-only Electron + TypeScript + React desktop app for internal Gantt tracking on Windows 11.
The app imports structured JSON, validates and normalizes tasks, stores snapshots in SQLite, and renders
Member Å® Project Å® Task timelines alongside diff summaries and audit-friendly history.

## Highlights

- Offline-only, local SQLite storage (better-sqlite3).
- Secure Electron defaults: `contextIsolation` on, `nodeIntegration` off, `sandbox` on.
- JSON import with preview + validation warnings.
- Diff summary (Added / Updated / Archived / Invalid / Unscheduled).
- Gantt timeline view, plus Unscheduled and Invalid lists.
- Import history, Saved Views, CSV export.

## Tech stack

- Electron + TypeScript
- React + Vite (renderer)
- Zustand (state management)
  - Reason: minimal API surface, predictable store, no boilerplate for MVP while keeping strong typing.
- SQLite: better-sqlite3
- Validation: zod

## Project layout

```
/electron
  /main
  /preload
/renderer
/packages
  /domain
  /db
```

## Getting started

```bash
npm install
npm run dev
```

### Build

```bash
npm run build
```

### Package (Windows)

```bash
npm run package
```

### Tests

```bash
npm run test
```

## JSON contract

```json
{
  "members": [
    {
      "name": "Alice",
      "projects": [
        {
          "project_id": "P-001",
          "group": "Core",
          "tasks": [
            {
              "task_name": "Design",
              "start": "2024-01-10",
              "end": "2024-01-12",
              "raw_date": "2024-01-10..2024-01-12",
              "note": "Optional"
            }
          ]
        }
      ]
    }
  ]
}
```

Date rules:
- `start/end` null Å® `unscheduled`
- invalid date format Å® `invalid_date`
- 1-day task uses `start=end`

## IPC surface (preload)

- `import.preview`
- `import.apply`
- `diff.get`
- `gantt.query`
- `imports.list`
- `views.list`
- `views.save`
- `export.csv`

All IPC payloads are validated with zod in the main process.

## Data storage

SQLite database is created at:
- Windows: `%APPDATA%/Rasuva/rasuva.db`

Snapshots are stored per import for auditability. Archived tasks remain in historical imports and are
reported in diff summaries.

## Assumptions

- Duplicate task keys (`project_id + task_name`) are suffixed internally (`#2`, `#3`) to avoid collisions.
- End date before start date is treated as `invalid_date`.
- Member or project group changes are treated as updates in diff results.
- Projects missing `project_id` are skipped with warnings.

## Dependencies and licenses

See `THIRD_PARTY_NOTICES.md` for OSS license attribution.

## Security notes

- No external network calls or telemetry.
- Renderer has no direct Node access; `window.api` is the only bridge.
- External URL navigation is blocked by default.

