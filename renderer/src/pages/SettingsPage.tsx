const SettingsPage = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>設定</h1>
        <p>セキュリティ重視、オフライン運用。</p>
      </div>
      <div className="card">
        <h3>実行環境</h3>
        <p>Context Isolation を有効化し、IPC は zod で検証します。</p>
      </div>
      <div className="card">
        <h3>保存先</h3>
        <p>SQLite をユーザーデータ配下に保存し、テレメトリはありません。</p>
      </div>
    </div>
  );
};

export default SettingsPage;
