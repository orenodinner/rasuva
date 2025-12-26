import type { StateCreator } from 'zustand';
import type { GanttQueryResult, NormalizedTask, TaskUpdateInput } from '@domain';
import type { AppState } from '../store';

export interface GanttSlice {
  gantt: GanttQueryResult | null;
  selectedTask: NormalizedTask | null;
  selectedTaskIds: string[];
  focusDate: string | null;
  currentImportId: number | null;
  taskOrder: NormalizedTask[];
  canUndo: boolean;
  canRedo: boolean;
  setSelectedTask: (task: NormalizedTask | null) => void;
  toggleTaskSelection: (task: NormalizedTask) => void;
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

export const createGanttSlice: StateCreator<AppState, [], [], GanttSlice> = (set, get) => {
  const executeHistoryOperation = async (
    operation: (
      importId: number
    ) => Promise<{ ok: true; task: NormalizedTask } | { ok: false; error: string }>
  ) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const importId = get().currentImportId;
    if (!importId) {
      get().setLastError('インポートが選択されていません。');
      return;
    }
    const response = await operation(importId);
    if (!response.ok) {
      get().setLastError(response.error);
      return;
    }
    await get().loadGantt(importId);
    const refreshed =
      get().gantt?.tasks.find((task) => task.taskKeyFull === response.task.taskKeyFull) ??
      response.task;
    set({ selectedTask: refreshed });
  };

  return {
    gantt: null,
    selectedTask: null,
    selectedTaskIds: [],
    focusDate: null,
    currentImportId: null,
    taskOrder: [],
    canUndo: false,
    canRedo: false,
    setSelectedTask: (task) =>
      set({
        selectedTask: task,
        selectedTaskIds: task ? [task.taskKeyFull] : []
      }),
    toggleTaskSelection: (task) =>
      set((state) => {
        const exists = state.selectedTaskIds.includes(task.taskKeyFull);
        const nextIds = exists
          ? state.selectedTaskIds.filter((id) => id !== task.taskKeyFull)
          : [...state.selectedTaskIds, task.taskKeyFull];
        const selectedTask =
          exists && state.selectedTask?.taskKeyFull === task.taskKeyFull
            ? nextIds
                .map((id) => state.gantt?.tasks.find((entry) => entry.taskKeyFull === id))
                .find(Boolean) ?? null
            : exists
              ? state.selectedTask
              : task;
        return { selectedTask, selectedTaskIds: nextIds };
      }),
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
      await executeHistoryOperation((importId) => window.api!.historyUndo(importId));
    },
    redo: async () => {
      await executeHistoryOperation((importId) => window.api!.historyRedo(importId));
    }
  };
};
