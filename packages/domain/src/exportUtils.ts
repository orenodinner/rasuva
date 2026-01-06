import type { NormalizedTask } from './types';

export interface MemberGanttRow {
  memberName: string;
  task: NormalizedTask;
}

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
