import { useEffect, useRef, type KeyboardEvent } from 'react';
import { useAppStore } from '../state/store';

const ConfirmDialog = () => {
  const confirmDialog = useAppStore((state) => state.confirmDialog);
  const resolveConfirmDialog = useAppStore((state) => state.resolveConfirmDialog);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmDialog.isOpen) {
      return;
    }
    const rafId = requestAnimationFrame(() => {
      cancelButtonRef.current?.focus();
    });
    return () => cancelAnimationFrame(rafId);
  }, [confirmDialog.isOpen]);

  if (!confirmDialog.isOpen) {
    return null;
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      resolveConfirmDialog(false);
    }
    if (event.key === 'Enter') {
      event.preventDefault();
      resolveConfirmDialog(true);
    }
  };

  return (
    <div
      className="modal-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          resolveConfirmDialog(false);
        }
      }}
    >
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="確認"
        onKeyDown={handleKeyDown}
      >
        <div className="modal-body">
          <p>{confirmDialog.message}</p>
        </div>
        <div className="modal-actions">
          <button
            type="button"
            className="cmd-button cmd-button--ghost"
            onClick={() => resolveConfirmDialog(false)}
            ref={cancelButtonRef}
          >
            {confirmDialog.cancelLabel}
          </button>
          <button
            type="button"
            className="cmd-button"
            onClick={() => resolveConfirmDialog(true)}
          >
            {confirmDialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
