import type { StateCreator } from 'zustand';
import type { SavedViewItem, SavedViewState } from '@domain';
import type { AppState } from '../store';

export interface ViewSlice {
  views: SavedViewItem[];
  collapsedGroups: string[];
  rangeStart: string | null;
  rangeEnd: string | null;
  loadViews: () => Promise<void>;
  saveView: (name: string, state: SavedViewState) => Promise<void>;
  setCollapsedGroups: (groups: string[]) => void;
  toggleGroup: (groupId: string) => void;
  setRange: (start: string | null, end: string | null) => void;
  applyViewState: (state: SavedViewState) => void;
}

const API_MISSING_MESSAGE =
  'Preload API が利用できません。preload の読み込みを確認してください。';

export const createViewSlice: StateCreator<AppState, [], [], ViewSlice> = (set, get) => ({
  views: [],
  collapsedGroups: [],
  rangeStart: null,
  rangeEnd: null,
  loadViews: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const scheduleId = get().currentScheduleId;
    if (!scheduleId) {
      get().setLastError('スケジュールが選択されていません。');
      return;
    }
    const response = await window.api.viewsList(scheduleId);
    if (response.ok) {
      set({ views: response.views });
      get().setLastError(null);
    } else {
      get().setLastError(response.error);
    }
  },
  saveView: async (name, state) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const scheduleId = get().currentScheduleId;
    if (!scheduleId) {
      get().setLastError('スケジュールが選択されていません。');
      return;
    }
    const response = await window.api.viewsSave(scheduleId, name, state);
    if (response.ok) {
      get().setLastError(null);
      await get().loadViews();
    } else {
      get().setLastError(response.error);
    }
  },
  setCollapsedGroups: (groups) => set({ collapsedGroups: groups }),
  toggleGroup: (groupId) => {
    set((state) => {
      const exists = state.collapsedGroups.includes(groupId);
      return {
        collapsedGroups: exists
          ? state.collapsedGroups.filter((id) => id !== groupId)
          : [...state.collapsedGroups, groupId]
      };
    });
  },
  setRange: (start, end) => {
    set({
      rangeStart: start,
      rangeEnd: end
    });
  },
  applyViewState: (state) => {
    set({
      collapsedGroups: state.collapsedGroups ?? [],
      rangeStart: state.rangeStart ?? null,
      rangeEnd: state.rangeEnd ?? null
    });
    get().setSearch(state.search ?? '');
    get().setZoom(state.zoom ?? 'month');
  }
});
