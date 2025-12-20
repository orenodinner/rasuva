import type { StateCreator } from 'zustand';
import type { AppState } from '../store';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';
export type StatusFilter = 'all' | 'scheduled' | 'unscheduled' | 'invalid_date';

export interface UISlice {
  search: string;
  zoom: ZoomLevel;
  statusFilter: StatusFilter;
  lastError: string | null;
  setSearch: (search: string) => void;
  setZoom: (zoom: ZoomLevel) => void;
  setStatusFilter: (value: StatusFilter) => void;
  setLastError: (message: string | null) => void;
  clearError: () => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  search: '',
  zoom: 'month',
  statusFilter: 'all',
  lastError: null,
  setSearch: (search) => set({ search }),
  setZoom: (zoom) => set({ zoom }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setLastError: (message) => set({ lastError: message }),
  clearError: () => set({ lastError: null })
});
