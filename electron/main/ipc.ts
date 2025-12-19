import { dialog, ipcMain } from 'electron';
import { z } from 'zod';
import { diffTasks, normalizeImport, parseDateStrict, parseImportJson } from '@domain';
import type { DbClient } from '@db';
import type { NormalizedTask } from '@domain';
import { writeFileSync } from 'fs';
import ExcelJS from 'exceljs';
import { IPC_CHANNELS } from '../shared/ipcChannels';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

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

const applySchema = z.object({
  jsonText: z.string(),
  source: z.enum(['paste', 'file'])
});

const diffSchema = z.object({
  importId: z.number().int().positive().optional()
});

const ganttSchema = z.object({
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
  name: z.string().min(1),
  state: viewStateSchema
});

const exportSchema = z.object({
  importId: z.number().int().positive().optional()
});

const taskUpdateSchema = z.object({
  importId: z.number().int().positive().optional(),
  taskKeyFull: z.string().min(1),
  start: z.string().nullable(),
  end: z.string().nullable(),
  note: z.string().nullable().optional()
});

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
    const latestImportId = db.getLatestImportId();
    const prevTasks = latestImportId ? db.getTasksByImportId(latestImportId) : [];
    const diff = diffTasks(prevTasks, normalized.tasks);

    const importId = db.insertImport({
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
      parsedPayload.data.importId ?? db.getLatestImportId();

    if (!targetImportId) {
      return { ok: true, importId: null, diff: diffTasks([], []) };
    }

    const previousImportId = db.getPreviousImportId(targetImportId);
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

    const importId = parsedPayload.data.importId ?? db.getLatestImportId();
    if (!importId) {
      return { ok: true, result: { importId: null, tasks: [] } };
    }

    const tasks = db.getTasksByImportId(importId);
    return { ok: true, result: { importId, tasks } };
  });

  ipcMain.handle(IPC_CHANNELS.importsList, async () => {
    const imports = db.listImports();
    return { ok: true, imports };
  });

  ipcMain.handle(IPC_CHANNELS.viewsList, async () => {
    const views = db.getSavedViews();
    return { ok: true, views };
  });

  ipcMain.handle(IPC_CHANNELS.viewsSave, async (_event, payload) => {
    const parsedPayload = viewSaveSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const viewId = db.saveView(parsedPayload.data.name, parsedPayload.data.state);
    return { ok: true, viewId };
  });

  ipcMain.handle(IPC_CHANNELS.exportCsv, async (_event, payload) => {
    const parsedPayload = exportSchema.safeParse(payload ?? {});
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId = parsedPayload.data.importId ?? db.getLatestImportId();
    if (!importId) {
      return { ok: false, error: 'No import available.' };
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

    const importId = parsedPayload.data.importId ?? db.getLatestImportId();
    if (!importId) {
      return { ok: false, error: 'No import available.' };
    }

    const tasks = db.getTasksByImportId(importId);
    const workbook = new ExcelJS.Workbook();
    const ganttSheet = workbook.addWorksheet('Gantt');
    const baseColumns = [
      { header: 'member_name', key: 'memberName', width: 20 },
      { header: 'project_id', key: 'projectId', width: 18 },
      { header: 'project_group', key: 'projectGroup', width: 18 },
      { header: 'task_name', key: 'taskName', width: 28 },
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

  ipcMain.handle(IPC_CHANNELS.taskUpdate, async (_event, payload) => {
    const parsedPayload = taskUpdateSchema.safeParse(payload);
    if (!parsedPayload.success) {
      return { ok: false, error: 'Invalid payload.' };
    }

    const importId = parsedPayload.data.importId ?? db.getLatestImportId();
    if (!importId) {
      return { ok: false, error: 'No import available.' };
    }

    const { taskKeyFull } = parsedPayload.data;
    const startRaw = parsedPayload.data.start;
    const endRaw = parsedPayload.data.end;
    const note = parsedPayload.data.note ?? null;

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

    db.updateTask(importId, taskKeyFull, {
      start: status === 'scheduled' ? start : null,
      end: status === 'scheduled' ? end : null,
      note,
      status
    });

    const updated = db.getTaskByKey(importId, taskKeyFull);
    if (!updated) {
      return { ok: false, error: '更新対象のタスクが見つかりません。' };
    }

    return { ok: true, task: updated };
  });
};
