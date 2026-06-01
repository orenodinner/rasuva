import { describe, expect, it } from 'vitest';
import {
  flattenTasksByMember,
  generateTimelineStructure,
  getProjectWeekNumber,
  getSundayOnOrBeforeUtc,
  getWeekEnd,
  getWeekStart,
  parseIsoDate
} from '../src/exportUtils';
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
  status: overrides.status ?? 'scheduled',
  completed: overrides.completed ?? false
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

describe('week utilities', () => {
  it('handles a year where Jan 1 is Sunday', () => {
    const jan1 = new Date(Date.UTC(2023, 0, 1));
    const jan7 = new Date(Date.UTC(2023, 0, 7));
    const jan8 = new Date(Date.UTC(2023, 0, 8));
    const weekStart = getWeekStart(jan1);
    expect(weekStart.getTime()).toBe(jan1.getTime());
    expect(getWeekEnd(weekStart).getTime()).toBe(jan7.getTime());
    expect(getProjectWeekNumber(weekStart)).toBe(1);

    const nextWeekStart = getWeekStart(jan8);
    expect(nextWeekStart.getTime()).toBe(jan8.getTime());
    expect(getProjectWeekNumber(nextWeekStart)).toBe(2);
  });

  it('handles a year where Jan 1 is a weekday and clamps year-end weeks', () => {
    const jan1 = new Date(Date.UTC(2024, 0, 1));
    const jan3 = new Date(Date.UTC(2024, 0, 3));
    const jan6 = new Date(Date.UTC(2024, 0, 6));
    const jan7 = new Date(Date.UTC(2024, 0, 7));
    const jan13 = new Date(Date.UTC(2024, 0, 13));
    const weekStart = getWeekStart(jan3);
    expect(weekStart.getTime()).toBe(jan1.getTime());
    expect(getWeekEnd(weekStart).getTime()).toBe(jan6.getTime());
    expect(getProjectWeekNumber(weekStart)).toBe(1);

    const nextWeekStart = getWeekStart(jan7);
    expect(nextWeekStart.getTime()).toBe(jan7.getTime());
    expect(getWeekEnd(nextWeekStart).getTime()).toBe(jan13.getTime());

    const dec31 = new Date(Date.UTC(2023, 11, 31));
    const yearEndWeekStart = getWeekStart(dec31);
    expect(yearEndWeekStart.getTime()).toBe(dec31.getTime());
    expect(getWeekEnd(yearEndWeekStart).getTime()).toBe(dec31.getTime());
  });

  it('uses Sunday on or before for week start after the first Sunday', () => {
    const date = new Date(Date.UTC(2024, 1, 14));
    const weekStart = getWeekStart(date);
    const expectedStart = getSundayOnOrBeforeUtc(date);
    expect(weekStart.getTime()).toBe(expectedStart.getTime());
  });
});

describe('generateTimelineStructure', () => {
  it('builds week columns with year/month grouping', () => {
    const tasks = [
      makeTask({
        start: '2024-01-01',
        end: '2024-01-03',
        taskKeyFull: 'P-1::Early'
      }),
      makeTask({
        start: '2024-02-05',
        end: '2024-02-06',
        taskKeyFull: 'P-1::Later'
      })
    ];

    const structure = generateTimelineStructure(tasks);
    expect(structure.weeks.length).toBeGreaterThan(0);
    expect(structure.years[0].label).toBe('2024');
    expect(structure.months.some((group) => group.label === '1')).toBe(true);
    expect(structure.months.some((group) => group.label === '2')).toBe(true);
    expect(structure.weeks[0].label.endsWith('W')).toBe(true);
  });

  it('handles cross-year tasks with correct grouping and week boundaries', () => {
    const tasks = [
      makeTask({
        start: '2023-12-25',
        end: '2024-01-10',
        taskKeyFull: 'P-1::CrossYear'
      })
    ];

    const structure = generateTimelineStructure(tasks);
    expect(structure.years).toEqual([
      { label: '2023', span: 2 },
      { label: '2024', span: 2 }
    ]);
    expect(structure.months).toEqual([
      { label: '12', span: 2 },
      { label: '1', span: 2 }
    ]);

    expect(structure.weeks[0].start).toBe('2023-12-24');
    expect(structure.weeks[0].end).toBe('2023-12-30');
    expect(structure.weeks[1].start).toBe('2023-12-31');
    expect(structure.weeks[1].end).toBe('2023-12-31');
    expect(structure.weeks[2].start).toBe('2024-01-01');
    expect(structure.weeks[2].end).toBe('2024-01-06');
    expect(structure.weeks[3].start).toBe('2024-01-07');
    expect(structure.weeks[3].end).toBe('2024-01-13');

    expect(structure.weeks.some((week) => week.label === '1W')).toBe(true);
    expect(structure.weeks.some((week) => week.label === '52W')).toBe(true);
    structure.weeks.forEach((week) => {
      const weekStart = parseIsoDate(week.start);
      expect(weekStart).not.toBeNull();
      const expectedLabel = `${getProjectWeekNumber(weekStart!)}W`;
      expect(week.label).toBe(expectedLabel);
    });
  });

  it('maps a one-day task to the correct week when Jan 1 is Sunday', () => {
    const tasks = [
      makeTask({
        start: '2023-01-01',
        end: '2023-01-01',
        taskKeyFull: 'P-1::OneDay'
      })
    ];

    const structure = generateTimelineStructure(tasks);
    expect(structure.years).toEqual([{ label: '2023', span: 1 }]);
    expect(structure.months).toEqual([{ label: '1', span: 1 }]);
    expect(structure.weeks).toHaveLength(1);
    expect(structure.weeks[0]).toEqual({
      year: 2023,
      month: 1,
      label: '1W',
      start: '2023-01-01',
      end: '2023-01-07'
    });
  });

  it('returns empty structures when no tasks are provided', () => {
    const structure = generateTimelineStructure([]);
    expect(structure.years).toEqual([]);
    expect(structure.months).toEqual([]);
    expect(structure.weeks).toEqual([]);
  });
});
