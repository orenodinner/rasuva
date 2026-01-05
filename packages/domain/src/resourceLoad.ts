import type { NormalizedTask } from './types';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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
  return new Date(date.getTime() + MS_PER_DAY * days);
};

const isWeekend = (date: Date) => {
  const day = date.getUTCDay();
  return day === 0 || day === 6;
};

export type ResourceLoadDateColumn = {
  iso: string;
  day: number;
  isWeekend: boolean;
};

export type ResourceLoadTaskRange = {
  task: NormalizedTask;
  startIndex: number;
  endIndex: number;
};

export type ResourceLoadMemberGroup = {
  memberName: string;
  tasks: ResourceLoadTaskRange[];
  dailyCounts: number[];
};

export type ResourceLoadData = {
  rangeStart: string;
  rangeEnd: string;
  dates: ResourceLoadDateColumn[];
  members: ResourceLoadMemberGroup[];
};

type ParsedTask = {
  task: NormalizedTask;
  start: Date;
  end: Date;
};

export const buildResourceLoadData = (tasks: NormalizedTask[]): ResourceLoadData | null => {
  const parsedTasks = tasks
    .filter((task) => task.status === 'scheduled' && task.start && task.end)
    .map((task): ParsedTask | null => {
      const start = parseIsoDate(task.start!);
      const end = parseIsoDate(task.end!);
      if (!start || !end || end < start) {
        return null;
      }
      return { task, start, end };
    })
    .filter((task): task is ParsedTask => task !== null);

  if (parsedTasks.length === 0) {
    return null;
  }

  const rangeStart = parsedTasks.reduce(
    (min, task) => (task.start < min ? task.start : min),
    parsedTasks[0].start
  );
  const rangeEnd = parsedTasks.reduce(
    (max, task) => (task.end > max ? task.end : max),
    parsedTasks[0].end
  );

  const dates: ResourceLoadDateColumn[] = [];
  const dateIndexByIso = new Map<string, number>();
  for (let cursor = rangeStart; cursor <= rangeEnd; cursor = addUtcDays(cursor, 1)) {
    const iso = formatIsoDate(cursor);
    dateIndexByIso.set(iso, dates.length);
    dates.push({ iso, day: cursor.getUTCDate(), isWeekend: isWeekend(cursor) });
  }

  const tasksByMember = new Map<string, ParsedTask[]>();
  parsedTasks.forEach((task) => {
    const list = tasksByMember.get(task.task.memberName);
    if (list) {
      list.push(task);
    } else {
      tasksByMember.set(task.task.memberName, [task]);
    }
  });

  const members = Array.from(tasksByMember.entries())
    .sort(([memberA], [memberB]) => memberA.localeCompare(memberB))
    .map(([memberName, memberTasks]) => {
      const sortedTasks = memberTasks.slice().sort((left, right) => {
        const project = left.task.projectId.localeCompare(right.task.projectId);
        if (project !== 0) {
          return project;
        }
        const start = (left.task.start ?? '').localeCompare(right.task.start ?? '');
        if (start !== 0) {
          return start;
        }
        return left.task.taskName.localeCompare(right.task.taskName);
      });

      const dailyCounts = Array(dates.length).fill(0);
      const taskRanges: ResourceLoadTaskRange[] = [];

      sortedTasks.forEach((item) => {
        const startIso = item.task.start ?? formatIsoDate(item.start);
        const endIso = item.task.end ?? formatIsoDate(item.end);
        const startIndex = dateIndexByIso.get(startIso);
        const endIndex = dateIndexByIso.get(endIso);
        if (startIndex === undefined || endIndex === undefined || endIndex < startIndex) {
          return;
        }
        for (let index = startIndex; index <= endIndex; index += 1) {
          dailyCounts[index] += 1;
        }
        taskRanges.push({ task: item.task, startIndex, endIndex });
      });

      return { memberName, tasks: taskRanges, dailyCounts };
    });

  return {
    rangeStart: formatIsoDate(rangeStart),
    rangeEnd: formatIsoDate(rangeEnd),
    dates,
    members
  };
};
