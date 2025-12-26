import type { NormalizedTask } from '@domain';

export type ProjectStat = {
  projectId: string;
  group: string | null;
  startDate: string | null;
  endDate: string | null;
  totalTasks: number;
  scheduled: number;
  unscheduled: number;
  invalid: number;
  involvedMembers: Set<string>;
};

export const SPLITTER_HEIGHT = 8;
export const MIN_PANE_HEIGHT = 160;

export const clampSplit = (value: number, totalHeight: number) => {
  const available = Math.max(0, totalHeight - SPLITTER_HEIGHT);
  const min = Math.min(MIN_PANE_HEIGHT, Math.floor(available / 2));
  const max = Math.max(min, available - min);
  return Math.min(Math.max(value, min), max);
};

export const buildProjectStats = (tasks: NormalizedTask[]) => {
  const map = new Map<string, ProjectStat>();

  tasks.forEach((task) => {
    const projectId = task.projectId;
    if (!map.has(projectId)) {
      map.set(projectId, {
        projectId,
        group: task.projectGroup ?? null,
        startDate: null,
        endDate: null,
        totalTasks: 0,
        scheduled: 0,
        unscheduled: 0,
        invalid: 0,
        involvedMembers: new Set()
      });
    }
    const entry = map.get(projectId)!;
    entry.totalTasks += 1;
    if (task.status === 'scheduled') {
      entry.scheduled += 1;
    } else if (task.status === 'unscheduled') {
      entry.unscheduled += 1;
    } else if (task.status === 'invalid_date') {
      entry.invalid += 1;
    }
    if (!entry.group && task.projectGroup) {
      entry.group = task.projectGroup;
    }
    if (task.start) {
      entry.startDate = entry.startDate
        ? task.start < entry.startDate
          ? task.start
          : entry.startDate
        : task.start;
    }
    if (task.end) {
      entry.endDate = entry.endDate
        ? task.end > entry.endDate
          ? task.end
          : entry.endDate
        : task.end;
    }

    const members = new Set<string>([task.memberName, ...(task.assignees ?? [])]);
    members.forEach((name) => {
      if (!name) {
        return;
      }
      entry.involvedMembers.add(name);
    });
  });

  return Array.from(map.values()).sort((a, b) => a.projectId.localeCompare(b.projectId));
};
