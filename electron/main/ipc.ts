import { dialog, ipcMain } from 'electron';
import { z } from 'zod';
import {
  convertFlatTasksToRawImport,
  convertNormalizedTasksToRawImport,
  diffTasks,
  normalizeImport,
  parseDateStrict,
  parseImportJson
} from '@domain';
import type { DbClient } from '@db';
import type { FlatTaskRow, NormalizedTask } from '@domain';
import { writeFileSync } from 'fs';
import ExcelJS from 'exceljs';
import { IPC_CHANNELS } from '../shared/ipcChannels';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const parseIsoDate = (value: string) => {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  return new Date(Date.UTC(year, month - 1, day));
};

const formatIsoDate = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addUtcDays = (date: Date, days: number) => {
  return new Date(date.getTime() + MS_PER_DAY * days);
};

const excelSerialToDate = (value: number) => {
  const excelEpoch = Date.UTC(1899, 11, 30);
  return new Date(excelEpoch + value * MS_PER_DAY);
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

const previewSchema = z.object({
  jsonText: z.string()
});

const scheduleIdSchema = z.number().int().positive();

const applySchema = z.object({
  jsonText: z.string(),
  source: z.enum(['paste', 'file', 'excel']),
  scheduleId: scheduleIdSchema
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
  assignees: z.array(z.string())
});

const historySchema = z.object({
  importId: z.number().int().positive()
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
    return { ok: true, preview: { summary: normalized.summary, warnings: normalized.warnings } };
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

  ipcMain.handle(IPC_CHANNELS.importExcel, async () => {
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

    return {
      ok: true,
      preview: { summary: normalized.summary, warnings: normalized.warnings },
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
    const diff = diffTasks(prevTasks, normalized.tasks);

    const importId = db.insertImport(parsedPayload.data.scheduleId, {
      createdAt: new Date().toISOString(),
      source: parsedPayload.data.source,
      rawJson: parsedPayload.data.jsonText,
      summary: normalized.summary,
      diffSummary: diff.summary
    });

    db.insertTasks(importId, normalized.tasks);
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
      const startDates = scheduledTasks
        .map((task) => parseIsoDate(task.start!))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());
      const endDates = scheduledTasks
        .map((task) => parseIsoDate(task.end!))
        .filter((date): date is Date => date !== null)
        .sort((a, b) => a.getTime() - b.getTime());

      const rangeStart = startDates[0];
      const rangeEnd = endDates[endDates.length - 1];

      const dateColumns: Array<{ header: string; key: string; width: number }> = [];
      const dates: Date[] = [];
      for (let cursor = rangeStart; cursor <= rangeEnd; cursor = addUtcDays(cursor, 1)) {
        const iso = formatIsoDate(cursor);
        dates.push(cursor);
        dateColumns.push({ header: iso, key: `date_${iso}`, width: 3 });
      }

      ganttSheet.columns = [...baseColumns, ...dateColumns];
      ganttSheet.views = [
        {
          state: 'frozen',
          ySplit: 1,
          xSplit: baseColumns.length
        }
      ];

      const headerRow = ganttSheet.getRow(1);
      headerRow.font = { bold: true };
      baseColumns.forEach((_column, index) => {
        headerRow.getCell(index + 1).alignment = { vertical: 'middle' };
      });

      dates.forEach((date, index) => {
        const cell = headerRow.getCell(baseColumns.length + index + 1);
        cell.value = date;
        cell.numFmt = 'm/d';
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      });

      const startColumnIndex = baseColumns.findIndex((column) => column.key === 'start') + 1;
      const endColumnIndex = baseColumns.findIndex((column) => column.key === 'end') + 1;
      const statusColumnIndex = baseColumns.findIndex((column) => column.key === 'status') + 1;
      const dateColumnStartIndex = baseColumns.length + 1;

      ganttSheet.getColumn(startColumnIndex).numFmt = 'yyyy-mm-dd';
      ganttSheet.getColumn(endColumnIndex).numFmt = 'yyyy-mm-dd';

      tasks.forEach((task) => {
        const row = ganttSheet.addRow({
          memberName: task.memberName,
          projectId: task.projectId,
          projectGroup: task.projectGroup ?? '',
          taskName: task.taskName,
          assignees: task.assignees.join(', '),
          start: task.start ? parseIsoDate(task.start) : null,
          end: task.end ? parseIsoDate(task.end) : null,
          status: task.status
        });

        const rowIndex = row.number;
        const startCell = toColumnLetter(startColumnIndex);
        const endCell = toColumnLetter(endColumnIndex);
        const statusCell = toColumnLetter(statusColumnIndex);

        dates.forEach((_date, index) => {
          const columnIndex = dateColumnStartIndex + index;
          const columnLetter = toColumnLetter(columnIndex);
          const formula = `IF(AND($${statusCell}${rowIndex}="scheduled",$${startCell}${rowIndex}<=${columnLetter}$1,$${endCell}${rowIndex}>=${columnLetter}$1),IF($${startCell}${rowIndex}=${columnLetter}$1,"★","■"),"")`;
          const cell = ganttSheet.getCell(rowIndex, columnIndex);
          cell.value = { formula, result: '' };
          cell.alignment = { horizontal: 'center', vertical: 'middle' };
        });
      });

      if (tasks.length > 0) {
        const dateColumnEndIndex = dateColumnStartIndex + dates.length - 1;
        const startLetter = toColumnLetter(dateColumnStartIndex);
        const endLetter = toColumnLetter(dateColumnEndIndex);
        const rangeRef = `${startLetter}2:${endLetter}${tasks.length + 1}`;

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
            },
            {
              type: 'containsText',
              operator: 'containsText',
              text: '★',
              style: {
                font: { color: { argb: 'FFD93025' } }
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
      defaultPath: `rasuva_export_${importId}.xlsx`,
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

    const historyResult = db.updateTaskWithHistory(importId, currentTaskKeyFull, {
      memberName,
      projectId,
      projectGroup,
      taskName,
      start: status === 'scheduled' ? start : null,
      end: status === 'scheduled' ? end : null,
      note,
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
};
