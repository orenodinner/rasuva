import { useEffect, useMemo, useState, type FormEvent } from 'react';

type TaskCreateMode = 'project' | 'task';

type TaskCreateInput = {
  projectId: string;
  projectGroup: string | null;
  taskName: string;
  memberName: string;
  allowExistingProjectId?: boolean;
};

type TaskCreateModalProps = {
  isOpen: boolean;
  mode: TaskCreateMode;
  projectId?: string | null;
  projectGroup?: string | null;
  existingProjectIds?: string[];
  errorMessage: string | null;
  onClearError: () => void;
  onClose: () => void;
  onCreate: (input: TaskCreateInput) => Promise<boolean>;
};

const DEFAULT_TASK_NAME = 'General';
const DEFAULT_MEMBER_NAME = '未割り当て';

const TaskCreateModal = ({
  isOpen,
  mode,
  projectId: fixedProjectId,
  projectGroup: fixedProjectGroup,
  existingProjectIds,
  errorMessage,
  onClearError,
  onClose,
  onCreate
}: TaskCreateModalProps) => {
  const isProjectMode = mode === 'project';
  const [projectIdInput, setProjectIdInput] = useState('');
  const [projectGroupInput, setProjectGroupInput] = useState('');
  const [taskName, setTaskName] = useState(DEFAULT_TASK_NAME);
  const [memberName, setMemberName] = useState(DEFAULT_MEMBER_NAME);
  const [localError, setLocalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const existingIds = useMemo(() => {
    return new Set(
      (existingProjectIds ?? []).map((id) => id.trim()).filter((id) => id.length > 0)
    );
  }, [existingProjectIds]);

  const trimmedProjectId = isProjectMode
    ? projectIdInput.trim()
    : (fixedProjectId ?? '').trim();
  const trimmedTaskName = taskName.trim();
  const trimmedMemberName = memberName.trim();
  const trimmedGroup = projectGroupInput.trim();
  const isDuplicate =
    isProjectMode && trimmedProjectId.length > 0 && existingIds.has(trimmedProjectId);
  const resolvedProjectGroup = isProjectMode
    ? trimmedGroup.length > 0
      ? trimmedGroup
      : null
    : fixedProjectGroup ?? null;
  const displayError = errorMessage ?? localError;

  useEffect(() => {
    if (!isOpen) {
      return;
    }
    setProjectIdInput('');
    setProjectGroupInput('');
    setTaskName(isProjectMode ? DEFAULT_TASK_NAME : '');
    setMemberName(DEFAULT_MEMBER_NAME);
    setLocalError(null);
    onClearError();
  }, [isOpen, isProjectMode, onClearError]);

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
      setLocalError(
        isProjectMode
          ? 'プロジェクトIDを入力してください。'
          : '対象プロジェクトが選択されていません。'
      );
      return;
    }
    if (isDuplicate) {
      setLocalError('同じプロジェクトIDが既に存在します。');
      return;
    }
    if (!trimmedTaskName) {
      setLocalError(isProjectMode ? '初期タスク名を入力してください。' : 'タスク名を入力してください。');
      return;
    }
    if (!isProjectMode && !trimmedMemberName) {
      setLocalError('担当者を入力してください。');
      return;
    }

    setIsSubmitting(true);
    try {
      const ok = await onCreate({
        projectId: trimmedProjectId,
        projectGroup: resolvedProjectGroup,
        taskName: trimmedTaskName,
        memberName: isProjectMode ? DEFAULT_MEMBER_NAME : trimmedMemberName,
        allowExistingProjectId: !isProjectMode
      });
      if (!ok && !errorMessage) {
        setLocalError(
          isProjectMode ? 'プロジェクトの作成に失敗しました。' : 'タスクの追加に失敗しました。'
        );
      }
    } catch (error) {
      console.error(error);
      setLocalError(
        isProjectMode ? 'プロジェクトの作成に失敗しました。' : 'タスクの追加に失敗しました。'
      );
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
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="task-create-title"
      >
        <div className="modal-header">
          <h2 id="task-create-title" className="modal-title">
            {isProjectMode ? '新規プロジェクト' : 'タスクを追加'}
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
            <label htmlFor="task-create-project-id">
              {isProjectMode ? 'プロジェクトID *' : 'プロジェクトID'}
            </label>
            <input
              id="task-create-project-id"
              className="text-input"
              type="text"
              value={isProjectMode ? projectIdInput : trimmedProjectId}
              onChange={
                isProjectMode
                  ? (event) => {
                      setProjectIdInput(event.target.value);
                      clearErrors();
                    }
                  : undefined
              }
              readOnly={!isProjectMode}
              disabled={!isProjectMode}
              placeholder="例: PJ-001"
              autoFocus={isProjectMode}
            />
            {isDuplicate ? (
              <span className="modal-hint" role="status">
                同じプロジェクトIDが既に存在します。
              </span>
            ) : null}
          </div>

          {isProjectMode ? (
            <div className="modal-field">
              <label htmlFor="task-create-group">グループ (任意)</label>
              <input
                id="task-create-group"
                className="text-input"
                type="text"
                value={projectGroupInput}
                onChange={(event) => {
                  setProjectGroupInput(event.target.value);
                  clearErrors();
                }}
                placeholder="例: 営業企画"
              />
            </div>
          ) : (
            <div className="modal-field">
              <label htmlFor="task-create-group">グループ</label>
              <input
                id="task-create-group"
                className="text-input"
                type="text"
                value={resolvedProjectGroup ?? '未設定'}
                readOnly
                disabled
              />
            </div>
          )}

          <div className="modal-field">
            <label htmlFor="task-create-name">
              {isProjectMode ? '初期タスク名 *' : 'タスク名 *'}
            </label>
            <input
              id="task-create-name"
              className="text-input"
              type="text"
              value={taskName}
              onChange={(event) => {
                setTaskName(event.target.value);
                clearErrors();
              }}
              placeholder={isProjectMode ? DEFAULT_TASK_NAME : '例: 新規タスク'}
              autoFocus={!isProjectMode}
            />
            {isProjectMode ? (
              <span className="modal-hint">
                作成時にこのタスクを1件追加してプロジェクトを初期化します。
              </span>
            ) : null}
          </div>

          {!isProjectMode ? (
            <div className="modal-field">
              <label htmlFor="task-create-member">担当者 *</label>
              <input
                id="task-create-member"
                className="text-input"
                type="text"
                value={memberName}
                onChange={(event) => {
                  setMemberName(event.target.value);
                  clearErrors();
                }}
                placeholder={DEFAULT_MEMBER_NAME}
              />
            </div>
          ) : null}

          {displayError ? (
            <div className="alert" role="alert">
              {displayError}
            </div>
          ) : null}

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

export default TaskCreateModal;
