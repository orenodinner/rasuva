import { useEffect, useMemo, useState, type FormEvent } from 'react';

type ProjectCreateInput = {
  projectId: string;
  projectGroup: string | null;
  taskName: string;
};

type ProjectCreateModalProps = {
  isOpen: boolean;
  existingProjectIds: string[];
  errorMessage: string | null;
  onClearError: () => void;
  onClose: () => void;
  onCreate: (input: ProjectCreateInput) => Promise<boolean>;
};

const DEFAULT_TASK_NAME = 'General';

const ProjectCreateModal = ({
  isOpen,
  existingProjectIds,
  errorMessage,
  onClearError,
  onClose,
  onCreate
}: ProjectCreateModalProps) => {
  const [projectId, setProjectId] = useState('');
  const [projectGroup, setProjectGroup] = useState('');
  const [taskName, setTaskName] = useState(DEFAULT_TASK_NAME);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingIds = useMemo(() => {
    return new Set(existingProjectIds.map((id) => id.trim()).filter((id) => id.length > 0));
  }, [existingProjectIds]);

  const trimmedProjectId = projectId.trim();
  const trimmedTaskName = taskName.trim();
  const trimmedGroup = projectGroup.trim();
  const isDuplicate = trimmedProjectId.length > 0 && existingIds.has(trimmedProjectId);

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setProjectId('');
    setProjectGroup('');
    setTaskName(DEFAULT_TASK_NAME);
    setLocalError(null);
    onClearError();
  }, [isOpen, onClearError]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return undefined;
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !isSubmitting) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isSubmitting, onClose]);

  const clearErrors = () => {
    if (localError) {
      setLocalError(null);
    }
    if (errorMessage) {
      onClearError();
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    clearErrors();

    if (!trimmedProjectId) {
      setLocalError('プロジェクトIDを入力してください。');
      return;
    }
    if (isDuplicate) {
      setLocalError('同じプロジェクトIDが既に存在します。');
      return;
    }
    if (!trimmedTaskName) {
      setLocalError('初期タスク名を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      await onCreate({
        projectId: trimmedProjectId,
        projectGroup: trimmedGroup.length > 0 ? trimmedGroup : null,
        taskName: trimmedTaskName
      });
    } catch (error) {
      console.error(error);
      setLocalError('プロジェクトの作成に失敗しました。');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !isSubmitting) {
          onClose();
        }
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="project-create-title">
        <div className="modal-header">
          <h2 id="project-create-title" className="modal-title">
            新規プロジェクト
          </h2>
          <button
            type="button"
            className="cmd-button cmd-button--ghost"
            onClick={onClose}
            disabled={isSubmitting}
          >
            閉じる
          </button>
        </div>

        <form className="modal-body" onSubmit={handleSubmit}>
          <div className="modal-field">
            <label htmlFor="project-create-id">プロジェクトID *</label>
            <input
              id="project-create-id"
              className="text-input"
              type="text"
              value={projectId}
              onChange={(event) => {
                setProjectId(event.target.value);
                clearErrors();
              }}
              placeholder="例: PJ-001"
              autoFocus
            />
            {isDuplicate && (
              <span className="modal-hint" role="status">
                同じプロジェクトIDが既に存在します。
              </span>
            )}
          </div>

          <div className="modal-field">
            <label htmlFor="project-create-group">グループ (任意)</label>
            <input
              id="project-create-group"
              className="text-input"
              type="text"
              value={projectGroup}
              onChange={(event) => {
                setProjectGroup(event.target.value);
                clearErrors();
              }}
              placeholder="例: 営業企画"
            />
          </div>

          <div className="modal-field">
            <label htmlFor="project-create-task">初期タスク名 *</label>
            <input
              id="project-create-task"
              className="text-input"
              type="text"
              value={taskName}
              onChange={(event) => {
                setTaskName(event.target.value);
                clearErrors();
              }}
              placeholder={DEFAULT_TASK_NAME}
            />
            <span className="modal-hint">
              作成時にこのタスクを1件追加してプロジェクトを初期化します。
            </span>
          </div>

          {(localError || errorMessage) && (
            <div className="alert" role="alert">
              {localError ?? errorMessage}
            </div>
          )}

          <div className="modal-actions">
            <button
              type="button"
              className="cmd-button cmd-button--ghost"
              onClick={onClose}
              disabled={isSubmitting}
            >
              キャンセル
            </button>
            <button type="submit" className="cmd-button" disabled={isSubmitting}>
              {isSubmitting ? '作成中...' : '作成する'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProjectCreateModal;
