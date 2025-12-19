import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const CommandBar = () => {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const { search, setSearch, zoom, setZoom, setFocusDate } = useAppStore();

  useEffect(() => {
    const handler = () => searchRef.current?.focus();
    window.addEventListener('app:focus-search', handler as EventListener);
    return () => window.removeEventListener('app:focus-search', handler as EventListener);
  }, []);

  return (
    <div className="command-bar">
      <div className="command-bar__left">
        <button className="cmd-button" onClick={() => navigate('/import')}>
          Import
        </button>
        <button className="cmd-button" onClick={() => navigate('/diff')}>
          Diff
        </button>
        <button
          className="cmd-button cmd-button--ghost"
          onClick={() => setFocusDate(new Date().toISOString().slice(0, 10))}
        >
          Today
        </button>
      </div>
      <div className="command-bar__center">
        <input
          ref={searchRef}
          className="search-input"
          placeholder="Search tasks, members, projects"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="command-bar__right">
        <div className="zoom-group">
          {(['day', 'week', 'month', 'quarter'] as const).map((level) => (
            <button
              key={level}
              className={
                zoom === level ? 'cmd-button cmd-button--active' : 'cmd-button cmd-button--ghost'
              }
              onClick={() => setZoom(level)}
              aria-pressed={zoom === level}
            >
              {level[0].toUpperCase() + level.slice(1)}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandBar;
