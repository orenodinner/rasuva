import { BrowserWindow, Menu, MenuItem, dialog, ipcMain } from 'electron';
import { z } from 'zod';
import {
  addUtcDays,
  convertFlatTasksToRawImport,
  convertNormalizedTasksToRawImport,
  diffTasks,
  flattenTasksByMember,
  formatIsoDate,
  generateTimelineStructure,
  getNextSundayAfterUtc,
  getSundayOnOrBeforeUtc,
  mergeTasksForSave,
  normalizeImport,
  parseIsoDate,
  parseDateStrict,
  parseImportJson,
  summarizeTasksForImport,
  TaskCreateSchema
} from '@domain';
import type { DbClient } from '@db';
import type { FlatTaskRow, NormalizedTask } from '@domain';
import { writeFileSync } from 'fs';
import ExcelJS from 'exceljs';
import { IPC_CHANNELS } from '../shared/ipcChannels';

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const MS_PER_WEEK = MS_PER_DAY * 7;

type HistoryState = { pointer: number; ids: number[] };

class HistoryManager {
  private historyByImport = new Map<number, HistoryState>();

  ensure(importId: number) {
    if (!this.historyByImport.has(importId)) {
      this.historyByImport.set(importId, { pointer: -1, ids: [] });
    }
    return this.historyByImport.get(importId)!;
  }

  record(importId: number, historyId: number) {
    const state = this.ensure(importId);
    let dropped: number[] = [];
    if (state.pointer < state.ids.length - 1) {
      dropped = state.ids.slice(state.pointer + 1);
      state.ids = state.ids.slice(0, state.pointer + 1);
    }
    state.ids.push(historyId);
    state.pointer = state.ids.length - 1;
    return dropped;
  }

  getStatus(importId: number) {
    const state = this.ensure(importId);
    return {
      canUndo: state.pointer >= 0,
      canRedo: state.pointer < state.ids.length - 1
    };
  }

  peekUndo(importId: number) {
    const state = this.ensure(importId);
    if (state.pointer < 0) {
      return null;
    }
    return state.ids[state.pointer];
  }

  peekRedo(importId: number) {
    const state = this.ensure(importId);
    if (state.pointer >= state.ids.length - 1) {
      return null;
    }
    return state.ids[state.pointer + 1];
  }

  commitUndo(importId: number) {
    const state = this.ensure(importId);
    if (state.pointer >= 0) {
      state.pointer -= 1;
    }
  }

  commitRedo(importId: number) {
    const state = this.ensure(importId);
    if (state.pointer < state.ids.length - 1) {
      state.pointer += 1;
    }
  }
}

const historyManager = new HistoryManager();

const formatMonthDay = (date: Date) => {
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  return `${month}/${day}`;
};

const formatTaskRangeLabel = (start: Date | null, end: Date | null) => {
  if (!start || !end) {
    return '未確定';
  }
  const startLabel = formatMonthDay(start);
  const endLabel = formatMonthDay(end);
  return startLabel === endLabel ? startLabel : `${startLabel}-${endLabel}`;
};

