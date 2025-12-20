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

const getTodayIso = () => new Date().toISOString().slice(0, 10);

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

const buildTooltip = (task: NormalizedTask) => {
  const note = task.note?.trim();
  const noteSnippet = note ? (note.length > 60 ? `${note.slice(0, 60)}…` : note) : null;
  const parts = [`原文: ${task.rawDate}`];
  if (noteSnippet) {
    parts.push(`メモ: ${noteSnippet}`);
  }
  return parts.join('\n');
};

const zoomConfig = {
  day: { unitDays: 7, columnWidth: 28 },
  week: { unitDays: 7, columnWidth: 48 },
  month: { unitDays: 7, columnWidth: 72 },
  quarter: { unitDays: 7, columnWidth: 90 }
} as const;

const groupTasks = (tasks: NormalizedTask[]) => {
  const members = new Map<string, Map<string, NormalizedTask[]>>();

  const addTaskToRow = (memberName: string, projectId: string, task: NormalizedTask) => {
    if (!members.has(memberName)) {
      members.set(memberName, new Map());
    }
    const projects = members.get(memberName)!;
    if (!projects.has(projectId)) {
      projects.set(projectId, []);
    }
    projects.get(projectId)!.push(task);
  };

  tasks.forEach((task) => {
    const memberSet = new Set<string>([task.memberName, ...(task.assignees ?? [])]);
    memberSet.forEach((memberName) => {
      if (memberName.trim().length === 0) {
        return;
      }
      addTaskToRow(memberName, task.projectId, task);
    });
  });

  return members;
};

const buildSearchHaystack = (task: NormalizedTask) => {
  return [
    task.memberName,
    ...(task.assignees ?? []),
    task.projectId,
    task.projectGroup ?? '',
    task.taskName,
    task.note ?? ''
  ]
    .join(' ')
    .toLowerCase();
};

interface GanttViewProps {
  tasks?: NormalizedTask[];
  emptyLabel?: string;
  getBarClassName?: (task: NormalizedTask) => string;
}

