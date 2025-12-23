import Database from 'better-sqlite3';
import type {
  DiffSummary,
  ImportListItem,
  ImportSummary,
  ImportWarning,
  NormalizedTask,
  TaskUpdateInput,
  ScheduleItem,
  SavedViewItem,
  SavedViewState
} from '@domain';

const migrations: string[] = [
  `
CREATE TABLE IF NOT EXISTS imports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL,
  source TEXT NOT NULL,
  raw_json TEXT NOT NULL,
  total_members INTEGER NOT NULL,
  total_projects INTEGER NOT NULL,
  total_tasks INTEGER NOT NULL,
  added_count INTEGER NOT NULL,
  updated_count INTEGER NOT NULL,
  archived_count INTEGER NOT NULL,
  invalid_count INTEGER NOT NULL,
  unscheduled_count INTEGER NOT NULL,
  warnings_count INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id INTEGER NOT NULL,
  task_key TEXT NOT NULL,
  task_key_full TEXT NOT NULL,
  member_name TEXT NOT NULL,
  project_id TEXT NOT NULL,
  project_group TEXT,
  task_name TEXT NOT NULL,
  start TEXT,
  end TEXT,
  raw_date TEXT NOT NULL,
  note TEXT,
  status TEXT NOT NULL,
  FOREIGN KEY (import_id) REFERENCES imports(id)
);

CREATE INDEX IF NOT EXISTS idx_tasks_import_id ON tasks(import_id);
CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
CREATE INDEX IF NOT EXISTS idx_tasks_key_full ON tasks(task_key_full);

CREATE TABLE IF NOT EXISTS warnings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id INTEGER NOT NULL,
  code TEXT NOT NULL,
  message TEXT NOT NULL,
  context_json TEXT NOT NULL,
  FOREIGN KEY (import_id) REFERENCES imports(id)
);

CREATE TABLE IF NOT EXISTS saved_views (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  state_json TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
`,
  `ALTER TABLE tasks ADD COLUMN assignees_json TEXT;`,
  `
CREATE TABLE IF NOT EXISTS schedules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  description TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

INSERT INTO schedules (id, name, description, created_at, updated_at)
SELECT 1, 'メインスケジュール', NULL, datetime('now'), datetime('now')
WHERE NOT EXISTS (SELECT 1 FROM schedules);

ALTER TABLE imports ADD COLUMN schedule_id INTEGER NOT NULL DEFAULT 1;
ALTER TABLE saved_views ADD COLUMN schedule_id INTEGER NOT NULL DEFAULT 1;

UPDATE imports SET schedule_id = 1 WHERE schedule_id IS NULL;
UPDATE saved_views SET schedule_id = 1 WHERE schedule_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_imports_schedule_id ON imports(schedule_id);
CREATE INDEX IF NOT EXISTS idx_views_schedule_id ON saved_views(schedule_id);
`
,
  `
CREATE TABLE IF NOT EXISTS command_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  import_id INTEGER NOT NULL,
  command_type TEXT NOT NULL,
  target_task_id INTEGER,
  prev_state_json TEXT,
  next_state_json TEXT,
  created_at TEXT NOT NULL,
  FOREIGN KEY (import_id) REFERENCES imports(id)
);

CREATE INDEX IF NOT EXISTS idx_history_import ON command_history(import_id);
`
];

interface TaskRow {
  id: number;
  task_key: string;
  task_key_full: string;
  member_name: string;
  project_id: string;
  project_group: string | null;
  task_name: string;
  assignees_json: string | null;
  start: string | null;
  end: string | null;
  raw_date: string;
  note: string | null;
  status: NormalizedTask['status'];
}

interface ImportRow {
  id: number;
  created_at: string;
  source: string;
  total_tasks: number;
  added_count: number;
  updated_count: number;
  archived_count: number;
  invalid_count: number;
  unscheduled_count: number;
  warnings_count: number;
}

interface CommandHistoryRow {
  id: number;
  import_id: number;
  command_type: string;
  target_task_id: number | null;
  prev_state_json: string | null;
  next_state_json: string | null;
  created_at: string;
}

interface ViewRow {
  id: number;
  name: string;
  state_json: string;
  created_at: string;
  updated_at: string;
}

interface ScheduleRow {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
}

