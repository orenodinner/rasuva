import type { NormalizedTask, TaskStatus } from './types';

const pad2 = (value: number) => `${value}`.padStart(2, '0');

const formatIsoDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}-${month}-${day}`;
};

const addDays = (date: Date, days: number) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
};

export interface GenerateTasksOptions {
  memberCount?: number;
  projectCount?: number;
  startDate?: string;
  maxDurationDays?: number;
  includeUnscheduled?: boolean;
  includeInvalid?: boolean;
}

export const generateNormalizedTasks = (
  count: number,
  options: GenerateTasksOptions = {}
): NormalizedTask[] => {
  const memberCount = options.memberCount ?? 8;
  const projectCount = options.projectCount ?? 6;
  const startDate = options.startDate ?? '2024-01-01';
  const maxDurationDays = options.maxDurationDays ?? 10;
  const includeUnscheduled = options.includeUnscheduled ?? false;
  const includeInvalid = options.includeInvalid ?? false;

  const baseDate = new Date(`${startDate}T00:00:00Z`);
  const members = Array.from({ length: memberCount }, (_, index) => `Member-${index + 1}`);
  const projects = Array.from({ length: projectCount }, (_, index) =>
    `P-${pad2(index + 1)}`
  );

  return Array.from({ length: count }, (_, index) => {
    const memberName = members[index % memberCount];
    const projectId = projects[index % projectCount];
    const taskName = `Task-${index + 1}`;
    const dayOffset = index % 180;
    const duration = (index % maxDurationDays) + 1;
    const start = addDays(baseDate, dayOffset);
    const end = addDays(start, duration - 1);

    let status: TaskStatus = 'scheduled';
    let startIso: string | null = formatIsoDate(start);
    let endIso: string | null = formatIsoDate(end);
    let rawDate = `${startIso} - ${endIso}`;

    if (includeUnscheduled && index % 25 === 0) {
      status = 'unscheduled';
      startIso = null;
      endIso = null;
      rawDate = 'unscheduled';
    } else if (includeInvalid && index % 40 === 0) {
      status = 'invalid_date';
      startIso = null;
      endIso = null;
      rawDate = 'invalid_date';
    }

    const taskKey = `${projectId}::${taskName}`;

    return {
      taskKey,
      taskKeyFull: taskKey,
      memberName,
      projectId,
      projectGroup: null,
      taskName,
      assignees: [],
      start: startIso,
      end: endIso,
      rawDate,
      note: null,
      status
    };
  });
};
