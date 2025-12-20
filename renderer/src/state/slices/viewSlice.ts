import type { StateCreator } from 'zustand';
import type { SavedViewItem, SavedViewState } from '@domain';
import type { AppState } from '../store';

export interface ViewSlice {
  views: SavedViewItem[];
  loadViews: () => Promise<void>;
  saveView: (name: string, state: SavedViewState) => Promise<void>;
}

const API_MISSING_MESSAGE =
  'Preload API が利用できません。preload の読み込みを確認してください。';

export const createViewSlice: StateCreator<AppState, [], [], ViewSlice> = (set, get) => ({
  views: [],
  loadViews: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const response = await window.api.viewsList();
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
    const response = await window.api.viewsSave(name, state);
    if (response.ok) {
      get().setLastError(null);
      await get().loadViews();
    } else {
      get().setLastError(response.error);
    }
  }
});
