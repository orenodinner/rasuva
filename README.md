# Rasuva

OSS-only Electron + TypeScript + React desktop app for internal Gantt tracking on Windows 11.
The app imports structured JSON, validates and normalizes tasks, stores snapshots in SQLite, and renders
Member -> Project -> Task timelines alongside diff summaries and audit-friendly history.

## Highlights

- Offline-only, local SQLite storage (better-sqlite3).
- SQLite schema migrations via `PRAGMA user_version`.
- Secure Electron defaults: `contextIsolation` on, `nodeIntegration` off, `sandbox` on.
- JSON import with preview + validation warnings.
- Diff summary (Added / Updated / Archived / Invalid / Unscheduled).
- Gantt timeline view, plus Unscheduled and Invalid lists.
- Import history, Saved Views, CSV/Excel export (Excel includes a Gantt sheet with green ■ and red ★).
- Saved Views restore search/zoom/range/collapsed groups; CommandBar has status quick filters.

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

Note: `postinstall` runs `electron-rebuild` (from `@electron/rebuild`) for better-sqlite3 to match the Electron runtime.

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

Note: tests run under Node, so `better-sqlite3` is rebuilt for Node via `pretest`. Electron dev/build/package uses the Electron rebuild scripts.

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
- `start/end` null -> `unscheduled`
- invalid date format -> `invalid_date`
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
- `export.xlsx`

All IPC payloads are validated with zod in the main process.

## Data storage

SQLite database is created at:
- Windows: `%APPDATA%/Rasuva/rasuva.db`

Snapshots are stored per import for auditability. Archived tasks remain in historical imports and are
reported in diff summaries.
Schema changes are applied via `PRAGMA user_version` migrations at startup.

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

## 日本語

OSS のみで構成された Electron + TypeScript + React デスクトップアプリです。
構造化 JSON をインポートして検証・正規化し、SQLite にスナップショットとして保存します。担当者 -> プロジェクト -> タスクの
タイムライン表示と差分サマリーに対応します。

## 特長

- オフライン動作のみ、ローカル SQLite へ保存（better-sqlite3）。
- `PRAGMA user_version` を使った SQLite マイグレーション。
- Electron の安全設定を有効化: `contextIsolation` on、`nodeIntegration` off、`sandbox` on。
- JSON インポートにプレビューとバリデーション警告を追加。
- 差分サマリー（Added / Updated / Archived / Invalid / Unscheduled）。
- ガントタイムラインと Unscheduled / Invalid の専用一覧。
- インポート履歴、Saved Views、CSV / Excel エクスポート（Excel はガントシート付き。■=緑、★=赤）。
- 保存ビューは検索/ズーム/表示期間/折りたたみを復元し、CommandBar にステータスフィルタを備えます。

## 技術スタック

- Electron + TypeScript
- React + Vite（renderer）
- Zustand（状態管理）
  - 理由: API が小さく、MVP のボイラープレートを抑えつつ型を維持できるため。
- SQLite: better-sqlite3
- バリデーション: zod

## プロジェクト構成

```
/electron
  /main
  /preload
/renderer
/packages
  /domain
  /db
```

## セットアップ

```bash
npm install
npm run dev
```

補足: `postinstall` で `electron-rebuild`（`@electron/rebuild`）を実行し、better-sqlite3 を Electron のバージョンに合わせて再ビルドします。

### ビルド

```bash
npm run build
```

### パッケージ（Windows）

```bash
npm run package
```

### テスト

```bash
npm run test
```

補足: テストは Node 実行のため `pretest` で `better-sqlite3` を Node 向けに再ビルドします。Electron の開発/ビルド/パッケージは Electron 向けに再ビルドします。

## JSON 契約

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

日付ルール:
- `start/end` が null -> `unscheduled`
- 不正フォーマット -> `invalid_date`
- 1 日タスクは `start=end`

## IPC インターフェース（preload）

- `import.preview`
- `import.apply`
- `diff.get`
- `gantt.query`
- `imports.list`
- `views.list`
- `views.save`
- `export.csv`
- `export.xlsx`

IPC の入力はすべて main プロセス側で zod により検証されます。

## データ保存

SQLite データベースは以下に作成されます:
- Windows: `%APPDATA%/Rasuva/rasuva.db`

インポートごとにスナップショットを保持し、監査向けに履歴を残します。
アーカイブされたタスクは過去インポート内に保持され、差分サマリーで確認できます。
スキーマ変更は起動時に `PRAGMA user_version` マイグレーションで適用されます。

## 仮定

- 重複タスクキー（`project_id + task_name`）は `#2`/`#3` のサフィックスで一意化します。
- `end` が `start` より前の場合は `invalid_date` として扱います。
- メンバー変更やグループ変更は diff の更新として扱います。
- `project_id` が欠落したプロジェクトは警告を出してスキップします。

## 依存とライセンス

OSS のライセンス表記は `THIRD_PARTY_NOTICES.md` を参照してください。

## セキュリティ

- 外部ネットワーク送信やテレメトリはありません。
- Renderer は Node API に直接アクセスできず、`window.api` のみを経由します。
- 外部 URL への遷移はデフォルトでブロックされます。
