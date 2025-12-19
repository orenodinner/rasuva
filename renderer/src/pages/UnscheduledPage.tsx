import { useEffect, useMemo } from 'react';
import TaskList from '../components/TaskList';
import { useAppStore } from '../state/store';

const UnscheduledPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);

  useEffect(() => {
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt]);

  const tasks = useMemo(() => {
    return gantt ? gantt.tasks.filter((task) => task.status === 'unscheduled') : [];
  }, [gantt]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Unscheduled</h1>
        <p>Tasks missing dates (start/end null).</p>
      </div>
      <TaskList tasks={tasks} onSelect={setSelectedTask} emptyLabel="No unscheduled tasks." />
    </div>
  );
};

export default UnscheduledPage;
