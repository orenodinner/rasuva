import { useEffect } from 'react';
import GanttView from '../components/GanttView';
import { useAppStore } from '../state/store';

const GanttPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);

  useEffect(() => {
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt]);

  return (
    <div className="page gantt-page">
      <div className="page-header">
        <h1>Gantt</h1>
        <p>Member ¨ Project ¨ Task timeline view.</p>
      </div>
      <GanttView />
    </div>
  );
};

export default GanttPage;
