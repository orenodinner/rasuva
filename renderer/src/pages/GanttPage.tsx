import { useEffect, useMemo, useRef } from 'react';
import ContextMenu from '../components/ContextMenu';
import GanttView from '../components/GanttView';
import { useAppStore } from '../state/store';

const GanttPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const rangeStart = useAppStore((state) => state.rangeStart);
  const rangeEnd = useAppStore((state) => state.rangeEnd);
  const setRange = useAppStore((state) => state.setRange);
  const collapsedGroups = useAppStore((state) => state.collapsedGroups);
  const setCollapsedGroups = useAppStore((state) => state.setCollapsedGroups);
  const collapseAll = useAppStore((state) => state.collapseAll);
  const expandAll = useAppStore((state) => state.expandAll);

  const allGroupIds = useMemo(() => {
    if (!gantt?.tasks) {
      return [];
    }
    const groupIds = new Set<string>();
    gantt.tasks.forEach((task) => {
      const members = new Set([task.memberName, ...(task.assignees ?? [])]);
      members.forEach((memberName) => {
        if (!memberName || memberName.trim().length === 0) {
          return;
        }
        groupIds.add(`member:${memberName}`);
        groupIds.add(`project:${memberName}:${task.projectId}`);
      });
    });
    return Array.from(groupIds);
  }, [gantt]);

  const storageKey = currentScheduleId ? `rasuva:view:${currentScheduleId}` : null;
  const hasLoadedRef = useRef(false);

  useEffect(() => {
    if (!currentScheduleId) {
      return;
    }
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt, currentScheduleId]);

  useEffect(() => {
    if (!storageKey) {
      return;
    }
    hasLoadedRef.current = false;
    let nextGroups: string[] | null = null;
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as { collapsedGroups?: unknown };
        if (Array.isArray(parsed.collapsedGroups)) {
          nextGroups = parsed.collapsedGroups.filter(
            (value): value is string => typeof value === 'string'
          );
        }
      }
    } catch {
      nextGroups = null;
    }
    setCollapsedGroups(nextGroups ?? []);
    hasLoadedRef.current = true;
  }, [storageKey, setCollapsedGroups]);

  useEffect(() => {
    if (!storageKey || !hasLoadedRef.current) {
      return;
    }
    const payload = JSON.stringify({ collapsedGroups });
    localStorage.setItem(storageKey, payload);
  }, [storageKey, collapsedGroups]);

  if (!currentScheduleId) {
    return (
      <div className="page gantt-page">
        <div className="page-header">
          <h1>ガント</h1>
          <p>スケジュールを選択してください。</p>
        </div>
      </div>
    );
  }

  return (
    <div className="page gantt-page">
      <div className="page-header">
        <h1>ガント</h1>
        <p>担当者 → プロジェクト → タスクのタイムラインです。</p>
      </div>
      <div className="view-toggle">
        <label className="range-control">
          <span>開始</span>
          <input
            className="text-input"
            type="date"
            value={rangeStart ?? ''}
            onChange={(event) => setRange(event.target.value || null, rangeEnd)}
          />
        </label>
        <label className="range-control">
          <span>終了</span>
          <input
            className="text-input"
            type="date"
            value={rangeEnd ?? ''}
            onChange={(event) => setRange(rangeStart, event.target.value || null)}
          />
        </label>
        <button
          className="cmd-button cmd-button--ghost"
          type="button"
          onClick={() => setRange(null, null)}
        >
          期間リセット
        </button>
        <button
          className="cmd-button cmd-button--ghost"
          type="button"
          onClick={() => collapseAll(allGroupIds)}
          disabled={allGroupIds.length === 0}
        >
          すべて折りたたむ
        </button>
        <button
          className="cmd-button cmd-button--ghost"
          type="button"
          onClick={expandAll}
          disabled={collapsedGroups.length === 0}
        >
          すべて展開
        </button>
      </div>
      <GanttView />
      <ContextMenu />
    </div>
  );
};

export default GanttPage;
