import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { NormalizedTask } from '@domain';
import { useAppStore } from '../state/store';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const toUtc = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
};

const diffDays = (start: string, end: string) => {
  return Math.floor((toUtc(end) - toUtc(start)) / MS_PER_DAY);
};

const addDays = (start: string, days: number) => {
  const [year, month, day] = start.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  const nextYear = date.getUTCFullYear();
  const nextMonth = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const nextDay = `${date.getUTCDate()}`.padStart(2, '0');
  return `${nextYear}-${nextMonth}-${nextDay}`;
};

const formatLabel = (date: string) => {
  const [year, month, day] = date.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: '2-digit'
  });
};

const zoomConfig = {
  day: { unitDays: 1, columnWidth: 28 },
  week: { unitDays: 7, columnWidth: 48 },
  month: { unitDays: 30, columnWidth: 72 },
  quarter: { unitDays: 90, columnWidth: 90 }
} as const;

const groupTasks = (tasks: NormalizedTask[]) => {
  const members = new Map<string, Map<string, NormalizedTask[]>>();
  tasks.forEach((task) => {
    if (!members.has(task.memberName)) {
      members.set(task.memberName, new Map());
    }
    const projects = members.get(task.memberName)!;
    if (!projects.has(task.projectId)) {
      projects.set(task.projectId, []);
    }
    projects.get(task.projectId)!.push(task);
  });
  return members;
};

const GanttView = () => {
  const gantt = useAppStore((state) => state.gantt);
  const search = useAppStore((state) => state.search);
  const zoom = useAppStore((state) => state.zoom);
  const focusDate = useAppStore((state) => state.focusDate);
  const setFocusDate = useAppStore((state) => state.setFocusDate);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);

  const scrollRef = useRef<HTMLDivElement>(null);

  const filteredTasks = useMemo(() => {
    if (!gantt) {
      return [] as NormalizedTask[];
    }
    const query = search.trim().toLowerCase();
    const tasks = gantt.tasks.filter((task) => task.status === 'scheduled');
    if (!query) {
      return tasks;
    }
    return tasks.filter((task) => {
      const haystack = [
        task.memberName,
        task.projectId,
        task.projectGroup ?? '',
        task.taskName,
        task.note ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(query);
    });
  }, [gantt, search]);

  const { rows, rangeStart, rangeEnd } = useMemo(() => {
    const scheduled = filteredTasks.filter((task) => task.start && task.end);
    if (scheduled.length === 0) {
      return { rows: [], rangeStart: null as string | null, rangeEnd: null as string | null };
    }

    const sortedByStart = [...scheduled].sort((a, b) =>
      a.start!.localeCompare(b.start!)
    );
    const sortedByEnd = [...scheduled].sort((a, b) => a.end!.localeCompare(b.end!));
    const rangeStart = sortedByStart[0].start!;
    const rangeEnd = sortedByEnd[sortedByEnd.length - 1].end!;

    const members = groupTasks(scheduled);
    const rows: Array<{
      id: string;
      type: 'member' | 'project' | 'task';
      label: string;
      task?: NormalizedTask;
      level: number;
    }> = [];

    Array.from(members.entries()).forEach(([memberName, projects]) => {
      rows.push({ id: `member:${memberName}`, type: 'member', label: memberName, level: 0 });
      Array.from(projects.entries()).forEach(([projectId, tasks]) => {
        rows.push({
          id: `project:${memberName}:${projectId}`,
          type: 'project',
          label: projectId,
          level: 1
        });
        tasks.forEach((task) => {
          rows.push({
            id: `task:${task.taskKeyFull}`,
            type: 'task',
            label: task.taskName,
            task,
            level: 2
          });
        });
      });
    });

    return { rows, rangeStart, rangeEnd };
  }, [filteredTasks]);

  useEffect(() => {
    if (!focusDate || !rangeStart) {
      return;
    }
    const config = zoomConfig[zoom];
    const offsetDays = diffDays(rangeStart, focusDate);
    const scrollLeft = Math.max(0, (offsetDays / config.unitDays) * config.columnWidth - 120);
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft;
    }
    setFocusDate(null);
  }, [focusDate, rangeStart, zoom, setFocusDate]);

  if (!gantt || gantt.tasks.length === 0) {
    return <div className="empty-state">No imports loaded yet.</div>;
  }

  if (!rangeStart || !rangeEnd) {
    return <div className="empty-state">No scheduled tasks to render on the timeline.</div>;
  }

  const { unitDays, columnWidth } = zoomConfig[zoom];
  const rangeDays = diffDays(rangeStart, rangeEnd) + 1;
  const columnCount = Math.ceil(rangeDays / unitDays);
  const timelineWidth = columnCount * columnWidth;
  const labelWidth = 260;

  const ganttStyle: CSSProperties = { ['--column-width' as string]: `${columnWidth}px` };

  return (
    <div className="gantt" style={ganttStyle}>
      <div className="gantt-scroll" ref={scrollRef}>
        <div className="gantt-grid" style={{ minWidth: labelWidth + timelineWidth }}>
          <div className="gantt-row gantt-row--header">
            <div className="gantt-label gantt-label--header" style={{ width: labelWidth }}>
              Workstream
            </div>
            <div className="gantt-timeline" style={{ width: timelineWidth }}>
              {Array.from({ length: columnCount }).map((_, index) => {
                const labelDate = addDays(rangeStart, index * unitDays);
                return (
                  <div
                    key={labelDate}
                    className="gantt-tick"
                    style={{ width: columnWidth }}
                  >
                    {formatLabel(labelDate)}
                  </div>
                );
              })}
            </div>
          </div>
          {rows.map((row) => (
            <div
              key={row.id}
              className={`gantt-row gantt-row--${row.type}`}
              onClick={() => row.task && setSelectedTask(row.task)}
            >
              <div
                className={`gantt-label gantt-label--level-${row.level}`}
                style={{ width: labelWidth }}
              >
                {row.label}
              </div>
              <div className="gantt-timeline" style={{ width: timelineWidth }}>
                {row.type === 'task' && row.task && row.task.start && row.task.end ? (
                  <div
                    className="gantt-bar"
                    style={{
                      left:
                        (diffDays(rangeStart, row.task.start) / unitDays) * columnWidth,
                      width:
                        Math.max(
                          columnWidth,
                          Math.ceil((diffDays(row.task.start, row.task.end) + 1) / unitDays) *
                            columnWidth
                        )
                    }}
                  >
                    <span>{row.task.taskName}</span>
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default GanttView;
