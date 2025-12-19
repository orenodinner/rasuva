import { RawImportSchema } from './schema';
import { normalizeImport, parseDateStrict } from './normalize';
import { diffTasks } from './diff';
import type { RawImport } from './types';

export const parseImportJson = (jsonText: string) => {
  try {
    const parsed = JSON.parse(jsonText) as unknown;
    const result = RawImportSchema.safeParse(parsed);
    if (!result.success) {
      return {
        ok: false as const,
        error: 'Schema validation failed.',
        issues: result.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      };
    }

    return { ok: true as const, data: result.data as RawImport };
  } catch (error) {
    return {
      ok: false as const,
      error: 'Invalid JSON payload.',
      issues: [error instanceof Error ? error.message : 'Unknown JSON error']
    };
  }
};

export { normalizeImport, parseDateStrict, diffTasks };
export * from './types';