const runMigrations = (db: Database.Database) => {
  const userVersion = db.pragma('user_version', { simple: true }) as number;
  if (userVersion > migrations.length) {
    console.warn(
      `Database user_version (${userVersion}) is newer than migrations (${migrations.length}).`
    );
    return;
  }

  for (let i = userVersion; i < migrations.length; i += 1) {
    const nextVersion = i + 1;
    db.transaction(() => {
      db.exec(migrations[i]);
      db.pragma(`user_version = ${nextVersion}`);
    })();
  }
};

export interface ImportInsertInput {
  createdAt: string;
  source: string;
  rawJson: string;
  summary: ImportSummary;
  diffSummary: DiffSummary;
}

type TaskUpdatePayload = Omit<TaskUpdateInput, 'importId' | 'currentTaskKeyFull'> & {
  status: NormalizedTask['status'];
};

export interface DbClient {
  init: () => void;
  close: () => void;
  insertImport: (scheduleId: number, input: ImportInsertInput) => number;
  insertTasks: (importId: number, tasks: NormalizedTask[]) => void;
  insertWarnings: (importId: number, warnings: ImportWarning[]) => void;
  listImports: (scheduleId: number) => ImportListItem[];
  getLatestImportId: (scheduleId: number) => number | null;
  getPreviousImportId: (scheduleId: number, importId: number) => number | null;
  getTasksByImportId: (importId: number) => NormalizedTask[];
  getTaskByKey: (importId: number, taskKeyFull: string) => NormalizedTask | null;
  updateTask: (importId: number, taskKeyFull: string, updates: TaskUpdatePayload) => string | null;
  getImportById: (scheduleId: number, importId: number) => ImportListItem | null;
  getSavedViews: (scheduleId: number) => SavedViewItem[];
  saveView: (scheduleId: number, name: string, state: SavedViewState) => number;
  listSchedules: () => ScheduleItem[];
  createSchedule: (name: string, description?: string | null) => ScheduleItem | null;
  updateSchedule: (scheduleId: number, name: string, description?: string | null) => boolean;
  deleteSchedule: (scheduleId: number) => boolean;
  updateTaskWithHistory: (
    importId: number,
    currentTaskKeyFull: string,
    updates: TaskUpdatePayload
  ) => { historyId: number; updatedTask: NormalizedTask } | null;
  insertCommandHistory: (input: {
    importId: number;
    commandType: string;
    targetTaskId: number | null;
    prevState: NormalizedTask | null;
    nextState: NormalizedTask | null;
  }) => number;
  getCommandHistoryById: (historyId: number) => {
    id: number;
    importId: number;
    commandType: string;
    targetTaskId: number | null;
    prevState: NormalizedTask | null;
    nextState: NormalizedTask | null;
    createdAt: string;
  } | null;
  deleteCommandHistoryByIds: (historyIds: number[]) => void;
  applyTaskSnapshot: (snapshot: NormalizedTask) => boolean;
}

const parseAssignees = (value: unknown): string[] => {
  if (typeof value !== 'string' || value.trim().length === 0) {
    return [];
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : [];
  } catch {
    return [];
  }
};

const rowToTask = (row: TaskRow): NormalizedTask => ({
  id: row.id,
  taskKey: row.task_key,
  taskKeyFull: row.task_key_full,
  memberName: row.member_name,
  projectId: row.project_id,
  projectGroup: row.project_group,
  taskName: row.task_name,
  assignees: parseAssignees(row.assignees_json),
  start: row.start,
  end: row.end,
  rawDate: row.raw_date,
  note: row.note,
  status: row.status
});

const rowToImportItem = (row: ImportRow): ImportListItem => ({
  id: row.id,
  createdAt: row.created_at,
  source: row.source,
  totalTasks: row.total_tasks,
  addedCount: row.added_count,
  updatedCount: row.updated_count,
  archivedCount: row.archived_count,
  invalidCount: row.invalid_count,
  unscheduledCount: row.unscheduled_count,
  warningsCount: row.warnings_count
});

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every((item) => typeof item === 'string');

