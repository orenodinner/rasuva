import { describe, expect, it } from 'vitest';
import type { NormalizedTask } from '@domain';
import { buildProjectStats, clampSplit, MIN_PANE_HEIGHT, SPLITTER_HEIGHT } from './projectStats';

const makeTask = (overrides: Partial<NormalizedTask> = {}): NormalizedTask => {
  const hasProjectGroup = Object.prototype.hasOwnProperty.call(overrides, 'projectGroup');
  const hasStart = Object.prototype.hasOwnProperty.call(overrides, 'start');
  const hasEnd = Object.prototype.hasOwnProperty.call(overrides, 'end');
  return {
    taskKey: overrides.taskKey ?? 'P-1::Task',
    taskKeyFull: overrides.taskKeyFull ?? 'P-1::Task',
    memberName: overrides.memberName ?? 'Alice',
    projectId: overrides.projectId ?? 'P-1',
    projectGroup: hasProjectGroup ? (overrides.projectGroup ?? null) : 'Group-A',
    taskName: overrides.taskName ?? 'Task',
    assignees: overrides.assignees ?? [],
    start: hasStart ? (overrides.start ?? null) : '2024-01-10',
    end: hasEnd ? (overrides.end ?? null) : '2024-01-12',
    rawDate: overrides.rawDate ?? '2024-01-10..2024-01-12',
    note: overrides.note ?? null,
    status: overrides.status ?? 'scheduled'
  };
};

describe('buildProjectStats', () => {
  it('returns empty array for no tasks', () => {
    expect(buildProjectStats([])).toEqual([]);
  });

  it('aggregates counts, dates, and members by project', () => {
    const tasks: NormalizedTask[] = [
      makeTask({
        taskKey: 'P-2::A',
        taskKeyFull: 'P-2::A',
        projectId: 'P-2',
        projectGroup: null,
        memberName: 'Alice',
        assignees: ['Bob'],
        start: '2024-01-05',
        end: '2024-01-06',
        status: 'scheduled'
      }),
      makeTask({
        taskKey: 'P-2::B',
        taskKeyFull: 'P-2::B',
        projectId: 'P-2',
        projectGroup: 'Group-B',
        memberName: 'Cara',
        assignees: ['Bob', 'Dina'],
        start: null,
        end: null,
        status: 'unscheduled'
      }),
      makeTask({
        taskKey: 'P-1::C',
        taskKeyFull: 'P-1::C',
        projectId: 'P-1',
        projectGroup: 'Group-A',
        memberName: 'Eli',
        assignees: [],
        start: '2024-02-01',
        end: '2024-02-03',
        status: 'invalid_date'
      })
    ];

    const stats = buildProjectStats(tasks);
    expect(stats.map((entry) => entry.projectId)).toEqual(['P-1', 'P-2']);

    const p2 = stats.find((entry) => entry.projectId === 'P-2');
    expect(p2).toBeTruthy();
    expect(p2?.group).toBe('Group-B');
    expect(p2?.totalTasks).toBe(2);
    expect(p2?.scheduled).toBe(1);
    expect(p2?.unscheduled).toBe(1);
    expect(p2?.invalid).toBe(0);
    expect(p2?.startDate).toBe('2024-01-05');
    expect(p2?.endDate).toBe('2024-01-06');
    expect(p2?.involvedMembers.size).toBe(4);
    expect(p2?.involvedMembers.has('Alice')).toBe(true);
    expect(p2?.involvedMembers.has('Bob')).toBe(true);
    expect(p2?.involvedMembers.has('Cara')).toBe(true);
    expect(p2?.involvedMembers.has('Dina')).toBe(true);
  });
});

describe('clampSplit', () => {
  it('clamps within min and max bounds', () => {
    const totalHeight = 400;
    const available = totalHeight - SPLITTER_HEIGHT;
    const min = Math.min(MIN_PANE_HEIGHT, Math.floor(available / 2));
    const max = Math.max(min, available - min);

    expect(clampSplit(min - 50, totalHeight)).toBe(min);
    expect(clampSplit(max + 50, totalHeight)).toBe(max);
    expect(clampSplit(min + 10, totalHeight)).toBe(min + 10);
  });
});
