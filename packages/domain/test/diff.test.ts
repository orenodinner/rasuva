import { describe, expect, it } from 'vitest';
import { diffTasks } from '../src/diff';
import type { NormalizedTask } from '../src/types';

const baseTask: NormalizedTask = {
  taskKey: 'P-1::Build',
  taskKeyFull: 'P-1::Build',
  memberName: 'Alice',
  projectId: 'P-1',
  projectGroup: null,
  taskName: 'Build',
  assignees: [],
  start: '2024-01-01',
  end: '2024-01-02',
  rawDate: '2024-01-01..2024-01-02',
  note: null,
  status: 'scheduled'
};

describe('diffTasks', () => {
  it('detects added, updated, and archived tasks', () => {
    const prev: NormalizedTask[] = [baseTask];
    const next: NormalizedTask[] = [
      { ...baseTask, end: '2024-01-03' },
      {
        ...baseTask,
        taskKey: 'P-1::New',
        taskKeyFull: 'P-1::New',
        taskName: 'New'
      }
    ];

    const diff = diffTasks(prev, next);
    expect(diff.summary.added).toBe(1);
    expect(diff.summary.updated).toBe(1);
    expect(diff.summary.archived).toBe(0);
  });

  it('detects archived tasks', () => {
    const diff = diffTasks([baseTask], []);
    expect(diff.summary.archived).toBe(1);
  });

  it('detects assignee changes as updates', () => {
    const prev: NormalizedTask[] = [baseTask];
    const next: NormalizedTask[] = [{ ...baseTask, assignees: ['Bob'] }];
    const diff = diffTasks(prev, next);
    expect(diff.summary.updated).toBe(1);
  });
});
