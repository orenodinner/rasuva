import { describe, expect, it } from 'vitest';
import { mergeTasksForSave, summarizeTasksForImport } from '../src/merge';
import type { NormalizedTask } from '../src/types';

const makeTask = (overrides: Partial<NormalizedTask>): NormalizedTask => ({
  taskKey: overrides.taskKey ?? 'P-1::Task',
  taskKeyFull: overrides.taskKeyFull ?? overrides.taskKey ?? 'P-1::Task',
  memberName: overrides.memberName ?? 'Alice',
  projectId: overrides.projectId ?? 'P-1',
  projectGroup: overrides.projectGroup ?? null,
  taskName: overrides.taskName ?? 'Task',
  assignees: overrides.assignees ?? [],
  start: overrides.start ?? '2024-01-01',
  end: overrides.end ?? '2024-01-01',
  rawDate: overrides.rawDate ?? '2024-01-01',
  note: overrides.note ?? null,
  status: overrides.status ?? 'scheduled'
});

describe('mergeTasksForSave', () => {
  it('keeps missing tasks in incremental mode and prefers input updates', () => {
    const prev = [
      makeTask({ taskKey: 'P-1::Design', taskKeyFull: 'P-1::Design', note: 'old' }),
      makeTask({ taskKey: 'P-2::Review', taskKeyFull: 'P-2::Review', projectId: 'P-2' })
    ];
    const input = [
      makeTask({ taskKey: 'P-1::Design', taskKeyFull: 'P-1::Design', note: 'new' }),
      makeTask({ taskKey: 'P-3::Build', taskKeyFull: 'P-3::Build', projectId: 'P-3' })
    ];

    const merged = mergeTasksForSave(prev, input, 'incremental');
    const mergedByKey = new Map(merged.map((task) => [task.taskKeyFull, task]));

    expect(merged).toHaveLength(3);
    expect(mergedByKey.get('P-1::Design')?.note).toBe('new');
    expect(mergedByKey.has('P-2::Review')).toBe(true);
  });

  it('returns only input tasks in full mode', () => {
    const prev = [makeTask({ taskKeyFull: 'P-1::Design' })];
    const input = [makeTask({ taskKeyFull: 'P-2::Build', projectId: 'P-2' })];

    const merged = mergeTasksForSave(prev, input, 'full');
    expect(merged).toEqual(input);
  });
});

describe('summarizeTasksForImport', () => {
  it('counts status totals and unique members/projects', () => {
    const tasks = [
      makeTask({ memberName: 'Alice', projectId: 'P-1', status: 'scheduled' }),
      makeTask({ memberName: 'Alice', projectId: 'P-2', status: 'unscheduled', start: null, end: null }),
      makeTask({ memberName: 'Bob', projectId: 'P-2', status: 'invalid_date', start: null, end: null })
    ];

    const summary = summarizeTasksForImport(tasks, 2, 1);
    expect(summary.totalMembers).toBe(2);
    expect(summary.totalProjects).toBe(3);
    expect(summary.totalTasks).toBe(3);
    expect(summary.scheduledCount).toBe(1);
    expect(summary.unscheduledCount).toBe(1);
    expect(summary.invalidCount).toBe(1);
    expect(summary.warningsCount).toBe(2);
    expect(summary.skippedProjects).toBe(1);
  });
});
