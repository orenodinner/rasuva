import type { StateCreator } from 'zustand';
import type { AppState } from '../store';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';

export interface UISlice {
  search: string;
  zoom: ZoomLevel;
  lastError: string | null;
  setSearch: (search: string) => void;
  setZoom: (zoom: ZoomLevel) => void;
  setLastError: (message: string | null) => void;
  clearError: () => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  search: '',
  zoom: 'month',
  lastError: null,
  setSearch: (search) => set({ search }),
  setZoom: (zoom) => set({ zoom }),
  setLastError: (message) => set({ lastError: message }),
  clearError: () => set({ lastError: null })
});
