import { create } from 'zustand';
import { createImportSlice, type ImportSlice } from './slices/importSlice';
import { createGanttSlice, type GanttSlice } from './slices/ganttSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createViewSlice, type ViewSlice } from './slices/viewSlice';

export type AppState = ImportSlice & GanttSlice & UISlice & ViewSlice;
export type { ZoomLevel } from './slices/uiSlice';

export const useAppStore = create<AppState>()((...args) => ({
  ...createImportSlice(...args),
  ...createGanttSlice(...args),
  ...createUISlice(...args),
  ...createViewSlice(...args)
}));
