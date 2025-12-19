import { useState } from 'react';
import { useAppStore } from '../state/store';

const ExportPage = () => {
  const [message, setMessage] = useState<string | null>(null);
  const gantt = useAppStore((state) => state.gantt);

  const handleExport = async () => {
    const response = await window.api.exportCsv(gantt?.importId ?? undefined);
    if (response.ok) {
      setMessage(`Saved to ${response.path}`);
    } else {
      setMessage(response.error);
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Export</h1>
        <p>Export the latest import as CSV.</p>
      </div>
      <button className="cmd-button" onClick={handleExport}>
        Export CSV
      </button>
      {message ? <div className="alert">{message}</div> : null}
    </div>
  );
};

export default ExportPage;
