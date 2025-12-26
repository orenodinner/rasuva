import type { StateCreator } from 'zustand';
import type { NormalizedTask } from '@domain';
import type { AppState } from '../store';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';
export type StatusFilter = 'all' | 'scheduled' | 'unscheduled' | 'invalid_date';

export interface UISlice {
  search: string;
  zoom: ZoomLevel;
  statusFilter: StatusFilter;
  lastError: string | null;
  shouldFocusEdit: boolean;
  inlineEditTaskKey: string | null;
  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    task: NormalizedTask | null;
  };
  setSearch: (search: string) => void;
  setZoom: (zoom: ZoomLevel) => void;
  setStatusFilter: (value: StatusFilter) => void;
  setLastError: (message: string | null) => void;
  clearError: () => void;
  triggerEditFocus: () => void;
  consumeEditFocus: () => void;
  startInlineEdit: (taskKeyFull: string) => void;
  stopInlineEdit: () => void;
  showContextMenu: (payload: { x: number; y: number; task: NormalizedTask }) => void;
  hideContextMenu: () => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  search: '',
  zoom: 'month',
  statusFilter: 'all',
  lastError: null,
  shouldFocusEdit: false,
  inlineEditTaskKey: null,
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    task: null
  },
  setSearch: (search) => set({ search }),
  setZoom: (zoom) => set({ zoom }),
  setStatusFilter: (value) => set({ statusFilter: value }),
  setLastError: (message) => set({ lastError: message }),
  clearError: () => set({ lastError: null }),
  triggerEditFocus: () => set({ shouldFocusEdit: true }),
  consumeEditFocus: () => set({ shouldFocusEdit: false }),
  startInlineEdit: (taskKeyFull) => set({ inlineEditTaskKey: taskKeyFull }),
  stopInlineEdit: () => set({ inlineEditTaskKey: null }),
  showContextMenu: ({ x, y, task }) =>
    set({
      contextMenu: {
        visible: true,
        x,
        y,
        task
      }
    }),
  hideContextMenu: () =>
    set({
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        task: null
      }
    })
});
