import { describe, expect, it } from 'vitest';
import { convertNormalizedTasksToRawImport } from '../src/denormalize';
import type { NormalizedTask } from '../src/types';

describe('convertNormalizedTasksToRawImport', () => {
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
});
