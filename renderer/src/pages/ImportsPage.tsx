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
        <h1>Imports</h1>
        <p>History of applied imports.</p>
      </div>
      {imports.length === 0 ? (
        <div className="empty-state">No imports stored yet.</div>
      ) : (
        <div className="list">
          {imports.map((item) => (
            <div key={item.id} className="list-row list-row--action">
              <div>
                <div className="list-title">Import #{item.id}</div>
                <div className="list-subtitle">{item.createdAt}</div>
              </div>
              <div className="list-metrics">
                <span>Added {item.addedCount}</span>
                <span>Updated {item.updatedCount}</span>
                <span>Archived {item.archivedCount}</span>
              </div>
              <div className="list-actions">
                <button
                  className="cmd-button cmd-button--ghost"
                  onClick={async () => {
                    await loadDiff(item.id);
                    navigate('/diff');
                  }}
                >
                  View Diff
                </button>
                <button
                  className="cmd-button"
                  onClick={async () => {
                    await loadGantt(item.id);
                    navigate('/gantt');
                  }}
                >
                  Open
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
