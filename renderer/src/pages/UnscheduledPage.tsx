import { useEffect, useMemo } from 'react';
import TaskList from '../components/TaskList';
import { useAppStore } from '../state/store';

const UnscheduledPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const setTaskOrder = useAppStore((state) => state.setTaskOrder);

  useEffect(() => {
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt]);

  const tasks = useMemo(() => {
    return gantt ? gantt.tasks.filter((task) => task.status === 'unscheduled') : [];
  }, [gantt]);

  useEffect(() => {
    setTaskOrder(tasks);
  }, [tasks, setTaskOrder]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>未確定</h1>
        <p>開始日/終了日が空のタスク一覧です。</p>
      </div>
      <TaskList tasks={tasks} onSelect={setSelectedTask} emptyLabel="未確定はありません。" />
    </div>
  );
};

export default UnscheduledPage;
