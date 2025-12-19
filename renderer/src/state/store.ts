import { create } from 'zustand';
import type {
  DiffResult,
  ImportApplyResult,
  ImportListItem,
  ImportPreviewResult,
  GanttQueryResult,
  NormalizedTask,
  SavedViewItem,
  SavedViewState
} from '@domain';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

interface TaskUpdateInput {
  importId?: number;
  taskKeyFull: string;
  start: string | null;
  end: string | null;
  note: string | null;
}

interface AppState {
  jsonText: string;
  importSource: 'paste' | 'file';
  preview: ImportPreviewResult | null;
  diff: DiffResult | null;
  gantt: GanttQueryResult | null;
  imports: ImportListItem[];
  views: SavedViewItem[];
  selectedTask: NormalizedTask | null;
  search: string;
  zoom: ZoomLevel;
  focusDate: string | null;
  currentImportId: number | null;
  lastError: string | null;
  setJsonText: (value: string) => void;
  setImportSource: (value: 'paste' | 'file') => void;
  setSelectedTask: (task: NormalizedTask | null) => void;
  setSearch: (value: string) => void;
  setZoom: (value: ZoomLevel) => void;
  setFocusDate: (value: string | null) => void;
  clearError: () => void;
  loadPreview: () => Promise<boolean>;
  applyImport: (source: 'paste' | 'file') => Promise<ImportApplyResult | null>;
  loadDiff: (importId?: number) => Promise<void>;
  loadGantt: (importId?: number) => Promise<void>;
  loadImports: () => Promise<void>;
  loadViews: () => Promise<void>;
  saveView: (name: string, state: SavedViewState) => Promise<void>;
  updateTask: (input: TaskUpdateInput) => Promise<boolean>;
}

export const useAppStore = create<AppState>((set, get) => ({
  jsonText: '',
  importSource: 'paste',
  preview: null,
  diff: null,
  gantt: null,
  imports: [],
  views: [],
  selectedTask: null,
  search: '',
  zoom: 'month',
  focusDate: null,
  currentImportId: null,
  lastError: null,
  setJsonText: (value) => set({ jsonText: value }),
  setImportSource: (value) => set({ importSource: value }),
  setSelectedTask: (task) => set({ selectedTask: task }),
  setSearch: (value) => set({ search: value }),
  setZoom: (value) => set({ zoom: value }),
  setFocusDate: (value) => set({ focusDate: value }),
  clearError: () => set({ lastError: null }),
  loadPreview: async () => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return false;
    }
    const jsonText = get().jsonText;
    const response = await window.api.importPreview(jsonText);
    if (response.ok) {
      set({ preview: response.preview, lastError: null });
      return true;
    }
    set({ lastError: response.error });
    return false;
  },
  applyImport: async (source) => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return null;
    }
    const jsonText = get().jsonText;
    const response = await window.api.importApply(jsonText, source);
    if (response.ok) {
      set({
        diff: response.result.diff,
        preview: null,
        currentImportId: response.result.importId,
        lastError: null
      });
      await get().loadImports();
      return response.result;
    }
    set({ lastError: response.error });
    return null;
  },
  loadDiff: async (importId) => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return;
    }
    const response = await window.api.diffGet(importId);
    if (response.ok) {
      set({ diff: response.diff, currentImportId: response.importId, lastError: null });
    } else {
      set({ lastError: response.error });
    }
  },
  loadGantt: async (importId) => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return;
    }
    const response = await window.api.ganttQuery(importId);
    if (response.ok) {
      set({ gantt: response.result, currentImportId: response.result.importId, lastError: null });
    } else {
      set({ lastError: response.error });
    }
  },
  loadImports: async () => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return;
    }
    const response = await window.api.importsList();
    if (response.ok) {
      set({ imports: response.imports, lastError: null });
    } else {
      set({ lastError: response.error });
    }
  },
  loadViews: async () => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return;
    }
    const response = await window.api.viewsList();
    if (response.ok) {
      set({ views: response.views, lastError: null });
    } else {
      set({ lastError: response.error });
    }
  },
  saveView: async (name, state) => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return;
    }
    const response = await window.api.viewsSave(name, state);
    if (response.ok) {
      set({ lastError: null });
      await get().loadViews();
    } else {
      set({ lastError: response.error });
    }
  },
  updateTask: async (input) => {
    if (!window.api) {
      set({ lastError: 'Preload API が利用できません。preload の読み込みを確認してください。' });
      return false;
    }

    const importId = input.importId ?? get().currentImportId;
    if (!importId) {
      set({ lastError: 'インポートが選択されていません。' });
      return false;
    }

    const response = await window.api.taskUpdate(
      importId,
      input.taskKeyFull,
      input.start,
      input.end,
      input.note
    );

    if (!response.ok) {
      set({ lastError: response.error });
      return false;
    }

    const updated = response.task;
    const replaceTask = (items: NormalizedTask[]) =>
      items.map((task) => (task.taskKeyFull === updated.taskKeyFull ? updated : task));

    set((state) => ({
      gantt: state.gantt ? { ...state.gantt, tasks: replaceTask(state.gantt.tasks) } : state.gantt,
      diff: state.diff
        ? {
            ...state.diff,
            added: replaceTask(state.diff.added),
            updated: replaceTask(state.diff.updated),
            archived: replaceTask(state.diff.archived)
          }
        : state.diff,
      selectedTask: updated,
      lastError: null
    }));

    return true;
  }
}));
