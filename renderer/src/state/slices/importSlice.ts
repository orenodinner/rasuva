import type { StateCreator } from 'zustand';
import type { DiffResult, ImportApplyResult, ImportListItem, ImportPreviewResult } from '@domain';
import type { AppState } from '../store';

export type ImportSource = 'paste' | 'file' | 'excel';

export interface ImportSlice {
  jsonText: string;
  importSource: ImportSource;
  preview: ImportPreviewResult | null;
  diff: DiffResult | null;
  imports: ImportListItem[];
  setJsonText: (value: string) => void;
  setImportSource: (value: ImportSource) => void;
  loadPreview: () => Promise<boolean>;
  loadExcelImport: () => Promise<boolean>;
  applyImport: (source: ImportSource) => Promise<ImportApplyResult | null>;
  loadDiff: (importId?: number) => Promise<void>;
  loadImports: () => Promise<void>;
}

const API_MISSING_MESSAGE =
  'Preload API が利用できません。preload の読み込みを確認してください。';

export const createImportSlice: StateCreator<AppState, [], [], ImportSlice> = (set, get) => ({
  jsonText: '',
  importSource: 'paste',
  preview: null,
  diff: null,
  imports: [],
  setJsonText: (value) => set({ jsonText: value }),
  setImportSource: (value) => set({ importSource: value }),
  loadPreview: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return false;
    }
    const response = await window.api.importPreview(get().jsonText);
    if (response.ok) {
      set({ preview: response.preview });
      get().setLastError(null);
      return true;
    }
    get().setLastError(response.error);
    return false;
  },
  loadExcelImport: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return false;
    }
    const response = await window.api.importExcel();
    if (response.ok) {
      set({
        jsonText: response.jsonText,
        preview: response.preview,
        importSource: 'excel'
      });
      get().setLastError(null);
      return true;
    }
    get().setLastError(response.error);
    return false;
  },
  applyImport: async (source) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return null;
    }
    const response = await window.api.importApply(get().jsonText, source);
    if (response.ok) {
      set({
        diff: response.result.diff,
        preview: null,
        currentImportId: response.result.importId
      });
      get().setLastError(null);
      await get().loadImports();
      return response.result;
    }
    get().setLastError(response.error);
    return null;
  },
  loadDiff: async (importId) => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const response = await window.api.diffGet(importId);
    if (response.ok) {
      set({ diff: response.diff, currentImportId: response.importId });
      get().setLastError(null);
    } else {
      get().setLastError(response.error);
    }
  },
  loadImports: async () => {
    if (!window.api) {
      get().setLastError(API_MISSING_MESSAGE);
      return;
    }
    const response = await window.api.importsList();
    if (response.ok) {
      set({ imports: response.imports });
      get().setLastError(null);
    } else {
      get().setLastError(response.error);
    }
  }
});
