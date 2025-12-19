import type {
  DiffResult,
  ImportApplyResult,
  ImportListItem,
  ImportPreviewResult,
  SavedViewItem,
  SavedViewState,
  GanttQueryResult
} from '@domain';

type ApiFailure = { ok: false; error: string; issues?: string[] };

type ApiSuccess<T> = { ok: true } & T;

declare global {
  interface Window {
    api: {
      importPreview: (jsonText: string) => Promise<ApiSuccess<{ preview: ImportPreviewResult }> | ApiFailure>;
      importApply: (
        jsonText: string,
        source: 'paste' | 'file'
      ) => Promise<ApiSuccess<{ result: ImportApplyResult }> | ApiFailure>;
      diffGet: (
        importId?: number
      ) => Promise<ApiSuccess<{ importId: number | null; diff: DiffResult }> | ApiFailure>;
      ganttQuery: (
        importId?: number
      ) => Promise<ApiSuccess<{ result: GanttQueryResult }> | ApiFailure>;
      importsList: () => Promise<ApiSuccess<{ imports: ImportListItem[] }> | ApiFailure>;
      viewsList: () => Promise<ApiSuccess<{ views: SavedViewItem[] }> | ApiFailure>;
      viewsSave: (
        name: string,
        state: SavedViewState
      ) => Promise<ApiSuccess<{ viewId: number }> | ApiFailure>;
      exportCsv: (importId?: number) => Promise<ApiSuccess<{ path: string }> | ApiFailure>;
      exportXlsx: (importId?: number) => Promise<ApiSuccess<{ path: string }> | ApiFailure>;
      taskUpdate: (
        importId: number | undefined,
        taskKeyFull: string,
        start: string | null,
        end: string | null,
        note: string | null
      ) => Promise<ApiSuccess<{ task: NormalizedTask }> | ApiFailure>;
    };
  }
}

export {};
