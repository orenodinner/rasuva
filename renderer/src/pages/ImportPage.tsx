import { useEffect, useRef } from 'react';
import type { ChangeEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppStore } from '../state/store';

const ImportPage = () => {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonText = useAppStore((state) => state.jsonText);
  const setJsonText = useAppStore((state) => state.setJsonText);
  const setImportSource = useAppStore((state) => state.setImportSource);
  const loadPreview = useAppStore((state) => state.loadPreview);
  const lastError = useAppStore((state) => state.lastError);
  const clearError = useAppStore((state) => state.clearError);

  useEffect(() => {
    const handler = () => fileRef.current?.click();
    window.addEventListener('app:open-file', handler as EventListener);
    return () => window.removeEventListener('app:open-file', handler as EventListener);
  }, []);

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const text = typeof reader.result === 'string' ? reader.result : '';
      setJsonText(text);
      setImportSource('file');
    };
    reader.readAsText(file);
  };

  const handlePreview = async () => {
    clearError();
    const ok = await loadPreview();
    if (ok) {
      navigate('/preview');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>インポート</h1>
        <p>JSON を貼り付けるか、ファイルを読み込みます。</p>
      </div>
      <div className="import-actions">
        <button className="cmd-button" onClick={() => fileRef.current?.click()}>
          JSONファイルを選択
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="file-input"
          onChange={handleFileChange}
        />
        <button className="cmd-button cmd-button--ghost" onClick={handlePreview}>
          プレビュー
        </button>
      </div>
      <textarea
        className="json-input"
        placeholder="ここに JSON を貼り付けてください..."
        value={jsonText}
        onChange={(event) => {
          setJsonText(event.target.value);
          setImportSource('paste');
        }}
      />
      {lastError ? <div className="alert">{lastError}</div> : null}
    </div>
  );
};

export default ImportPage;
