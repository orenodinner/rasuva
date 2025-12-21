import { create } from 'zustand';
import { createImportSlice, type ImportSlice } from './slices/importSlice';
import { createGanttSlice, type GanttSlice } from './slices/ganttSlice';
import { createUISlice, type UISlice } from './slices/uiSlice';
import { createViewSlice, type ViewSlice } from './slices/viewSlice';
import { createScheduleSlice, type ScheduleSlice } from './slices/scheduleSlice';

export type AppState = ImportSlice & GanttSlice & UISlice & ViewSlice & ScheduleSlice;
export type { ZoomLevel, StatusFilter } from './slices/uiSlice';

export const useAppStore = create<AppState>()((...args) => ({
  ...createImportSlice(...args),
  ...createGanttSlice(...args),
  ...createUISlice(...args),
  ...createViewSlice(...args),
  ...createScheduleSlice(...args)
}));
