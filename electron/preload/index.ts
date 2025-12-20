import { contextBridge, ipcRenderer } from 'electron';
import { IPC_CHANNELS } from '../shared/ipcChannels';
import type { SavedViewState } from '@domain';

const api = {
  importPreview: (jsonText: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.importPreview, { jsonText }),
  importExcel: () => ipcRenderer.invoke(IPC_CHANNELS.importExcel),
  importApply: (jsonText: string, source: 'paste' | 'file' | 'excel') =>
    ipcRenderer.invoke(IPC_CHANNELS.importApply, { jsonText, source }),
  diffGet: (importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.diffGet, { importId }),
  ganttQuery: (importId?: number) =>
    ipcRenderer.invoke(IPC_CHANNELS.ganttQuery, { importId }),
  importsList: () => ipcRenderer.invoke(IPC_CHANNELS.importsList),
  viewsList: () => ipcRenderer.invoke(IPC_CHANNELS.viewsList),
  viewsSave: (name: string, state: SavedViewState) =>
    ipcRenderer.invoke(IPC_CHANNELS.viewsSave, { name, state }),
  exportCsv: (importId?: number) => ipcRenderer.invoke(IPC_CHANNELS.exportCsv, { importId }),
  exportXlsx: (importId?: number) => ipcRenderer.invoke(IPC_CHANNELS.exportXlsx, { importId }),
  taskUpdate: (
    importId: number | undefined,
    taskKeyFull: string,
    start: string | null,
    end: string | null,
    note: string | null,
    assignees: string[]
  ) =>
    ipcRenderer.invoke(IPC_CHANNELS.taskUpdate, {
      importId,
      taskKeyFull,
      start,
      end,
      note,
      assignees
    })
};

contextBridge.exposeInMainWorld('api', api);