const isNormalizedTaskSnapshot = (value: unknown): value is NormalizedTask => {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const record = value as Record<string, unknown>;
  const id = record.id;
  const status = record.status;
  const projectGroup = record.projectGroup;
  const start = record.start;
  const end = record.end;
  const note = record.note;

  if (id !== undefined && typeof id !== 'number') {
    return false;
  }
  if (
    typeof record.taskKey !== 'string' ||
    typeof record.taskKeyFull !== 'string' ||
    typeof record.memberName !== 'string' ||
    typeof record.projectId !== 'string' ||
    typeof record.taskName !== 'string' ||
    typeof record.rawDate !== 'string' ||
    !isStringArray(record.assignees)
  ) {
    return false;
  }
  if (projectGroup !== null && projectGroup !== undefined && typeof projectGroup !== 'string') {
    return false;
  }
  if (start !== null && start !== undefined && typeof start !== 'string') {
    return false;
  }
  if (end !== null && end !== undefined && typeof end !== 'string') {
    return false;
  }
  if (note !== null && note !== undefined && typeof note !== 'string') {
    return false;
  }
  if (
    status !== 'scheduled' &&
    status !== 'unscheduled' &&
    status !== 'invalid_date'
  ) {
    return false;
  }
  return true;
};

const parseTaskSnapshot = (value: string | null): NormalizedTask | null => {
  if (!value) {
    return null;
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return isNormalizedTaskSnapshot(parsed) ? parsed : null;
  } catch {
    return null;
  }
};

const rowToCommandHistory = (row: CommandHistoryRow) => ({
  id: row.id,
  importId: row.import_id,
  commandType: row.command_type,
  targetTaskId: row.target_task_id,
  prevState: parseTaskSnapshot(row.prev_state_json),
  nextState: parseTaskSnapshot(row.next_state_json),
  createdAt: row.created_at
});

