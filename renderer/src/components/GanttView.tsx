import { useEffect, useMemo, useRef } from 'react';
import type { CSSProperties } from 'react';
import type { NormalizedTask } from '@domain';
import { useAppStore } from '../state/store';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;

const toUtcDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
};

const diffDays = (start: Date, end: Date) => {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
};

const getSundayOnOrBefore = (date: Date) => {
  const day = date.getUTCDay();
  return addDays(date, -day);
};

const getNextSundayAfter = (date: Date) => {
  const day = date.getUTCDay();
  const offset = day === 0 ? 7 : 7 - day;
  return addDays(date, offset);
};

const getWeekStart = (dateStr: string) => {
  const date = toUtcDate(dateStr);
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const firstSunday = getNextSundayAfter(jan1);
  if (date.getTime() < firstSunday.getTime()) {
    return jan1;
  }
  return getSundayOnOrBefore(date);
};

const getWeekNumber = (weekStart: Date) => {
  const year = weekStart.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const firstSunday = getNextSundayAfter(jan1);

  if (weekStart.getTime() <= jan1.getTime() || weekStart.getTime() < firstSunday.getTime()) {
    return { week: 1, year };
  }

  const diffWeeks = Math.floor((weekStart.getTime() - firstSunday.getTime()) / MS_PER_WEEK);
  return { week: diffWeeks + 2, year };
};

const formatMonthDay = (date: Date) => {
  return date.toLocaleDateString('ja-JP', {
    month: 'numeric',
    day: '2-digit'
  });
};

const zoomConfig = {
  day: { unitDays: 7, columnWidth: 28 },
  week: { unitDays: 7, columnWidth: 48 },
  month: { unitDays: 7, columnWidth: 72 },
  quarter: { unitDays: 7, columnWidth: 90 }
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

interface GanttViewProps {
  tasks?: NormalizedTask[];
  emptyLabel?: string;
  getBarClassName?: (task: NormalizedTask) => string;
}

const GanttView = ({ tasks, emptyLabel, getBarClassName }: GanttViewProps) => {
  const gantt = useAppStore((state) => state.gantt);
  const search = useAppStore((state) => state.search);
  const zoom = useAppStore((state) => state.zoom);
  const focusDate = useAppStore((state) => state.focusDate);
  const setFocusDate = useAppStore((state) => state.setFocusDate);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sourceTasks: NormalizedTask[] = tasks ?? gantt?.tasks ?? [];

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();
    const taskList = sourceTasks.filter((task) => task.status === 'scheduled');
    if (!query) {
      return taskList;
    }
    return taskList.filter((task) => {
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
  }, [sourceTasks, search]);

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

  const timelineStart = rangeStart ? getWeekStart(rangeStart) : null;
  const timelineEnd = rangeEnd ? toUtcDate(rangeEnd) : null;

  useEffect(() => {
    if (!focusDate || !timelineStart) {
      return;
    }
    const config = zoomConfig[zoom];
    const focus = toUtcDate(focusDate);
    const dayWidth = config.columnWidth / config.unitDays;
    const offsetDays = diffDays(timelineStart, focus);
    const scrollLeft = Math.max(0, offsetDays * dayWidth - 120);
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft;
    }
    setFocusDate(null);
  }, [focusDate, timelineStart, zoom, setFocusDate]);

  if (sourceTasks.length === 0) {
    return (
      <div className="empty-state">{emptyLabel ?? 'インポート済みデータがありません。'}</div>
    );
  }

  if (!rangeStart || !rangeEnd || !timelineStart || !timelineEnd) {
    return <div className="empty-state">予定ありタスクがありません。</div>;
  }

  const { unitDays, columnWidth } = zoomConfig[zoom];
  const dayWidth = columnWidth / unitDays;
  const rangeDays = diffDays(timelineStart, timelineEnd) + 1;
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
              担当/プロジェクト
            </div>
            <div className="gantt-timeline" style={{ width: timelineWidth }}>
              {Array.from({ length: columnCount }).map((_, index) => {
                const tickDate = addDays(timelineStart, index * unitDays);
                const { week } = getWeekNumber(tickDate);
                return (
                  <div
                    key={formatIsoDate(tickDate)}
                    className="gantt-tick"
                    style={{ width: columnWidth }}
                  >
                    <span className="gantt-tick__week">{week}W</span>
                    <span className="gantt-tick__date">{formatMonthDay(tickDate)}</span>
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
                  (() => {
                    const startDate = toUtcDate(row.task.start);
                    const endDate = toUtcDate(row.task.end);
                    const durationDays = diffDays(startDate, endDate) + 1;
                    const left = diffDays(timelineStart, startDate) * dayWidth;
                    const className = getBarClassName?.(row.task) ?? '';

                    if (durationDays === 1) {
                      return (
                        <div
                          className={`gantt-marker ${className}`}
                          style={{ left: left + dayWidth / 2 }}
                        >
                          ★
                        </div>
                      );
                    }

                    return (
                      <div
                        className={`gantt-bar ${className}`}
                        style={{
                          left,
                          width: Math.max(dayWidth, durationDays * dayWidth)
                        }}
                      >
                        <span>{row.task.taskName}</span>
                      </div>
                    );
                  })()
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
