import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NormalizedTask } from '@domain';
import TaskCreateModal from '../components/TaskCreateModal';
import TaskList from '../components/TaskList';
import { useAppStore } from '../state/store';
import {
  buildProjectStats,
  clampSplit,
  SPLITTER_HEIGHT,
  type ProjectStat
} from '../utils/projectStats';

const ProjectsPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const createTask = useAppStore((state) => state.createTask);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const openTaskCreateModal = useAppStore((state) => state.openTaskCreateModal);
  const currentScheduleId = useAppStore((state) => state.currentScheduleId);
  const currentImportId = useAppStore((state) => state.currentImportId);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [topHeight, setTopHeight] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!gantt) {
      loadGantt();
    }
  }, [gantt, loadGantt]);

  const projects = useMemo(() => {
    if (!gantt) {
      return [] as ProjectStat[];
    }
    return buildProjectStats(gantt.tasks);
  }, [gantt]);

  const filteredProjects = useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) {
      return projects;
    }
    return projects.filter((project) => {
      const group = project.group ?? '';
      return (
        project.projectId.toLowerCase().includes(trimmed) ||
        group.toLowerCase().includes(trimmed)
      );
    });
  }, [projects, query]);

  const filteredTasks = useMemo(() => {
    if (!selectedProjectId || !gantt) {
      return [] as NormalizedTask[];
    }
    return gantt.tasks.filter((task) => task.projectId === selectedProjectId);
  }, [selectedProjectId, gantt]);

  const selectedProject = useMemo(() => {
    if (!selectedProjectId) {
      return null;
    }
    return projects.find((project) => project.projectId === selectedProjectId) ?? null;
  }, [projects, selectedProjectId]);

  const existingProjectIds = useMemo(
    () => projects.map((project) => project.projectId),
    [projects]
  );

  useEffect(() => {
    const container = containerRef.current;
    if (!container || topHeight !== null) {
      return;
    }
    const total = container.clientHeight;
    const initial = Math.round(Math.max(0, (total - SPLITTER_HEIGHT) / 2));
    setTopHeight(initial);
  }, [topHeight]);

  useEffect(() => {
    const handleResize = () => {
      const container = containerRef.current;
      if (!container) {
        return;
      }
      setTopHeight((prev) => {
        if (prev === null) {
          return prev;
        }
        return clampSplit(prev, container.clientHeight);
      });
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const handleSplitterMouseDown = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    const container = containerRef.current;
    if (!container) {
      return;
    }
    const totalHeight = container.clientHeight;
    const startY = event.clientY;
    const startHeight = topHeight ?? Math.round(Math.max(0, (totalHeight - SPLITTER_HEIGHT) / 2));

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const nextHeight = clampSplit(
        startHeight + (moveEvent.clientY - startY),
        container.clientHeight
      );
      setTopHeight(nextHeight);
    };

    const handleMouseUp = () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      document.body.style.userSelect = '';
      document.body.style.cursor = '';
    };

    document.body.style.userSelect = 'none';
    document.body.style.cursor = 'row-resize';
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const splitStyle =
    topHeight !== null
      ? { gridTemplateRows: `${topHeight}px ${SPLITTER_HEIGHT}px 1fr` }
      : undefined;

  const handleCreateProject = async (input: {
    projectId: string;
    projectGroup: string | null;
    taskName: string;
    memberName: string;
    allowExistingProjectId?: boolean;
  }) => {
    if (!currentScheduleId) {
      setModalError('スケジュールが選択されていません。');
      return false;
    }
    setModalError(null);
    const ok = await createTask({
      scheduleId: currentScheduleId,
      importId: currentImportId ?? undefined,
      allowExistingProjectId: input.allowExistingProjectId,
      projectId: input.projectId,
      projectGroup: input.projectGroup,
      taskName: input.taskName,
      memberName: input.memberName,
      assignees: [],
      start: null,
      end: null,
      note: null
    });
    if (ok) {
      setSelectedProjectId(input.projectId);
      setIsModalOpen(false);
    } else {
      setModalError('プロジェクトの作成に失敗しました。');
    }
    return ok;
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>プロジェクト</h1>
        <p>プロジェクト別の統計とタスク一覧です。</p>
      </div>

      <div className="view-toggle">
        <label className="range-control">
          <span>検索</span>
          <input
            className="text-input"
            type="text"
            placeholder="プロジェクトID / グループ"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
        <button
          type="button"
          className="cmd-button"
          onClick={() => {
            setModalError(null);
            setIsModalOpen(true);
          }}
        >
          ＋ 新規プロジェクト
        </button>
      </div>

      <div className="projects-split" ref={containerRef} style={splitStyle}>
        <div className="projects-pane">
          {filteredProjects.length === 0 ? (
            <div className="empty-state">プロジェクトが見つかりません。</div>
          ) : (
            <div className="list">
              {filteredProjects.map((project) => {
                const isActive = project.projectId === selectedProjectId;
                return (
                  <button
                    key={project.projectId}
                    type="button"
                    className={`list-row list-row--action${isActive ? ' list-row--active' : ''}`}
                    onClick={() => setSelectedProjectId(project.projectId)}
                  >
                    <div>
                      <div className="list-title">{project.projectId}</div>
                      <div className="list-subtitle">{project.group ?? '未分類'}</div>
                    </div>
                    <div className="list-metrics">
                      <span>{project.totalTasks} 件</span>
                      <span>
                        予定 {project.scheduled} / 未確定 {project.unscheduled} / 不正 {project.invalid}
                      </span>
                      <span>{project.involvedMembers.size} 名</span>
                      <span>
                        {project.startDate ?? '未設定'} 〜 {project.endDate ?? '未設定'}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="projects-splitter" onMouseDown={handleSplitterMouseDown} />

        <div className="projects-pane">
          {selectedProjectId ? (
            <div className="section">
              <div className="section-header section-header--actions">
                <h2>{selectedProjectId} のタスク</h2>
                <div className="section-header__actions">
                  <button
                    type="button"
                    className="cmd-button cmd-button--ghost"
                    onClick={() => {
                      openTaskCreateModal({
                        projectId: selectedProjectId,
                        projectGroup: selectedProject?.group ?? null
                      });
                    }}
                  >
                    ＋ タスクを追加
                  </button>
                </div>
              </div>
              <TaskList
                tasks={filteredTasks}
                onSelect={setSelectedTask}
                emptyLabel="タスクはありません。"
              />
            </div>
          ) : (
            <div className="empty-state">プロジェクトを選択してください。</div>
          )}
        </div>
      </div>
      <TaskCreateModal
        mode="project"
        isOpen={isModalOpen}
        existingProjectIds={existingProjectIds}
        autoFocusOnOpen
        errorMessage={modalError}
        onClearError={() => setModalError(null)}
        onClose={() => {
          setModalError(null);
          setIsModalOpen(false);
        }}
        onCreate={handleCreateProject}
      />
    </div>
  );
};

export default ProjectsPage;