const rowToViewItem = (row: ViewRow): SavedViewItem => ({
  id: row.id,
  name: row.name,
  state: JSON.parse(row.state_json) as SavedViewState,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

const rowToScheduleItem = (row: ScheduleRow): ScheduleItem => ({
  id: row.id,
  name: row.name,
  description: row.description,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createDb = (dbPath: string): DbClient => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const init = () => {
    runMigrations(db);
  };

  const insertImport = (scheduleId: number, input: ImportInsertInput) => {
    const stmt = db.prepare(`
      INSERT INTO imports (
        schedule_id,
        created_at,
        source,
        raw_json,
        total_members,
        total_projects,
        total_tasks,
        added_count,
        updated_count,
        archived_count,
        invalid_count,
        unscheduled_count,
        warnings_count
      ) VALUES (
        @schedule_id,
        @created_at,
        @source,
        @raw_json,
        @total_members,
        @total_projects,
        @total_tasks,
        @added_count,
        @updated_count,
        @archived_count,
        @invalid_count,
        @unscheduled_count,
        @warnings_count
      )
    `);

    const info = stmt.run({
      schedule_id: scheduleId,
      created_at: input.createdAt,
      source: input.source,
      raw_json: input.rawJson,
      total_members: input.summary.totalMembers,
      total_projects: input.summary.totalProjects,
      total_tasks: input.summary.totalTasks,
      added_count: input.diffSummary.added,
      updated_count: input.diffSummary.updated,
      archived_count: input.diffSummary.archived,
      invalid_count: input.diffSummary.invalid,
      unscheduled_count: input.diffSummary.unscheduled,
      warnings_count: input.summary.warningsCount
    });

    return Number(info.lastInsertRowid);
  };

  const insertTasks = (importId: number, tasks: NormalizedTask[]) => {
    const stmt = db.prepare(`
      INSERT INTO tasks (
        import_id,
        task_key,
        task_key_full,
        member_name,
        project_id,
        project_group,
        task_name,
        assignees_json,
        start,
        end,
        raw_date,
        note,
        status
      ) VALUES (
        @import_id,
        @task_key,
        @task_key_full,
        @member_name,
        @project_id,
        @project_group,
        @task_name,
        @assignees_json,
        @start,
        @end,
        @raw_date,
        @note,
        @status
      )
    `);

    const insertMany = db.transaction((items: NormalizedTask[]) => {
      items.forEach((task) => {
        stmt.run({
          import_id: importId,
          task_key: task.taskKey,
          task_key_full: task.taskKeyFull,
          member_name: task.memberName,
          project_id: task.projectId,
          project_group: task.projectGroup,
          task_name: task.taskName,
          assignees_json: JSON.stringify(task.assignees ?? []),
          start: task.start,
          end: task.end,
          raw_date: task.rawDate,
          note: task.note,
          status: task.status
        });
      });
    });

    insertMany(tasks);
  };

  const insertWarnings = (importId: number, warnings: ImportWarning[]) => {
    if (warnings.length === 0) {
      return;
    }

    const stmt = db.prepare(`
      INSERT INTO warnings (
        import_id,
        code,
        message,
        context_json
      ) VALUES (
        @import_id,
        @code,
        @message,
        @context_json
      )
    `);

    const insertMany = db.transaction((items: ImportWarning[]) => {
      items.forEach((warning) => {
        stmt.run({
          import_id: importId,
          code: warning.code,
          message: warning.message,
          context_json: JSON.stringify(warning.context)
        });
      });
    });

    insertMany(warnings);
  };

  const listImports = (scheduleId: number): ImportListItem[] => {
    const rows = db
      .prepare(
        `SELECT id, created_at, source, total_tasks, added_count, updated_count, archived_count, invalid_count, unscheduled_count, warnings_count
         FROM imports
         WHERE schedule_id = @scheduleId
         ORDER BY id DESC`
      )
      .all({ scheduleId }) as ImportRow[];

    return rows.map(rowToImportItem);
  };

  const getLatestImportId = (scheduleId: number) => {
    const row = db
      .prepare(`SELECT id FROM imports WHERE schedule_id = @scheduleId ORDER BY id DESC LIMIT 1`)
      .get({ scheduleId }) as { id: number } | undefined;
    return row ? row.id : null;
  };

  const getPreviousImportId = (scheduleId: number, importId: number) => {
    const row = db
      .prepare(
        `SELECT id FROM imports WHERE schedule_id = @scheduleId AND id < @importId ORDER BY id DESC LIMIT 1`
      )
      .get({ scheduleId, importId }) as { id: number } | undefined;
    return row ? row.id : null;
  };

  const getTasksByImportId = (importId: number) => {
    const rows = db
      .prepare(
        `SELECT * FROM tasks WHERE import_id = @importId ORDER BY member_name, project_id, task_name`
      )
      .all({ importId }) as TaskRow[];
    return rows.map(rowToTask);
  };

  const getTaskByKey = (importId: number, taskKeyFull: string) => {
    const row = db
      .prepare(`SELECT * FROM tasks WHERE import_id = @importId AND task_key_full = @taskKeyFull`)
      .get({ importId, taskKeyFull }) as TaskRow | undefined;
    return row ? rowToTask(row) : null;
  };

  const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  const getNextTaskKeyFull = (importId: number, baseKey: string, currentKeyFull: string) => {
    const rows = db
      .prepare(
        `SELECT task_key_full FROM tasks WHERE import_id = @importId AND task_key = @taskKey AND task_key_full != @currentKeyFull`
      )
      .all({ importId, taskKey: baseKey, currentKeyFull }) as { task_key_full: string }[];

    if (rows.length === 0) {
      return baseKey;
    }

    const used = new Set<number>();
    const keyRegex = new RegExp(`^${escapeRegExp(baseKey)}#(\\d+)$`);
    rows.forEach((row) => {
      if (row.task_key_full === baseKey) {
        used.add(1);
        return;
      }
      const match = keyRegex.exec(row.task_key_full);
      if (match) {
        used.add(Number(match[1]));
      }
    });

    if (!used.has(1)) {
      return baseKey;
    }

    let suffix = 2;
    while (used.has(suffix)) {
      suffix += 1;
    }
    return `${baseKey}#${suffix}`;
  };

  const updateTask = (
    importId: number,
    currentTaskKeyFull: string,
    updates: TaskUpdatePayload
  ) => {
    const current = getTaskByKey(importId, currentTaskKeyFull);
    if (!current) {
      return null;
    }

    const baseKey = `${updates.projectId}::${updates.taskName}`;
    const taskKey = baseKey;
    const taskKeyFull =
      current.taskKey === baseKey
        ? current.taskKeyFull
        : getNextTaskKeyFull(importId, baseKey, currentTaskKeyFull);

    const stmt = db.prepare(`
      UPDATE tasks
      SET member_name = @member_name,
          project_id = @project_id,
          project_group = @project_group,
          task_name = @task_name,
          task_key = @task_key,
          task_key_full = @task_key_full,
          start = @start,
          end = @end,
          note = @note,
          status = @status,
          assignees_json = @assignees_json
      WHERE import_id = @importId AND task_key_full = @currentTaskKeyFull
    `);

    stmt.run({
      importId,
      currentTaskKeyFull,
      member_name: updates.memberName,
      project_id: updates.projectId,
      project_group: updates.projectGroup ?? null,
      task_name: updates.taskName,
      task_key: taskKey,
      task_key_full: taskKeyFull,
      start: updates.start ?? null,
      end: updates.end ?? null,
      note: updates.note ?? null,
      status: updates.status,
      assignees_json: JSON.stringify(updates.assignees)
    });

    return taskKeyFull;
  };

  const insertCommandHistory = (input: {
    importId: number;
    commandType: string;
    targetTaskId: number | null;
    prevState: NormalizedTask | null;
    nextState: NormalizedTask | null;
  }) => {
    const stmt = db.prepare(`
      INSERT INTO command_history (
        import_id,
        command_type,
        target_task_id,
        prev_state_json,
        next_state_json,
        created_at
      )
      VALUES (
        @import_id,
        @command_type,
        @target_task_id,
        @prev_state_json,
        @next_state_json,
        @created_at
      )
    `);
    const info = stmt.run({
      import_id: input.importId,
      command_type: input.commandType,
      target_task_id: input.targetTaskId,
      prev_state_json: input.prevState ? JSON.stringify(input.prevState) : null,
      next_state_json: input.nextState ? JSON.stringify(input.nextState) : null,
      created_at: new Date().toISOString()
    });
    return Number(info.lastInsertRowid);
  };

  const getCommandHistoryById = (historyId: number) => {
    const row = db
      .prepare(`SELECT * FROM command_history WHERE id = @id`)
      .get({ id: historyId }) as CommandHistoryRow | undefined;
    return row ? rowToCommandHistory(row) : null;
  };

  const deleteCommandHistoryByIds = (historyIds: number[]) => {
    if (historyIds.length === 0) {
      return;
    }
    const placeholders = historyIds.map(() => '?').join(', ');
    db.prepare(`DELETE FROM command_history WHERE id IN (${placeholders})`).run(...historyIds);
  };

  const applyTaskSnapshot = (snapshot: NormalizedTask) => {
    if (snapshot.id === undefined) {
      return false;
    }
    const stmt = db.prepare(`
      UPDATE tasks
      SET task_key = @task_key,
          task_key_full = @task_key_full,
          member_name = @member_name,
          project_id = @project_id,
          project_group = @project_group,
          task_name = @task_name,
          start = @start,
          end = @end,
          raw_date = @raw_date,
          note = @note,
          status = @status,
          assignees_json = @assignees_json
      WHERE id = @id
    `);

    try {
      const result = stmt.run({
        id: snapshot.id,
        task_key: snapshot.taskKey,
        task_key_full: snapshot.taskKeyFull,
        member_name: snapshot.memberName,
        project_id: snapshot.projectId,
        project_group: snapshot.projectGroup ?? null,
        task_name: snapshot.taskName,
        start: snapshot.start ?? null,
        end: snapshot.end ?? null,
        raw_date: snapshot.rawDate,
        note: snapshot.note ?? null,
        status: snapshot.status,
        assignees_json: JSON.stringify(snapshot.assignees)
      });
      return result.changes > 0;
    } catch (error) {
      console.warn('Failed to apply task snapshot.', error);
      return false;
    }
  };

  const updateTaskWithHistory = db.transaction(
    (importId: number, currentTaskKeyFull: string, updates: TaskUpdatePayload) => {
      const prevTask = getTaskByKey(importId, currentTaskKeyFull);
      if (!prevTask) {
        return null;
      }
      if (prevTask.id === undefined) {
        throw new Error('Task id missing for history.');
      }
      const updatedKey = updateTask(importId, currentTaskKeyFull, updates);
      if (!updatedKey) {
        return null;
      }
      const nextTask = getTaskByKey(importId, updatedKey);
      if (!nextTask) {
        throw new Error('Updated task not found.');
      }

      const historyId = insertCommandHistory({
        importId,
        commandType: 'UPDATE_TASK',
        targetTaskId: prevTask.id,
        prevState: prevTask,
        nextState: nextTask
      });

      return { historyId, updatedTask: nextTask };
    }
  );

  const getImportById = (scheduleId: number, importId: number): ImportListItem | null => {
    const row = db
      .prepare(
        `SELECT id, created_at, source, total_tasks, added_count, updated_count, archived_count, invalid_count, unscheduled_count, warnings_count
         FROM imports
         WHERE id = @importId AND schedule_id = @scheduleId`
      )
      .get({ importId, scheduleId }) as ImportRow | undefined;

    return row ? rowToImportItem(row) : null;
  };

  const getSavedViews = (scheduleId: number): SavedViewItem[] => {
    const rows = db
      .prepare(
        `SELECT id, name, state_json, created_at, updated_at FROM saved_views WHERE schedule_id = @scheduleId ORDER BY id DESC`
      )
      .all({ scheduleId }) as ViewRow[];
    return rows.map(rowToViewItem);
  };

  const saveView = (scheduleId: number, name: string, state: SavedViewState) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO saved_views (schedule_id, name, state_json, created_at, updated_at)
      VALUES (@schedule_id, @name, @state_json, @created_at, @updated_at)
    `);
    const info = stmt.run({
      schedule_id: scheduleId,
      name,
      state_json: JSON.stringify(state),
      created_at: now,
      updated_at: now
    });
    return Number(info.lastInsertRowid);
  };

  const listSchedules = (): ScheduleItem[] => {
    const rows = db
      .prepare(`SELECT id, name, description, created_at, updated_at FROM schedules ORDER BY id ASC`)
      .all() as ScheduleRow[];
    return rows.map(rowToScheduleItem);
  };

  const getScheduleById = (scheduleId: number): ScheduleItem | null => {
    const row = db
      .prepare(
        `SELECT id, name, description, created_at, updated_at FROM schedules WHERE id = @scheduleId`
      )
      .get({ scheduleId }) as ScheduleRow | undefined;
    return row ? rowToScheduleItem(row) : null;
  };

  const createSchedule = (name: string, description?: string | null): ScheduleItem | null => {
    const now = new Date().toISOString();
    try {
      const stmt = db.prepare(`
        INSERT INTO schedules (name, description, created_at, updated_at)
        VALUES (@name, @description, @created_at, @updated_at)
      `);
      const info = stmt.run({
        name,
        description: description ?? null,
        created_at: now,
        updated_at: now
      });
      const scheduleId = Number(info.lastInsertRowid);
      return getScheduleById(scheduleId);
    } catch {
      return null;
    }
  };

  const updateSchedule = (
    scheduleId: number,
    name: string,
    description?: string | null
  ): boolean => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      UPDATE schedules
      SET name = @name,
          description = @description,
          updated_at = @updated_at
      WHERE id = @scheduleId
    `);
    const info = stmt.run({
      scheduleId,
      name,
      description: description ?? null,
      updated_at: now
    });
    return info.changes > 0;
  };

  const deleteSchedule = (scheduleId: number): boolean => {
    const countRow = db
      .prepare(`SELECT COUNT(*) as count FROM schedules`)
      .get() as { count: number };
    if (countRow.count <= 1) {
      return false;
    }
    const exists = db
      .prepare(`SELECT 1 FROM schedules WHERE id = @scheduleId`)
      .get({ scheduleId });
    if (!exists) {
      return false;
    }

    const tx = db.transaction(() => {
      db.prepare(
        `DELETE FROM tasks WHERE import_id IN (SELECT id FROM imports WHERE schedule_id = @scheduleId)`
      ).run({ scheduleId });
      db.prepare(
        `DELETE FROM command_history WHERE import_id IN (SELECT id FROM imports WHERE schedule_id = @scheduleId)`
      ).run({ scheduleId });
      db.prepare(
        `DELETE FROM warnings WHERE import_id IN (SELECT id FROM imports WHERE schedule_id = @scheduleId)`
      ).run({ scheduleId });
      db.prepare(`DELETE FROM imports WHERE schedule_id = @scheduleId`).run({ scheduleId });
      db.prepare(`DELETE FROM saved_views WHERE schedule_id = @scheduleId`).run({ scheduleId });
      db.prepare(`DELETE FROM schedules WHERE id = @scheduleId`).run({ scheduleId });
    });

    tx();
    return true;
  };

  const close = () => {
    db.close();
  };

  return {
    init,
    insertImport,
    insertTasks,
    insertWarnings,
    listImports,
    getLatestImportId,
    getPreviousImportId,
    getTasksByImportId,
    getTaskByKey,
    updateTask,
    updateTaskWithHistory,
    insertCommandHistory,
    getCommandHistoryById,
    deleteCommandHistoryByIds,
    applyTaskSnapshot,
    getImportById,
    getSavedViews,
    saveView,
    listSchedules,
    createSchedule,
    updateSchedule,
    deleteSchedule,
    close
  };
};
