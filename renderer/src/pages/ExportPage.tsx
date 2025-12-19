import { useState } from 'react';
import { useAppStore } from '../state/store';

const ExportPage = () => {
  const [message, setMessage] = useState<string | null>(null);
  const gantt = useAppStore((state) => state.gantt);

  const handleExport = async () => {
    const response = await window.api.exportCsv(gantt?.importId ?? undefined);
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
        <p>最新インポートを CSV で出力します。</p>
      </div>
      <button className="cmd-button" onClick={handleExport}>
        CSV をエクスポート
      </button>
      {message ? <div className="alert">{message}</div> : null}
    </div>
  );
};

export default ExportPage;
