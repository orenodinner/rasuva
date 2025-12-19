# Codex Prompt: OSS Electron ガント管理アプリ（Windows 11 / 社内利用）

あなたは熟練したテックリード兼フルスタックエンジニアです。以下の要件に基づき、**OSSのみ**で構築される **Electron + TypeScript + React** のデスクトップアプリを実装してください。対象OSは **Windows 11**（ただしクロスプラットフォームでも動作してよい）。  
本プロジェクトは社内利用を想定し、**セキュリティ、可搬性、保守性、監査性、使いやすさ**を最優先にします。

---

## 0. 成果物（このリポジトリで実装すべきもの）

- Electronアプリ一式（Main / Preload / Renderer）
- JSONインポート（貼り付け / ファイル） + プレビュー/バリデーション
- 差分サマリー（Added/Updated/Archived/Invalid/Unscheduled）
- ガント表示（担当者→プロジェクト→タスクの階層）
- 未確定タスク表示（start/endがnull）
- 不正日付タスク表示（invalid_date）
- インポート履歴（過去比較の土台）
- 保存ビュー（フィルタ条件、ズーム、期間、折りたたみ状態）
- エクスポート（MVPはCSV、可能ならPDFは後回し）
- README（実行/開発/ビルド手順）
- ライセンス/依存ライセンス通知（THIRD_PARTY_NOTICES）

---

## 1. 入力データ（JSON契約）

JSONは以下の階層構造です。

- `members[]`
  - `name: string`
  - `projects[]`
    - `project_id: string`（空/ null はスキップ）
    - `group?: string`（空可）
    - `tasks[]`
      - `task_name: string`
      - `start: "YYYY-MM-DD" | null`
      - `end: "YYYY-MM-DD" | null`
      - `raw_date: string`（原文保持。UIは詳細のみ）
      - `note?: string`（空可）

日付ルール:
- `start/end` がnull → `unscheduled` 扱い（ガントのタイムラインには出さず、専用セクションに表示）
- `start/end` が不正フォーマット → `invalid_date` 扱い（タイムラインから除外、一覧に表示。raw_dateを警告に残す）
- 1日タスクは `start=end`

差分更新ルール:
- キーは `project_id + task_name`（同一プロジェクトで同名タスクが重複する場合は衝突警告）
- `start`/`end`/`note` の変更は更新
- JSONに無くなったタスクは **非表示（archived）**（物理削除はせず、監査のため保持推奨）

---

## 2. UX要件（Windows 11で最高に使いやすく）

必須UI構成（3ペイン）:
- 左: SideNav（Home / Import / Gantt / Members / Groups / Unscheduled / Invalid / Imports / Views / Export / Settings）
- 上: CommandBar（Import / Diff / Search / Zoom / Today / Toggles）
- 中央: ガント or 一覧
- 右: 詳細ペイン（選択タスクの詳細。raw_dateはここだけに表示）

MVPの画面:
1) Home（最近のインポート、クイックアクション）  
2) Import（貼り付け/ファイル）  
3) Preview（バリデーション結果 + 件数サマリー）  
4) Diff Summary（差分カード + 差分一覧）  
5) Main Gantt（階層 + タイムライン + 検索/フィルタ）  
6) Unscheduled（未確定一覧）  
7) Invalid（不正データ一覧）  
8) Imports（履歴一覧）  
9) Saved Views  
10) Settings  

ショートカット（目標）:
- Ctrl+K: 検索フォーカス
- Ctrl+O: Import（ファイル）
- T: Today
- Ctrl+1/2/3/4: Day/Week/Month/Quarter

---

## 3. 技術要件（OSS縛り / Electron）

### 推奨スタック
- Electron + TypeScript
- React + Vite（renderer）
- Zustand か Redux Toolkit（どちらかを選び、理由をREADMEに記載）
- SQLite: `better-sqlite3`（ローカル永続化）
- バリデーション: `zod`
- ガント/タイムライン: **MIT/Apache/BSD等のOSSのみ**
  - 優先候補: `vis-timeline`（MIT）または `gantt-task-react`（MIT）

### セキュリティ必須
- `contextIsolation: true`
- `nodeIntegration: false`
- preloadで `window.api` のみ公開（最小API）
- IPCはチャンネル固定 + 引数をzodで検証
- ネットワーク送信/テレメトリは禁止（オフライン動作）
- 外部URLのオープンは禁止（必要ならallowlist）

---

## 4. 実装スコープ（MVPの段階定義）

### Phase 1: 骨組み
- プロジェクト雛形（electron + vite + react + ts）
- SideNav + 画面ルーティング
- Main/Preload/Rendererの安全設定

### Phase 2: インポート〜差分
- Import（貼り付け/ファイル）→ Preview（検証）→ Apply（DB保存）
- 差分サマリー（前回インポートとの比較）
- 警告ログ（invalid/skip/duplicate）

### Phase 3: ガント表示
- Member→Project→Task の行ツリー
- タイムライン（期間レンジ、ズーム、Today）
- 未確定/不正の専用画面
- 詳細ペイン（raw_date表示はここだけ）

### Phase 4: 便利機能
- Saved Views
- CSV Export
- Imports一覧（履歴）

---

## 5. 進め方（Codexの作業手順）

- まず **リポジトリ構成** と **依存の選定** を確定し、`README` に記録する
- 次に **データ層（domain + db + diff）** を先に作り、UIは後から接続する
- UIは「壊れにくい骨格（AppShell）」→「Import/Diff」→「Gantt」の順で実装
- 迷ったら **合理的な仮定** を置いて進め、READMEの「Assumptions」に必ず記録する
- 依存追加時は `codex_rules.md` のライセンスルールに従い、禁止ライセンスを避ける

---

## 6. 受け入れ基準（最低限のDone）

- サンプルJSONを貼り付けて Import → Preview → Apply が完了する
- Diff Summaryで Added/Updated/Archived/Invalid/Unscheduled の件数と一覧が見える
- Ganttで担当者→プロジェクト→タスクが表示され、期間バーが出る（scheduledのみ）
- Unscheduled/Invalid の一覧画面がある
- 詳細ペインに raw_date が表示される（通常UIには出ない）
- 過去インポート履歴が見える
- Windows 11で起動し、操作が破綻しない

---

## 7. 最初に着手する具体タスク（ここから開始）

1) Electron+Vite+React+TSの雛形を作成（安全設定込み）
2) packages/domain に Zodスキーマ + 正規化モデル + 差分計算を実装
3) packages/db に SQLiteスキーマ + CRUD（imports/tasks/warnings）を実装
4) IPC API（import.preview / import.apply / diff.get / gantt.query）を定義
5) Import画面→Preview画面→Diff画面を接続
6) 最後にGantt画面の表示（最初は簡易でOK、段階的に改善）

このプロンプトに従って実装を開始してください。  
追加の情報が無くても、上記仕様に基づいて進め、仮定はREADMEへ明記してください。
