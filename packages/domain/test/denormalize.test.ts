import { describe, expect, it } from 'vitest';
import { convertNormalizedTasksToRawImport } from '../src/denormalize';
import type { NormalizedTask } from '../src/types';

describe('convertNormalizedTasksToRawImport', () => {
  const makeTask = (overrides: Partial<NormalizedTask> = {}): NormalizedTask => ({
    taskKey: 'P1::Base',
    taskKeyFull: 'P1::Base',
    memberName: 'Alice',
    projectId: 'P1',
    projectGroup: null,
    taskName: 'Base',
    assignees: [],
    start: '2024-01-01',
    end: '2024-01-02',
    rawDate: '2024-01-01..2024-01-02',
    note: null,
    status: 'scheduled',
    ...overrides
  });

  it('groups tasks by member and project, preserving assigns and dates', () => {
    const tasks: NormalizedTask[] = [
      {
        taskKey: 'P1::Design',
        taskKeyFull: 'P1::Design',
        memberName: 'Alice',
        projectId: 'P1',
        projectGroup: null,
        taskName: 'Design',
        assignees: ['Bob'],
        start: '2024-01-10',
        end: '2024-01-12',
        rawDate: '2024-01-10..2024-01-12',
        note: null,
        status: 'scheduled'
      },
      {
        taskKey: 'P1::Build',
        taskKeyFull: 'P1::Build',
        memberName: 'Alice',
        projectId: 'P1',
        projectGroup: 'Core',
        taskName: 'Build',
        assignees: [],
        start: null,
        end: null,
        rawDate: 'TBD',
        note: null,
        status: 'unscheduled'
      },
      {
        taskKey: 'P2::Ship',
        taskKeyFull: 'P2::Ship',
        memberName: 'Ben',
        projectId: 'P2',
        projectGroup: 'Ops',
        taskName: 'Ship',
        assignees: ['Cara'],
        start: '2024-02-01',
        end: '2024-02-02',
        rawDate: '2024-02-01..2024-02-02',
        note: 'Ready',
        status: 'scheduled'
      }
    ];

    const raw = convertNormalizedTasksToRawImport(tasks);
    expect(raw.members).toHaveLength(2);

    const alice = raw.members.find((member) => member.name === 'Alice');
    expect(alice?.projects).toHaveLength(1);
    const aliceProject = alice?.projects[0];
    expect(aliceProject?.project_id).toBe('P1');
    expect(aliceProject?.group).toBe('Core');
    expect(aliceProject?.tasks).toHaveLength(2);
    expect(aliceProject?.tasks?.[0]).toMatchObject({
      task_name: 'Design',
      start: '2024-01-10',
      end: '2024-01-12',
      raw_date: '2024-01-10..2024-01-12',
      note: null,
      assign: ['Bob']
    });
    expect(aliceProject?.tasks?.[1]).toMatchObject({
      task_name: 'Build',
      start: null,
      end: null,
      raw_date: 'TBD',
      note: null,
      assign: []
    });

    const ben = raw.members.find((member) => member.name === 'Ben');
    expect(ben?.projects).toHaveLength(1);
    expect(ben?.projects?.[0]).toMatchObject({
      project_id: 'P2',
      group: 'Ops'
    });
  });

  it('returns empty members when tasks are empty', () => {
    const raw = convertNormalizedTasksToRawImport([]);
    expect(raw.members).toEqual([]);
  });

  it('falls back to 不明 when memberName is empty or null', () => {
    const tasks: NormalizedTask[] = [
      makeTask({
        memberName: '',
        taskName: 'Design',
        assignees: ['Bob'],
        note: 'Note A'
      }),
      makeTask({
        memberName: null as unknown as string,
        taskName: 'Build',
        assignees: [],
        note: null
      })
    ];

    const raw = convertNormalizedTasksToRawImport(tasks);
    expect(raw.members).toHaveLength(1);
    const member = raw.members[0];
    expect(member.name).toBe('不明');
    expect(member.projects).toHaveLength(1);
    const project = member.projects[0];
    expect(project.project_id).toBe('P1');
    expect(project.tasks).toHaveLength(2);
    expect(project.tasks[0]).toMatchObject({
      task_name: 'Design',
      start: '2024-01-01',
      end: '2024-01-02',
      raw_date: '2024-01-01..2024-01-02',
      note: 'Note A',
      assign: ['Bob']
    });
    expect(project.tasks[1]).toMatchObject({
      task_name: 'Build',
      start: '2024-01-01',
      end: '2024-01-02',
      raw_date: '2024-01-01..2024-01-02',
      note: null,
      assign: []
    });
  });

  it('groups missing projectId under __missing__', () => {
    const tasks: NormalizedTask[] = [
      makeTask({
        projectId: null as unknown as string,
        taskName: 'No Project',
        assignees: ['Zoe'],
        note: 'Missing project'
      })
    ];

    const raw = convertNormalizedTasksToRawImport(tasks);
    expect(raw.members).toHaveLength(1);
    const member = raw.members[0];
    expect(member.projects).toHaveLength(1);
    const project = member.projects[0];
    expect(project.project_id).toBe('__missing__');
    expect(project.tasks).toHaveLength(1);
    expect(project.tasks[0]).toMatchObject({
      task_name: 'No Project',
      start: '2024-01-01',
      end: '2024-01-02',
      raw_date: '2024-01-01..2024-01-02',
      note: 'Missing project',
      assign: ['Zoe']
    });
  });

  it('builds raw_date from start/end when rawDate is empty', () => {
    const tasks: NormalizedTask[] = [
      makeTask({
        taskName: 'Range Task',
        rawDate: '',
        start: '2024-03-01',
        end: '2024-03-02',
        assignees: ['Ken'],
        note: null
      }),
      makeTask({
        taskName: 'TBD Task',
        rawDate: '',
        start: null,
        end: null,
        assignees: [],
        note: 'Pending'
      })
    ];

    const raw = convertNormalizedTasksToRawImport(tasks);
    expect(raw.members).toHaveLength(1);
    const member = raw.members[0];
    expect(member.projects).toHaveLength(1);
    const project = member.projects[0];
    expect(project.tasks).toHaveLength(2);
    expect(project.tasks[0]).toMatchObject({
      task_name: 'Range Task',
      start: '2024-03-01',
      end: '2024-03-02',
      raw_date: '2024-03-01..2024-03-02',
      note: null,
      assign: ['Ken']
    });
    expect(project.tasks[1]).toMatchObject({
      task_name: 'TBD Task',
      start: null,
      end: null,
      raw_date: 'TBD',
      note: 'Pending',
      assign: []
    });
  });
});
