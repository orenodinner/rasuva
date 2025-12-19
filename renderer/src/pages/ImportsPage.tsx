import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const ImportsPage = () => {
  const navigate = useNavigate();
  const imports = useAppStore((state) => state.imports);
  const loadImports = useAppStore((state) => state.loadImports);
  const loadDiff = useAppStore((state) => state.loadDiff);
  const loadGantt = useAppStore((state) => state.loadGantt);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>インポート履歴</h1>
        <p>適用済みインポートの一覧です。</p>
      </div>
      {imports.length === 0 ? (
        <div className="empty-state">履歴がありません。</div>
      ) : (
        <div className="list">
          {imports.map((item) => (
            <div key={item.id} className="list-row list-row--action">
              <div>
                <div className="list-title">インポート #{item.id}</div>
                <div className="list-subtitle">{item.createdAt}</div>
              </div>
              <div className="list-metrics">
                <span>追加 {item.addedCount}</span>
                <span>更新 {item.updatedCount}</span>
                <span>アーカイブ {item.archivedCount}</span>
              </div>
              <div className="list-actions">
                <button
                  className="cmd-button cmd-button--ghost"
                  onClick={async () => {
                    await loadDiff(item.id);
                    navigate('/diff');
                  }}
                >
                  差分を見る
                </button>
                <button
                  className="cmd-button"
                  onClick={async () => {
                    await loadGantt(item.id);
                    navigate('/gantt');
                  }}
                >
                  開く
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ImportsPage;
