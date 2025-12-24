import type { NormalizedTask, RawImport } from './types';

const toTrimmed = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

const buildRawDate = (start: string | null, end: string | null, rawDate: string | null) => {
  if (rawDate && rawDate.trim().length > 0) {
    return rawDate;
  }
  if (start && end) {
    return start === end ? start : `${start}..${end}`;
  }
  if (start) {
    return start;
  }
  if (end) {
    return end;
  }
  return 'TBD';
};

export const convertNormalizedTasksToRawImport = (tasks: NormalizedTask[]): RawImport => {
  const members: RawImport['members'] = [];
  const memberIndex = new Map<
    string,
    { member: RawImport['members'][number]; projects: Map<string, RawImport['members'][number]['projects'][number]> }
  >();

  tasks.forEach((task) => {
    const memberName = toTrimmed(task.memberName) ?? '不明';
    let memberEntry = memberIndex.get(memberName);
    if (!memberEntry) {
      const member = { name: memberName, projects: [] as RawImport['members'][number]['projects'] };
      memberEntry = { member, projects: new Map() };
      memberIndex.set(memberName, memberEntry);
      members.push(member);
    }

    const projectId = toTrimmed(task.projectId) ?? '__missing__';
    const projectKey = projectId;
    let project = memberEntry.projects.get(projectKey);
    if (!project) {
      project = {
        project_id: projectId,
        group: toTrimmed(task.projectGroup),
        tasks: []
      };
      memberEntry.projects.set(projectKey, project);
      memberEntry.member.projects.push(project);
    } else if (!project.group) {
      const group = toTrimmed(task.projectGroup);
      if (group) {
        project.group = group;
      }
    }

    const start = task.start ?? null;
    const end = task.end ?? null;
    const rawDate = buildRawDate(start, end, task.rawDate ?? null);

    project.tasks.push({
      task_name: toTrimmed(task.taskName) ?? '',
      start,
      end,
      raw_date: rawDate,
      note: toTrimmed(task.note),
      assign: task.assignees ?? []
    });
  });

  return { members };
};
