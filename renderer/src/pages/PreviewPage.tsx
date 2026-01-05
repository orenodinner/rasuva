import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const PreviewPage = () => {
  const navigate = useNavigate();
  const preview = useAppStore((state) => state.preview);
  const importSource = useAppStore((state) => state.importSource);
  const applyImport = useAppStore((state) => state.applyImport);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const lastError = useAppStore((state) => state.lastError);

  const handleApply = async (mode: 'incremental' | 'full') => {
    const result = await applyImport(importSource, mode);
    if (result) {
      await loadGantt(result.importId);
      navigate('/diff');
    }
  };

  const handleApplyIncremental = async () => {
    await handleApply('incremental');
  };

  const handleApplyFull = async () => {
    const confirmed = window.confirm(
      '全面改訂として適用します。現在のデータはインポート内容で置き換えられます。よろしいですか？'
    );
    if (!confirmed) {
      return;
    }
    await handleApply('full');
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

  const { summary, warnings, diffSummary } = preview;
  const archivedCount = diffSummary?.archived ?? 0;

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
      {archivedCount > 0 ? (
        <div className="alert">
          入力データに含まれないタスクが {archivedCount} 件あります。
        </div>
      ) : null}
      <div className="preview-hints">
        <div>追記・更新: 既存のタスクを残し、新しいデータのみ追加・更新します。</div>
        <div>
          全面改訂: 現在のデータをこのインポート内容で完全に置き換えます。
        </div>
        <div>※追記モードではアーカイブは発生しません。</div>
      </div>
      <div className="action-row">
        <button className="cmd-button" type="button" onClick={handleApplyIncremental}>
          追記・更新として適用
        </button>
        <button className="cmd-button cmd-button--danger" type="button" onClick={handleApplyFull}>
          全面改訂として適用
        </button>
      </div>
    </div>
  );
};

export default PreviewPage;
