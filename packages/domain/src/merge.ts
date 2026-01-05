import type { ImportApplyMode, ImportSummary, NormalizedTask } from './types';

export const mergeTasksForSave = (
  prevTasks: NormalizedTask[],
  inputTasks: NormalizedTask[],
  mode: ImportApplyMode
): NormalizedTask[] => {
  if (mode === 'full') {
    return inputTasks;
  }

  const inputByKey = new Map<string, NormalizedTask>();
  inputTasks.forEach((task) => {
    inputByKey.set(task.taskKeyFull, task);
  });

  const merged = inputTasks.slice();
  prevTasks.forEach((task) => {
    if (!inputByKey.has(task.taskKeyFull)) {
      merged.push(task);
    }
  });

  return merged;
};

export const summarizeTasksForImport = (
  tasks: NormalizedTask[],
  warningsCount: number,
  skippedProjects = 0
): ImportSummary => {
  const members = new Set<string>();
  const projects = new Set<string>();
  let scheduledCount = 0;
  let unscheduledCount = 0;
  let invalidCount = 0;

  tasks.forEach((task) => {
    members.add(task.memberName);
    projects.add(`${task.memberName}::${task.projectId}`);
    if (task.status === 'scheduled') {
      scheduledCount += 1;
    } else if (task.status === 'unscheduled') {
      unscheduledCount += 1;
    } else {
      invalidCount += 1;
    }
  });

  return {
    totalMembers: members.size,
    totalProjects: projects.size,
    totalTasks: tasks.length,
    scheduledCount,
    unscheduledCount,
    invalidCount,
    warningsCount,
    skippedProjects
  };
};
