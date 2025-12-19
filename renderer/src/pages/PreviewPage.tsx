import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const PreviewPage = () => {
  const navigate = useNavigate();
  const preview = useAppStore((state) => state.preview);
  const importSource = useAppStore((state) => state.importSource);
  const applyImport = useAppStore((state) => state.applyImport);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const lastError = useAppStore((state) => state.lastError);

  const handleApply = async () => {
    const result = await applyImport(importSource);
    if (result) {
      await loadGantt(result.importId);
      navigate('/diff');
    }
  };

  if (!preview) {
    return (
      <div className="page">
        <div className="page-header">
          <h1>プレビュー</h1>
          <p>プレビューがありません。</p>
        </div>
        <button className="cmd-button" onClick={() => navigate('/import')}>
          インポートへ
        </button>
      </div>
    );
  }

  const { summary, warnings } = preview;

  return (
    <div className="page">
      <div className="page-header">
        <h1>プレビュー</h1>
        <p>適用前の検証結果です。</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>総タスク</span>
          <strong>{summary.totalTasks}</strong>
        </div>
        <div className="stat-card">
          <span>予定あり</span>
          <strong>{summary.scheduledCount}</strong>
        </div>
        <div className="stat-card">
          <span>未確定</span>
          <strong>{summary.unscheduledCount}</strong>
        </div>
        <div className="stat-card">
          <span>不正</span>
          <strong>{summary.invalidCount}</strong>
        </div>
        <div className="stat-card">
          <span>警告</span>
          <strong>{summary.warningsCount}</strong>
        </div>
      </div>
      <div className="section">
        <div className="section-header">
          <h2>警告</h2>
        </div>
        {warnings.length === 0 ? (
          <div className="empty-state">警告はありません。</div>
        ) : (
          <div className="warning-list">
            {warnings.map((warning, index) => (
              <div key={`${warning.code}-${index}`} className="warning-item">
                <div className="warning-code">{warning.code}</div>
                <div className="warning-message">{warning.message}</div>
              </div>
            ))}
          </div>
        )}
      </div>
      {lastError ? <div className="alert">{lastError}</div> : null}
      <div className="action-row">
        <button className="cmd-button" onClick={handleApply}>
          インポートを適用
        </button>
      </div>
    </div>
  );
};

export default PreviewPage;
