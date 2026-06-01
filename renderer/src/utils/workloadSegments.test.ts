import { describe, expect, it } from 'vitest';
import type { NormalizedTask } from '@domain';
import { toUtcDate } from './ganttMath';
import { buildWorkloadSegments, getPeakWeeklyTaskCount } from './workloadSegments';

const makeTask = (overrides: Partial<NormalizedTask> = {}): NormalizedTask => ({
  taskKey: overrides.taskKey ?? 'P-1::Task',
  taskKeyFull: overrides.taskKeyFull ?? 'P-1::Task',
  memberName: overrides.memberName ?? 'Alice',
  projectId: overrides.projectId ?? 'P-1',
  projectGroup: overrides.projectGroup ?? 'Group-A',
  taskName: overrides.taskName ?? 'Task',
  assignees: overrides.assignees ?? [],
  start: overrides.start ?? '2024-01-01',
  end: overrides.end ?? '2024-01-01',
  rawDate: overrides.rawDate ?? '2024-01-01',
  note: overrides.note ?? null,
  status: overrides.status ?? 'scheduled',
  completed: overrides.completed ?? false
});

describe('getPeakWeeklyTaskCount', () => {
  it('returns the maximum scheduled task count in any week', () => {
    const tasks = [
      makeTask({ taskKeyFull: 'P-1::A', start: '2024-01-01', end: '2024-01-01' }),
      makeTask({ taskKeyFull: 'P-1::B', start: '2024-01-03', end: '2024-01-03' }),
      makeTask({ taskKeyFull: 'P-1::C', start: '2024-01-10', end: '2024-01-10' }),
      makeTask({ taskKeyFull: 'P-1::D', start: null, end: null, status: 'unscheduled' })
    ];

    expect(getPeakWeeklyTaskCount(tasks, toUtcDate('2024-01-01'), toUtcDate('2024-01-31'))).toBe(2);
  });

  it('does not use the visible zoom column size for group load badges', () => {
    const tasks = [
      makeTask({ taskKeyFull: 'P-1::A', start: '2024-01-01', end: '2024-01-01' }),
      makeTask({ taskKeyFull: 'P-1::B', start: '2024-01-08', end: '2024-01-08' }),
      makeTask({ taskKeyFull: 'P-1::C', start: '2024-01-15', end: '2024-01-15' }),
      makeTask({ taskKeyFull: 'P-1::D', start: '2024-01-22', end: '2024-01-22' })
    ];
    const rangeStart = toUtcDate('2024-01-01');
    const rangeEnd = toUtcDate('2024-01-31');

    const quarterLikeSegments = buildWorkloadSegments(tasks, rangeStart, rangeEnd, 28, 1);

    expect(Math.max(...quarterLikeSegments.map((segment) => segment.count))).toBe(4);
    expect(getPeakWeeklyTaskCount(tasks, rangeStart, rangeEnd)).toBe(1);
  });
});
