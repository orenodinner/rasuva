import { useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import type { NormalizedTask } from '@domain';
import TaskList from '../components/TaskList';
import { useAppStore } from '../state/store';

type ProjectStat = {
  projectId: string;
  group: string | null;
  startDate: string | null;
  endDate: string | null;
  totalTasks: number;
  scheduled: number;
  unscheduled: number;
  invalid: number;
  involvedMembers: Set<string>;
};

const SPLITTER_HEIGHT = 8;
const MIN_PANE_HEIGHT = 160;

const clampSplit = (value: number, totalHeight: number) => {
  const available = Math.max(0, totalHeight - SPLITTER_HEIGHT);
  const min = Math.min(MIN_PANE_HEIGHT, Math.floor(available / 2));
  const max = Math.max(min, available - min);
  return Math.min(Math.max(value, min), max);
};

const buildProjectStats = (tasks: NormalizedTask[]) => {
  const map = new Map<string, ProjectStat>();

  tasks.forEach((task) => {
    const projectId = task.projectId;
    if (!map.has(projectId)) {
      map.set(projectId, {
        projectId,
        group: task.projectGroup ?? null,
        startDate: null,
        endDate: null,
        totalTasks: 0,
        scheduled: 0,
        unscheduled: 0,
        invalid: 0,
        involvedMembers: new Set()
      });
    }
    const entry = map.get(projectId)!;
    entry.totalTasks += 1;
    if (task.status === 'scheduled') {
      entry.scheduled += 1;
    } else if (task.status === 'unscheduled') {
      entry.unscheduled += 1;
    } else if (task.status === 'invalid_date') {
      entry.invalid += 1;
    }
    if (!entry.group && task.projectGroup) {
      entry.group = task.projectGroup;
    }
    if (task.start) {
      entry.startDate = entry.startDate
        ? task.start < entry.startDate
          ? task.start
          : entry.startDate
        : task.start;
    }
    if (task.end) {
      entry.endDate = entry.endDate
        ? task.end > entry.endDate
          ? task.end
          : entry.endDate
        : task.end;
    }

    const members = new Set<string>([task.memberName, ...(task.assignees ?? [])]);
    members.forEach((name) => {
      if (!name) {
        return;
      }
      entry.involvedMembers.add(name);
    });
  });

  return Array.from(map.values()).sort((a, b) => a.projectId.localeCompare(b.projectId));
};

const ProjectsPage = () => {
  const gantt = useAppStore((state) => state.gantt);
  const loadGantt = useAppStore((state) => state.loadGantt);
  const setSelectedTask = useAppStore((state) => state.setSelectedTask);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [topHeight, setTopHeight] = useState<number | null>(null);
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
                      <span>{project.totalTasks} ?</span>
                      <span>
                        予定 {project.scheduled} / 未確定 {project.unscheduled} / 不正 {project.invalid}
                      </span>
                      <span>{project.involvedMembers.size} ?</span>
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
              <div className="section-header">
                <h2>{selectedProjectId} のタスク</h2>
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
    </div>
  );
};

export default ProjectsPage;
