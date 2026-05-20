import { useEffect, useMemo, useState } from 'react';
import {
  createDefaultPromptTemplate,
  createPromptTemplate,
  loadPromptTemplates,
  savePromptTemplates
} from '../utils/promptTemplates';
import type { PromptTemplate } from '../utils/promptTemplates';

const getNow = () => new Date().toISOString();

const PromptTemplatesPage = () => {
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [selectedId, setSelectedId] = useState('');
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const loaded = loadPromptTemplates();
    setTemplates(loaded);
    setSelectedId(loaded[0]?.id ?? '');
  }, []);

  const selectedTemplate = useMemo(
    () => templates.find((template) => template.id === selectedId) ?? templates[0],
    [selectedId, templates]
  );

  const persistTemplates = (nextTemplates: PromptTemplate[], nextSelectedId = selectedId) => {
    savePromptTemplates(nextTemplates);
    setTemplates(nextTemplates);
    setSelectedId(nextSelectedId);
  };

  const updateSelectedTemplate = (patch: Partial<Pick<PromptTemplate, 'title' | 'body'>>) => {
    if (!selectedTemplate) {
      return;
    }
    const updatedAt = getNow();
    setTemplates((current) =>
      current.map((template) =>
        template.id === selectedTemplate.id ? { ...template, ...patch, updatedAt } : template
      )
    );
    setMessage(null);
  };

  const handleSave = () => {
    const cleaned = templates
      .map((template) => ({
        ...template,
        title: template.title.trim(),
        body: template.body
      }))
      .filter((template) => template.title && template.body.trim());

    if (cleaned.length === 0) {
      const fallback = createDefaultPromptTemplate(getNow());
      persistTemplates([fallback], fallback.id);
      setMessage('空のため初期テンプレートを保存しました。');
      return;
    }

    persistTemplates(
      cleaned,
      cleaned.some((template) => template.id === selectedId) ? selectedId : cleaned[0].id
    );
    setMessage('定型文を保存しました。');
  };

  const handleAdd = () => {
    const now = getNow();
    const template = createPromptTemplate('新しい定型文', '', now);
    const next = [template, ...templates];
    persistTemplates(next, template.id);
    setMessage('新しい定型文を追加しました。本文を入力して保存してください。');
  };

  const handleRestoreDefault = () => {
    const template = createDefaultPromptTemplate(getNow());
    const next = [template, ...templates.filter((current) => current.id !== template.id)];
    persistTemplates(next, template.id);
    setMessage('Rasuva JSON生成テンプレートを復元しました。');
  };

  const handleDelete = () => {
    if (!selectedTemplate) {
      return;
    }
    if (templates.length <= 1) {
      setMessage('最後の定型文は削除できません。');
      return;
    }
    const ok = window.confirm(`定型文「${selectedTemplate.title}」を削除しますか？`);
    if (!ok) {
      return;
    }
    const next = templates.filter((template) => template.id !== selectedTemplate.id);
    persistTemplates(next, next[0]?.id ?? '');
    setMessage('定型文を削除しました。');
  };

  const handleCopy = async () => {
    if (!selectedTemplate) {
      return;
    }
    if (!navigator.clipboard?.writeText) {
      setMessage('クリップボードが利用できません。');
      return;
    }
    try {
      await navigator.clipboard.writeText(selectedTemplate.body);
      setMessage('定型文をクリップボードへコピーしました。');
    } catch (error) {
      console.error('Failed to copy prompt template.', error);
      setMessage('コピーに失敗しました。');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>AI定型文</h1>
        <p>JSON インポート用のプロンプトをローカルに保存します。</p>
      </div>

      <div className="prompt-template-layout">
        <aside className="prompt-template-list" aria-label="定型文一覧">
          <div className="prompt-template-list__header">
            <h2>定型文</h2>
            <button className="cmd-button" type="button" onClick={handleAdd}>
              追加
            </button>
          </div>
          <div className="list">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={
                  template.id === selectedTemplate?.id
                    ? 'list-row list-row--active prompt-template-item'
                    : 'list-row prompt-template-item'
                }
                onClick={() => setSelectedId(template.id)}
              >
                <div>
                  <div className="list-title">{template.title}</div>
                  <div className="list-subtitle">更新 {template.updatedAt}</div>
                </div>
              </button>
            ))}
          </div>
        </aside>

        <section className="prompt-template-editor" aria-label="定型文編集">
          {selectedTemplate ? (
            <>
              <div className="prompt-template-editor__header">
                <div>
                  <h2>編集</h2>
                  <p>AI に貼り付ける文章を保存しておきます。</p>
                </div>
                <div className="prompt-template-actions">
                  <button
                    className="cmd-button cmd-button--ghost"
                    type="button"
                    onClick={handleRestoreDefault}
                  >
                    初期テンプレートを復元
                  </button>
                  <button
                    className="cmd-button cmd-button--ghost"
                    type="button"
                    onClick={handleCopy}
                  >
                    コピー
                  </button>
                  <button className="cmd-button" type="button" onClick={handleSave}>
                    保存
                  </button>
                  <button
                    className="cmd-button cmd-button--danger"
                    type="button"
                    onClick={handleDelete}
                  >
                    削除
                  </button>
                </div>
              </div>
              <label className="field">
                <span>名前</span>
                <input
                  className="text-input"
                  value={selectedTemplate.title}
                  onChange={(event) => updateSelectedTemplate({ title: event.target.value })}
                />
              </label>
              <label className="field">
                <span>本文</span>
                <textarea
                  className="prompt-template-textarea"
                  value={selectedTemplate.body}
                  onChange={(event) => updateSelectedTemplate({ body: event.target.value })}
                  placeholder="AI に入力する定型文"
                />
              </label>
              {message ? <div className="alert">{message}</div> : null}
            </>
          ) : (
            <div className="empty-state">定型文がありません。</div>
          )}
        </section>
      </div>
    </div>
  );
};

export default PromptTemplatesPage;
