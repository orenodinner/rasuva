import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type { SavedViewState, TaskUpdateInput } from '@domain';

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
  taskUpdate: (input: TaskUpdateInput) =>
    ipcRenderer.invoke(IPC_CHANNELS.taskUpdate, input)
};

contextBridge.exposeInMainWorld('api', api);
