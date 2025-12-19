const SettingsPage = () => {
  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
        <p>Security-first, offline configuration.</p>
      </div>
      <div className="card">
        <h3>Runtime</h3>
        <p>Context isolation enabled. IPC is validated by zod and scoped.</p>
      </div>
      <div className="card">
        <h3>Storage</h3>
        <p>SQLite stored under the user data directory. No telemetry.</p>
      </div>
    </div>
  );
};

export default SettingsPage;
