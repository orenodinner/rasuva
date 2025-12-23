import type { StateCreator } from 'zustand';
import type { GanttQueryResult, NormalizedTask, TaskUpdateInput } from '@domain';
import type { AppState } from '../store';

export interface GanttSlice {
  gantt: GanttQueryResult | null;
  selectedTask: NormalizedTask | null;
  focusDate: string | null;
  currentImportId: number | null;
  taskOrder: NormalizedTask[];
  setSelectedTask: (task: NormalizedTask | null) => void;
  setFocusDate: (value: string | null) => void;
  setTaskOrder: (tasks: NormalizedTask[]) => void;
  loadGantt: (importId?: number) => Promise<void>;
  updateTask: (input: TaskUpdateInput) => Promise<boolean>;
}

const API_MISSING_MESSAGE =
  'Preload API が利用できません。preload の読み込みを確認してください。';

export const createGanttSlice: StateCreator<AppState, [], [], GanttSlice> = (set, get) => ({
  gantt: null,
  selectedTask: null,
  focusDate: null,
  currentImportId: null,
  taskOrder: [],
  setSelectedTask: (task) => set({ selectedTask: task }),
  setFocusDate: (value) => set({ focusDate: value }),
  setTaskOrder: (tasks) => set({ taskOrder: tasks }),
  loadGantt: async (importId) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const scheduleId = get().currentScheduleId;
    if (!scheduleId) {
      get().setLastError('スケジュールが選択されていません。');
      return;
    }
    const response = await window.api.ganttQuery(scheduleId, importId);
    if (response.ok) {
      set({ gantt: response.result, currentImportId: response.result.importId });
      get().setLastError(null);
    } else {
      get().setLastError(response.error);
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
  }
});
