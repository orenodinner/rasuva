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
        <h1>ホーム</h1>
        <p>最近のインポートとクイック操作。</p>
      </div>
      <div className="card-grid">
        <button className="card" onClick={() => navigate('/import')}>
          <h3>JSONをインポート</h3>
          <p>貼り付けまたはファイル読み込みで開始します。</p>
        </button>
        <button className="card" onClick={() => navigate('/gantt')}>
          <h3>ガントを開く</h3>
          <p>最新のタイムラインを確認します。</p>
        </button>
        <button className="card" onClick={() => navigate('/diff')}>
          <h3>差分を見る</h3>
          <p>直近インポートとの差分を確認します。</p>
        </button>
      </div>
      <section className="section">
        <div className="section-header">
          <h2>最近のインポート</h2>
        </div>
        {imports.length === 0 ? (
          <div className="empty-state">インポート履歴がありません。</div>
        ) : (
          <div className="list">
            {imports.slice(0, 5).map((item) => (
              <div key={item.id} className="list-row">
                <div>
                  <div className="list-title">インポート #{item.id}</div>
                  <div className="list-subtitle">{item.createdAt}</div>
                </div>
                <div className="list-metrics">
                  <span>追加 {item.addedCount}</span>
                  <span>更新 {item.updatedCount}</span>
                  <span>アーカイブ {item.archivedCount}</span>
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