const GanttView = ({ tasks, emptyLabel, getBarClassName }: GanttViewProps) => {
  const gantt = useAppStore((state) => state.gantt);
  const search = useAppStore((state) => state.search);
  const statusFilter = useAppStore((state) => state.statusFilter);
  const zoom = useAppStore((state) => state.zoom);
  const focusDate = useAppStore((state) => state.focusDate);
  const rangeStart = useAppStore((state) => state.rangeStart);
  const rangeEnd = useAppStore((state) => state.rangeEnd);
  const collapsedGroups = useAppStore((state) => state.collapsedGroups);
  const toggleGroup = useAppStore((state) => state.toggleGroup);
  const setFocusDate = useAppStore((state) => state.setFocusDate);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const setTaskOrder = useAppStore((state) => state.setTaskOrder);

  const scrollRef = useRef<HTMLDivElement>(null);
  const sourceTasks: NormalizedTask[] = tasks ?? gantt?.tasks ?? [];
  const query = search.trim().toLowerCase();
  const isRangeBounded = Boolean(rangeStart || rangeEnd);
  const rangeFilterStart = rangeStart ? toUtcDate(rangeStart) : null;
  const rangeFilterEnd = rangeEnd ? toUtcDate(rangeEnd) : null;

  const filteredTasks = useMemo(() => {
    let taskList = sourceTasks;
    if (statusFilter !== 'all') {
      taskList = taskList.filter((task) => task.status === statusFilter);
    }
    if (!query) {
      return taskList;
    }
    return taskList.filter((task) => buildSearchHaystack(task).includes(query));
  }, [sourceTasks, statusFilter, query]);

  const rangeFilteredTasks = useMemo(() => {
    if (!isRangeBounded) {
      return filteredTasks;
    }
    return filteredTasks.filter((task) => {
      if (!task.start || !task.end) {
        return true;
      }
      const startDate = toUtcDate(task.start);
      const endDate = toUtcDate(task.end);
      if (rangeFilterStart && endDate < rangeFilterStart) {
        return false;
      }
      if (rangeFilterEnd && startDate > rangeFilterEnd) {
        return false;
      }
      return true;
    });
  }, [filteredTasks, isRangeBounded, rangeFilterStart, rangeFilterEnd]);

  const { rows, derivedRangeStart, derivedRangeEnd } = useMemo(() => {
    const scheduled = rangeFilteredTasks.filter(
      (task) => task.status === 'scheduled' && task.start && task.end
    );

    let derivedRangeStart: string | null = null;
    let derivedRangeEnd: string | null = null;

    if (scheduled.length > 0) {
      const sortedByStart = [...scheduled].sort((a, b) =>
        a.start!.localeCompare(b.start!)
      );
      const sortedByEnd = [...scheduled].sort((a, b) => a.end!.localeCompare(b.end!));
      derivedRangeStart = sortedByStart[0].start!;
      derivedRangeEnd = sortedByEnd[sortedByEnd.length - 1].end!;
    } else {
      const todayIso = getTodayIso();
      derivedRangeStart = todayIso;
      derivedRangeEnd = todayIso;
    }

    const members = groupTasks(rangeFilteredTasks);
    const rows: Array<{
      id: string;
      type: 'member' | 'project' | 'task';
      label: string;
      task?: NormalizedTask;
      level: number;
      memberName: string;
      projectId: string | null;
    }> = [];

    Array.from(members.entries()).forEach(([memberName, projects]) => {
      rows.push({
        id: `member:${memberName}`,
        type: 'member',
        label: memberName,
        level: 0,
        memberName,
        projectId: null
      });
      Array.from(projects.entries()).forEach(([projectId, tasks]) => {
        rows.push({
          id: `project:${memberName}:${projectId}`,
          type: 'project',
          label: projectId,
          level: 1,
          memberName,
          projectId
        });
        tasks.forEach((task) => {
          rows.push({
            id: `task:${task.taskKeyFull}`,
            type: 'task',
            label: task.taskName,
            task,
            level: 2,
            memberName,
            projectId
          });
        });
      });
    });

    return { rows, derivedRangeStart, derivedRangeEnd };
  }, [rangeFilteredTasks]);

  const displayRangeStart = rangeStart ?? derivedRangeStart;
  const displayRangeEnd = rangeEnd ?? derivedRangeEnd;

  if (sourceTasks.length === 0) {
    return (
      <div className="empty-state">{emptyLabel ?? 'インポート済みデータがありません。'}</div>
    );
  }

  if (!displayRangeStart || !displayRangeEnd) {
    return <div className="empty-state">表示期間が設定されていません。</div>;
  }

  const rangeStartDate = toUtcDate(displayRangeStart);
  const rangeEndDate = toUtcDate(displayRangeEnd);

  if (rangeEndDate < rangeStartDate) {
    return <div className="empty-state">表示期間が不正です。</div>;
  }

  const timelineStart = getWeekStart(displayRangeStart);
  const timelineEnd = rangeEndDate;

  const visibleRows = useMemo(() => {
    return rows.filter((row) => {
      if (row.type === 'project') {
        return !collapsedGroups.includes(`member:${row.memberName}`);
      }
      if (row.type === 'task') {
        return (
          !collapsedGroups.includes(`member:${row.memberName}`) &&
          !collapsedGroups.includes(`project:${row.memberName}:${row.projectId}`)
        );
      }
      return true;
    });
  }, [rows, collapsedGroups]);

  const taskOrder = useMemo(() => {
    const unique = new Map<string, NormalizedTask>();
    visibleRows.forEach((row) => {
      if (row.type === 'task' && row.task) {
        if (!unique.has(row.task.taskKeyFull)) {
          unique.set(row.task.taskKeyFull, row.task);
        }
      }
    });
    return Array.from(unique.values());
  }, [visibleRows]);

  useEffect(() => {
    setTaskOrder(taskOrder);
  }, [taskOrder, setTaskOrder]);

  useEffect(() => {
    if (!focusDate || !timelineStart) {
      return;
    }
    const config = zoomConfig[zoom];
    const focus = toUtcDate(focusDate);
    const dayWidth = config.columnWidth / config.unitDays;
    const offsetDays = diffDays(timelineStart, focus);
    const scrollLeft = Math.max(0, offsetDays * dayWidth - 120);
    scrollRef.current?.scrollTo({ left: scrollLeft, behavior: 'smooth' });
    setFocusDate(null);
  }, [focusDate, timelineStart, zoom, setFocusDate]);

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
          {visibleRows.map((row) => {
            const isGroup = row.type === 'member' || row.type === 'project';
            const groupId =
              row.type === 'member'
                ? `member:${row.memberName}`
                : row.type === 'project'
                  ? `project:${row.memberName}:${row.projectId}`
                  : null;
            const isCollapsed = groupId ? collapsedGroups.includes(groupId) : false;

            return (
              <div
                key={row.id}
                className={`gantt-row gantt-row--${row.type}`}
                onClick={() => row.task && setSelectedTask(row.task)}
              >
                <div
                  className={`gantt-label gantt-label--level-${row.level}`}
                  style={{ width: labelWidth }}
                >
                  {isGroup && groupId ? (
                    <button
                      type="button"
                      className="gantt-toggle"
                      aria-expanded={!isCollapsed}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleGroup(groupId);
                      }}
                    >
                      <span className="gantt-toggle__icon">{isCollapsed ? '▸' : '▾'}</span>
                      <span>{row.label}</span>
                    </button>
                  ) : (
                    row.label
                  )}
                </div>
                <div className="gantt-timeline" style={{ width: timelineWidth }}>
                  {row.type === 'task' && row.task && row.task.start && row.task.end ? (
                    (() => {
                      const startDate = toUtcDate(row.task.start);
                      const endDate = toUtcDate(row.task.end);
                      const originalDurationDays = diffDays(startDate, endDate) + 1;
                      const clippedStart = startDate < timelineStart ? timelineStart : startDate;
                      const clippedEnd = endDate > timelineEnd ? timelineEnd : endDate;
                      if (clippedEnd < clippedStart) {
                        return null;
                      }
                      const durationDays = diffDays(clippedStart, clippedEnd) + 1;
                      const left = diffDays(timelineStart, clippedStart) * dayWidth;
                      const baseClassName = getBarClassName?.(row.task) ?? '';
                      const isHighlighted = query
                        ? buildSearchHaystack(row.task).includes(query)
                        : false;
                      const highlightClass = isHighlighted ? 'gantt-bar--highlighted' : '';
                      const className = [baseClassName, highlightClass]
                        .filter(Boolean)
                        .join(' ');
                      const tooltip = buildTooltip(row.task);

                      if (originalDurationDays === 1) {
                        return (
                          <div
                            className={`gantt-marker ${className}`}
                            style={{ left: Math.max(0, left + dayWidth / 2) }}
                            data-tooltip={tooltip}
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
                          data-tooltip={tooltip}
                        >
                          <span>{row.task.taskName}</span>
                        </div>
                      );
                    })()
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GanttView;
