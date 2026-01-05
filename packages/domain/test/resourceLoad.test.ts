import { describe, expect, it } from 'vitest';
import { buildResourceLoadData } from '../src/resourceLoad';
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

describe('buildResourceLoadData', () => {
  it('computes daily counts across overlapping tasks', () => {
    const tasks: NormalizedTask[] = [
      makeTask({
        memberName: 'Alice',
        projectId: 'P-1',
        taskName: 'Design',
        start: '2024-01-01',
        end: '2024-01-02',
        taskKey: 'P-1::Design',
        taskKeyFull: 'P-1::Design'
      }),
      makeTask({
        memberName: 'Alice',
        projectId: 'P-1',
        taskName: 'Build',
        start: '2024-01-02',
        end: '2024-01-03',
        taskKey: 'P-1::Build',
        taskKeyFull: 'P-1::Build'
      }),
      makeTask({
        memberName: 'Bob',
        projectId: 'P-2',
        taskName: 'Review',
        start: '2024-01-03',
        end: '2024-01-03',
        taskKey: 'P-2::Review',
        taskKeyFull: 'P-2::Review'
      }),
      makeTask({
        memberName: 'Alice',
        projectId: 'P-3',
        taskName: 'Unscheduled',
        start: null,
        end: null,
        status: 'unscheduled',
        rawDate: 'TBD',
        taskKey: 'P-3::Unscheduled',
        taskKeyFull: 'P-3::Unscheduled'
      })
    ];

    const data = buildResourceLoadData(tasks);
    expect(data).not.toBeNull();
    if (!data) {
      return;
    }

    expect(data.dates.map((date) => date.iso)).toEqual([
      '2024-01-01',
      '2024-01-02',
      '2024-01-03'
    ]);

    const alice = data.members[0];
    const bob = data.members[1];
    expect(alice.memberName).toBe('Alice');
    expect(bob.memberName).toBe('Bob');
    expect(alice.dailyCounts).toEqual([1, 2, 1]);
    expect(bob.dailyCounts).toEqual([0, 0, 1]);
  });

  it('returns null when there are no scheduled tasks', () => {
    const data = buildResourceLoadData([
      makeTask({ status: 'unscheduled', start: null, end: null, rawDate: 'TBD' }),
      makeTask({ status: 'invalid_date', start: null, end: null, rawDate: 'invalid_date' })
    ]);

    expect(data).toBeNull();
  });
});
