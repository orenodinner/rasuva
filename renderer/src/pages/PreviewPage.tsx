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
          <h1>Preview</h1>
          <p>No preview available yet.</p>
        </div>
        <button className="cmd-button" onClick={() => navigate('/import')}>
          Go to Import
        </button>
      </div>
    );
  }

  const { summary, warnings } = preview;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Preview</h1>
        <p>Validation summary before applying.</p>
      </div>
      <div className="stat-grid">
        <div className="stat-card">
          <span>Total tasks</span>
          <strong>{summary.totalTasks}</strong>
        </div>
        <div className="stat-card">
          <span>Scheduled</span>
          <strong>{summary.scheduledCount}</strong>
        </div>
        <div className="stat-card">
          <span>Unscheduled</span>
          <strong>{summary.unscheduledCount}</strong>
        </div>
        <div className="stat-card">
          <span>Invalid</span>
          <strong>{summary.invalidCount}</strong>
        </div>
        <div className="stat-card">
          <span>Warnings</span>
          <strong>{summary.warningsCount}</strong>
        </div>
      </div>
      <div className="section">
        <div className="section-header">
          <h2>Warnings</h2>
        </div>
        {warnings.length === 0 ? (
          <div className="empty-state">No warnings.</div>
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
          Apply Import
        </button>
      </div>
    </div>
  );
};

export default PreviewPage;
