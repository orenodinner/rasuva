import type { StateCreator } from 'zustand';
import type { NormalizedTask } from '@domain';
import type { AppState } from '../store';

export type ZoomLevel = 'day' | 'week' | 'month' | 'quarter';
export type StatusFilter = 'all' | 'scheduled' | 'unscheduled' | 'invalid_date';
export type ContextMenuTarget =
  | { type: 'task'; task: NormalizedTask }
  | { type: 'project'; projectId: string; projectGroup: string | null };

export interface UISlice {
  search: string;
  zoom: ZoomLevel;
  statusFilter: StatusFilter;
  lastError: string | null;
  shouldFocusEdit: boolean;
  inlineEditTaskKey: string | null;
  taskCreateModal: {
    isOpen: boolean;
    projectId: string | null;
    projectGroup: string | null;
  };
  contextMenu: {
    visible: boolean;
    x: number;
    y: number;
    target: ContextMenuTarget | null;
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
  openTaskCreateModal: (payload: { projectId: string; projectGroup?: string | null }) => void;
  closeTaskCreateModal: () => void;
  showContextMenu: (payload: { x: number; y: number; target: ContextMenuTarget }) => void;
  hideContextMenu: () => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => ({
  search: '',
  zoom: 'month',
  statusFilter: 'all',
  lastError: null,
  shouldFocusEdit: false,
  inlineEditTaskKey: null,
  taskCreateModal: {
    isOpen: false,
    projectId: null,
    projectGroup: null
  },
  contextMenu: {
    visible: false,
    x: 0,
    y: 0,
    target: null
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
  openTaskCreateModal: ({ projectId, projectGroup }) =>
    set({
      taskCreateModal: {
        isOpen: true,
        projectId,
        projectGroup: projectGroup ?? null
      }
    }),
  closeTaskCreateModal: () =>
    set({
      taskCreateModal: {
        isOpen: false,
        projectId: null,
        projectGroup: null
      }
    }),
  showContextMenu: ({ x, y, target }) =>
    set({
      contextMenu: {
        visible: true,
        x,
        y,
        target
      }
    }),
  hideContextMenu: () =>
    set({
      contextMenu: {
        visible: false,
        x: 0,
        y: 0,
        target: null
      }
    })
});
