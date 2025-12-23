import { useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const CommandBar = () => {
  const navigate = useNavigate();
  const searchRef = useRef<HTMLInputElement>(null);
  const { search, setSearch, zoom, setZoom, setFocusDate, undo, redo, canUndo, canRedo } = useAppStore();
  const statusFilter = useAppStore((state) => state.statusFilter);
  const setStatusFilter = useAppStore((state) => state.setStatusFilter);
  const gantt = useAppStore((state) => state.gantt);

  useEffect(() => {
    const handler = () => searchRef.current?.focus();
    window.addEventListener('app:focus-search', handler as EventListener);
    return () => window.removeEventListener('app:focus-search', handler as EventListener);
  }, []);

  const statusCounts = useMemo(() => {
    const tasks = gantt?.tasks ?? [];
    return tasks.reduce(
      (acc, task) => {
        acc.total += 1;
        if (task.status === 'scheduled') acc.scheduled += 1;
        if (task.status === 'unscheduled') acc.unscheduled += 1;
        if (task.status === 'invalid_date') acc.invalid += 1;
        return acc;
      },
      { total: 0, scheduled: 0, unscheduled: 0, invalid: 0 }
    );
  }, [gantt]);

  return (
    <div className="command-bar">
      <div className="command-bar__left">
        <button className="cmd-button" onClick={() => navigate('/import')}>
          インポート
        </button>
        <button className="cmd-button" onClick={() => navigate('/diff')}>
          差分
        </button>
        <button className="cmd-button cmd-button--ghost" onClick={undo} disabled={!canUndo}>
          Undo
        </button>
        <button className="cmd-button cmd-button--ghost" onClick={redo} disabled={!canRedo}>
          Redo
        </button>
        <button
          className="cmd-button cmd-button--ghost"
          onClick={() => setFocusDate(new Date().toISOString().slice(0, 10))}
        >
          今日
        </button>
      </div>
      <div className="command-bar__center">
        <input
          ref={searchRef}
          className="search-input"
          placeholder="タスク・担当者・プロジェクトを検索"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </div>
      <div className="command-bar__right">
        <div className="filter-group">
          <button
            className={
              statusFilter === 'all'
                ? 'filter-pill filter-pill--active'
                : 'filter-pill filter-pill--ghost'
            }
            onClick={() => setStatusFilter('all')}
            aria-pressed={statusFilter === 'all'}
          >
            すべて ({statusCounts.total})
          </button>
          <button
            className={
              statusFilter === 'scheduled'
                ? 'filter-pill filter-pill--scheduled filter-pill--active'
                : 'filter-pill filter-pill--scheduled'
            }
            onClick={() => setStatusFilter('scheduled')}
            aria-pressed={statusFilter === 'scheduled'}
          >
            予定あり ({statusCounts.scheduled})
          </button>
          <button
            className={
              statusFilter === 'unscheduled'
                ? 'filter-pill filter-pill--unscheduled filter-pill--active'
                : 'filter-pill filter-pill--unscheduled'
            }
            onClick={() => setStatusFilter('unscheduled')}
            aria-pressed={statusFilter === 'unscheduled'}
          >
            未確定 ({statusCounts.unscheduled})
          </button>
          <button
            className={
              statusFilter === 'invalid_date'
                ? 'filter-pill filter-pill--invalid filter-pill--active'
                : 'filter-pill filter-pill--invalid'
            }
            onClick={() => setStatusFilter('invalid_date')}
            aria-pressed={statusFilter === 'invalid_date'}
          >
            日付不正 ({statusCounts.invalid})
          </button>
        </div>
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
              {level === 'day'
                ? '日'
                : level === 'week'
                  ? '週'
                  : level === 'month'
                    ? '月'
                    : '四半期'}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default CommandBar;
