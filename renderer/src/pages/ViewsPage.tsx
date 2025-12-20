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
  const applyViewState = useAppStore((state) => state.applyViewState);
  const search = useAppStore((state) => state.search);
  const zoom = useAppStore((state) => state.zoom);
  const rangeStart = useAppStore((state) => state.rangeStart);
  const rangeEnd = useAppStore((state) => state.rangeEnd);
  const collapsedGroups = useAppStore((state) => state.collapsedGroups);

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
      rangeStart,
      rangeEnd,
      collapsedGroups
    };
    await saveView(name.trim(), state);
    setName('');
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>保存ビュー</h1>
        <p>検索条件・ズーム・折りたたみ・表示期間を保存します。</p>
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
                <span>検索 {view.state.search || '?'}</span>
                <span>
                  期間{' '}
                  {view.state.rangeStart || view.state.rangeEnd
                    ? `${view.state.rangeStart ?? '?'} → ${view.state.rangeEnd ?? '?'}`
                    : '指定なし'}
                </span>
                <span>折りたたみ {(view.state.collapsedGroups ?? []).length} 件</span>
              </div>
              <div className="list-actions">
                <button
                  className="cmd-button cmd-button--ghost"
                  onClick={() => {
                    applyViewState(view.state);
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
