# Codex Prompt: Rasuva（OSS Electron ガント管理アプリ / Windows 11）

このファイルは **現在実装されている仕様** を反映した最新のプロンプトです。

---

## 0. 目的

- OSS のみで構築する Electron + TypeScript + React デスクトップアプリ。
- Windows 11 を主対象としつつクロスプラットフォーム動作も許容。
- セキュリティ、可搬性、保守性、監査性、使いやすさを最優先。

---

## 1. 実装済み機能（現状）

### 1.1 アプリ骨格
- Electron / Preload / Renderer を分離。
- SideNav + CommandBar + Main + Details の 3 ペイン構成。
- 画面ルーティング（HashRouter）。

### 1.2 JSON インポート
- JSON の貼り付け・ファイル選択に対応。
- Preview でバリデーション結果と警告一覧を表示。
- Apply で DB 保存 + Diff 計算。

### 1.3 差分サマリー
- Added / Updated / Archived / Invalid / Unscheduled の件数表示。
- 差分を 1 つのガントチャートでも表示可能（追加=青、更新=赤、アーカイブ=グレー）。

### 1.4 ガント表示
- Member → Project → Task の階層表示。
- 簡易タイムライン（独自実装、ズーム/検索/Today 対応）。
- 上部日付は週単位（1月1日=1W、日曜到来で+1）で表示し、週ラベルの下に月日を表示。
- タスクバーは日単位の長さで描画し、1日タスクは星印で表示。
- 折りたたみ（担当者/プロジェクト）と表示期間（rangeStart/rangeEnd）に対応。
- ステータスのクイックフィルタ（予定あり/未確定/日付不正）。
- ホバーで raw_date とメモのツールチップを表示。
- 検索一致タスクはハイライト表示。
- 未確定 / 不正日付の専用一覧。

### 1.5 監査・履歴
- インポート履歴一覧。
- Saved Views（検索語/ズームのみ保存）。
- CSV / Excel エクスポート（保存ダイアログで出力）。
  - Excel は Gantt シート付き（■=緑、★=赤）。

### 1.6 タスク編集
- 詳細ペインから **開始日/終了日/メモ** を編集可能。
- 開始/終了が空の場合は未確定として保存。
- 前後のタスクへ移動するナビゲーションを搭載。

### 1.7 日本語対応
- UI 文言は日本語。
- 日付ラベルは `ja-JP` で表示。
- HTML の `lang` は `ja`。
- エラーメッセージ/警告文は日本語化済み。

### 1.8 開発基盤
- Zustand ストアは Slice パターンで分割（import / gantt / ui / view）。
- SQLite は `PRAGMA user_version` を使ったマイグレーションに対応。

---

## 2. 入力データ（JSON 契約）

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

### 日付ルール
- `start/end` が `null` → `unscheduled`
- 不正フォーマット → `invalid_date`
- 1日タスクは `start=end`

### 差分ルール
- キー: `project_id + task_name`
- 重複時はサフィックス（`#2`/`#3`）で一意化し警告。
- JSON から消えたタスクは **archived**（物理削除はしない）。

---

## 3. 技術スタック（実装済み）

- Electron + TypeScript
- React + Vite（renderer）
- Zustand（状態管理）
- SQLite: `better-sqlite3`（^11.5.0）
- バリデーション: `zod`
- `electron-vite` / `@electron/rebuild` を利用

---

## 4. セキュリティ実装

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- `window.api` のみ公開（preload 経由）
- IPC はチャンネル固定 + zod 検証
- 外部 URL ナビゲーションをブロック
- CSP 追加（dev 向けに `unsafe-eval` を許容）

---

## 5. IPC（実装済み）

- `import.preview`
- `import.apply`
- `diff.get`
- `gantt.query`
- `imports.list`
- `views.list`
- `views.save`
- `export.csv`
- `export.xlsx`
- `task.update`

---

## 6. ショートカット（実装済み）

- `Ctrl+K`: 検索フォーカス
- `Ctrl+O`: インポート画面 + ファイル選択
- `T`: Today
- `Ctrl+1/2/3/4`: Day / Week / Month / Quarter

---

## 7. 既知の制限 / 未実装

- ガントは OSS ライブラリ未導入（簡易表示のみ）。
- Saved Views の範囲/折りたたみ状態の保存は未実装。
- PDF エクスポートは未実装（CSV / Excel は対応済み）。
- 大量データ向けの仮想スクロールは未対応。

---

## 8. 次の作業候補

- `vis-timeline` など OSS ガントライブラリの導入。
- Saved Views の `rangeStart/end` と `collapsedGroups` の保存。
- 大量件数の仮想スクロール対応。
- PDF 出力の追加。

---

## 9. 依存ライセンス

`THIRD_PARTY_NOTICES.md` に記載。
