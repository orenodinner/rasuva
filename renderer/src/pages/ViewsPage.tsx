import { useEffect, useState } from 'react';
import { useAppStore } from '../state/store';
import type { SavedViewState } from '@domain';

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
        <h1>Saved Views</h1>
        <p>Store filter and zoom presets.</p>
      </div>
      <div className="view-save">
        <input
          className="text-input"
          placeholder="View name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <button className="cmd-button" onClick={handleSave}>
          Save Current View
        </button>
      </div>
      {views.length === 0 ? (
        <div className="empty-state">No saved views yet.</div>
      ) : (
        <div className="list">
          {views.map((view) => (
            <div key={view.id} className="list-row list-row--action">
              <div>
                <div className="list-title">{view.name}</div>
                <div className="list-subtitle">Updated {view.updatedAt}</div>
              </div>
              <div className="list-metrics">
                <span>Zoom {view.state.zoom}</span>
                <span>Search {view.state.search || '?'}</span>
              </div>
              <div className="list-actions">
                <button
                  className="cmd-button cmd-button--ghost"
                  onClick={() => {
                    setSearch(view.state.search);
                    setZoom(view.state.zoom);
                  }}
                >
                  Apply
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
