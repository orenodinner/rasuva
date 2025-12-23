export type TaskStatus = 'scheduled' | 'unscheduled' | 'invalid_date';

export interface RawImport {
  members: RawMember[];
}

export interface RawMember {
  name: string;
  projects: RawProject[];
}

export interface RawProject {
  project_id: string | null;
  group?: string | null;
  tasks: RawTask[];
}

export interface RawTask {
  task_name: string;
  start: string | null;
  end: string | null;
  raw_date: string;
  note?: string | null;
  assign?: string[] | null;
}

export interface NormalizedTask {
  id?: number;
  taskKey: string;
  taskKeyFull: string;
  memberName: string;
  projectId: string;
  projectGroup: string | null;
  taskName: string;
  assignees: string[];
  start: string | null;
  end: string | null;
  rawDate: string;
  note: string | null;
  status: TaskStatus;
}

export interface TaskUpdateInput {
  importId?: number;
  currentTaskKeyFull: string;
  memberName: string;
  projectId: string;
  projectGroup: string | null;
  taskName: string;
  start: string | null;
  end: string | null;
  note: string | null;
  assignees: string[];
}

export interface ImportWarning {
  code:
    | 'project_id_missing'
    | 'duplicate_task_key'
    | 'invalid_date_format'
    | 'date_range_invalid'
    | 'partial_date';
  message: string;
  context: Record<string, unknown>;
}

export interface ImportSummary {
  totalMembers: number;
  totalProjects: number;
  totalTasks: number;
  scheduledCount: number;
  unscheduledCount: number;
  invalidCount: number;
  warningsCount: number;
  skippedProjects: number;
}

export interface ImportPreviewResult {
  summary: ImportSummary;
  warnings: ImportWarning[];
}

export interface DiffSummary {
  added: number;
  updated: number;
  archived: number;
  invalid: number;
  unscheduled: number;
}

export interface DiffResult {
  summary: DiffSummary;
  added: NormalizedTask[];
  updated: NormalizedTask[];
  archived: NormalizedTask[];
}

export interface ImportApplyResult {
  importId: number;
  summary: ImportSummary;
  diff: DiffResult;
}

export interface ImportListItem {
  id: number;
  createdAt: string;
  source: string;
  totalTasks: number;
  addedCount: number;
  updatedCount: number;
  archivedCount: number;
  invalidCount: number;
  unscheduledCount: number;
  warningsCount: number;
}

export interface GanttQueryResult {
  importId: number | null;
  tasks: NormalizedTask[];
}

export interface SavedViewState {
  search: string;
  zoom: 'day' | 'week' | 'month' | 'quarter';
  rangeStart: string | null;
  rangeEnd: string | null;
  collapsedGroups: string[];
}

export interface SavedViewItem {
  id: number;
  name: string;
  state: SavedViewState;
  createdAt: string;
  updatedAt: string;
}

export interface ScheduleItem {
  id: number;
  name: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface FlatTaskRow {
  member_name: string | null;
  project_id: string | null;
  project_group?: string | null;
  task_name: string | null;
  assignees?: string[] | null;
  start: string | null;
  end: string | null;
  note?: string | null;
  raw_date?: string | null;
}
