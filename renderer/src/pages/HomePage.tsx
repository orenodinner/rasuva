import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const HomePage = () => {
  const navigate = useNavigate();
  const imports = useAppStore((state) => state.imports);
  const loadImports = useAppStore((state) => state.loadImports);

  useEffect(() => {
    loadImports();
  }, [loadImports]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Home</h1>
        <p>Recent imports and quick actions.</p>
      </div>
      <div className="card-grid">
        <button className="card" onClick={() => navigate('/import')}>
          <h3>Import JSON</h3>
          <p>Paste or load a file to start a new import.</p>
        </button>
        <button className="card" onClick={() => navigate('/gantt')}>
          <h3>Open Gantt</h3>
          <p>Review the latest timeline and drill down.</p>
        </button>
        <button className="card" onClick={() => navigate('/diff')}>
          <h3>View Diff</h3>
          <p>Check what changed since the last import.</p>
        </button>
      </div>
      <section className="section">
        <div className="section-header">
          <h2>Recent Imports</h2>
        </div>
        {imports.length === 0 ? (
          <div className="empty-state">No imports yet.</div>
        ) : (
          <div className="list">
            {imports.slice(0, 5).map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <div className="list-title">Import #{item.id}</div>
                  <div className="list-subtitle">{item.createdAt}</div>
                </div>
                <div className="list-metrics">
                  <span>Added {item.addedCount}</span>
                  <span>Updated {item.updatedCount}</span>
                  <span>Archived {item.archivedCount}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default HomePage;
