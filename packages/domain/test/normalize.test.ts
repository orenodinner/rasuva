import { describe, expect, it } from 'vitest';
import { convertFlatTasksToRawImport, parseDateStrict, normalizeImport } from '../src/normalize';

const sampleImport = {
  members: [
    {
      name: 'Alice',
      projects: [
        {
          project_id: 'P-1',
          group: 'Core',
          tasks: [
            {
              task_name: 'Design',
              start: '2024-01-10',
              end: '2024-01-12',
              raw_date: '2024-01-10..2024-01-12'
            },
            {
              task_name: 'Design',
              start: '2024-01-13',
              end: '2024-01-13',
              raw_date: '2024-01-13'
            },
            {
              task_name: 'Unscheduled',
              start: null,
              end: null,
              raw_date: 'TBD'
            },
            {
              task_name: 'Invalid',
              start: '2024/01/01',
              end: '2024-01-02',
              raw_date: '2024/01/01-2024-01-02'
            }
          ]
        }
      ]
    }
  ]
};

describe('parseDateStrict', () => {
  it('accepts valid YYYY-MM-DD dates', () => {
    expect(parseDateStrict('2024-02-29')).toBe('2024-02-29');
    expect(parseDateStrict('9999-12-31')).toBe('9999-12-31');
  });

  it('rejects invalid dates', () => {
    expect(parseDateStrict('2024-13-01')).toBeNull();
    expect(parseDateStrict('2024-02-30')).toBeNull();
    expect(parseDateStrict('2024/01/01')).toBeNull();
  });

  it('rejects invalid leap year dates', () => {
    expect(parseDateStrict('2023-02-29')).toBeNull();
    expect(parseDateStrict('2024-02-29')).toBe('2024-02-29');
  });
});

describe('normalizeImport', () => {
  it('categorizes scheduled, unscheduled, and invalid tasks', () => {
    const { tasks, summary, warnings } = normalizeImport(sampleImport);
    const statusCounts = tasks.reduce(
      (acc, task) => {
        acc[task.status] += 1;
        return acc;
      },
      { scheduled: 0, unscheduled: 0, invalid_date: 0 }
    );

    expect(statusCounts.scheduled).toBe(2);
    expect(statusCounts.unscheduled).toBe(1);
    expect(statusCounts.invalid_date).toBe(1);
    expect(summary.totalTasks).toBe(4);
    expect(warnings.some((warning) => warning.code === 'duplicate_task_key')).toBe(true);
  });

  it('handles triple duplicate task keys correctly', () => {
    const raw = {
      members: [
        {
          name: 'Bob',
          projects: [
            {
              project_id: 'P1',
              tasks: [
                { task_name: 'Fix', start: '2024-01-01', end: '2024-01-01', raw_date: '' },
                { task_name: 'Fix', start: '2024-01-01', end: '2024-01-01', raw_date: '' },
                { task_name: 'Fix', start: '2024-01-01', end: '2024-01-01', raw_date: '' }
              ]
            }
          ]
        }
      ]
    };
    const { tasks } = normalizeImport(raw as any);
    expect(tasks[0].taskKeyFull).toBe('P1::Fix');
    expect(tasks[1].taskKeyFull).toBe('P1::Fix#2');
    expect(tasks[2].taskKeyFull).toBe('P1::Fix#3');
  });

  it('handles empty members list', () => {
    const { tasks, summary } = normalizeImport({ members: [] } as any);
    expect(tasks.length).toBe(0);
    expect(summary.totalMembers).toBe(0);
    expect(summary.totalProjects).toBe(0);
    expect(summary.totalTasks).toBe(0);
  });

  it('handles project with empty tasks array', () => {
    const raw = {
      members: [
        {
          name: 'Kana',
          projects: [{ project_id: 'P-Empty', tasks: [] }]
        }
      ]
    };
    const { tasks, summary } = normalizeImport(raw as any);
    expect(tasks.length).toBe(0);
    expect(summary.totalProjects).toBe(1);
    expect(summary.totalTasks).toBe(0);
  });

  it('normalizes assignees from assign list', () => {
    const raw = {
      members: [
        {
          name: 'Alice',
          projects: [
            {
              project_id: 'P-2',
              tasks: [
                {
                  task_name: 'Review',
                  start: '2024-01-01',
                  end: '2024-01-01',
                  raw_date: '2024-01-01',
                  assign: ['Bob', '  ', 'Alice', 'Bob', 'Charlie']
                }
              ]
            }
          ]
        }
      ]
    };
    const { tasks } = normalizeImport(raw as any);
    expect(tasks[0].assignees).toEqual(['Bob', 'Charlie']);
  });

  it('converts flat rows into raw import structure', () => {
    const raw = convertFlatTasksToRawImport([
      {
        member_name: 'Alice',
        project_id: 'P-10',
        project_group: 'Core',
        task_name: 'Sync',
        assignees: ['Bob'],
        start: '2024-01-05',
        end: '2024-01-06',
        note: 'Note',
        raw_date: '2024-01-05..2024-01-06'
      }
    ]);

    expect(raw.members.length).toBe(1);
    expect(raw.members[0].projects.length).toBe(1);
    expect(raw.members[0].projects[0].tasks.length).toBe(1);
    expect(raw.members[0].projects[0].tasks[0].assign).toEqual(['Bob']);
  });
});
