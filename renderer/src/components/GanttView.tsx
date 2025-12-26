import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList, type ListOnScrollProps } from 'react-window';
import type { NormalizedTask } from '@domain';
import { useAppStore } from '../state/store';
import { formatIsoDate, getWeekendRects, toUtcDate } from '../utils/ganttMath';
import GanttHeader from './GanttHeader';
import GanttRow, { type GanttRowData, type GanttRowItem } from './GanttRow';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const ROW_HEIGHT = 28;

const formatYearMonth = (date: Date) => {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  return `${year}-${month}`;
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
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${month}/${day}`;
};

const formatDayWithWeekday = (date: Date) => {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  const weekday = date.toLocaleDateString('ja-JP', {
    weekday: 'short',
    timeZone: 'UTC'
  });
  return `${day} (${weekday})`;
};

const formatQuarterRange = (date: Date) => {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const monthIndex = date.getUTCMonth();
  const quarterStart = Math.floor(monthIndex / 3) * 3 + 1;
  const quarterEnd = quarterStart + 2;
  return `${quarterStart}\u6708-${quarterEnd}\u6708`;
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
  day: { unitDays: 1, columnWidth: 40 },
  week: { unitDays: 7, columnWidth: 60 },
  month: { unitDays: 7, columnWidth: 20 },
  quarter: { unitDays: 28, columnWidth: 50 }
} as const;

const GanttOuterElement = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, style, ...rest }, ref) => (
    <div
      ref={ref}
      {...rest}
      className={['gantt-scroll', className].filter(Boolean).join(' ')}
      style={style}
    />
  )
);

GanttOuterElement.displayName = 'GanttOuterElement';

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
  const setCollapsedGroups = useAppStore((state) => state.setCollapsedGroups);
  const toggleGroup = useAppStore((state) => state.toggleGroup);
  const setFocusDate = useAppStore((state) => state.setFocusDate);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const setTaskOrder = useAppStore((state) => state.setTaskOrder);
  const setLastError = useAppStore((state) => state.setLastError);
  const updateTask = useAppStore((state) => state.updateTask);
  const selectedTask = useAppStore((state) => state.selectedTask);
  const selectedTaskIds = useAppStore((state) => state.selectedTaskIds);
  const toggleTaskSelection = useAppStore((state) => state.toggleTaskSelection);
  const inlineEditTaskKey = useAppStore((state) => state.inlineEditTaskKey);
  const startInlineEdit = useAppStore((state) => state.startInlineEdit);
  const stopInlineEdit = useAppStore((state) => state.stopInlineEdit);
  const showContextMenu = useAppStore((state) => state.showContextMenu);

  const scrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<FixedSizeList<GanttRowData> | null>(null);
  const [headerScrollLeft, setHeaderScrollLeft] = useState(0);
  const headerScrollLeftRef = useRef(0);
  const headerScrollRaf = useRef<number | null>(null);
  const sourceTasks = useMemo<NormalizedTask[]>(() => {
    return tasks ?? gantt?.tasks ?? [];
  }, [tasks, gantt]);
  const taskLookup = useMemo(() => {
    const lookup = new Map<string, NormalizedTask>();
    sourceTasks.forEach((task) => {
      lookup.set(task.taskKeyFull, task);
    });
    return lookup;
  }, [sourceTasks]);
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
    const rows: GanttRowItem[] = [];

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
            id: `task:${memberName}:${projectId}:${task.taskKeyFull}`,
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
  const rangeStartDate = displayRangeStart ? toUtcDate(displayRangeStart) : null;
  const rangeEndDate = displayRangeEnd ? toUtcDate(displayRangeEnd) : null;
  const hasValidRange =
    Boolean(displayRangeStart && displayRangeEnd) &&
    Boolean(rangeStartDate && rangeEndDate) &&
    !Number.isNaN(rangeStartDate?.getTime() ?? NaN) &&
    !Number.isNaN(rangeEndDate?.getTime() ?? NaN) &&
    rangeEndDate!.getTime() >= rangeStartDate!.getTime();
  const timelineStart = hasValidRange ? getWeekStart(displayRangeStart!) : null;
  const timelineEnd = hasValidRange ? rangeEndDate : null;

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
    if (!selectedTask) {
      return;
    }
    const isVisible = visibleRows.some(
      (row) => row.type === 'task' && row.task?.taskKeyFull === selectedTask.taskKeyFull
    );
    if (isVisible) {
      return;
    }
    const rowForTask = rows.find(
      (row) => row.type === 'task' && row.task?.taskKeyFull === selectedTask.taskKeyFull
    );
    if (!rowForTask) {
      return;
    }
    const memberId = `member:${rowForTask.memberName}`;
    const projectId = `project:${rowForTask.memberName}:${rowForTask.projectId}`;
    const nextCollapsed = collapsedGroups.filter(
      (groupId) => groupId !== memberId && groupId !== projectId
    );
    if (nextCollapsed.length !== collapsedGroups.length) {
      setCollapsedGroups(nextCollapsed);
    }
  }, [selectedTask, visibleRows, rows, collapsedGroups, setCollapsedGroups]);

  const scheduleHeaderScrollLeft = useCallback((scrollLeft: number) => {
    headerScrollLeftRef.current = scrollLeft;
    if (headerScrollRaf.current !== null) {
      return;
    }
    headerScrollRaf.current = requestAnimationFrame(() => {
      headerScrollRaf.current = null;
      setHeaderScrollLeft(headerScrollLeftRef.current);
    });
  }, []);

  const setHorizontalScroll = useCallback(
    (scrollLeft: number, behavior: ScrollBehavior = 'auto') => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ left: scrollLeft, behavior });
      }
      scheduleHeaderScrollLeft(scrollLeft);
    },
    [scheduleHeaderScrollLeft]
  );

  useEffect(() => {
    if (!focusDate || !timelineStart) {
      return;
    }
    const config = zoomConfig[zoom];
    const focus = toUtcDate(focusDate);
    const dayWidth = config.columnWidth / config.unitDays;
    const offsetDays = diffDays(timelineStart, focus);
    const scrollLeft = Math.max(0, offsetDays * dayWidth - 120);
    setHorizontalScroll(scrollLeft, 'smooth');
    setFocusDate(null);
  }, [focusDate, timelineStart, zoom, setFocusDate, setHorizontalScroll]);

  const { unitDays, columnWidth } = zoomConfig[zoom];
  const dayWidth = columnWidth / unitDays;
  const rangeDays =
    timelineStart && timelineEnd ? diffDays(timelineStart, timelineEnd) + 1 : 0;
  const columnCount = timelineStart && timelineEnd ? Math.ceil(rangeDays / unitDays) : 0;
  const timelineWidth = columnCount * columnWidth;
  const labelWidth = 260;
  const totalWidth = labelWidth + timelineWidth;
  const weekendRects = useMemo(() => {
    if (!timelineStart || !timelineEnd) {
      return [];
    }
    return getWeekendRects(timelineStart, timelineEnd, dayWidth);
  }, [timelineStart, timelineEnd, dayWidth]);

  const ticks = useMemo(() => {
    if (!timelineStart) {
      return [];
    }
    const result: { key: string; weekLabel: string; dateLabel: string }[] = [];

    for (let index = 0; index < columnCount; index += 1) {
      const tickDate = addDays(timelineStart, index * unitDays);
      const key = formatIsoDate(tickDate);

      if (zoom === 'day') {
        result.push({
          key,
          weekLabel: formatYearMonth(tickDate),
          dateLabel: formatDayWithWeekday(tickDate)
        });
        continue;
      }

      if (zoom === 'week') {
        const weekStart = getSundayOnOrBefore(tickDate);
        const { week } = getWeekNumber(weekStart);
        const monthLabel = formatYearMonth(weekStart);
        result.push({
          key,
          weekLabel: monthLabel,
          dateLabel: `${week}W ${formatMonthDay(weekStart)}`
        });
        continue;
      }

      if (zoom === 'month') {
        const weekStart = getSundayOnOrBefore(tickDate);
        const { week } = getWeekNumber(weekStart);
        const monthLabel = formatYearMonth(weekStart);
        result.push({
          key,
          weekLabel: monthLabel,
          dateLabel: `${week}W`
        });
        continue;
      }

      result.push({
        key,
        weekLabel: `${tickDate.getUTCFullYear()}`,
        dateLabel: formatQuarterRange(tickDate)
      });
    }

    return result;
  }, [timelineStart, columnCount, unitDays, zoom]);

  const listData = useMemo<GanttRowData | null>(() => {
    if (!timelineStart || !timelineEnd) {
      return null;
    }
    return {
      rows: visibleRows,
      labelWidth,
      timelineWidth,
      totalWidth,
      dayWidth,
      query,
      timelineStart,
      timelineEnd,
      weekendRects,
      collapsedGroups,
      toggleGroup,
      setSelectedTask,
      selectedTaskIds,
      toggleTaskSelection,
      setLastError,
      updateTask,
      inlineEditTaskKey,
      startInlineEdit,
      stopInlineEdit,
      showContextMenu,
      taskLookup,
      getBarClassName,
      buildTooltip,
      buildSearchHaystack,
      toUtcDate,
      diffDays
    };
  }, [
    visibleRows,
    labelWidth,
    timelineWidth,
    totalWidth,
    dayWidth,
    query,
    timelineStart,
    timelineEnd,
    weekendRects,
    collapsedGroups,
    toggleGroup,
    setSelectedTask,
    selectedTaskIds,
    toggleTaskSelection,
    setLastError,
    updateTask,
    inlineEditTaskKey,
    startInlineEdit,
    stopInlineEdit,
    showContextMenu,
    taskLookup,
    getBarClassName
  ]);

  const InnerElement = useMemo(() => {
    const Inner = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
      ({ className, style, ...rest }, ref) => (
        <div
          ref={ref}
          {...rest}
          className={['gantt-grid', className].filter(Boolean).join(' ')}
          style={{ ...(style as CSSProperties), width: totalWidth }}
        />
      )
    );
    Inner.displayName = 'GanttInnerElement';
    return Inner;
  }, [totalWidth]);


  useEffect(() => {
    const scrollElement = scrollRef.current;
    if (!scrollElement) {
      return;
    }
    const handleScroll = () => {
      scheduleHeaderScrollLeft(scrollElement.scrollLeft);
    };
    scheduleHeaderScrollLeft(scrollElement.scrollLeft);
    scrollElement.addEventListener('scroll', handleScroll, { passive: true });
    return () => {
      scrollElement.removeEventListener('scroll', handleScroll);
    };
  }, [scheduleHeaderScrollLeft, listData]);

  useEffect(() => {
    return () => {
      if (headerScrollRaf.current !== null) {
        cancelAnimationFrame(headerScrollRaf.current);
      }
    };
  }, []);

  const handleBodyScroll = useCallback(
    (scrollProps: ListOnScrollProps) => {
      void scrollProps;
      const scrollLeft = scrollRef.current?.scrollLeft ?? 0;
      scheduleHeaderScrollLeft(scrollLeft);
    },
    [scheduleHeaderScrollLeft]
  );

  if (sourceTasks.length === 0) {
    return (
      <div className="empty-state">{emptyLabel ?? 'インポート済みデータがありません。'}</div>
    );
  }

  if (!displayRangeStart || !displayRangeEnd) {
    return <div className="empty-state">表示期間が設定されていません。</div>;
  }

  if (!hasValidRange || !timelineStart || !timelineEnd) {
    return <div className="empty-state">表示期間が不正です。</div>;
  }

  const isDenseView = zoom === 'month' || zoom === 'quarter';
  const ganttStyle: CSSProperties = {
    ['--column-width' as string]: `${columnWidth}px`,
    ['--row-height' as string]: `${ROW_HEIGHT}px`,
    ['--grid-line-color' as string]:
      zoom === 'day' ? 'rgba(230, 220, 203, 0.35)' : 'rgba(230, 220, 203, 0.6)',
    ['--grid-line-color-soft' as string]:
      zoom === 'day' ? 'rgba(230, 220, 203, 0.25)' : 'rgba(230, 220, 203, 0.5)',
    ['--tick-font-size' as string]: isDenseView ? '10px' : '11px',
    ['--tick-date-font-size' as string]: isDenseView ? '9px' : '10px'
  };

  return (
    <div className="gantt" style={ganttStyle}>
      <div className="gantt-container">
        <div className="gantt-header">
          <GanttHeader
            labelWidth={labelWidth}
            timelineWidth={timelineWidth}
            columnWidth={columnWidth}
            totalWidth={totalWidth}
            labelText="担当者/プロジェクト"
            zoom={zoom}
            scrollLeft={headerScrollLeft}
            ticks={ticks}
          />
        </div>
        <div className="gantt-body">
          {listData ? (
            <AutoSizer>
              {({ height, width }) => (
                <FixedSizeList
                  ref={listRef}
                  height={height}
                  width={width}
                  itemCount={visibleRows.length}
                  itemSize={ROW_HEIGHT}
                  itemData={listData}
                  itemKey={(index, data) => data.rows[index]?.id ?? index}
                  onScroll={handleBodyScroll}
                  outerRef={scrollRef}
                  outerElementType={GanttOuterElement}
                  innerElementType={InnerElement}
                >
                  {GanttRow}
                </FixedSizeList>
              )}
            </AutoSizer>
          ) : null}
        </div>
      </div>
    </div>
  );
};

export default GanttView;
