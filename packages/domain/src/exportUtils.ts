import type { NormalizedTask } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;

export interface MemberGanttRow {
  memberName: string;
  task: NormalizedTask;
}

export interface TimelineColumn {
  year: number;
  month: number;
  label: string;
  start: string;
  end: string;
}

export interface HeaderGroup {
  label: string;
  span: number;
}

export interface ExportHeaderStructure {
  years: HeaderGroup[];
  months: HeaderGroup[];
  weeks: TimelineColumn[];
}

const parseIsoDate = (value: string): Date | null => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addUtcDays = (date: Date, days: number) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
};

const getSundayOnOrBeforeUtc = (date: Date) => {
  const day = date.getUTCDay();
  return addUtcDays(date, -day);
};

const getNextSundayAfterUtc = (date: Date) => {
  const day = date.getUTCDay();
  const offset = day === 0 ? 7 : 7 - day;
  return addUtcDays(date, offset);
};

const getWeekStart = (date: Date) => {
  const year = date.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const firstSunday = getNextSundayAfterUtc(jan1);
  if (date.getTime() < firstSunday.getTime()) {
    return jan1;
  }
  return getSundayOnOrBeforeUtc(date);
};

const getProjectWeekNumber = (weekStart: Date) => {
  const year = weekStart.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const firstSunday = getNextSundayAfterUtc(jan1);

  if (weekStart.getTime() <= jan1.getTime() || weekStart.getTime() < firstSunday.getTime()) {
    return 1;
  }

  const diffWeeks = Math.floor((weekStart.getTime() - firstSunday.getTime()) / MS_PER_WEEK);
  return diffWeeks + 2;
};

const getWeekEnd = (weekStart: Date) => {
  const year = weekStart.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const firstSunday = getNextSundayAfterUtc(jan1);
  const dec31 = new Date(Date.UTC(year, 11, 31));

  let weekEnd =
    weekStart.getTime() < firstSunday.getTime() ? addUtcDays(firstSunday, -1) : addUtcDays(weekStart, 6);
  if (weekEnd.getTime() > dec31.getTime()) {
    weekEnd = dec31;
  }
  return weekEnd;
};

const compareTasks = (left: NormalizedTask, right: NormalizedTask) => {
  const leftStart = left.start ?? '';
  const rightStart = right.start ?? '';
  if (leftStart !== rightStart) {
    return leftStart.localeCompare(rightStart);
  }
  const project = left.projectId.localeCompare(right.projectId);
  if (project !== 0) {
    return project;
  }
  return left.taskName.localeCompare(right.taskName);
};

export const flattenTasksByMember = (tasks: NormalizedTask[]): MemberGanttRow[] => {
  const memberMap = new Map<string, NormalizedTask[]>();

  tasks.forEach((task) => {
    const involved = new Set<string>([task.memberName, ...(task.assignees ?? [])]);
    involved.forEach((name) => {
      const trimmed = name.trim();
      if (!trimmed) {
        return;
      }
      const list = memberMap.get(trimmed) ?? [];
      list.push(task);
      memberMap.set(trimmed, list);
    });
  });

  return Array.from(memberMap.keys())
    .sort((a, b) => a.localeCompare(b))
    .flatMap((memberName) => {
      const memberTasks = memberMap.get(memberName) ?? [];
      memberTasks.sort(compareTasks);
      return memberTasks.map((task) => ({ memberName, task }));
    });
};

export const generateTimelineStructure = (tasks: NormalizedTask[]): ExportHeaderStructure => {
  const scheduled = tasks
    .filter((task) => task.status === 'scheduled' && task.start && task.end)
    .map((task) => ({
      start: parseIsoDate(task.start!),
      end: parseIsoDate(task.end!)
    }))
    .filter(
      (item): item is { start: Date; end: Date } => item.start !== null && item.end !== null
    );

  if (scheduled.length === 0) {
    return { years: [], months: [], weeks: [] };
  }

  const minDate = scheduled.reduce(
    (min, item) => (item.start < min ? item.start : min),
    scheduled[0].start
  );
  const maxDate = scheduled.reduce(
    (max, item) => (item.end > max ? item.end : max),
    scheduled[0].end
  );

  const weeks: TimelineColumn[] = [];
  let cursor = getWeekStart(minDate);
  while (cursor.getTime() <= maxDate.getTime()) {
    const weekNumber = getProjectWeekNumber(cursor);
    const weekEnd = getWeekEnd(cursor);
    weeks.push({
      year: cursor.getUTCFullYear(),
      month: cursor.getUTCMonth() + 1,
      label: `${weekNumber}W`,
      start: formatIsoDate(cursor),
      end: formatIsoDate(weekEnd)
    });
    const nextDay = addUtcDays(weekEnd, 1);
    cursor = getWeekStart(nextDay);
  }

  const years: HeaderGroup[] = [];
  const months: HeaderGroup[] = [];
  let currentYear = -1;
  let yearSpan = 0;
  let currentMonth = -1;
  let monthSpan = 0;

  weeks.forEach((week) => {
    if (week.year !== currentYear) {
      if (yearSpan > 0) {
        years.push({ label: `${currentYear}`, span: yearSpan });
      }
      currentYear = week.year;
      yearSpan = 0;
    }
    yearSpan += 1;

    const monthKey = week.year * 100 + week.month;
    if (monthKey !== currentMonth) {
      if (monthSpan > 0) {
        months.push({ label: `${currentMonth % 100}`, span: monthSpan });
      }
      currentMonth = monthKey;
      monthSpan = 0;
    }
    monthSpan += 1;
  });

  if (yearSpan > 0) {
    years.push({ label: `${currentYear}`, span: yearSpan });
  }
  if (monthSpan > 0) {
    months.push({ label: `${currentMonth % 100}`, span: monthSpan });
  }

  return { years, months, weeks };
};
