import { useEffect, useMemo } from 'react';
import { useAppStore } from '../state/store';

const MembersPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);

  useEffect(() => {
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt]);

  const members = useMemo(() => {
    if (!gantt) {
      return [] as Array<{ name: string; taskCount: number }>;
    }
    const counts = new Map<string, number>();
    gantt.tasks.forEach((task) => {
      counts.set(task.memberName, (counts.get(task.memberName) ?? 0) + 1);
    });
    return Array.from(counts.entries()).map(([name, taskCount]) => ({ name, taskCount }));
  }, [gantt]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>担当者</h1>
        <p>担当者ごとのタスク数です。</p>
      </div>
      {members.length === 0 ? (
        <div className="empty-state">担当者が見つかりません。</div>
      ) : (
        <div className="list">
          {members.map((member) => (
            <div key={member.name} className="list-row">
              <div className="list-title">{member.name}</div>
              <div className="list-metrics">
                <span>{member.taskCount} 件</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MembersPage;
