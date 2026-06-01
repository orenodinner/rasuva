import type { NormalizedTask } from '@domain';
import { addUtcDays, diffUtcDays, getTodayUtcDate, toUtcDate } from './ganttMath';

export type WorkloadLevel = 'low' | 'medium' | 'high';

export interface WorkloadSegment {
  key: string;
  left: number;
  width: number;
  count: number;
  level: WorkloadLevel;
}

export const getWorkloadLevel = (count: number): WorkloadLevel => {
  if (count >= 3) {
    return 'high';
  }
  if (count === 2) {
    return 'medium';
  }
  return 'low';
};

export const buildWorkloadSegments = (
  tasks: NormalizedTask[] | undefined,
  timelineStart: Date,
  timelineEnd: Date,
  unitDays: number,
  columnWidth: number
): WorkloadSegment[] => {
  const scheduled = (tasks ?? []).filter(
    (task) => task.status === 'scheduled' && task.start && task.end
  );
  if (scheduled.length === 0) {
    return [];
  }

  const rangeDays = diffUtcDays(timelineStart, timelineEnd) + 1;
  const columnCount = Math.ceil(rangeDays / unitDays);
  const rawSegments: { index: number; count: number }[] = [];

  for (let index = 0; index < columnCount; index += 1) {
    const blockStart = addUtcDays(timelineStart, index * unitDays);
    const blockEnd = addUtcDays(
      blockStart,
      Math.min(unitDays - 1, rangeDays - index * unitDays - 1)
    );
    const count = scheduled.filter((task) => {
      const start = toUtcDate(task.start!);
      const end = toUtcDate(task.end!);
      return start <= blockEnd && end >= blockStart;
    }).length;

    if (count > 0) {
      rawSegments.push({ index, count });
    }
  }

  const segments: WorkloadSegment[] = [];
  rawSegments.forEach((item) => {
    const last = segments[segments.length - 1];
    if (last && last.count === item.count && last.left + last.width === item.index * columnWidth) {
      last.width += columnWidth;
      return;
    }
    segments.push({
      key: `${item.index}-${item.count}`,
      left: item.index * columnWidth,
      width: columnWidth,
      count: item.count,
      level: getWorkloadLevel(item.count)
    });
  });

  return segments;
};

export const getCurrentWeekTaskCount = (
  tasks: NormalizedTask[] | undefined,
  today: Date = getTodayUtcDate()
) => {
  const scheduled = (tasks ?? []).filter(
    (task) => task.status === 'scheduled' && task.start && task.end
  );
  if (scheduled.length === 0 || Number.isNaN(today.getTime())) {
    return 0;
  }

  const weekStart = addUtcDays(today, -today.getUTCDay());
  const weekEnd = addUtcDays(weekStart, 6);

  return scheduled.filter((task) => {
    const start = toUtcDate(task.start!);
    const end = toUtcDate(task.end!);
    return start <= weekEnd && end >= weekStart;
  }).length;
};

export const getPeakWeeklyTaskCount = (
  tasks: NormalizedTask[] | undefined,
  rangeStart: Date,
  rangeEnd: Date
) => {
  const scheduled = (tasks ?? []).filter(
    (task) => task.status === 'scheduled' && task.start && task.end
  );
  if (
    scheduled.length === 0 ||
    Number.isNaN(rangeStart.getTime()) ||
    Number.isNaN(rangeEnd.getTime())
  ) {
    return 0;
  }

  let peak = 0;
  let weekStart = rangeStart;
  while (weekStart <= rangeEnd) {
    const weekEnd = addUtcDays(weekStart, Math.min(6, diffUtcDays(weekStart, rangeEnd)));
    const count = scheduled.filter((task) => {
      const start = toUtcDate(task.start!);
      const end = toUtcDate(task.end!);
      return start <= weekEnd && end >= weekStart;
    }).length;
    peak = Math.max(peak, count);
    weekStart = addUtcDays(weekStart, 7);
  }
  return peak;
};
