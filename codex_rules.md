# Codex Rules: OSS Electron ガント管理アプリ（ルール / ガードレール）

このファイルは、実装中に守るべき**ルール**を定義します。  
目的は「社内利用で安全」「OSSのみ」「保守容易」「差分更新に強い」アプリを確実に作ることです。

---

## 1. OSS / ライセンスのルール（最重要）

- プロジェクト本体のライセンスは **Apache-2.0**（推奨）または **MIT**
- 依存ライブラリは **OSSのみ**。以下を原則許可:
  - MIT / Apache-2.0 / BSD-2 / BSD-3 / ISC
- 以下のライセンスは**原則禁止**（社内利用で揉めやすい）:
  - GPL / AGPL / LGPL（例外が必要ならREADMEに理由と影響を書く）
- 新しい依存を追加する場合:
  1) `package.json` に追加する前にライセンスを確認
  2) READMEの「Dependencies」へ追記
  3) `THIRD_PARTY_NOTICES.md` へ反映（自動生成でも可）

---

## 2. Electronセキュリティルール（必須）

- `contextIsolation: true`
- `nodeIntegration: false`
- `sandbox: true`（可能な範囲で）
- RendererからNode APIを直接呼ばない
- Preloadは **最小の橋渡し** のみ（`window.api` に限定公開）
- IPC:
  - チャンネル名は定数化（文字列直書き禁止）
  - 引数は **zodで検証**（検証失敗は必ず拒否）
  - 返り値も型を固定（TypeScript型 + 実行時の形を維持）

禁止:
- 任意のコマンド実行（child_process）
- 外部URLの自由なオープン
- 勝手なネットワーク送信（テレメトリ/解析/広告/自動アップロード）

---

## 3. データ/差分ルール（仕様の核）

### 3.1 正規化モデル
- JSONをそのままUIに渡さない
- Domain層で以下に変換してから扱う:
  - Member / Project / Task（status: scheduled/unscheduled/invalid_date）
- `raw_date` は必ず保持する（UIは詳細のみ）

### 3.2 差分更新
- タスク差分キー: `project_id + task_name`
- 更新判定: `start/end/note/raw_date` の変更
- 削除扱い: 今回JSONに無い→ `is_archived=true`（物理削除しない）
- 同名タスク重複:
  - 衝突を検出し警告に出す
  - 内部キーはサフィックス等で一意化してDB破綻を防ぐ

### 3.3 日付パース
- 受理するフォーマットは厳密に `YYYY-MM-DD`
- 不正は `invalid_date` とし、タイムラインから除外
- start/endがnullは `unscheduled`

---

## 4. UI/UX ルール（迷わせない）

- 3ペイン構成を崩さない:
  - SideNav / CommandBar / Main / Details
- `raw_date` は通常UIに表示しない（詳細ペインのみ）
- 「未確定」「不正」「差分」は必ずワンクリックで見られる場所に置く
- 大量データを想定（数千タスク）:
  - 仮想スクロール/レンダリング最適化を検討
  - フィルタ・検索は応答性優先

---

## 5. コード品質ルール

- TypeScriptは `strict: true`
- Lint/Format:
  - ESLint + Prettier（設定を固定）
- フォルダ境界:
  - `packages/domain`（純粋ロジック：パース/正規化/差分）
  - `packages/db`（SQLiteアクセス）
  - `electron/*`（Main/Preload/IPC）
  - `renderer/*`（UI）
- Domain層はElectronに依存しない（テストしやすくする）

---

## 6. テストルール（最低限）

- Domain層は必ずユニットテストを書く（vitest推奨）
  - 日付パース
  - unscheduled/invalid判定
  - 差分（added/updated/archived）
  - 重複タスク検出
- DB層は少なくともCRUDのスモークテスト（可能ならインメモリ/テンポラリDB）
- 重要バグが出たら、まず再現テストを追加してから直す

---

## 7. 変更管理ルール（README更新）

- 仮定（Assumptions）をREADMEに書く
- 依存を追加したらREADMEに理由を残す
- 仕様変更を入れる場合:
  - 仕様の根拠（なぜ必要か）
  - 影響範囲（UI/DB/差分）
  - 移行（マイグレーション）が必要か

---

## 8. ビルド/配布ルール（Windows 11）

- `npm run dev` / `npm run build` / `npm run package` を提供
- electron-builder等でWindows向けビルドを用意（OSSのみ）
- オフライン環境でも起動・操作できること（依存のダウンロードを実行時にしない）

---

## 9. 禁止事項まとめ（即NG）

- GPL/AGPL依存の追加（許可無しで入れない）
- RendererでNode統合（nodeIntegration=true）
- IPCに任意コード実行やファイルシステム全面公開
- テレメトリ/外部送信
- raw_dateを一覧やツールチップに常時露出（詳細のみ）

---

このルールに従って実装・レビュー・依存管理を行うこと。
