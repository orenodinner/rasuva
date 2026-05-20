import { describe, expect, it } from 'vitest';
import {
  DEFAULT_PROMPT_TEMPLATE_ID,
  PROMPT_TEMPLATES_STORAGE_KEY,
  createDefaultPromptTemplate,
  createPromptTemplate,
  loadPromptTemplates,
  normalizePromptTemplates,
  savePromptTemplates
} from './promptTemplates';

const makeStorage = (initial: Record<string, string> = {}) => {
  const data = { ...initial };
  return {
    getItem: (key: string) => data[key] ?? null,
    setItem: (key: string, value: string) => {
      data[key] = value;
    },
    data
  };
};

describe('prompt template persistence', () => {
  it('returns the default template when storage is empty', () => {
    const templates = loadPromptTemplates(makeStorage(), '2026-05-20T00:00:00.000Z');

    expect(templates).toHaveLength(1);
    expect(templates[0].id).toBe(DEFAULT_PROMPT_TEMPLATE_ID);
    expect(templates[0].body).toContain('members');
  });

  it('filters broken entries and keeps valid templates', () => {
    const templates = normalizePromptTemplates(
      [
        { id: 'ok', title: 'OK', body: '本文', updatedAt: '2026-05-20T00:00:00.000Z' },
        { id: 'blank-body', title: 'No body', body: '   ' },
        { id: '', title: 'No id', body: '本文' },
        null
      ],
      '2026-05-20T00:00:00.000Z'
    );

    expect(templates).toEqual([
      { id: 'ok', title: 'OK', body: '本文', updatedAt: '2026-05-20T00:00:00.000Z' }
    ]);
  });

  it('falls back to the default template when stored JSON is invalid', () => {
    const storage = makeStorage({ [PROMPT_TEMPLATES_STORAGE_KEY]: '{not json' });
    const templates = loadPromptTemplates(storage, '2026-05-20T00:00:00.000Z');

    expect(templates).toEqual([createDefaultPromptTemplate('2026-05-20T00:00:00.000Z')]);
  });

  it('saves and reloads user templates', () => {
    const storage = makeStorage();
    const template = createPromptTemplate(
      '議事録からJSON',
      'Rasuva JSONにして',
      '2026-05-20T00:00:00.000Z'
    );

    savePromptTemplates([template], storage);

    expect(loadPromptTemplates(storage)).toEqual([template]);
  });
});
