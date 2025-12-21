import { forwardRef, useCallback, useEffect, useMemo, useRef } from 'react';
import type { CSSProperties, HTMLAttributes, UIEvent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList, type ListOnScrollProps } from 'react-window';
import type { NormalizedTask } from '@domain';
import { useAppStore } from '../state/store';
import GanttHeader from './GanttHeader';
import GanttRow, { type GanttRowData, type GanttRowItem } from './GanttRow';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;
const ROW_HEIGHT = 32;

const toUtcDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
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
  if (Number.isNaN(date.getTime())) {
    return '';
  }
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
  const toggleGroup = useAppStore((state) => state.toggleGroup);
  const setFocusDate = useAppStore((state) => state.setFocusDate);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const setTaskOrder = useAppStore((state) => state.setTaskOrder);
  const selectedTask = useAppStore((state) => state.selectedTask);

  const scrollRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<FixedSizeList<GanttRowData> | null>(null);
  const isSyncingScroll = useRef(false);
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

  const taskIndexByKey = useMemo(() => {
    const indexByKey = new Map<string, number>();
    visibleRows.forEach((row, index) => {
      if (row.type === 'task' && row.task) {
        indexByKey.set(row.task.taskKeyFull, index);
      }
    });
    return indexByKey;
  }, [visibleRows]);

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

  const syncScrollLeft = useCallback((source: 'body' | 'header', scrollLeft: number) => {
    if (isSyncingScroll.current) {
      return;
    }
    isSyncingScroll.current = true;
    if (source === 'body' && headerScrollRef.current) {
      headerScrollRef.current.scrollLeft = scrollLeft;
    }
    if (source === 'header' && scrollRef.current) {
      scrollRef.current.scrollLeft = scrollLeft;
    }
    requestAnimationFrame(() => {
      isSyncingScroll.current = false;
    });
  }, []);

  const setHorizontalScroll = useCallback(
    (scrollLeft: number, behavior: ScrollBehavior = 'auto') => {
      isSyncingScroll.current = true;
      if (scrollRef.current) {
        scrollRef.current.scrollTo({ left: scrollLeft, behavior });
      }
      if (headerScrollRef.current) {
        headerScrollRef.current.scrollLeft = scrollLeft;
      }
      requestAnimationFrame(() => {
        isSyncingScroll.current = false;
      });
    },
    []
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

  const ticks = useMemo(() => {
    if (!timelineStart) {
      return [];
    }
    return Array.from({ length: columnCount }).map((_, index) => {
      const tickDate = addDays(timelineStart, index * unitDays);
      const { week } = getWeekNumber(tickDate);
      return {
        key: formatIsoDate(tickDate),
        weekLabel: `${week}W`,
        dateLabel: formatMonthDay(tickDate)
      };
    });
  }, [timelineStart, columnCount, unitDays]);

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
      collapsedGroups,
      toggleGroup,
      setSelectedTask,
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
    collapsedGroups,
    toggleGroup,
    setSelectedTask,
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
    if (!listData || !selectedTask) {
      return;
    }
    const rowIndex = taskIndexByKey.get(selectedTask.taskKeyFull);
    if (rowIndex === undefined) {
      return;
    }
    listRef.current?.scrollToItem(rowIndex, 'center');
  }, [listData, selectedTask, taskIndexByKey]);

  const handleBodyScroll = useCallback(
    ({ scrollLeft }: ListOnScrollProps) => {
      syncScrollLeft('body', scrollLeft);
    },
    [syncScrollLeft]
  );

  const handleHeaderScroll = useCallback(
    (event: UIEvent<HTMLDivElement>) => {
      syncScrollLeft('header', event.currentTarget.scrollLeft);
    },
    [syncScrollLeft]
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

  const ganttStyle: CSSProperties = {
    ['--column-width' as string]: `${columnWidth}px`,
    ['--row-height' as string]: `${ROW_HEIGHT}px`
  };

  return (
    <div className="gantt" style={ganttStyle}>
      <div className="gantt-container">
        <div className="gantt-header" ref={headerScrollRef} onScroll={handleHeaderScroll}>
          <GanttHeader
            labelWidth={labelWidth}
            timelineWidth={timelineWidth}
            columnWidth={columnWidth}
            totalWidth={totalWidth}
            labelText="担当者/プロジェクト"
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
