import { useEffect, useMemo } from 'react';
import TaskList from '../components/TaskList';
import { useAppStore } from '../state/store';

const InvalidPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);

  useEffect(() => {
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt]);

  const tasks = useMemo(() => {
    return gantt ? gantt.tasks.filter((task) => task.status === 'invalid_date') : [];
  }, [gantt]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>Invalid Dates</h1>
        <p>Tasks with invalid date formats.</p>
      </div>
      <TaskList tasks={tasks} onSelect={setSelectedTask} emptyLabel="No invalid tasks." />
    </div>
  );
};

export default InvalidPage;
