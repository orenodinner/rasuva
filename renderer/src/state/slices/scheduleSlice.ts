import type { StateCreator } from 'zustand';
import type { ScheduleItem } from '@domain';
import type { AppState } from '../store';

export interface ScheduleSlice {
  schedules: ScheduleItem[];
  currentScheduleId: number | null;
  loadSchedules: () => Promise<void>;
  initSchedules: () => Promise<void>;
  switchSchedule: (scheduleId: number) => Promise<void>;
  createSchedule: (name: string) => Promise<number | null>;
  updateSchedule: (scheduleId: number, name: string) => Promise<boolean>;
  deleteSchedule: (scheduleId: number) => Promise<boolean>;
}

const API_MISSING_MESSAGE =
  'Preload API が利用できません。preload の読み込みを確認してください。';

export const createScheduleSlice: StateCreator<AppState, [], [], ScheduleSlice> = (set, get) => ({
  schedules: [],
  currentScheduleId: null,
  loadSchedules: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const response = await window.api.schedulesList();
    if (response.ok) {
      set({ schedules: response.schedules });
      get().setLastError(null);
    } else {
      get().setLastError(response.error);
    }
  },
  initSchedules: async () => {
    await get().loadSchedules();
    const current = get().currentScheduleId;
    const schedules = get().schedules;
    if (current) {
      return;
    }
    const first = schedules[0];
    if (first) {
      await get().switchSchedule(first.id);
    }
  },
  switchSchedule: async (scheduleId) => {
    if (get().currentScheduleId === scheduleId) {
      return;
    }
    set({
      currentScheduleId: scheduleId,
      jsonText: '',
      importSource: 'paste',
      preview: null,
      diff: null,
      imports: [],
      gantt: null,
      selectedTask: null,
      currentImportId: null,
      taskOrder: [],
      views: [],
      collapsedGroups: [],
      rangeStart: null,
      rangeEnd: null
    });
    get().setLastError(null);
    await Promise.all([get().loadImports(), get().loadGantt(), get().loadViews()]);
  },
  createSchedule: async (name) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return null;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return null;
    }
    const response = await window.api.schedulesCreate(trimmed);
    if (!response.ok) {
      get().setLastError(response.error);
      return null;
    }
    set((state) => ({ schedules: [...state.schedules, response.schedule] }));
    get().setLastError(null);
    await get().switchSchedule(response.schedule.id);
    return response.schedule.id;
  },
  updateSchedule: async (scheduleId, name) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return false;
    }
    const trimmed = name.trim();
    if (!trimmed) {
      return false;
    }
    const response = await window.api.schedulesUpdate(scheduleId, trimmed);
    if (!response.ok) {
      get().setLastError(response.error);
      return false;
    }
    set((state) => ({
      schedules: state.schedules.map((item) =>
        item.id === response.schedule.id ? response.schedule : item
      )
    }));
    get().setLastError(null);
    return true;
  },
  deleteSchedule: async (scheduleId) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return false;
    }
    const response = await window.api.schedulesDelete(scheduleId);
    if (!response.ok) {
      get().setLastError(response.error);
      return false;
    }
    const remaining = get().schedules.filter((item) => item.id !== scheduleId);
    set({ schedules: remaining });
    get().setLastError(null);

    if (get().currentScheduleId === scheduleId) {
      const next = remaining[0];
      if (next) {
        await get().switchSchedule(next.id);
      } else {
        set({ currentScheduleId: null });
      }
    }

    return true;
  }
});