const formatMonthDayPadded = (date: Date) => {
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${month}/${day}`;
};

const getMondayOnOrBeforeUtc = (date: Date) => {
  const day = date.getUTCDay();
  const offset = (day + 6) % 7;
  return addUtcDays(date, -offset);
};

const getSundayOnOrAfterUtc = (date: Date) => {
  const day = date.getUTCDay();
  const offset = day === 0 ? 0 : 7 - day;
  return addUtcDays(date, offset);
};

const getProjectWeekNumber = (date: Date) => {
  const weekStart = getSundayOnOrBeforeUtc(date);
  const year = weekStart.getUTCFullYear();
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const firstSunday = getNextSundayAfterUtc(jan1);

  if (weekStart.getTime() <= jan1.getTime() || weekStart.getTime() < firstSunday.getTime()) {
    return 1;
  }

  const diffWeeks = Math.floor((weekStart.getTime() - firstSunday.getTime()) / MS_PER_WEEK);
  return diffWeeks + 2;
};

const excelSerialToDate = (value: number) => {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + value * MS_PER_DAY);
};

const pad2 = (value: number) => `${value}`.padStart(2, '0');

const formatDateStamp = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = pad2(date.getUTCMonth() + 1);
  const day = pad2(date.getUTCDate());
  return `${year}${month}${day}`;
};

const sanitizeFilename = (value: string) => {
  const sanitized = value.replace(/[\\/:*?"<>|]/g, '_').trim();
  return sanitized.length > 0 ? sanitized : 'rasuva_export';
};

const buildDefaultExportFilename = (db: DbClient, scheduleId: number) => {
  const schedule = db.listSchedules().find((item) => item.id === scheduleId);
  const scheduleName = sanitizeFilename(schedule?.name ?? 'rasuva_export');
  const dateStamp = formatDateStamp(new Date());
  return `${scheduleName}_${dateStamp}.xlsx`;
};

const cellToText = (value: unknown): string | null => {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === 'string') {
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  if (typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }
  if (value instanceof Date) {
    return formatIsoDate(value);
  }
  if (typeof value === 'object') {
    if ('text' in value && typeof (value as { text: unknown }).text === 'string') {
      const trimmed = (value as { text: string }).text.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
    if ('result' in value) {
      return cellToText((value as { result: unknown }).result);
    }
    if ('richText' in value && Array.isArray((value as { richText: unknown }).richText)) {
      const parts = (value as { richText: Array<{ text?: string }> }).richText
        .map((item) => item.text ?? '')
        .join('');
      const trimmed = parts.trim();
      return trimmed.length === 0 ? null : trimmed;
    }
  }
  return null;
};

const cellToDateString = (value: unknown): string | null => {
  if (value instanceof Date) {
    return formatIsoDate(value);
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatIsoDate(excelSerialToDate(value));
  }
  const text = cellToText(value);
  return text && text.length > 0 ? text : null;
};

const parseAssigneesCell = (value: unknown) => {
  const text = cellToText(value);
  if (!text) {
    return [];
  }
  return text
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
};

const toColumnLetter = (index: number) => {
  let result = '';
  let current = index;
  while (current > 0) {
    const remainder = (current - 1) % 26;
    result = String.fromCharCode(65 + remainder) + result;
    current = Math.floor((current - 1) / 26);
  }
  return result;
};

const scheduleIdSchema = z.number().int().positive();

const previewSchema = z.object({
  jsonText: z.string(),
  scheduleId: scheduleIdSchema.optional()
});

const importExcelSchema = z.object({
  scheduleId: scheduleIdSchema.optional()
});

const applySchema = z.object({
  jsonText: z.string(),
  source: z.enum(['paste', 'file', 'excel']),
  scheduleId: scheduleIdSchema,
  mode: z.enum(['incremental', 'full'])
});

const diffSchema = z.object({
  scheduleId: scheduleIdSchema,
  importId: z.number().int().positive().optional()
});

const ganttSchema = z.object({
  scheduleId: scheduleIdSchema,
  importId: z.number().int().positive().optional()
});

const viewStateSchema = z.object({
  search: z.string(),
  zoom: z.enum(['day', 'week', 'month', 'quarter']),
  rangeStart: z.string().nullable(),
  rangeEnd: z.string().nullable(),
  collapsedGroups: z.array(z.string())
});

const viewSaveSchema = z.object({
  scheduleId: scheduleIdSchema,
  name: z.string().min(1),
  state: viewStateSchema
});

const exportSchema = z.object({
  scheduleId: scheduleIdSchema,
  importId: z.number().int().positive().optional()
});

const scheduleCreateSchema = z.object({
  name: z.string().min(1)
});

const scheduleUpdateSchema = z.object({
  id: scheduleIdSchema,
  name: z.string().min(1)
});

const scheduleDeleteSchema = z.object({
  id: scheduleIdSchema
});

const scheduleListSchema = z.object({
  scheduleId: scheduleIdSchema
});

const taskUpdateSchema = z.object({
  importId: z.number().int().positive(),
  currentTaskKeyFull: z.string().min(1),
  memberName: z.string().min(1),
  projectId: z.string().min(1),
  projectGroup: z.string().nullable(),
  taskName: z.string().min(1),
  start: z.string().nullable(),
  end: z.string().nullable(),
  note: z.string().nullable(),
  assignees: z.array(z.string()),
  reason: z.string().nullable().optional()
});

const taskDeleteSchema = z.object({
  importId: z.number().int().positive(),
  taskKeyFull: z.string().min(1)
});

const historySchema = z.object({
  importId: z.number().int().positive()
});

const contextMenuTaskSchema = z.object({
  taskKey: z.string().min(1),
  taskKeyFull: z.string().min(1),
  memberName: z.string().min(1),
  projectId: z.string().min(1),
  projectGroup: z.string().nullable().optional(),
  taskName: z.string().min(1),
  start: z.string().nullable(),
  end: z.string().nullable(),
  rawDate: z.string(),
  note: z.string().nullable().optional(),
  assignees: z.array(z.string()).optional(),
  status: z.enum(['scheduled', 'unscheduled', 'invalid_date']),
  id: z.number().int().optional()
});

const normalizeAssignees = (values: string[]) => {
  const unique = new Set<string>();
  values.forEach((value) => {
    const trimmed = value.trim();
    if (trimmed.length === 0) {
      return;
    }
    unique.add(trimmed);
  });
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
};

const buildTaskRawDate = (start: string | null, end: string | null) => {
  if (start && end) {
    return start === end ? start : `${start}..${end}`;
  }
  if (start) {
    return start;
  }
  if (end) {
    return end;
  }
  return 'TBD';
};

const escapeCsv = (value: string | null) => {
  if (value === null) {
    return '';
  }
  const needsQuotes = /[",\n]/.test(value);
  const escaped = value.replace(/"/g, '""');
  return needsQuotes ? `"${escaped}"` : escaped;
};

const tasksToCsv = (tasks: NormalizedTask[]) => {
  const header = [
    'member_name',
    'project_id',
    'project_group',
    'task_name',
    'assignees',
    'start',
    'end',
    'status',
    'note',
    'raw_date'
  ];

  const rows = tasks.map((task) => [
    task.memberName,
    task.projectId,
    task.projectGroup,
    task.taskName,
    task.assignees.join(', '),
    task.start,
    task.end,
    task.status,
    task.note,
    task.rawDate
  ]);

  return [header, ...rows]
    .map((row) => row.map((value) => escapeCsv(value)).join(','))
    .join('\n');
};

export const registerIpcHandlers = (db: DbClient) => {
  ipcMain.handle(IPC_CHANNELS.importPreview, async (_event, payload) => {
    const parsedPayload = previewSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const parsed = parseImportJson(parsedPayload.data.jsonText);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error, issues: parsed.issues };
    }

    const normalized = normalizeImport(parsed.data);
    const scheduleId = parsedPayload.data.scheduleId;
    const latestImportId = scheduleId ? db.getLatestImportId(scheduleId) : null;
    const prevTasks = latestImportId ? db.getTasksByImportId(latestImportId) : [];
    const diffSummary = scheduleId ? diffTasks(prevTasks, normalized.tasks).summary : undefined;

    return {
      ok: true,
      preview: { summary: normalized.summary, warnings: normalized.warnings, diffSummary }
    };
  });

  ipcMain.handle(IPC_CHANNELS.schedulesList, async () => {
    const schedules = db.listSchedules();
    return { ok: true, schedules };
  });

  ipcMain.handle(IPC_CHANNELS.schedulesCreate, async (_event, payload) => {
    const parsedPayload = scheduleCreateSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const schedule = db.createSchedule(parsedPayload.data.name);
    if (!schedule) {
      return { ok: false, error: 'スケジュールの作成に失敗しました。' };
    }
    return { ok: true, schedule };
  });

  ipcMain.handle(IPC_CHANNELS.schedulesUpdate, async (_event, payload) => {
    const parsedPayload = scheduleUpdateSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const updated = db.updateSchedule(parsedPayload.data.id, parsedPayload.data.name);
    if (!updated) {
      return { ok: false, error: 'スケジュールの更新に失敗しました。' };
    }
    const schedule = db.listSchedules().find((item) => item.id === parsedPayload.data.id);
    if (!schedule) {
      return { ok: false, error: 'スケジュールが見つかりません。' };
    }
    return { ok: true, schedule };
  });

  ipcMain.handle(IPC_CHANNELS.schedulesDelete, async (_event, payload) => {
    const parsedPayload = scheduleDeleteSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const deleted = db.deleteSchedule(parsedPayload.data.id);
    if (!deleted) {
      return { ok: false, error: '最後のスケジュールは削除できません。' };
    }
    return { ok: true, deleted: true };
  });

  ipcMain.handle(IPC_CHANNELS.importExcel, async (_event, payload) => {
    const parsedPayload = importExcelSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const scheduleId = parsedPayload.data.scheduleId;
    const dialogResult = await dialog.showOpenDialog({
      title: 'Import Excel',
      filters: [{ name: 'Excel', extensions: ['xlsx'] }],
      properties: ['openFile']
    });

    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return { ok: false, error: 'Import canceled.' };
    }

    const filePath = dialogResult.filePaths[0];
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.readFile(filePath);

    const sheet = workbook.worksheets.find((worksheet) =>
      worksheet.name.toLowerCase().trim() === 'tasks'
    );

    if (!sheet) {
      return { ok: false, error: '"Tasks" シートが見つかりません。' };
    }

    const headerRow = sheet.getRow(1);
    const headerMap = new Map<string, number>();
    headerRow.eachCell((cell, colNumber) => {
      const header = cellToText(cell.value);
      if (!header) {
        return;
      }
      headerMap.set(header.toLowerCase(), colNumber);
    });

    const requiredHeaders = ['member_name', 'project_id', 'task_name'];
    const missing = requiredHeaders.filter((key) => !headerMap.has(key));
    if (missing.length > 0) {
      return { ok: false, error: `必要な列が見つかりません: ${missing.join(', ')}` };
    }

    const rows: FlatTaskRow[] = [];
    sheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
      if (rowNumber === 1) {
        return;
      }

      const memberName = cellToText(row.getCell(headerMap.get('member_name')!).value);
      const projectId = cellToText(row.getCell(headerMap.get('project_id')!).value);
      const taskName = cellToText(row.getCell(headerMap.get('task_name')!).value);

      if (!memberName && !projectId && !taskName) {
        return;
      }

      const projectGroup = headerMap.has('project_group')
        ? cellToText(row.getCell(headerMap.get('project_group')!).value)
        : null;
      const assignees = headerMap.has('assignees')
        ? parseAssigneesCell(row.getCell(headerMap.get('assignees')!).value)
        : [];
      const start = headerMap.has('start')
        ? cellToDateString(row.getCell(headerMap.get('start')!).value)
        : null;
      const end = headerMap.has('end')
        ? cellToDateString(row.getCell(headerMap.get('end')!).value)
        : null;
      const note = headerMap.has('note')
        ? cellToText(row.getCell(headerMap.get('note')!).value)
        : null;
      const rawDate = headerMap.has('raw_date')
        ? cellToText(row.getCell(headerMap.get('raw_date')!).value)
        : null;

      rows.push({
        member_name: memberName,
        project_id: projectId,
        project_group: projectGroup,
        task_name: taskName,
        assignees,
        start,
        end,
        note,
        raw_date: rawDate
      });
    });

    const rawImport = convertFlatTasksToRawImport(rows);
    const normalized = normalizeImport(rawImport);
    const jsonText = JSON.stringify(rawImport, null, 2);
    const latestImportId = scheduleId ? db.getLatestImportId(scheduleId) : null;
    const prevTasks = latestImportId ? db.getTasksByImportId(latestImportId) : [];
    const diffSummary = scheduleId ? diffTasks(prevTasks, normalized.tasks).summary : undefined;

    return {
      ok: true,
      preview: { summary: normalized.summary, warnings: normalized.warnings, diffSummary },
      jsonText
    };
  });

  ipcMain.handle(IPC_CHANNELS.importApply, async (_event, payload) => {
    const parsedPayload = applySchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const parsed = parseImportJson(parsedPayload.data.jsonText);
    if (!parsed.ok) {
      return { ok: false, error: parsed.error, issues: parsed.issues };
    }

    const normalized = normalizeImport(parsed.data);
    const latestImportId = db.getLatestImportId(parsedPayload.data.scheduleId);
    const prevTasks = latestImportId ? db.getTasksByImportId(latestImportId) : [];
    const finalTasks = mergeTasksForSave(prevTasks, normalized.tasks, parsedPayload.data.mode);
    const diff = diffTasks(prevTasks, finalTasks);
    const summary = summarizeTasksForImport(
      finalTasks,
      normalized.warnings.length,
      normalized.summary.skippedProjects
    );

    const importId = db.insertImport(parsedPayload.data.scheduleId, {
      createdAt: new Date().toISOString(),
      source: parsedPayload.data.source,
      rawJson: parsedPayload.data.jsonText,
      summary,
      diffSummary: diff.summary
    });

    db.insertTasks(importId, finalTasks);
    db.insertWarnings(importId, normalized.warnings);

    return {
      ok: true,
      result: {
        importId,
        summary: normalized.summary,
        diff
      }
    };
  });

  ipcMain.handle(IPC_CHANNELS.taskCreate, async (_event, payload) => {
    const parsedPayload = TaskCreateSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const {
      scheduleId,
      importId: importIdRaw,
      allowExistingProjectId,
      projectId: projectIdRaw,
      projectGroup: projectGroupRaw,
      taskName: taskNameRaw,
      memberName: memberNameRaw,
      assignees: assigneesRaw,
      start: startRaw,
      end: endRaw,
      note: noteRaw
    } = parsedPayload.data;

    const projectId = projectIdRaw.trim();
    const taskName = taskNameRaw.trim();
    const memberName = memberNameRaw.trim();
    const projectGroup =
      projectGroupRaw && projectGroupRaw.trim().length > 0 ? projectGroupRaw.trim() : null;
    const note = noteRaw && noteRaw.trim().length > 0 ? noteRaw.trim() : null;

    if (!projectId || !taskName || !memberName) {
      return { ok: false, error: 'Required fields are missing.' };
    }

    const start = startRaw === null ? null : parseDateStrict(startRaw);
    const end = endRaw === null ? null : parseDateStrict(endRaw);

    if (startRaw !== null && start === null) {
      return { ok: false, error: 'Invalid start date.' };
    }

    if (endRaw !== null && end === null) {
      return { ok: false, error: 'Invalid end date.' };
    }

    if (start !== null && end !== null && end < start) {
      return { ok: false, error: 'End date must be on or after start date.' };
    }

    const status =
      start === null || end === null ? 'unscheduled' : ('scheduled' as const);
    const assignees = normalizeAssignees(assigneesRaw).filter((name) => name !== memberName);
    const rawDate = buildTaskRawDate(start, end);

    const input = {
      memberName,
      projectId,
      projectGroup,
      taskName,
      assignees,
      start,
      end,
      rawDate,
      note,
      status
    };

    const existingImportId = importIdRaw ?? db.getLatestImportId(scheduleId);
    if (existingImportId) {
      const currentImport = db.getImportById(scheduleId, existingImportId);
      if (!currentImport) {
        return { ok: false, error: 'Import not found.' };
      }

      if (!allowExistingProjectId) {
        const existingTasks = db.getTasksByImportId(existingImportId);
        if (existingTasks.some((task) => task.projectId === projectId)) {
          return { ok: false, error: 'Project ID already exists.' };
        }
      }

      const task = db.insertTask(existingImportId, input);
      return { ok: true, task, importId: existingImportId };
    }

    const rawImport = {
      members: [
        {
          name: memberName,
          projects: [
            {
              project_id: projectId,
              group: projectGroup,
              tasks: [
                {
                  task_name: taskName,
                  start,
                  end,
                  raw_date: rawDate,
                  note,
                  assign: assignees
                }
              ]
            }
          ]
        }
      ]
    };

    const summary = {
      totalMembers: 1,
      totalProjects: 1,
      totalTasks: 1,
      scheduledCount: status === 'scheduled' ? 1 : 0,
      unscheduledCount: status === 'unscheduled' ? 1 : 0,
      invalidCount: 0,
      warningsCount: 0,
      skippedProjects: 0
    };

    const diffSummary = {
      added: 1,
      updated: 0,
      archived: 0,
      invalid: 0,
      unscheduled: status === 'unscheduled' ? 1 : 0
    };

    const importId = db.insertImport(scheduleId, {
      createdAt: new Date().toISOString(),
      source: 'manual',
      rawJson: JSON.stringify(rawImport, null, 2),
      summary,
      diffSummary
    });

    const task = db.insertTask(importId, input);
    return { ok: true, task, importId };
  });

  ipcMain.handle(IPC_CHANNELS.diffGet, async (_event, payload) => {
    const parsedPayload = diffSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const targetImportId =
      parsedPayload.data.importId ?? db.getLatestImportId(parsedPayload.data.scheduleId);

    if (!targetImportId) {
      return { ok: true, importId: null, diff: diffTasks([], []) };
    }

    const currentImport = db.getImportById(parsedPayload.data.scheduleId, targetImportId);
    if (!currentImport) {
      return { ok: false, error: '指定されたインポートが見つかりません。' };
    }

    const previousImportId = db.getPreviousImportId(
      parsedPayload.data.scheduleId,
      targetImportId
    );
    const currentTasks = db.getTasksByImportId(targetImportId);
    const previousTasks = previousImportId ? db.getTasksByImportId(previousImportId) : [];

    const diff = diffTasks(previousTasks, currentTasks);
    return { ok: true, importId: targetImportId, diff };
  });

  ipcMain.handle(IPC_CHANNELS.ganttQuery, async (_event, payload) => {
    const parsedPayload = ganttSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId =
      parsedPayload.data.importId ?? db.getLatestImportId(parsedPayload.data.scheduleId);
    if (!importId) {
      return { ok: true, result: { importId: null, tasks: [] } };
    }

    const currentImport = db.getImportById(parsedPayload.data.scheduleId, importId);
    if (!currentImport) {
      return { ok: false, error: '指定されたインポートが見つかりません。' };
    }

    const tasks = db.getTasksByImportId(importId);
    return { ok: true, result: { importId, tasks } };
  });

  ipcMain.handle(IPC_CHANNELS.importsList, async (_event, payload) => {
    const parsedPayload = scheduleListSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }
    const imports = db.listImports(parsedPayload.data.scheduleId);
    return { ok: true, imports };
  });

  ipcMain.handle(IPC_CHANNELS.viewsList, async (_event, payload) => {
    const parsedPayload = scheduleListSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }
    const views = db.getSavedViews(parsedPayload.data.scheduleId);
    return { ok: true, views };
  });

  ipcMain.handle(IPC_CHANNELS.viewsSave, async (_event, payload) => {
    const parsedPayload = viewSaveSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const viewId = db.saveView(
      parsedPayload.data.scheduleId,
      parsedPayload.data.name,
      parsedPayload.data.state
    );
    return { ok: true, viewId };
  });

  ipcMain.handle(IPC_CHANNELS.exportCsv, async (_event, payload) => {
    const parsedPayload = exportSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId =
      parsedPayload.data.importId ?? db.getLatestImportId(parsedPayload.data.scheduleId);
    if (!importId) {
      return { ok: false, error: 'No import available.' };
    }

    const currentImport = db.getImportById(parsedPayload.data.scheduleId, importId);
    if (!currentImport) {
      return { ok: false, error: '指定されたインポートが見つかりません。' };
    }

    const tasks = db.getTasksByImportId(importId);
    const csv = tasksToCsv(tasks);

    const dialogResult = await dialog.showSaveDialog({
      title: 'Export CSV',
      defaultPath: `rasuva_export_${importId}.csv`,
      filters: [{ name: 'CSV', extensions: ['csv'] }]
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { ok: false, error: 'Export canceled.' };
    }

    writeFileSync(dialogResult.filePath, csv, 'utf-8');
    return { ok: true, path: dialogResult.filePath };
  });

  ipcMain.handle(IPC_CHANNELS.exportXlsx, async (_event, payload) => {
    const parsedPayload = exportSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId =
      parsedPayload.data.importId ?? db.getLatestImportId(parsedPayload.data.scheduleId);
    if (!importId) {
      return { ok: false, error: 'No import available.' };
    }

    const currentImport = db.getImportById(parsedPayload.data.scheduleId, importId);
    if (!currentImport) {
      return { ok: false, error: '指定されたインポートが見つかりません。' };
    }

    const tasks = db.getTasksByImportId(importId);
    const workbook = new ExcelJS.Workbook();
    const ganttSheet = workbook.addWorksheet('Gantt');
    const baseColumns = [
      { header: 'member_name', key: 'memberName', width: 20 },
      { header: 'project_id', key: 'projectId', width: 18 },
      { header: 'project_group', key: 'projectGroup', width: 18 },
      { header: 'task_name', key: 'taskName', width: 28 },
      { header: 'assignees', key: 'assignees', width: 26 },
      { header: 'start', key: 'start', width: 14 },
      { header: 'end', key: 'end', width: 14 },
      { header: 'status', key: 'status', width: 14 }
    ];

    const scheduledTasks = tasks.filter(
      (task) => task.status === 'scheduled' && task.start && task.end
    );

    if (scheduledTasks.length === 0) {
      ganttSheet.columns = baseColumns;
      ganttSheet.addRow({});
      ganttSheet.addRow({ taskName: '予定ありタスクがありません。' });
    } else {
      const timeline = generateTimelineStructure(scheduledTasks);
      const weekColumns = timeline.weeks.map((week) => ({
        key: `week_${week.start}`,
        width: 4
      }));

      ganttSheet.columns = [
        ...baseColumns.map((column) => ({ key: column.key, width: column.width })),
        ...weekColumns
      ];
      ganttSheet.views = [
        {
          state: 'frozen',
          ySplit: 3,
          xSplit: baseColumns.length
        }
      ];

      const yearRow = ganttSheet.getRow(1);
      const monthRow = ganttSheet.getRow(2);
      const weekRow = ganttSheet.getRow(3);
      yearRow.font = { bold: true };
      monthRow.font = { bold: true };
      weekRow.font = { bold: true };

      baseColumns.forEach((column, index) => {
        const colIndex = index + 1;
        ganttSheet.mergeCells(1, colIndex, 3, colIndex);
        const cell = yearRow.getCell(colIndex);
        cell.value = column.header;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      const weekStartColumnIndex = baseColumns.length + 1;
      let columnIndex = weekStartColumnIndex;
      timeline.years.forEach((group) => {
        const start = columnIndex;
        const end = columnIndex + group.span - 1;
        if (group.span > 0) {
          ganttSheet.mergeCells(1, start, 1, end);
          const cell = yearRow.getCell(start);
          cell.value = `${group.label}年`;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        columnIndex += group.span;
      });

      columnIndex = weekStartColumnIndex;
      timeline.months.forEach((group) => {
        const start = columnIndex;
        const end = columnIndex + group.span - 1;
        if (group.span > 0) {
          ganttSheet.mergeCells(2, start, 2, end);
          const cell = monthRow.getCell(start);
          cell.value = `${group.label}月`;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        columnIndex += group.span;
      });

      timeline.weeks.forEach((week, index) => {
        const cell = weekRow.getCell(weekStartColumnIndex + index);
        cell.value = week.label;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      const startColumnIndex = baseColumns.findIndex((column) => column.key === 'start') + 1;
      const endColumnIndex = baseColumns.findIndex((column) => column.key === 'end') + 1;

      ganttSheet.getColumn(startColumnIndex).numFmt = 'yyyy-mm-dd';
      ganttSheet.getColumn(endColumnIndex).numFmt = 'yyyy-mm-dd';

      tasks.forEach((task) => {
        const taskStart = task.start ? parseIsoDate(task.start) : null;
        const taskEnd = task.end ? parseIsoDate(task.end) : null;
        const row = ganttSheet.addRow({
          memberName: task.memberName,
          projectId: task.projectId,
          projectGroup: task.projectGroup ?? '',
          taskName: task.taskName,
          assignees: task.assignees.join(', '),
          start: taskStart,
          end: taskEnd,
          status: task.status
        });

        if (task.status !== 'scheduled' || !taskStart || !taskEnd) {
          return;
        }

        timeline.weeks.forEach((week, index) => {
          const weekStart = parseIsoDate(week.start);
          const weekEnd = parseIsoDate(week.end);
          if (!weekStart || !weekEnd) {
            return;
          }
          if (taskStart <= weekEnd && taskEnd >= weekStart) {
            const cell = row.getCell(weekStartColumnIndex + index);
            cell.value = '■';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
      });

      if (tasks.length > 0 && timeline.weeks.length > 0) {
        const dateColumnEndIndex = weekStartColumnIndex + timeline.weeks.length - 1;
        const startLetter = toColumnLetter(weekStartColumnIndex);
        const endLetter = toColumnLetter(dateColumnEndIndex);
        const rangeRef = `${startLetter}4:${endLetter}${tasks.length + 3}`;

        ganttSheet.addConditionalFormatting({
          ref: rangeRef,
          rules: [
            {
              type: 'containsText',
              operator: 'containsText',
              text: '■',
              style: {
                font: { color: { argb: 'FF1E8E3E' } }
              }
            }
          ]
        });
      }
    }

    const membersGanttSheet = workbook.addWorksheet('MembersGantt');
    const membersGanttRows = flattenTasksByMember(tasks);
    const membersGanttBaseColumns = [
      { header: '', key: 'member', width: 20 },
      { header: '', key: 'project', width: 18 },
      { header: '', key: 'task', width: 28 },
      { header: '', key: 'range', width: 16 }
    ];
    const membersScheduled = tasks.filter(
      (task) => task.status === 'scheduled' && task.start && task.end
    );
    const membersTimeline = generateTimelineStructure(membersScheduled);

    if (membersGanttRows.length === 0 || membersTimeline.weeks.length === 0) {
      membersGanttSheet.columns = membersGanttBaseColumns;
      membersGanttSheet.addRow({});
      membersGanttSheet.addRow({ task: '予定ありタスクがありません。' });
    } else {
      const weekColumns = membersTimeline.weeks.map((week) => ({
        key: `week_${week.start}`,
        width: 4
      }));

      membersGanttSheet.columns = [
        ...membersGanttBaseColumns.map((column) => ({ key: column.key, width: column.width })),
        ...weekColumns
      ];
      membersGanttSheet.views = [
        {
          state: 'frozen',
          ySplit: 3,
          xSplit: membersGanttBaseColumns.length
        }
      ];

      const yearRow = membersGanttSheet.getRow(1);
      const monthRow = membersGanttSheet.getRow(2);
      const weekRow = membersGanttSheet.getRow(3);
      yearRow.font = { bold: true };
      monthRow.font = { bold: true };
      weekRow.font = { bold: true };

      membersGanttBaseColumns.forEach((column, index) => {
        const colIndex = index + 1;
        membersGanttSheet.mergeCells(1, colIndex, 3, colIndex);
        const cell = yearRow.getCell(colIndex);
        cell.value = column.header;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      const weekStartColumnIndex = membersGanttBaseColumns.length + 1;
      let columnIndex = weekStartColumnIndex;
      membersTimeline.years.forEach((group) => {
        const start = columnIndex;
        const end = columnIndex + group.span - 1;
        if (group.span > 0) {
          membersGanttSheet.mergeCells(1, start, 1, end);
          const cell = yearRow.getCell(start);
          cell.value = `${group.label}年`;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        columnIndex += group.span;
      });

      columnIndex = weekStartColumnIndex;
      membersTimeline.months.forEach((group) => {
        const start = columnIndex;
        const end = columnIndex + group.span - 1;
        if (group.span > 0) {
          membersGanttSheet.mergeCells(2, start, 2, end);
          const cell = monthRow.getCell(start);
          cell.value = `${group.label}月`;
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        }
        columnIndex += group.span;
      });

      membersTimeline.weeks.forEach((week, index) => {
        const cell = weekRow.getCell(weekStartColumnIndex + index);
        cell.value = week.label;
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      let lastMemberName = '';
      membersGanttRows.forEach(({ memberName, task }) => {
        const startDate = task.start ? parseIsoDate(task.start) : null;
        const endDate = task.end ? parseIsoDate(task.end) : null;
        const row = membersGanttSheet.addRow({
          member: memberName !== lastMemberName ? memberName : '',
          project: task.projectId,
          task: task.taskName,
          range: formatTaskRangeLabel(startDate, endDate)
        });
        lastMemberName = memberName;

        if (task.status !== 'scheduled' || !startDate || !endDate) {
          return;
        }

        membersTimeline.weeks.forEach((week, index) => {
          const weekStart = parseIsoDate(week.start);
          const weekEnd = parseIsoDate(week.end);
          if (!weekStart || !weekEnd) {
            return;
          }
          if (startDate <= weekEnd && endDate >= weekStart) {
            const cell = row.getCell(weekStartColumnIndex + index);
            cell.value = '■';
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
          }
        });
      });

      if (membersGanttRows.length > 0 && membersTimeline.weeks.length > 0) {
        const dateColumnEndIndex = weekStartColumnIndex + membersTimeline.weeks.length - 1;
        const startLetter = toColumnLetter(weekStartColumnIndex);
        const endLetter = toColumnLetter(dateColumnEndIndex);
        const rangeRef = `${startLetter}4:${endLetter}${membersGanttRows.length + 3}`;

        membersGanttSheet.addConditionalFormatting({
          ref: rangeRef,
          rules: [
            {
              type: 'containsText',
              operator: 'containsText',
              text: '■',
              style: {
                font: { color: { argb: 'FF1E8E3E' } }
              }
            }
          ]
        });
      }
    }

    const sheet = workbook.addWorksheet('Tasks');

    sheet.columns = [
      { header: 'member_name', key: 'memberName', width: 20 },
      { header: 'project_id', key: 'projectId', width: 18 },
      { header: 'project_group', key: 'projectGroup', width: 18 },
      { header: 'task_name', key: 'taskName', width: 28 },
      { header: 'assignees', key: 'assignees', width: 26 },
      { header: 'start', key: 'start', width: 14 },
      { header: 'end', key: 'end', width: 14 },
      { header: 'status', key: 'status', width: 14 },
      { header: 'note', key: 'note', width: 30 },
      { header: 'raw_date', key: 'rawDate', width: 22 },
      { header: 'task_key_full', key: 'taskKeyFull', width: 32 }
    ];

    tasks.forEach((task) => {
      sheet.addRow({
        memberName: task.memberName,
        projectId: task.projectId,
        projectGroup: task.projectGroup ?? '',
        taskName: task.taskName,
        assignees: task.assignees.join(', '),
        start: task.start ?? '',
        end: task.end ?? '',
        status: task.status,
        note: task.note ?? '',
        rawDate: task.rawDate,
        taskKeyFull: task.taskKeyFull
      });
    });

    sheet.views = [{ state: 'frozen', ySplit: 1 }];

    const dialogResult = await dialog.showSaveDialog({
      title: 'Export Excel',
      defaultPath: buildDefaultExportFilename(db, parsedPayload.data.scheduleId),
      filters: [{ name: 'Excel', extensions: ['xlsx'] }]
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { ok: false, error: 'Export canceled.' };
    }

    await workbook.xlsx.writeFile(dialogResult.filePath);
    return { ok: true, path: dialogResult.filePath };
  });

  ipcMain.handle(IPC_CHANNELS.exportJson, async (_event, payload) => {
    const parsedPayload = exportSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId =
      parsedPayload.data.importId ?? db.getLatestImportId(parsedPayload.data.scheduleId);
    if (!importId) {
      return { ok: false, error: 'No import available.' };
    }

    const currentImport = db.getImportById(parsedPayload.data.scheduleId, importId);
    if (!currentImport) {
      return { ok: false, error: '指定されたインポートが見つかりません。' };
    }

    const tasks = db.getTasksByImportId(importId);
    const rawImport = convertNormalizedTasksToRawImport(tasks);
    const jsonText = JSON.stringify(rawImport, null, 2);

    const dialogResult = await dialog.showSaveDialog({
      title: 'Export JSON',
      defaultPath: `rasuva_export_${importId}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    });

    if (dialogResult.canceled || !dialogResult.filePath) {
      return { ok: false, error: 'Export canceled.' };
    }

    writeFileSync(dialogResult.filePath, jsonText, 'utf-8');
    return { ok: true, path: dialogResult.filePath };
  });

  ipcMain.handle(IPC_CHANNELS.taskUpdate, async (_event, payload) => {
    const parsedPayload = taskUpdateSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId = parsedPayload.data.importId;

    const currentTaskKeyFull = parsedPayload.data.currentTaskKeyFull;
    const memberName = parsedPayload.data.memberName.trim();
    const projectId = parsedPayload.data.projectId.trim();
    const taskName = parsedPayload.data.taskName.trim();
    const projectGroupRaw = parsedPayload.data.projectGroup;
    const projectGroup =
      projectGroupRaw && projectGroupRaw.trim().length > 0 ? projectGroupRaw.trim() : null;
    const startRaw = parsedPayload.data.start;
    const endRaw = parsedPayload.data.end;
    const noteRaw = parsedPayload.data.note ?? null;
    const note = noteRaw && noteRaw.trim().length > 0 ? noteRaw.trim() : null;
    const reasonRaw = parsedPayload.data.reason ?? null;
    const reason = reasonRaw && reasonRaw.trim().length > 0 ? reasonRaw.trim() : null;
    const assignees = normalizeAssignees(parsedPayload.data.assignees).filter(
      (name) => name !== memberName
    );

    if (!memberName || !projectId || !taskName) {
      return { ok: false, error: 'Required fields are missing.' };
    }

    const start = startRaw === null ? null : parseDateStrict(startRaw);
    const end = endRaw === null ? null : parseDateStrict(endRaw);

    if (startRaw !== null && start === null) {
      return { ok: false, error: '開始日が不正です（YYYY-MM-DD を想定）。' };
    }

    if (endRaw !== null && end === null) {
      return { ok: false, error: '終了日が不正です（YYYY-MM-DD を想定）。' };
    }

    let status: 'scheduled' | 'unscheduled' | 'invalid_date' = 'scheduled';

    if (start === null || end === null) {
      status = 'unscheduled';
    } else if (end < start) {
      return { ok: false, error: '終了日が開始日より前です。' };
    }

    const noteWithReason = reason
      ? `${note ? `${note}\n` : ''}理由: ${reason}`
      : note;

    const historyResult = db.updateTaskWithHistory(importId, currentTaskKeyFull, {
      memberName,
      projectId,
      projectGroup,
      taskName,
      start: status === 'scheduled' ? start : null,
      end: status === 'scheduled' ? end : null,
      note: noteWithReason,
      status,
      assignees
    });

    if (!historyResult) {
      return { ok: false, error: '更新対象のタスクが見つかりません。' };
    }

    const droppedHistory = historyManager.record(importId, historyResult.historyId);
    if (droppedHistory.length > 0) {
      db.deleteCommandHistoryByIds(droppedHistory);
    }

    return { ok: true, task: historyResult.updatedTask };
  });

  ipcMain.handle(IPC_CHANNELS.taskDelete, async (_event, payload) => {
    const parsedPayload = taskDeleteSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const { importId, taskKeyFull } = parsedPayload.data;
    try {
      const result = db.deleteTaskWithHistory(importId, taskKeyFull);
      if (!result) {
        return { ok: false, error: '削除対象のタスクが見つかりません。' };
      }

      return { ok: true, taskKeyFull: result.taskKeyFull };
    } catch (error) {
      console.error('Failed to delete task with history cleanup.', error);
      return { ok: false, error: 'タスクの削除に失敗しました。' };
    }
  });

  ipcMain.handle(IPC_CHANNELS.historyStatus, async (_event, payload) => {
    const parsedPayload = historySchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const status = historyManager.getStatus(parsedPayload.data.importId);
    return { ok: true, ...status };
  });

  ipcMain.handle(IPC_CHANNELS.historyUndo, async (_event, payload) => {
    const parsedPayload = historySchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId = parsedPayload.data.importId;
    const historyId = historyManager.peekUndo(importId);
    if (!historyId) {
      return { ok: false, error: 'No undo history.' };
    }

    const entry = db.getCommandHistoryById(historyId);
    if (!entry || entry.importId !== importId) {
      return { ok: false, error: 'History entry not found.' };
    }
    if (!entry.prevState) {
      return { ok: false, error: 'Undo snapshot missing.' };
    }
    const applied = db.applyTaskSnapshot(entry.prevState);
    if (!applied) {
      return { ok: false, error: 'Undo failed.' };
    }

    historyManager.commitUndo(importId);
    return { ok: true, task: entry.prevState };
  });

  ipcMain.handle(IPC_CHANNELS.historyRedo, async (_event, payload) => {
    const parsedPayload = historySchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId = parsedPayload.data.importId;
    const historyId = historyManager.peekRedo(importId);
    if (!historyId) {
      return { ok: false, error: 'No redo history.' };
    }

    const entry = db.getCommandHistoryById(historyId);
    if (!entry || entry.importId !== importId) {
      return { ok: false, error: 'History entry not found.' };
    }
    if (!entry.nextState) {
      return { ok: false, error: 'Redo snapshot missing.' };
    }
    const applied = db.applyTaskSnapshot(entry.nextState);
    if (!applied) {
      return { ok: false, error: 'Redo failed.' };
    }

    historyManager.commitRedo(importId);
    return { ok: true, task: entry.nextState };
  });

  ipcMain.handle(IPC_CHANNELS.contextMenuTask, async (event, payload) => {
    const parsedPayload = contextMenuTaskSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const task = parsedPayload.data;
    const menu = new Menu();
    menu.append(
      new MenuItem({
        label: '詳細を編集 (Edit)',
        click: () => event.sender.send(IPC_CHANNELS.menuAction, { action: 'edit', task })
      })
    );
    menu.append(new MenuItem({ type: 'separator' }));
    menu.append(
      new MenuItem({
        label: '未確定に戻す (Unschedule)',
        enabled: task.status !== 'unscheduled',
        click: () => event.sender.send(IPC_CHANNELS.menuAction, { action: 'unschedule', task })
      })
    );

    const window = BrowserWindow.fromWebContents(event.sender) ?? undefined;
    menu.popup({ window });
    return { ok: true };
  });
};
