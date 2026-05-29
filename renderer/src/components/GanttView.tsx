import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, HTMLAttributes, DragEvent } from 'react';
import AutoSizer from 'react-virtualized-auto-sizer';
import { FixedSizeList, type ListOnScrollProps } from 'react-window';
import type { NormalizedTask } from '@domain';
import { useAppStore } from '../state/store';
import {
  addUtcDays,
  diffUtcDays,
  formatIsoDate,
  getDateFromX,
  getTodayRect,
  getTodayUtcDate,
  getWeekendRects,
  toUtcDate
} from '../utils/ganttMath';
import { buildWorkloadSegments } from '../utils/workloadSegments';
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

const getSundayOnOrBefore = (date: Date) => {
  const day = date.getUTCDay();
  return addUtcDays(date, -day);
};

const getNextSundayAfter = (date: Date) => {
  const day = date.getUTCDay();
  const offset = day === 0 ? 7 : 7 - day;
  return addUtcDays(date, offset);
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
  const memberOrder = useAppStore((state) => state.memberOrder);
  const setCollapsedGroups = useAppStore((state) => state.setCollapsedGroups);
  const setMemberOrder = useAppStore((state) => state.setMemberOrder);
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
  const [selectedColumnKey, setSelectedColumnKey] = useState<string | null>(null);

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
  const projectGroups = useMemo(() => {
    const lookup = new Map<string, string | null>();
    sourceTasks.forEach((task) => {
      if (!lookup.has(task.projectId)) {
        lookup.set(task.projectId, task.projectGroup ?? null);
        return;
      }
      if (!lookup.get(task.projectId) && task.projectGroup) {
        lookup.set(task.projectId, task.projectGroup);
      }
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
      const sortedByStart = [...scheduled].sort((a, b) => a.start!.localeCompare(b.start!));
      const sortedByEnd = [...scheduled].sort((a, b) => a.end!.localeCompare(b.end!));
      derivedRangeStart = sortedByStart[0].start!;
      derivedRangeEnd = sortedByEnd[sortedByEnd.length - 1].end!;
    } else {
      const todayIso = getTodayIso();
      derivedRangeStart = todayIso;
      derivedRangeEnd = todayIso;
    }

    const members = groupTasks(rangeFilteredTasks);
    const orderedMemberNames = memberOrder.filter((memberName) => members.has(memberName));
    const orderedMemberSet = new Set(orderedMemberNames);
    const memberEntries = [
      ...orderedMemberNames.map((memberName) => [memberName, members.get(memberName)!] as const),
      ...Array.from(members.entries()).filter(([memberName]) => !orderedMemberSet.has(memberName))
    ];
    const rows: GanttRowItem[] = [];

    memberEntries.forEach(([memberName, projects]) => {
      rows.push({
        id: `member:${memberName}`,
        type: 'member',
        label: memberName,
        aggregateTasks: Array.from(projects.values()).flat(),
        level: 0,
        memberName,
        projectId: null
      });
      Array.from(projects.entries()).forEach(([projectId, tasks]) => {
        rows.push({
          id: `project:${memberName}:${projectId}`,
          type: 'project',
          label: projectId,
          aggregateTasks: tasks,
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
  }, [rangeFilteredTasks, memberOrder]);

  const displayedMemberNames = useMemo(() => {
    const names: string[] = [];
    rows.forEach((row) => {
      if (row.type === 'member') {
        names.push(row.memberName);
      }
    });
    return names;
  }, [rows]);

  const moveMember = useCallback(
    (memberName: string, direction: -1 | 1) => {
      const currentIndex = displayedMemberNames.indexOf(memberName);
      if (currentIndex < 0) {
        return;
      }
      const nextIndex = currentIndex + direction;
      if (nextIndex < 0 || nextIndex >= displayedMemberNames.length) {
        return;
      }
      const nextOrder = [...displayedMemberNames];
      const [moved] = nextOrder.splice(currentIndex, 1);
      nextOrder.splice(nextIndex, 0, moved);
      setMemberOrder(nextOrder);
    },
    [displayedMemberNames, setMemberOrder]
  );

  const reorderMember = useCallback(
    (sourceMemberName: string, targetMemberName: string) => {
      if (sourceMemberName === targetMemberName) {
        return;
      }
      const sourceIndex = displayedMemberNames.indexOf(sourceMemberName);
      const targetIndex = displayedMemberNames.indexOf(targetMemberName);
      if (sourceIndex < 0 || targetIndex < 0) {
        return;
      }
      const nextOrder = [...displayedMemberNames];
      const [moved] = nextOrder.splice(sourceIndex, 1);
      nextOrder.splice(targetIndex, 0, moved);
      setMemberOrder(nextOrder);
    },
    [displayedMemberNames, setMemberOrder]
  );

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
    const offsetDays = diffUtcDays(timelineStart, focus);
    const scrollLeft = Math.max(0, offsetDays * dayWidth - 120);
    setHorizontalScroll(scrollLeft, 'smooth');
    setFocusDate(null);
  }, [focusDate, timelineStart, zoom, setFocusDate, setHorizontalScroll]);

  const { unitDays, columnWidth } = zoomConfig[zoom];
  const dayWidth = columnWidth / unitDays;
  const rangeDays = timelineStart && timelineEnd ? diffUtcDays(timelineStart, timelineEnd) + 1 : 0;
  const columnCount = timelineStart && timelineEnd ? Math.ceil(rangeDays / unitDays) : 0;
  const timelineWidth = columnCount * columnWidth;
  const labelWidth = 260;
  const totalWidth = labelWidth + timelineWidth;
  const workloadSummarySegments = useMemo(() => {
    if (!timelineStart || !timelineEnd) {
      return [];
    }
    return buildWorkloadSegments(
      rangeFilteredTasks,
      timelineStart,
      timelineEnd,
      unitDays,
      columnWidth
    );
  }, [rangeFilteredTasks, timelineStart, timelineEnd, unitDays, columnWidth]);
  const weekendRects = useMemo(() => {
    if (!timelineStart || !timelineEnd) {
      return [];
    }
    return getWeekendRects(timelineStart, timelineEnd, dayWidth);
  }, [timelineStart, timelineEnd, dayWidth]);
  const todayRect = useMemo(() => {
    if (!timelineStart || !timelineEnd) {
      return null;
    }
    return getTodayRect(timelineStart, timelineEnd, dayWidth, unitDays);
  }, [timelineStart, timelineEnd, dayWidth, unitDays]);
  const selectedColumnRect = useMemo(() => {
    if (!timelineStart || !timelineEnd || !selectedColumnKey) {
      return null;
    }
    const selectedDate = toUtcDate(selectedColumnKey);
    if (Number.isNaN(selectedDate.getTime())) {
      return null;
    }
    if (selectedDate < timelineStart || selectedDate > timelineEnd) {
      return null;
    }
    const offsetDays = diffUtcDays(timelineStart, selectedDate);
    const rangeDays = diffUtcDays(timelineStart, timelineEnd) + 1;
    const blockWidthDays = Math.min(unitDays, rangeDays - offsetDays);
    if (blockWidthDays <= 0 || offsetDays < 0) {
      return null;
    }
    return {
      left: offsetDays * dayWidth,
      width: blockWidthDays * dayWidth
    };
  }, [timelineStart, timelineEnd, selectedColumnKey, dayWidth, unitDays]);

  const ticks = useMemo(() => {
    if (!timelineStart) {
      return [];
    }
    const today = getTodayUtcDate();
    const todayTime = today.getTime();
    const result: {
      key: string;
      weekLabel: string;
      dateLabel: string;
      yearLabel: string;
      monthLabel: string;
      dayLabel: string;
      isToday: boolean;
    }[] = [];

    for (let index = 0; index < columnCount; index += 1) {
      const tickDate = addUtcDays(timelineStart, index * unitDays);
      const key = formatIsoDate(tickDate);
      const yearLabel = `${tickDate.getUTCFullYear()}`;
      const monthLabel = `${tickDate.getUTCMonth() + 1}`.padStart(2, '0');
      const tickEnd = addUtcDays(tickDate, Math.max(0, unitDays - 1));
      const isToday = todayTime >= tickDate.getTime() && todayTime <= tickEnd.getTime();

      if (zoom === 'day') {
        const dayLabel = formatDayWithWeekday(tickDate);
        result.push({
          key,
          weekLabel: formatYearMonth(tickDate),
          dateLabel: dayLabel,
          yearLabel,
          monthLabel,
          dayLabel,
          isToday
        });
        continue;
      }

      if (zoom === 'week') {
        const weekStart = getSundayOnOrBefore(tickDate);
        const { week } = getWeekNumber(weekStart);
        const monthLabel = formatYearMonth(weekStart);
        const dateLabel = `${week}W ${formatMonthDay(weekStart)}`;
        result.push({
          key,
          weekLabel: monthLabel,
          dateLabel,
          yearLabel,
          monthLabel,
          dayLabel: dateLabel,
          isToday
        });
        continue;
      }

      if (zoom === 'month') {
        const weekStart = getSundayOnOrBefore(tickDate);
        const { week } = getWeekNumber(weekStart);
        const monthLabel = formatYearMonth(weekStart);
        const dateLabel = `${week}W`;
        result.push({
          key,
          weekLabel: monthLabel,
          dateLabel,
          yearLabel,
          monthLabel,
          dayLabel: dateLabel,
          isToday
        });
        continue;
      }

      const dateLabel = formatQuarterRange(tickDate);
      result.push({
        key,
        weekLabel: `${tickDate.getUTCFullYear()}`,
        dateLabel,
        yearLabel,
        monthLabel,
        dayLabel: dateLabel,
        isToday
      });
    }

    return result;
  }, [timelineStart, columnCount, unitDays, zoom]);

  useEffect(() => {
    if (!selectedColumnKey || !timelineStart || !timelineEnd) {
      return;
    }
    const selectedDate = toUtcDate(selectedColumnKey);
    if (selectedDate < timelineStart || selectedDate > timelineEnd) {
      setSelectedColumnKey(null);
    }
  }, [selectedColumnKey, timelineStart, timelineEnd]);

  const getScrollLeft = useCallback(() => scrollRef.current?.scrollLeft ?? 0, []);

  const handleTimelineClick = useCallback(
    (x: number) => {
      if (!timelineStart || !timelineEnd) {
        return;
      }
      if (x < 0 || x > timelineWidth) {
        return;
      }
      if (dayWidth <= 0 || unitDays <= 0) {
        return;
      }
      const rangeDays = diffUtcDays(timelineStart, timelineEnd) + 1;
      const offsetDays = Math.min(rangeDays - 1, Math.floor(x / dayWidth));
      if (offsetDays < 0) {
        return;
      }
      const blockStartDays = Math.floor(offsetDays / unitDays) * unitDays;
      const blockStartDate = addUtcDays(timelineStart, blockStartDays);
      const blockKey = formatIsoDate(blockStartDate);
      if (!blockKey) {
        return;
      }
      setSelectedColumnKey((prev) => (prev === blockKey ? null : blockKey));
    },
    [timelineStart, timelineEnd, dayWidth, unitDays, timelineWidth]
  );

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
      unitDays,
      columnWidth,
      query,
      timelineStart,
      timelineEnd,
      weekendRects,
      todayRect,
      selectedColumnRect,
      projectGroups,
      collapsedGroups,
      toggleGroup,
      moveMember,
      reorderMember,
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
      diffDays: diffUtcDays,
      onTimelineClick: handleTimelineClick,
      getScrollLeft
    };
  }, [
    visibleRows,
    labelWidth,
    timelineWidth,
    totalWidth,
    dayWidth,
    unitDays,
    columnWidth,
    query,
    timelineStart,
    timelineEnd,
    weekendRects,
    todayRect,
    selectedColumnRect,
    projectGroups,
    collapsedGroups,
    toggleGroup,
    moveMember,
    reorderMember,
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
    handleTimelineClick,
    getScrollLeft
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

  const handleDragOver = useCallback(
    (event: DragEvent<HTMLDivElement>) => {
      if (!timelineStart) {
        return;
      }
      event.preventDefault();
      event.dataTransfer.dropEffect = 'move';
    },
    [timelineStart]
  );

  const handleDrop = useCallback(
    async (event: DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      if (!timelineStart || !scrollRef.current) {
        return;
      }
      const raw = event.dataTransfer.getData('application/json');
      if (!raw) {
        return;
      }
      let payload: { taskKeyFull?: unknown };
      try {
        payload = JSON.parse(raw) as { taskKeyFull?: unknown };
      } catch {
        return;
      }
      if (typeof payload.taskKeyFull !== 'string') {
        return;
      }
      const task = taskLookup.get(payload.taskKeyFull);
      if (!task) {
        return;
      }

      const targetElement = event.target instanceof Element ? event.target : null;
      const rowElement = targetElement?.closest<HTMLElement>('[data-row-type]');
      if (!rowElement) {
        return;
      }
      const memberName = rowElement.dataset.memberName?.trim();
      if (!memberName) {
        return;
      }
      const projectIdFromRow = rowElement.dataset.projectId?.trim();
      const projectId =
        projectIdFromRow && projectIdFromRow.length > 0 ? projectIdFromRow : task.projectId;
      if (!projectId) {
        return;
      }

      const scrollElement = scrollRef.current;
      const scrollRect = scrollElement.getBoundingClientRect();
      const timelineX = Math.max(
        0,
        event.clientX - scrollRect.left + scrollElement.scrollLeft - labelWidth
      );

      const startDate = getDateFromX(timelineX, timelineStart, dayWidth);
      const startIso = formatIsoDate(startDate);
      if (!startIso) {
        return;
      }

      const durationDays =
        task.start && task.end ? diffUtcDays(toUtcDate(task.start), toUtcDate(task.end)) + 1 : 1;
      const endIso = formatIsoDate(addUtcDays(startDate, Math.max(0, durationDays - 1)));
      const nextProjectGroup = projectGroups.get(projectId) ?? task.projectGroup ?? null;

      try {
        const ok = await updateTask({
          currentTaskKeyFull: task.taskKeyFull,
          memberName,
          projectId,
          projectGroup: nextProjectGroup,
          taskName: task.taskName,
          start: startIso,
          end: endIso,
          note: task.note ?? null,
          assignees: task.assignees ?? []
        });
        if (!ok) {
          setLastError('未確定タスクの更新に失敗しました。');
        }
      } catch (error) {
        console.error('Failed to schedule task from drawer.', error);
        setLastError(error instanceof Error ? error.message : '未確定タスクの更新に失敗しました。');
      }
    },
    [timelineStart, taskLookup, projectGroups, updateTask, setLastError, labelWidth, dayWidth]
  );

  if (sourceTasks.length === 0) {
    return <div className="empty-state">{emptyLabel ?? 'インポート済みデータがありません。'}</div>;
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
            workloadSegments={workloadSummarySegments}
          />
        </div>
        <div className="gantt-body" onDragOver={handleDragOver} onDrop={handleDrop}>
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
