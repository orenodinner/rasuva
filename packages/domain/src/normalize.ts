import { RawImport, NormalizedTask, ImportWarning, ImportSummary, TaskStatus } from './types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const toTrimmed = (value: string | null | undefined): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
};

export const parseDateStrict = (value: string): string | null => {
  if (!DATE_REGEX.test(value)) {
    return null;
  }
  const [yearStr, monthStr, dayStr] = value.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr);
  const day = Number(dayStr);
  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null;
  }
  if (month < 1 || month > 12) {
    return null;
  }
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day < 1 || day > daysInMonth) {
    return null;
  }
  return value;
};

const normalizeTaskDates = (
  startRaw: string | null,
  endRaw: string | null,
  warnings: ImportWarning[],
  context: Record<string, unknown>
): { status: TaskStatus; start: string | null; end: string | null } => {
  const start = startRaw === null ? null : parseDateStrict(startRaw);
  const end = endRaw === null ? null : parseDateStrict(endRaw);

  if (startRaw !== null && start === null) {
    warnings.push({
      code: 'invalid_date_format',
      message: 'Invalid start date format (expected YYYY-MM-DD).',
      context: { ...context, value: startRaw }
    });
    return { status: 'invalid_date', start: null, end: null };
  }

  if (endRaw !== null && end === null) {
    warnings.push({
      code: 'invalid_date_format',
      message: 'Invalid end date format (expected YYYY-MM-DD).',
      context: { ...context, value: endRaw }
    });
    return { status: 'invalid_date', start: null, end: null };
  }

  if (start === null || end === null) {
    if (start !== end) {
      warnings.push({
        code: 'partial_date',
        message: 'Start or end date is missing; task treated as unscheduled.',
        context
      });
    }
    return { status: 'unscheduled', start: null, end: null };
  }

  if (end < start) {
    warnings.push({
      code: 'date_range_invalid',
      message: 'End date precedes start date; task treated as invalid.',
      context: { ...context, start, end }
    });
    return { status: 'invalid_date', start: null, end: null };
  }

  return { status: 'scheduled', start, end };
};

export const normalizeImport = (raw: RawImport) => {
  const warnings: ImportWarning[] = [];
  const tasks: NormalizedTask[] = [];
  const taskKeyCounts = new Map<string, number>();

  let totalProjects = 0;
  let totalTasks = 0;
  let skippedProjects = 0;
  let scheduledCount = 0;
  let unscheduledCount = 0;
  let invalidCount = 0;

  raw.members.forEach((member) => {
    const memberName = toTrimmed(member.name) ?? 'Unknown';

    member.projects.forEach((project) => {
      const projectId = toTrimmed(project.project_id);
      if (!projectId) {
        warnings.push({
          code: 'project_id_missing',
          message: 'Project ID is missing; project skipped.',
          context: { member: memberName }
        });
        skippedProjects += 1;
        return;
      }

      totalProjects += 1;
      const projectGroup = toTrimmed(project.group);

      project.tasks.forEach((task) => {
        totalTasks += 1;
        const taskName = toTrimmed(task.task_name) ?? 'Untitled task';
        const baseKey = `${projectId}::${taskName}`;
        const count = (taskKeyCounts.get(baseKey) ?? 0) + 1;
        taskKeyCounts.set(baseKey, count);

        let taskKeyFull = baseKey;
        if (count > 1) {
          taskKeyFull = `${baseKey}#${count}`;
          warnings.push({
            code: 'duplicate_task_key',
            message: 'Duplicate task key detected; suffixed to keep uniqueness.',
            context: { taskKey: baseKey, member: memberName, occurrence: count }
          });
        }

        const { status, start, end } = normalizeTaskDates(task.start, task.end, warnings, {
          task: taskName,
          projectId,
          member: memberName
        });

        if (status === 'scheduled') {
          scheduledCount += 1;
        } else if (status === 'unscheduled') {
          unscheduledCount += 1;
        } else {
          invalidCount += 1;
        }

        tasks.push({
          taskKey: baseKey,
          taskKeyFull,
          memberName,
          projectId,
          projectGroup,
          taskName,
          start,
          end,
          rawDate: task.raw_date,
          note: toTrimmed(task.note),
          status
        });
      });
    });
  });

  const summary: ImportSummary = {
    totalMembers: raw.members.length,
    totalProjects,
    totalTasks,
    scheduledCount,
    unscheduledCount,
    invalidCount,
    warningsCount: warnings.length,
    skippedProjects
  };

  return { tasks, warnings, summary };
};
