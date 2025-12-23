import type {
  DiffResult,
  ImportApplyResult,
  ImportListItem,
  ImportPreviewResult,
  ScheduleItem,
  NormalizedTask,
  TaskUpdateInput,
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
      importExcel: () => Promise<
        ApiSuccess<{ preview: ImportPreviewResult; jsonText: string }> | ApiFailure
      >;
      importApply: (
        jsonText: string,
        source: 'paste' | 'file' | 'excel',
        scheduleId: number
      ) => Promise<ApiSuccess<{ result: ImportApplyResult }> | ApiFailure>;
      diffGet: (
        scheduleId: number,
        importId?: number
      ) => Promise<ApiSuccess<{ importId: number | null; diff: DiffResult }> | ApiFailure>;
      ganttQuery: (
        scheduleId: number,
        importId?: number
      ) => Promise<ApiSuccess<{ result: GanttQueryResult }> | ApiFailure>;
      schedulesList: () => Promise<ApiSuccess<{ schedules: ScheduleItem[] }> | ApiFailure>;
      schedulesCreate: (
        name: string
      ) => Promise<ApiSuccess<{ schedule: ScheduleItem }> | ApiFailure>;
      schedulesUpdate: (
        id: number,
        name: string
      ) => Promise<ApiSuccess<{ schedule: ScheduleItem }> | ApiFailure>;
      schedulesDelete: (
        id: number
      ) => Promise<ApiSuccess<{ deleted: boolean }> | ApiFailure>;
      importsList: (scheduleId: number) => Promise<ApiSuccess<{ imports: ImportListItem[] }> | ApiFailure>;
      viewsList: (scheduleId: number) => Promise<ApiSuccess<{ views: SavedViewItem[] }> | ApiFailure>;
      viewsSave: (
        scheduleId: number,
        name: string,
        state: SavedViewState
      ) => Promise<ApiSuccess<{ viewId: number }> | ApiFailure>;
      exportCsv: (scheduleId: number, importId?: number) => Promise<ApiSuccess<{ path: string }> | ApiFailure>;
      exportXlsx: (scheduleId: number, importId?: number) => Promise<ApiSuccess<{ path: string }> | ApiFailure>;
      taskUpdate: (
        input: TaskUpdateInput
      ) => Promise<ApiSuccess<{ task: NormalizedTask }> | ApiFailure>;
    };
  }
}

export {};
