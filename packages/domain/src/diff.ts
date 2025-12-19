import { DiffResult, NormalizedTask } from './types';

const hasTaskChanged = (prev: NormalizedTask, next: NormalizedTask) => {
  return (
    prev.start !== next.start ||
    prev.end !== next.end ||
    prev.note !== next.note ||
    prev.rawDate !== next.rawDate ||
    prev.memberName !== next.memberName ||
    prev.projectGroup !== next.projectGroup ||
    prev.status !== next.status
  );
};

export const diffTasks = (prevTasks: NormalizedTask[], nextTasks: NormalizedTask[]) => {
  const prevByKey = new Map<string, NormalizedTask>();
  prevTasks.forEach((task) => {
    prevByKey.set(task.taskKeyFull, task);
  });

  const nextByKey = new Map<string, NormalizedTask>();
  nextTasks.forEach((task) => {
    nextByKey.set(task.taskKeyFull, task);
  });

  const added: NormalizedTask[] = [];
  const updated: NormalizedTask[] = [];
  const archived: NormalizedTask[] = [];

  nextTasks.forEach((task) => {
    const prev = prevByKey.get(task.taskKeyFull);
    if (!prev) {
      added.push(task);
      return;
    }

    if (hasTaskChanged(prev, task)) {
      updated.push(task);
    }
  });

  prevTasks.forEach((task) => {
    if (!nextByKey.has(task.taskKeyFull)) {
      archived.push(task);
    }
  });

  const invalid = nextTasks.filter((task) => task.status === 'invalid_date').length;
  const unscheduled = nextTasks.filter((task) => task.status === 'unscheduled').length;

  return {
    summary: {
      added: added.length,
      updated: updated.length,
      archived: archived.length,
      invalid,
      unscheduled
    },
    added,
    updated,
    archived
  } satisfies DiffResult;
};
