import type { StateCreator } from 'zustand';
import type { GanttQueryResult, NormalizedTask, TaskUpdateInput } from '@domain';
import type { AppState } from '../store';

export interface GanttSlice {
  gantt: GanttQueryResult | null;
  selectedTask: NormalizedTask | null;
  focusDate: string | null;
  currentImportId: number | null;
  taskOrder: NormalizedTask[];
  canUndo: boolean;
  canRedo: boolean;
  setSelectedTask: (task: NormalizedTask | null) => void;
  setFocusDate: (value: string | null) => void;
  setTaskOrder: (tasks: NormalizedTask[]) => void;
  loadGantt: (importId?: number) => Promise<void>;
  updateTask: (input: TaskUpdateInput) => Promise<boolean>;
  refreshHistoryStatus: (importId?: number) => Promise<void>;
  undo: () => Promise<void>;
  redo: () => Promise<void>;
}

const API_MISSING_MESSAGE =
  'Preload API が利用できません。preload の読み込みを確認してください。';

export const createGanttSlice: StateCreator<AppState, [], [], GanttSlice> = (set, get) => ({
  gantt: null,
  selectedTask: null,
  focusDate: null,
  currentImportId: null,
  taskOrder: [],
  canUndo: false,
  canRedo: false,
  setSelectedTask: (task) => set({ selectedTask: task }),
  setFocusDate: (value) => set({ focusDate: value }),
  setTaskOrder: (tasks) => set({ taskOrder: tasks }),
  loadGantt: async (importId) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      set({ canUndo: false, canRedo: false });
      return;
    }
    const scheduleId = get().currentScheduleId;
    if (!scheduleId) {
      get().setLastError('スケジュールが選択されていません。');
      set({ canUndo: false, canRedo: false });
      return;
    }
    const response = await window.api.ganttQuery(scheduleId, importId);
    if (response.ok) {
      set({ gantt: response.result, currentImportId: response.result.importId });
      get().setLastError(null);
      await get().refreshHistoryStatus(response.result.importId ?? importId);
    } else {
      get().setLastError(response.error);
      set({ canUndo: false, canRedo: false });
    }
  },
  updateTask: async (input) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return false;
    }

    const importId = input.importId ?? get().currentImportId;
    if (!importId) {
      get().setLastError('インポートが選択されていません。');
      return false;
    }

    const response = await window.api.taskUpdate({ ...input, importId });

    if (!response.ok) {
      get().setLastError(response.error);
      return false;
    }

    await get().loadGantt(importId);
    const refreshed =
      get().gantt?.tasks.find((task) => task.taskKeyFull === response.task.taskKeyFull) ??
      response.task;
    set({ selectedTask: refreshed });
    get().setLastError(null);
    return true;
  },
  refreshHistoryStatus: async (importId) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      set({ canUndo: false, canRedo: false });
      return;
    }
    const targetImportId = importId ?? get().currentImportId;
    if (!targetImportId) {
      set({ canUndo: false, canRedo: false });
      return;
    }
    const response = await window.api.historyStatus(targetImportId);
    if (response.ok) {
      set({ canUndo: response.canUndo, canRedo: response.canRedo });
    } else {
      get().setLastError(response.error);
      set({ canUndo: false, canRedo: false });
    }
  },
  undo: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const importId = get().currentImportId;
    if (!importId) {
      get().setLastError('インポートが選択されていません。');
      return;
    }
    const response = await window.api.historyUndo(importId);
    if (!response.ok) {
      get().setLastError(response.error);
      return;
    }
    await get().loadGantt(importId);
    const refreshed =
      get().gantt?.tasks.find((task) => task.taskKeyFull === response.task.taskKeyFull) ??
      response.task;
    set({ selectedTask: refreshed });
  },
  redo: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const importId = get().currentImportId;
    if (!importId) {
      get().setLastError('インポートが選択されていません。');
      return;
    }
    const response = await window.api.historyRedo(importId);
    if (!response.ok) {
      get().setLastError(response.error);
      return;
    }
    await get().loadGantt(importId);
    const refreshed =
      get().gantt?.tasks.find((task) => task.taskKeyFull === response.task.taskKeyFull) ??
      response.task;
    set({ selectedTask: refreshed });
  }
});
