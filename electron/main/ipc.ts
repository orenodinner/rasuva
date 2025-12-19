import { dialog, ipcMain } from 'electron';
import { z } from 'zod';
import { diffTasks, normalizeImport, parseImportJson } from '@domain';
import type { DbClient } from '@db';
import type { NormalizedTask } from '@domain';
import { writeFileSync } from 'fs';
import { IPC_CHANNELS } from '../shared/ipcChannels';

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
};
