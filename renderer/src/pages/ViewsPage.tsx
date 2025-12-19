import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import type { SavedViewState } from '@domain';

const zoomLabel = (value: string) => {
  if (value === 'day') return '日';
  if (value === 'week') return '週';
  if (value === 'month') return '月';
  if (value === 'quarter') return '四半期';
  return value;
};

const ViewsPage = () => {
  const [name, setName] = useState('');
  const views = useAppStore((state) => state.views);
  const loadViews = useAppStore((state) => state.loadViews);
  const saveView = useAppStore((state) => state.saveView);
  const search = useAppStore((state) => state.search);
  const zoom = useAppStore((state) => state.zoom);
  const setSearch = useAppStore((state) => state.setSearch);
  const setZoom = useAppStore((state) => state.setZoom);

  useEffect(() => {
    loadViews();
  }, [loadViews]);

  const handleSave = async () => {
    if (!name.trim()) {
      return;
    }
    const state: SavedViewState = {
      search,
      zoom,
      rangeStart: null,
      rangeEnd: null,
      collapsedGroups: []
    };
    await saveView(name.trim(), state);
    setName('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>保存ビュー</h1>
        <p>検索条件やズームを保存します。</p>
      </div>
      <div className="view-save">
        <input
          className="text-input"
          placeholder="ビュー名"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="cmd-button" onClick={handleSave}>
          現在のビューを保存
        </button>
      </div>
      {views.length === 0 ? (
        <div className="empty-state">保存されたビューはありません。</div>
      ) : (
        <div className="list">
          {views.map((view) => (
            <div key={view.id} className="list-row list-row--action">
              <div>
                <div className="list-title">{view.name}</div>
                <div className="list-subtitle">更新 {view.updatedAt}</div>
              </div>
              <div className="list-metrics">
                <span>ズーム {zoomLabel(view.state.zoom)}</span>
                <span>検索 {view.state.search || '—'}</span>
              </div>
              <div className="list-actions">
                <button
                  className="cmd-button cmd-button--ghost"
                  onClick={() => {
                    setSearch(view.state.search);
                    setZoom(view.state.zoom);
                  }}
                >
                  適用
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ViewsPage;
