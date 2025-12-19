import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../main/ipc';
import type { SavedViewState } from '@domain';

const api = {
  importPreview: (jsonText: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.importPreview, { jsonText }),
  importApply: (jsonText: string, source: 'paste' | 'file') =>
    ipcRenderer.invoke(IPC_CHANNELS.importApply, { jsonText, source }),
  diffGet: (importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.diffGet, { importId }),
  ganttQuery: (importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.ganttQuery, { importId }),
  importsList: () => ipcRenderer.invoke(IPC_CHANNELS.importsList),
  viewsList: () => ipcRenderer.invoke(IPC_CHANNELS.viewsList),
  viewsSave: (name: string, state: SavedViewState) =>
    ipcRenderer.invoke(IPC_CHANNELS.viewsSave, { name, state }),
  exportCsv: (importId?: number) => ipcRenderer.invoke(IPC_CHANNELS.exportCsv, { importId })
};

contextBridge.exposeInMainWorld('api', api);
