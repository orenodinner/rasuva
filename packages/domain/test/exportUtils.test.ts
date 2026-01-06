import { describe, expect, it } from 'vitest';
import { flattenTasksByMember } from '../src/exportUtils';
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

describe('flattenTasksByMember', () => {
  it('expands tasks to owners and assignees and sorts by member', () => {
    const tasks = [
      makeTask({
        memberName: 'Bob',
        projectId: 'P-2',
        taskName: 'Review',
        assignees: ['Alice'],
        start: '2024-01-03',
        taskKeyFull: 'P-2::Review'
      }),
      makeTask({
        memberName: 'Alice',
        projectId: 'P-1',
        taskName: 'Design',
        assignees: ['Bob'],
        start: '2024-01-01',
        taskKeyFull: 'P-1::Design'
      })
    ];

    const rows = flattenTasksByMember(tasks);
    const names = rows.map((row) => row.memberName);
    expect(names).toEqual(['Alice', 'Alice', 'Bob', 'Bob']);
  });

  it('avoids duplicate entries when assignee matches owner', () => {
    const tasks = [
      makeTask({
        memberName: 'Alice',
        assignees: ['Alice'],
        taskKeyFull: 'P-1::Solo'
      })
    ];

    const rows = flattenTasksByMember(tasks);
    expect(rows).toHaveLength(1);
    expect(rows[0].memberName).toBe('Alice');
  });

  it('sorts tasks for a member by start then project id', () => {
    const tasks = [
      makeTask({
        memberName: 'Alice',
        projectId: 'P-2',
        taskName: 'Late',
        start: '2024-01-05',
        taskKeyFull: 'P-2::Late'
      }),
      makeTask({
        memberName: 'Alice',
        projectId: 'P-1',
        taskName: 'Early',
        start: '2024-01-03',
        taskKeyFull: 'P-1::Early'
      }),
      makeTask({
        memberName: 'Alice',
        projectId: 'P-0',
        taskName: 'SameDay',
        start: '2024-01-03',
        taskKeyFull: 'P-0::SameDay'
      })
    ];

    const rows = flattenTasksByMember(tasks).filter((row) => row.memberName === 'Alice');
    expect(rows.map((row) => row.task.taskKeyFull)).toEqual([
      'P-0::SameDay',
      'P-1::Early',
      'P-2::Late'
    ]);
  });
});
