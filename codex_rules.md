# Codex Rules: Rasuva プロジェクト運用ルール

このファイルは、このリポジトリで実装・運用する上での**最新ルール**をまとめたものです。

---

## 1. OSS / ライセンス（最重要）

- アプリ本体のライセンスは **Apache-2.0**（推奨）または **MIT**。
- 依存ライブラリは **OSSのみ**。原則許可:
  - MIT / Apache-2.0 / BSD-2 / BSD-3 / ISC
- 原則禁止:
  - GPL / AGPL / LGPL（例外が必要なら README に理由と影響を記載）
- 依存追加時の手順:
  1) ライセンス確認
  2) README の「Dependencies」更新
  3) `THIRD_PARTY_NOTICES.md` 更新

---

## 2. Electron セキュリティ

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`
- preload は **window.api のみ公開**（最小ブリッジ）
- IPC はチャンネル固定 + zod 検証
- 外部 URL の自由なオープン禁止（allowlist 制）
- テレメトリ/外部送信禁止

**重要:** preload から main の IPC 実装を import しない。
- 共通チャンネル定義は `electron/shared/ipcChannels.ts` に置く。

---

## 3. データ / 差分ルール

- JSON 契約は `members -> projects -> tasks`。
- 日付フォーマットは厳密に `YYYY-MM-DD`。
- `start/end = null` → `unscheduled`
- 不正日付 → `invalid_date`
- 差分キーは `project_id + task_name`。
- 重複は `#2`/`#3` サフィックスで一意化し警告。
- JSON から消えたタスクは `archived`（物理削除しない）。

---

## 4. UI / UX ルール

- 3ペイン構成を維持（SideNav / CommandBar / Main / Details）。
- `raw_date` は詳細ペインを基本とし、ガントのツールチップでは表示可。
- 未確定/不正/差分はワンクリックで見られる導線を維持。
- タスク編集は詳細ペインから **開始日/終了日/メモのみ** を許可。
- CommandBar のステータスフィルタは **全タスク/予定あり/未確定/日付不正**。

### ガント表示のルール
- 上部日付は **週単位**。
- **1月1日を 1W** とし、日曜日到来で +1（例: 2W）。
- 週ラベルの下に **月日** を表示。
- 折りたたみ（担当者/プロジェクト）と表示期間を Saved Views に保存・復元する。
- 検索一致のタスクはハイライトする。
- ガントバーはホバーで raw_date/メモの簡易ツールチップを表示。

### 差分ガントのルール
- 差分は **1つのガントチャート**で表示。
- 色:
  - 追加 = 青
  - 更新 = 赤
  - アーカイブ = グレー

### Excel エクスポートのルール
- Excel には Gantt シートを含める。
- ガント表記は ■ を緑、★ を赤で表示する。

---

## 5. 国際化 / 日本語対応

- UI 文言は日本語。
- 日付ロケールは `ja-JP`。
- HTML の `lang` は `ja`。
- エラーメッセージ/警告は日本語。

---

## 6. コード品質

- TypeScript `strict: true`。
- Domain 層は Electron 依存禁止（純粋ロジック）。
- Zustand ストアは Slice パターンを維持（import / gantt / ui / view）。
- Unit Test（最低限）:
  - 日付パース
  - unscheduled/invalid 判定
  - diff の added/updated/archived
  - 重複タスク検知

---

## 7. Build / Dev 運用

- `npm run dev` / `npm run build` / `npm run package` を提供。
- `better-sqlite3` は Electron に合わせてビルドが必要。
  - `postinstall` で `@electron/rebuild` を実行する。
- テストは Node 実行のため `pretest` で Node 向けに再ビルドする。
- SQLite のスキーマ変更は `PRAGMA user_version` マイグレーションで管理する。
- Electron dev 起動時は **localhost:5173** へフォールバック。
- CSP は dev のみ `unsafe-eval` を許容（本番は不要）。

---

## 8. 禁止事項

- Renderer で Node API 直接利用
- IPC に任意コード実行を混ぜる
- テレメトリ/外部送信
- `raw_date` を一覧に常時表示

---

以上。
