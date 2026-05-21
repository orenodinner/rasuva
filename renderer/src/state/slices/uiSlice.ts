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
  isDetailsPaneVisible: boolean;
  taskCreateModal: {
    isOpen: boolean;
    projectId: string | null;
    projectGroup: string | null;
  };
  confirmDialog: {
    isOpen: boolean;
    message: string;
    confirmLabel: string;
    cancelLabel: string;
  };
  isUnscheduledDrawerOpen: boolean;
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
  toggleDetailsPane: () => void;
  toggleUnscheduledDrawer: () => void;
  openTaskCreateModal: (payload: { projectId: string; projectGroup?: string | null }) => void;
  closeTaskCreateModal: () => void;
  openConfirmDialog: (
    message: string,
    options?: { confirmLabel?: string; cancelLabel?: string }
  ) => Promise<boolean>;
  resolveConfirmDialog: (confirmed: boolean) => void;
  showContextMenu: (payload: { x: number; y: number; target: ContextMenuTarget }) => void;
  hideContextMenu: () => void;
}

export const createUISlice: StateCreator<AppState, [], [], UISlice> = (set) => {
  let confirmResolver: ((confirmed: boolean) => void) | null = null;

  return {
    search: '',
    zoom: 'month',
    statusFilter: 'all',
    lastError: null,
    shouldFocusEdit: false,
    inlineEditTaskKey: null,
    isDetailsPaneVisible: true,
    taskCreateModal: {
      isOpen: false,
      projectId: null,
      projectGroup: null
    },
    confirmDialog: {
      isOpen: false,
      message: '',
      confirmLabel: 'OK',
      cancelLabel: 'キャンセル'
    },
    isUnscheduledDrawerOpen: false,
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
    toggleDetailsPane: () =>
      set((state) => ({ isDetailsPaneVisible: !state.isDetailsPaneVisible })),
    toggleUnscheduledDrawer: () =>
      set((state) => ({ isUnscheduledDrawerOpen: !state.isUnscheduledDrawerOpen })),
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
    openConfirmDialog: (message, options) =>
      new Promise((resolve) => {
        if (confirmResolver) {
          confirmResolver(false);
        }
        confirmResolver = resolve;
        set({
          confirmDialog: {
            isOpen: true,
            message,
            confirmLabel: options?.confirmLabel ?? 'OK',
            cancelLabel: options?.cancelLabel ?? 'キャンセル'
          }
        });
      }),
    resolveConfirmDialog: (confirmed) => {
      if (confirmResolver) {
        confirmResolver(confirmed);
        confirmResolver = null;
      }
      set({
        confirmDialog: {
          isOpen: false,
          message: '',
          confirmLabel: 'OK',
          cancelLabel: 'キャンセル'
        }
      });
    },
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
  };
};
