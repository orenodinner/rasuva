import type { StateCreator } from 'zustand';
import { extractJsonFromText } from '@domain';
import type {
  DiffResult,
  ImportApplyMode,
  ImportApplyResult,
  ImportListItem,
  ImportPreviewResult
} from '@domain';
import type { AppState } from '../store';

export type ImportSource = 'paste' | 'file' | 'excel';

export interface ImportSlice {
  jsonText: string;
  importSource: ImportSource;
  preview: ImportPreviewResult | null;
  diff: DiffResult | null;
  imports: ImportListItem[];
  setJsonText: (value: string) => void;
  appendJsonText: (value: string) => void;
  setImportSource: (value: ImportSource) => void;
  loadPreview: () => Promise<boolean>;
  loadExcelImport: () => Promise<boolean>;
  applyImport: (source: ImportSource, mode: ImportApplyMode) => Promise<ImportApplyResult | null>;
  loadDiff: (importId?: number) => Promise<void>;
  loadImports: () => Promise<void>;
}

const API_MISSING_MESSAGE = 'Preload API が利用できません。preload の読み込みを確認してください。';
const INVALID_JSON_MESSAGE = 'Invalid JSON input.';

type PreparedJsonResult = { ok: true; text: string } | { ok: false; error: string };

const prepareJsonText = (jsonText: string): PreparedJsonResult => {
  try {
    JSON.parse(jsonText);
    return { ok: true, text: jsonText };
  } catch {
    const extracted = extractJsonFromText(jsonText);
    if (!extracted.rawJson) {
      return { ok: false, error: INVALID_JSON_MESSAGE };
    }
    return { ok: true, text: JSON.stringify(extracted.rawJson, null, 2) };
  }
};

export const createImportSlice: StateCreator<AppState, [], [], ImportSlice> = (set, get) => {
  const getAndPrepareJsonText = (inputText?: string): PreparedJsonResult => {
    const currentText = inputText ?? get().jsonText;
    const result = prepareJsonText(currentText);
    if (!result.ok) {
      return result;
    }
    if (inputText === undefined && result.text !== currentText) {
      set({ jsonText: result.text });
    }
    return result;
  };

  return {
    jsonText: '',
    importSource: 'paste',
    preview: null,
    diff: null,
    imports: [],
    setJsonText: (value) => set({ jsonText: value }),
    appendJsonText: (value) =>
      set((state) => {
        if (!value) {
          return {};
        }
        const separator =
          state.jsonText.length > 0 && !state.jsonText.endsWith('\n') ? '\n' : '';
        return { jsonText: `${state.jsonText}${separator}${value}` };
      }),
    setImportSource: (value) => set({ importSource: value }),
    loadPreview: async () => {
      if (!window.api) {
        get().setLastError(API_MISSING_MESSAGE);
        return false;
      }
      const preparedText = getAndPrepareJsonText();
      if (!preparedText.ok) {
        get().setLastError(preparedText.error);
        return false;
      }
      const scheduleId = get().currentScheduleId;
      const response = await window.api.importPreview(
        preparedText.text,
        scheduleId ?? undefined
      );
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
      const scheduleId = get().currentScheduleId;
      const response = await window.api.importExcel(scheduleId ?? undefined);
      if (response.ok) {
        const preparedText = getAndPrepareJsonText(response.jsonText);
        if (!preparedText.ok) {
          get().setLastError(preparedText.error);
          return false;
        }
        set({
          jsonText: preparedText.text,
          preview: response.preview,
          importSource: 'excel'
        });
        get().setLastError(null);
        return true;
      }
      get().setLastError(response.error);
      return false;
    },
    applyImport: async (source, mode) => {
      if (!window.api) {
        get().setLastError(API_MISSING_MESSAGE);
        return null;
      }
      const scheduleId = get().currentScheduleId;
      if (!scheduleId) {
        get().setLastError('スケジュールが選択されていません。');
        return null;
      }
      const preparedText = getAndPrepareJsonText();
      if (!preparedText.ok) {
        get().setLastError(preparedText.error);
        return null;
      }
      const response = await window.api.importApply(preparedText.text, source, scheduleId, mode);
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
      const scheduleId = get().currentScheduleId;
      if (!scheduleId) {
        get().setLastError('スケジュールが選択されていません。');
        return;
      }
      const response = await window.api.diffGet(scheduleId, importId);
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
      const scheduleId = get().currentScheduleId;
      if (!scheduleId) {
        get().setLastError('スケジュールが選択されていません。');
        return;
      }
      const response = await window.api.importsList(scheduleId);
      if (response.ok) {
        set({ imports: response.imports });
        get().setLastError(null);
      } else {
        get().setLastError(response.error);
      }
    }
  };
};
