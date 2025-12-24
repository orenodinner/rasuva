import { useState } from 'react';
import { useAppStore } from '../state/store';

const ExportPage = () => {
  const [message, setMessage] = useState<string | null>(null);
  const gantt = useAppStore((state) => state.gantt);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);

  const handleExportCsv = async () => {
    if (!currentScheduleId) {
      setMessage('スケジュールが選択されていません。');
      return;
    }
    const response = await window.api.exportCsv(currentScheduleId, gantt?.importId ?? undefined);
    if (response.ok) {
      setMessage(`保存先: ${response.path}`);
    } else {
      setMessage(response.error);
    }
  };

  const handleExportXlsx = async () => {
    if (!currentScheduleId) {
      setMessage('スケジュールが選択されていません。');
      return;
    }
    const response = await window.api.exportXlsx(currentScheduleId, gantt?.importId ?? undefined);
    if (response.ok) {
      setMessage(`保存先: ${response.path}`);
    } else {
      setMessage(response.error);
    }
  };

  const handleExportJson = async () => {
    if (!currentScheduleId) {
      setMessage('スケジュールが選択されていません。');
      return;
    }
    const response = await window.api.exportJson(currentScheduleId, gantt?.importId ?? undefined);
    if (response.ok) {
      setMessage(`保存先: ${response.path}`);
    } else {
      setMessage(response.error);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>エクスポート</h1>
        <p>最新インポートを CSV / Excel / JSON で出力します。</p>
      </div>
      <div className="export-actions">
        <button className="cmd-button" onClick={handleExportCsv}>
          CSV をエクスポート
        </button>
        <button className="cmd-button cmd-button--ghost" onClick={handleExportXlsx}>
          Excel をエクスポート
        </button>
        <button className="cmd-button cmd-button--ghost" onClick={handleExportJson}>
          JSON をエクスポート
        </button>
      </div>
      {message ? <div className="alert">{message}</div> : null}
    </div>
  );
};

export default ExportPage;
