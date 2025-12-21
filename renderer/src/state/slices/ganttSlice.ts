import type { StateCreator } from 'zustand';
import type { GanttQueryResult, NormalizedTask } from '@domain';
import type { AppState } from '../store';

interface TaskUpdateInput {
  importId?: number;
  taskKeyFull: string;
  start: string | null;
  end: string | null;
  note: string | null;
  assignees: string[];
}

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

    const response = await window.api.taskUpdate(
      importId,
      input.taskKeyFull,
      input.start,
      input.end,
      input.note,
      input.assignees
    );

    if (!response.ok) {
      get().setLastError(response.error);
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
      selectedTask: updated
    }));

    get().setLastError(null);
    return true;
  }
});
