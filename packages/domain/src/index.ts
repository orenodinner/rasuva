import { RawImportSchema } from './schema';
import { convertFlatTasksToRawImport, normalizeImport, parseDateStrict } from './normalize';
import { diffTasks } from './diff';
import { generateNormalizedTasks } from './generate';
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

export { convertFlatTasksToRawImport, normalizeImport, parseDateStrict, diffTasks, generateNormalizedTasks };
export * from './types';
