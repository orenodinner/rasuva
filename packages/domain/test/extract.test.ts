import { describe, expect, it } from 'vitest';
import { extractJsonFromText } from '../src/extract';

const makeImport = (memberName: string, projectId: string, taskName: string) => ({
  members: [
    {
      name: memberName,
      projects: [
        {
          project_id: projectId,
          tasks: [
            {
              task_name: taskName,
              start: '2025-01-01',
              end: '2025-01-02',
              raw_date: '2025-01-01..2025-01-02'
            }
          ]
        }
      ]
    }
  ]
});

describe('extractJsonFromText', () => {
  it('extracts JSON from noisy chat logs', () => {
    const rawImport = makeImport('Tanaka', 'P1', 'Task A');
    const input = [
      'Assistant: Sure, here is the data.',
      '```json',
      JSON.stringify(rawImport, null, 2),
      '```',
      'User: Thanks!'
    ].join('\n');

    const result = extractJsonFromText(input);
    expect(result).toEqual(rawImport);
  });

  it('repairs truncated JSON by closing strings and braces', () => {
    const input = [
      '{',
      '  "members": [',
      '    {',
      '      "name": "Tanaka",',
      '      "projects": [',
      '        {',
      '          "project_id": "P1",',
      '          "tasks": [',
      '            {',
      '              "task_name": "Task A",',
      '              "start": "2025-01-",',
      '              "end": null,',
      '              "raw_date": "2025-01-'
    ].join('\n');

    const result = extractJsonFromText(input);
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }

    const task = result.members[0].projects[0].tasks[0];
    expect(task.start).toBe('2025-01-');
    expect(task.raw_date).toBe('2025-01-');
  });

  it('merges multiple JSON blocks into a single import', () => {
    const first = makeImport('Tanaka', 'P1', 'Task A');
    const second = makeImport('Suzuki', 'P2', 'Task B');
    const input = `${JSON.stringify(first)}\n\nUser: Next\n\n${JSON.stringify(second)}`;

    const result = extractJsonFromText(input);
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }

    expect(result.members.length).toBe(2);
    const memberNames = result.members.map((member) => member.name).sort();
    expect(memberNames).toEqual(['Suzuki', 'Tanaka']);
  });

  it('merges projects with the same project_id under the same member', () => {
    const first = makeImport('Tanaka', 'P1', 'Task A');
    const second = makeImport('Tanaka', 'P1', 'Task B');
    const input = [
      '```json',
      JSON.stringify(first, null, 2),
      '```',
      '```json',
      JSON.stringify(second, null, 2),
      '```'
    ].join('\n');

    const result = extractJsonFromText(input);
    expect(result).not.toBeNull();
    if (!result) {
      return;
    }

    const tasks = result.members[0].projects[0].tasks.map((task) => task.task_name);
    expect(tasks).toEqual(['Task A', 'Task B']);
  });
});
