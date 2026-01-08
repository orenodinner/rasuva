import { RawImportSchema } from './schema';
import { convertFlatTasksToRawImport, normalizeImport, parseDateStrict } from './normalize';
import { convertNormalizedTasksToRawImport } from './denormalize';
import { diffTasks } from './diff';
import { flattenTasksByMember, generateTimelineStructure } from './exportUtils';
import { generateNormalizedTasks } from './generate';
import { mergeTasksForSave, summarizeTasksForImport } from './merge';
import type { RawImport } from './types';

export const parseImportJson = (jsonText: string) => {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const result = RawImportSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false as const,
        error: 'スキーマ検証に失敗しました。',
        issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      };
    }

    return { ok: true as const, data: result.data as RawImport };
  } catch (error) {
    return {
      ok: false as const,
      error: 'JSON が不正です。',
      issues: [error instanceof Error ? error.message : '不明な JSON エラー']
    };
  }
};

export {
  convertFlatTasksToRawImport,
  convertNormalizedTasksToRawImport,
  normalizeImport,
  parseDateStrict,
  diffTasks,
  flattenTasksByMember,
  generateTimelineStructure,
  generateNormalizedTasks,
  mergeTasksForSave,
  summarizeTasksForImport
};
export { RawImportSchema, TaskCreateSchema } from './schema';
export { extractJsonFromText } from './extract';
export * from './types';
