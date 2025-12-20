import Database from 'better-sqlite3';
import type {
  DiffSummary,
  ImportListItem,
  ImportSummary,
  ImportWarning,
  NormalizedTask,
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
  `ALTER TABLE tasks ADD COLUMN assignees_json TEXT;`
];

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

export interface DbClient {
  init: () => void;
  close: () => void;
  insertImport: (input: ImportInsertInput) => number;
  insertTasks: (importId: number, tasks: NormalizedTask[]) => void;
  insertWarnings: (importId: number, warnings: ImportWarning[]) => void;
  listImports: () => ImportListItem[];
  getLatestImportId: () => number | null;
  getPreviousImportId: (importId: number) => number | null;
  getTasksByImportId: (importId: number) => NormalizedTask[];
  getTaskByKey: (importId: number, taskKeyFull: string) => NormalizedTask | null;
  updateTask: (importId: number, taskKeyFull: string, updates: Partial<NormalizedTask>) => void;
  getImportById: (importId: number) => ImportListItem | null;
  getSavedViews: () => SavedViewItem[];
  saveView: (name: string, state: SavedViewState) => number;
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

const rowToTask = (row: any): NormalizedTask => ({
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

const rowToImportItem = (row: any): ImportListItem => ({
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

const rowToViewItem = (row: any): SavedViewItem => ({
  id: row.id,
  name: row.name,
  state: JSON.parse(row.state_json) as SavedViewState,
  createdAt: row.created_at,
  updatedAt: row.updated_at
});

export const createDb = (dbPath: string): DbClient => {
  const db = new Database(dbPath);
  db.pragma('journal_mode = WAL');

  const init = () => {
    runMigrations(db);
  };

  const insertImport = (input: ImportInsertInput) => {
    const stmt = db.prepare(`
      INSERT INTO imports (
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

  const listImports = (): ImportListItem[] => {
    const rows = db
      .prepare(
        `SELECT id, created_at, source, total_tasks, added_count, updated_count, archived_count, invalid_count, unscheduled_count, warnings_count
         FROM imports
         ORDER BY id DESC`
      )
      .all();

    return rows.map(rowToImportItem);
  };

  const getLatestImportId = () => {
    const row = db
      .prepare(`SELECT id FROM imports ORDER BY id DESC LIMIT 1`)
      .get() as { id: number } | undefined;
    return row ? row.id : null;
  };

  const getPreviousImportId = (importId: number) => {
    const row = db
      .prepare(`SELECT id FROM imports WHERE id < @importId ORDER BY id DESC LIMIT 1`)
      .get({ importId }) as { id: number } | undefined;
    return row ? row.id : null;
  };

  const getTasksByImportId = (importId: number) => {
    const rows = db
      .prepare(`SELECT * FROM tasks WHERE import_id = @importId ORDER BY member_name, project_id, task_name`)
      .all({ importId });
    return rows.map(rowToTask);
  };

  const getTaskByKey = (importId: number, taskKeyFull: string) => {
    const row = db
      .prepare(`SELECT * FROM tasks WHERE import_id = @importId AND task_key_full = @taskKeyFull`)
      .get({ importId, taskKeyFull });
    return row ? rowToTask(row) : null;
  };

  const updateTask = (importId: number, taskKeyFull: string, updates: Partial<NormalizedTask>) => {
    const stmt = db.prepare(`\n      UPDATE tasks\n      SET start = @start,\n          end = @end,\n          note = @note,\n          status = @status,\n          assignees_json = COALESCE(@assignees_json, assignees_json)\n      WHERE import_id = @importId AND task_key_full = @taskKeyFull\n    `);

    const assigneesJson =
      updates.assignees === undefined ? null : JSON.stringify(updates.assignees);

    stmt.run({
      importId,
      taskKeyFull,
      start: updates.start ?? null,
      end: updates.end ?? null,
      note: updates.note ?? null,
      status: updates.status,
      assignees_json: assigneesJson
    });
  };

  const getImportById = (importId: number): ImportListItem | null => {
    const row = db
      .prepare(
        `SELECT id, created_at, source, total_tasks, added_count, updated_count, archived_count, invalid_count, unscheduled_count, warnings_count
         FROM imports
         WHERE id = @importId`
      )
      .get({ importId });

    return row ? rowToImportItem(row) : null;
  };

  const getSavedViews = (): SavedViewItem[] => {
    const rows = db
      .prepare(`SELECT id, name, state_json, created_at, updated_at FROM saved_views ORDER BY id DESC`)
      .all();
    return rows.map(rowToViewItem);
  };

  const saveView = (name: string, state: SavedViewState) => {
    const now = new Date().toISOString();
    const stmt = db.prepare(`
      INSERT INTO saved_views (name, state_json, created_at, updated_at)
      VALUES (@name, @state_json, @created_at, @updated_at)
    `);
    const info = stmt.run({
      name,
      state_json: JSON.stringify(state),
      created_at: now,
      updated_at: now
    });
    return Number(info.lastInsertRowid);
  };

  const close = () => {
    db.close();
  };

  return {
    init,
    close,
    insertImport,
    insertTasks,
    insertWarnings,
    listImports,
    getLatestImportId,
    getPreviousImportId,
    getTasksByImportId,
    getTaskByKey,
    updateTask,
    getImportById,
    getSavedViews,
    saveView
  };
};
