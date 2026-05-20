export type PromptTemplate = {
  id: string;
  title: string;
  body: string;
  updatedAt: string;
};

export type PromptTemplateStorage = Pick<Storage, 'getItem' | 'setItem'>;

export const PROMPT_TEMPLATES_STORAGE_KEY = 'rasuva.promptTemplates.v1';
export const DEFAULT_PROMPT_TEMPLATE_ID = 'json-import-contract';

export const DEFAULT_PROMPT_TEMPLATE_BODY = `次の要件に沿って、Rasuva にインポートできる JSON だけを出力してください。

- 返答は JSON オブジェクトのみ。Markdown のコードフェンスや説明文は付けない。
- ルートは members 配列。
- members[].name は担当者名。
- members[].projects[].project_id はプロジェクト ID。
- members[].projects[].group はプロジェクトグループ名。
- members[].projects[].tasks[].task_name はタスク名。
- 日付が決まっている場合は start/end を YYYY-MM-DD で入れる。
- 日程未確定の場合は start と end を null にする。
- 元資料の日付表記は raw_date に残す。
- 補足や注意点は note に入れる。
- 複数担当がある場合は assign に担当者名の配列を入れる。

期待する形式:
{
  "members": [
    {
      "name": "担当者名",
      "projects": [
        {
          "project_id": "PROJECT-001",
          "group": "グループ名",
          "tasks": [
            {
              "task_name": "タスク名",
              "start": "2026-06-01",
              "end": "2026-06-03",
              "raw_date": "6/1〜6/3",
              "note": "補足",
              "assign": ["別担当者"]
            }
          ]
        }
      ]
    }
  ]
}

以下の素材をこの形式に変換してください。`;

const nowIso = () => new Date().toISOString();

export const createDefaultPromptTemplate = (updatedAt: string = nowIso()): PromptTemplate => ({
  id: DEFAULT_PROMPT_TEMPLATE_ID,
  title: 'Rasuva JSON生成',
  body: DEFAULT_PROMPT_TEMPLATE_BODY,
  updatedAt
});

export const createPromptTemplate = (
  title: string,
  body: string,
  updatedAt: string = nowIso()
): PromptTemplate => ({
  id: `prompt-${updatedAt.replace(/[^0-9]/g, '')}`,
  title,
  body,
  updatedAt
});

export const normalizePromptTemplates = (
  value: unknown,
  fallbackUpdatedAt: string = nowIso()
): PromptTemplate[] => {
  if (!Array.isArray(value)) {
    return [createDefaultPromptTemplate(fallbackUpdatedAt)];
  }

  const templates = value
    .map((entry): PromptTemplate | null => {
      if (!entry || typeof entry !== 'object') {
        return null;
      }
      const candidate = entry as Partial<Record<keyof PromptTemplate, unknown>>;
      const id = typeof candidate.id === 'string' ? candidate.id.trim() : '';
      const title = typeof candidate.title === 'string' ? candidate.title.trim() : '';
      const body = typeof candidate.body === 'string' ? candidate.body : '';
      const updatedAt =
        typeof candidate.updatedAt === 'string' && candidate.updatedAt.trim()
          ? candidate.updatedAt
          : fallbackUpdatedAt;

      if (!id || !title || !body.trim()) {
        return null;
      }

      return { id, title, body, updatedAt };
    })
    .filter((entry): entry is PromptTemplate => entry !== null);

  return templates.length > 0 ? templates : [createDefaultPromptTemplate(fallbackUpdatedAt)];
};

export const loadPromptTemplates = (
  storage: PromptTemplateStorage = window.localStorage,
  fallbackUpdatedAt: string = nowIso()
): PromptTemplate[] => {
  try {
    const raw = storage.getItem(PROMPT_TEMPLATES_STORAGE_KEY);
    if (!raw) {
      return [createDefaultPromptTemplate(fallbackUpdatedAt)];
    }
    return normalizePromptTemplates(JSON.parse(raw), fallbackUpdatedAt);
  } catch {
    return [createDefaultPromptTemplate(fallbackUpdatedAt)];
  }
};

export const savePromptTemplates = (
  templates: PromptTemplate[],
  storage: PromptTemplateStorage = window.localStorage
) => {
  storage.setItem(PROMPT_TEMPLATES_STORAGE_KEY, JSON.stringify(templates));
};
