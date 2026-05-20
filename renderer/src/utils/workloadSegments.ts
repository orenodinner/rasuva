import type { NormalizedTask } from '@domain';
import { addUtcDays, diffUtcDays, toUtcDate } from './ganttMath';

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

export const getWorkloadCountForBlockKey = (
  tasks: NormalizedTask[] | undefined,
  timelineStart: Date,
  timelineEnd: Date,
  unitDays: number,
  blockKey: string | null
): number => {
  if (!blockKey) {
    return 0;
  }

  const scheduled = (tasks ?? []).filter(
    (task) => task.status === 'scheduled' && task.start && task.end
  );
  if (scheduled.length === 0) {
    return 0;
  }

  const blockStartDate = toUtcDate(blockKey);
  if (Number.isNaN(blockStartDate.getTime())) {
    return 0;
  }

  if (blockStartDate < timelineStart || blockStartDate > timelineEnd) {
    return 0;
  }

  const rangeDays = diffUtcDays(timelineStart, timelineEnd) + 1;
  const offsetDays = diffUtcDays(timelineStart, blockStartDate);
  const blockStartDays = Math.floor(offsetDays / unitDays) * unitDays;
  const normalizedBlockStart = addUtcDays(timelineStart, blockStartDays);
  const blockEnd = addUtcDays(
    normalizedBlockStart,
    Math.min(unitDays - 1, rangeDays - blockStartDays - 1)
  );

  return scheduled.filter((task) => {
    const start = toUtcDate(task.start!);
    const end = toUtcDate(task.end!);
    return start <= blockEnd && end >= normalizedBlockStart;
  }).length;
};
