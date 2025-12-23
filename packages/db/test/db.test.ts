import { describe, expect, it } from 'vitest';
import { createDb } from '../src/index';
import type { NormalizedTask } from '@domain';

const makeTask = (): NormalizedTask => ({
  taskKey: 'P-1::Build',
  taskKeyFull: 'P-1::Build',
  memberName: 'Alice',
  projectId: 'P-1',
  projectGroup: null,
  taskName: 'Build',
  assignees: ['Bob'],
  start: '2024-01-01',
  end: '2024-01-02',
  rawDate: '2024-01-01..2024-01-02',
  note: null,
  status: 'scheduled'
});

describe('db', () => {
  it('inserts and reads imports and tasks', () => {
    const db = createDb(':memory:');
    db.init();
    const scheduleId = db.listSchedules()[0]?.id;
    expect(scheduleId).toBeTruthy();

    const importId = db.insertImport(scheduleId as number, {
      createdAt: new Date().toISOString(),
      source: 'test',
      rawJson: '{}',
      summary: {
        totalMembers: 1,
        totalProjects: 1,
        totalTasks: 1,
        scheduledCount: 1,
        unscheduledCount: 0,
        invalidCount: 0,
        warningsCount: 0,
        skippedProjects: 0
      },
      diffSummary: {
        added: 1,
        updated: 0,
        archived: 0,
        invalid: 0,
        unscheduled: 0
      }
    });

    db.insertTasks(importId, [makeTask()]);

    const imports = db.listImports(scheduleId);
    expect(imports.length).toBe(1);
    expect(imports[0].id).toBe(importId);

    const tasks = db.getTasksByImportId(importId);
    expect(tasks.length).toBe(1);
    expect(tasks[0].taskName).toBe('Build');

    db.updateTask(importId, tasks[0].taskKeyFull, {
      memberName: 'Alice',
      projectId: 'P-1',
      projectGroup: null,
      taskName: 'Build',
      start: '2024-01-02',
      end: '2024-01-03',
      note: 'Updated',
      status: 'scheduled',
      assignees: ['Bob', 'Eve']
    });

    const updated = db.getTaskByKey(importId, tasks[0].taskKeyFull);
    expect(updated?.start).toBe('2024-01-02');
    expect(updated?.note).toBe('Updated');
    expect(updated?.assignees).toEqual(['Bob', 'Eve']);

    db.close();
  });
});
