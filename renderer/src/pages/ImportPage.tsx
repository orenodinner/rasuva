import { useEffect, useMemo, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const ImportPage = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const appendFileRef = useRef<HTMLInputElement>(null);
  const jsonText = useAppStore((state) => state.jsonText);
  const setJsonText = useAppStore((state) => state.setJsonText);
  const appendJsonText = useAppStore((state) => state.appendJsonText);
  const setImportSource = useAppStore((state) => state.setImportSource);
  const loadPreview = useAppStore((state) => state.loadPreview);
  const loadExcelImport = useAppStore((state) => state.loadExcelImport);
  const lastError = useAppStore((state) => state.lastError);
  const clearError = useAppStore((state) => state.clearError);
  const setLastError = useAppStore((state) => state.setLastError);

  useEffect(() => {
    const handler = () => fileRef.current?.click();
    window.addEventListener('app:open-file', handler as EventListener);
    return () => window.removeEventListener('app:open-file', handler as EventListener);
  }, []);

  const inputStats = useMemo(() => {
    const trimmed = jsonText.trim();
    const lineCount = jsonText.length === 0 ? 0 : jsonText.split(/\r\n|\r|\n/).length;
    let status = '未入力';

    if (trimmed.length > 0) {
      try {
        JSON.parse(trimmed);
        status = 'JSON OK';
      } catch {
        status = 'JSON要確認';
      }
    }

    return {
      chars: jsonText.length,
      lines: lineCount,
      status
    };
  }, [jsonText]);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setJsonText(text);
      setImportSource('file');
    };
    reader.readAsText(file);
  };

  const handleAppendFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    event.target.value = '';
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      appendJsonText(text);
      setImportSource('file');
    };
    reader.readAsText(file);
  };

  const handleAppendClipboard = async () => {
    clearError();
    if (!navigator.clipboard?.readText) {
      setLastError('クリップボードが利用できません。');
      return;
    }
    try {
      const text = await navigator.clipboard.readText();
      if (!text) {
        setLastError('クリップボードが空です。');
        return;
      }
      appendJsonText(text);
      setImportSource('paste');
    } catch (error) {
      console.error('Failed to read clipboard.', error);
      setLastError('クリップボードの読み取りに失敗しました。');
    }
  };

  const handlePreview = async () => {
    clearError();
    const ok = await loadPreview();
    if (ok) {
      navigate('/preview');
    }
  };

  const handleExcelImport = async () => {
    clearError();
    const ok = await loadExcelImport();
    if (ok) {
      navigate('/preview');
    }
  };

  const handleFormatJson = () => {
    clearError();
    const trimmed = jsonText.trim();
    if (!trimmed) {
      setLastError('整形する JSON がありません。');
      return;
    }
    try {
      setJsonText(JSON.stringify(JSON.parse(trimmed), null, 2));
      setImportSource('paste');
    } catch {
      setLastError('JSON として整形できません。日付やカンマの抜けを確認してください。');
    }
  };

  const statusClass =
    inputStats.status === 'JSON OK'
      ? 'json-status--ok'
      : inputStats.status === 'JSON要確認'
        ? 'json-status--warn'
        : 'json-status--empty';

  return (
    <div className="page">
      <div className="page-header">
        <h1>インポート</h1>
        <p>JSON を貼り付けるか、ファイル（JSON/Excel）を読み込みます。</p>
      </div>
      <div className="import-panel">
        <div className="import-actions import-actions--sources">
          <button className="cmd-button" type="button" onClick={() => fileRef.current?.click()}>
            JSONファイルを選択
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="file-input"
            onChange={handleFileChange}
          />
          <button
            className="cmd-button cmd-button--ghost"
            type="button"
            onClick={() => appendFileRef.current?.click()}
          >
            ファイルを追加
          </button>
          <input
            ref={appendFileRef}
            type="file"
            accept="application/json,.json"
            className="file-input"
            onChange={handleAppendFileChange}
          />
          <button
            className="cmd-button cmd-button--ghost"
            type="button"
            onClick={handleAppendClipboard}
          >
            クリップボードから追記
          </button>
          <button
            className="cmd-button cmd-button--ghost"
            type="button"
            onClick={handleExcelImport}
          >
            Excelからインポート
          </button>
        </div>
        <div className="json-workspace">
          <div className="json-editor-card">
            <div className="json-input-toolbar">
              <div>
                <h2>JSON入力</h2>
                <p>日付は YYYY-MM-DD、未確定は start/end を null にします。</p>
              </div>
              <div className="json-input-actions">
                <span className={`json-status ${statusClass}`}>{inputStats.status}</span>
                <span className="json-meta">
                  {inputStats.lines}行 / {inputStats.chars}文字
                </span>
                <button
                  className="cmd-button cmd-button--ghost"
                  type="button"
                  onClick={handleFormatJson}
                >
                  整形
                </button>
                <button className="cmd-button" type="button" onClick={handlePreview}>
                  プレビュー
                </button>
              </div>
            </div>
            <textarea
              className="json-input"
              placeholder={`ここに JSON を貼り付けてください...\n例: start/end は "2026-06-03"、日程未確定は null`}
              value={jsonText}
              onChange={(event) => {
                setJsonText(event.target.value);
                setImportSource('paste');
              }}
            />
          </div>
          <aside className="import-tips" aria-label="日程入力の注意点">
            <h2>日程入力の見方</h2>
            <div className="import-tip">
              <strong>予定あり</strong>
              <span>start と end の両方に YYYY-MM-DD を入れるとガントに表示されます。</span>
            </div>
            <div className="import-tip">
              <strong>1日タスク</strong>
              <span>start と end を同じ日付にします。</span>
            </div>
            <div className="import-tip">
              <strong>未確定</strong>
              <span>start/end を null にすると未確定一覧からあとで配置できます。</span>
            </div>
            <div className="import-tip">
              <strong>複数担当</strong>
              <span>assign に名前を入れると同じタスクが複数担当者の行に出ます。</span>
            </div>
          </aside>
        </div>
      </div>
      {lastError ? <div className="alert">{lastError}</div> : null}
    </div>
  );
};

export default ImportPage;
