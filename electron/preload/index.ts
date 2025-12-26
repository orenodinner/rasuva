import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type { NormalizedTask, SavedViewState, TaskUpdateInput } from '@domain';

const api = {
  importPreview: (jsonText: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.importPreview, { jsonText }),
  importExcel: () => ipcRenderer.invoke(IPC_CHANNELS.importExcel),
  importApply: (jsonText: string, source: 'paste' | 'file' | 'excel', scheduleId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.importApply, { jsonText, source, scheduleId }),
  diffGet: (scheduleId: number, importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.diffGet, { scheduleId, importId }),
  ganttQuery: (scheduleId: number, importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.ganttQuery, { scheduleId, importId }),
  schedulesList: () => ipcRenderer.invoke(IPC_CHANNELS.schedulesList),
  schedulesCreate: (name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.schedulesCreate, { name }),
  schedulesUpdate: (id: number, name: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.schedulesUpdate, { id, name }),
  schedulesDelete: (id: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.schedulesDelete, { id }),
  importsList: (scheduleId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.importsList, { scheduleId }),
  viewsList: (scheduleId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.viewsList, { scheduleId }),
  viewsSave: (scheduleId: number, name: string, state: SavedViewState) =>
    ipcRenderer.invoke(IPC_CHANNELS.viewsSave, { scheduleId, name, state }),
  exportCsv: (scheduleId: number, importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportCsv, { scheduleId, importId }),
  exportXlsx: (scheduleId: number, importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportXlsx, { scheduleId, importId }),
  exportJson: (scheduleId: number, importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.exportJson, { scheduleId, importId }),
  showTaskContextMenu: (task: NormalizedTask) =>
    ipcRenderer.invoke(IPC_CHANNELS.contextMenuTask, task),
  onMenuAction: (
    callback: (event: Electron.IpcRendererEvent, payload: { action: string; task: NormalizedTask }) => void
  ) => {
    ipcRenderer.on(IPC_CHANNELS.menuAction, callback);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.menuAction, callback);
  },
  historyUndo: (importId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.historyUndo, { importId }),
  historyRedo: (importId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.historyRedo, { importId }),
  historyStatus: (importId: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.historyStatus, { importId }),
  taskUpdate: (input: TaskUpdateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.taskUpdate, input)
};

contextBridge.exposeInMainWorld('api', api);
