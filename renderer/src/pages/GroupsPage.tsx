import { useEffect, useMemo } from 'react';
import { useAppStore } from '../state/store';

const GroupsPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);

  useEffect(() => {
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt]);

  const groups = useMemo(() => {
    if (!gantt) {
      return [] as Array<{ name: string; taskCount: number }>;
    }
    const counts = new Map<string, number>();
    gantt.tasks.forEach((task) => {
      const group = task.projectGroup ?? '未分類';
      counts.set(group, (counts.get(group) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, taskCount]) => ({ name, taskCount }));
  }, [gantt]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>グループ</h1>
        <p>最新インポート内のプロジェクトグループです。</p>
      </div>
      {groups.length === 0 ? (
        <div className="empty-state">グループが見つかりません。</div>
      ) : (
        <div className="list">
          {groups.map((group) => (
            <div key={group.name} className="list-row">
              <div className="list-title">{group.name}</div>
              <div className="list-metrics">
                <span>{group.taskCount} 件</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default GroupsPage;
