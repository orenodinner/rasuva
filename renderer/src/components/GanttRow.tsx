import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { ListChildComponentProps } from 'react-window';
import type { NormalizedTask, TaskUpdateInput } from '@domain';
import { useTaskInteraction } from '../hooks/useTaskInteraction';
import { addUtcDays, diffUtcDays, formatIsoDate, toUtcDate } from '../utils/ganttMath';

export interface GanttRowItem {
  id: string;
  type: 'member' | 'project' | 'task';
  label: string;
  task?: NormalizedTask;
  level: number;
  memberName: string;
  projectId: string | null;
}

export interface GanttRowData {
  rows: GanttRowItem[];
  labelWidth: number;
  timelineWidth: number;
  totalWidth: number;
  dayWidth: number;
  query: string;
  timelineStart: Date;
  timelineEnd: Date;
  weekendRects: { left: number; width: number }[];
  collapsedGroups: string[];
  toggleGroup: (groupId: string) => void;
  setSelectedTask: (task: NormalizedTask) => void;
  selectedTaskIds: string[];
  toggleTaskSelection: (task: NormalizedTask) => void;
  setLastError: (message: string | null) => void;
  updateTask: (input: TaskUpdateInput) => Promise<boolean>;
  inlineEditTaskKey: string | null;
  startInlineEdit: (taskKeyFull: string) => void;
  stopInlineEdit: () => void;
  showContextMenu: (payload: { x: number; y: number; task: NormalizedTask }) => void;
  taskLookup: Map<string, NormalizedTask>;
  getBarClassName?: (task: NormalizedTask) => string;
  buildTooltip: (task: NormalizedTask) => string;
  buildSearchHaystack: (task: NormalizedTask) => string;
  toUtcDate: (value: string) => Date;
  diffDays: (start: Date, end: Date) => number;
}

interface GanttTaskBarProps {
  task: NormalizedTask;
  left: number;
  width: number;
  dayWidth: number;
  durationDays: number;
  className: string;
  tooltip: string;
  setSelectedTask: (task: NormalizedTask) => void;
  selectedTaskIds: string[];
  toggleTaskSelection: (task: NormalizedTask) => void;
  setLastError: (message: string | null) => void;
  updateTask: (input: TaskUpdateInput) => Promise<boolean>;
  inlineEditTaskKey: string | null;
  startInlineEdit: (taskKeyFull: string) => void;
  stopInlineEdit: () => void;
  showContextMenu: (payload: { x: number; y: number; task: NormalizedTask }) => void;
  taskLookup: Map<string, NormalizedTask>;
}

const GanttTaskBar = ({
  task,
  left,
  width,
  dayWidth,
  durationDays,
  className,
  tooltip,
  setSelectedTask,
  selectedTaskIds,
  toggleTaskSelection,
  setLastError,
  updateTask,
  inlineEditTaskKey,
  startInlineEdit,
  stopInlineEdit,
  showContextMenu,
  taskLookup
}: GanttTaskBarProps) => {
  const isInlineEditing = inlineEditTaskKey === task.taskKeyFull;
  const isSelected = selectedTaskIds.includes(task.taskKeyFull);
  const [draftName, setDraftName] = useState(task.taskName);
  const inputRef = useRef<HTMLInputElement>(null);
  const submittingRef = useRef(false);

  useEffect(() => {
    if (isInlineEditing) {
      setDraftName(task.taskName);
    }
  }, [isInlineEditing, task.taskName]);

  useEffect(() => {
    if (!isInlineEditing) {
      return;
    }
    const rafId = requestAnimationFrame(() => {
      inputRef.current?.focus();
      inputRef.current?.select();
    });
    return () => cancelAnimationFrame(rafId);
  }, [isInlineEditing]);

  const { barRef, isDragging, handleMoveStart, handleResizeStart } = useTaskInteraction({
    task,
    dayWidth,
    barLeft: left,
    barWidth: width,
    durationDays,
    onUpdate: async (target, newStart, newEnd) => {
      const previousStart = target.start;
      const previousEnd = target.end;
      const shouldMultiMove =
        selectedTaskIds.length > 1 &&
        selectedTaskIds.includes(target.taskKeyFull) &&
        Boolean(target.start && target.end);

      if (shouldMultiMove && target.start && target.end) {
        const deltaStart = diffUtcDays(toUtcDate(target.start), toUtcDate(newStart));
        const deltaEnd = diffUtcDays(toUtcDate(target.end), toUtcDate(newEnd));
        if (deltaStart === deltaEnd) {
          const deltaDays = deltaStart;
          const tasksToMove = selectedTaskIds
            .map((taskKey) => taskLookup.get(taskKey))
            .filter(
              (entry): entry is NormalizedTask =>
                Boolean(entry && entry.start && entry.end)
            );
          if (tasksToMove.length > 1) {
            try {
              const results = await Promise.all(
                tasksToMove.map((entry) => {
                  const nextStart = formatIsoDate(
                    addUtcDays(toUtcDate(entry.start!), deltaDays)
                  );
                  const nextEnd = formatIsoDate(
                    addUtcDays(toUtcDate(entry.end!), deltaDays)
                  );
                  if (!nextStart || !nextEnd) {
                    return Promise.resolve(false);
                  }
                  return updateTask({
                    currentTaskKeyFull: entry.taskKeyFull,
                    memberName: entry.memberName,
                    projectId: entry.projectId,
                    projectGroup: entry.projectGroup ?? null,
                    taskName: entry.taskName,
                    start: nextStart,
                    end: nextEnd,
                    note: entry.note ?? null,
                    assignees: entry.assignees ?? []
                  });
                })
              );
              const ok = results.every(Boolean);
              if (!ok) {
                setLastError('複数タスクの更新に失敗しました。');
                if (previousStart && previousEnd) {
                  setSelectedTask({ ...target, start: previousStart, end: previousEnd });
                }
              }
              return ok;
            } catch (error) {
              setLastError(
                error instanceof Error
                  ? error.message
                  : '複数タスクの更新に失敗しました。'
              );
              if (previousStart && previousEnd) {
                setSelectedTask({ ...target, start: previousStart, end: previousEnd });
              }
              return false;
            }
          }
        }
      }
      try {
        const ok = await updateTask({
          currentTaskKeyFull: target.taskKeyFull,
          memberName: target.memberName,
          projectId: target.projectId,
          projectGroup: target.projectGroup ?? null,
          taskName: target.taskName,
          start: newStart,
          end: newEnd,
          note: target.note ?? null,
          assignees: target.assignees ?? []
        });
        if (!ok) {
          setLastError('日程の更新に失敗しました。');
          if (previousStart && previousEnd) {
            setSelectedTask({ ...target, start: previousStart, end: previousEnd });
          }
        }
        return ok;
      } catch (error) {
        setLastError(
          error instanceof Error ? error.message : '日程の更新に失敗しました。'
        );
        if (previousStart && previousEnd) {
          setSelectedTask({ ...target, start: previousStart, end: previousEnd });
        }
        return false;
      }
    },
    onSelect: (selected) => {
      if (!selectedTaskIds.includes(selected.taskKeyFull)) {
        setSelectedTask(selected);
      }
    }
  });

  const draggingClass = isDragging ? 'gantt-bar--dragging' : '';
  const selectedClass = isSelected ? 'gantt-bar--selected' : '';
  const barClassName = ['gantt-bar', className, draggingClass, selectedClass]
    .filter(Boolean)
    .join(' ');

  const handleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (event.metaKey || event.ctrlKey) {
      toggleTaskSelection(task);
      return;
    }
    setSelectedTask(task);
  };

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setSelectedTask(task);
    startInlineEdit(task.taskKeyFull);
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTask(task);
    showContextMenu({ x: event.clientX, y: event.clientY, task });
  };

  const commitInlineEdit = async () => {
    if (submittingRef.current) {
      return;
    }
    const trimmed = draftName.trim();
    if (!trimmed) {
      setLastError('タスク名を入力してください。');
      return;
    }
    if (trimmed === task.taskName) {
      stopInlineEdit();
      return;
    }
    submittingRef.current = true;
    try {
      const ok = await updateTask({
        currentTaskKeyFull: task.taskKeyFull,
        memberName: task.memberName,
        projectId: task.projectId,
        projectGroup: task.projectGroup ?? null,
        taskName: trimmed,
        start: task.start ?? null,
        end: task.end ?? null,
        note: task.note ?? null,
        assignees: task.assignees ?? []
      });
      if (ok) {
        stopInlineEdit();
      }
    } finally {
      submittingRef.current = false;
    }
  };

  return (
    <div
      ref={barRef}
      className={barClassName}
      style={{ left, width: Math.max(dayWidth, width) }}
      data-tooltip={tooltip}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <div
        className="gantt-resize-handle gantt-resize-handle--left"
        onMouseDown={isInlineEditing ? undefined : handleResizeStart('left')}
      />
      <div className="gantt-bar-content" onMouseDown={isInlineEditing ? undefined : handleMoveStart}>
        {isInlineEditing ? (
          <input
            ref={inputRef}
            className="gantt-inline-input"
            value={draftName}
            onChange={(event) => setDraftName(event.target.value)}
            onBlur={() => {
              void commitInlineEdit();
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                void commitInlineEdit();
              }
              if (event.key === 'Escape') {
                event.preventDefault();
                setDraftName(task.taskName);
                stopInlineEdit();
              }
            }}
            onMouseDown={(event) => event.stopPropagation()}
            onClick={(event) => event.stopPropagation()}
          />
        ) : (
          <span>{task.taskName}</span>
        )}
      </div>
      <div
        className="gantt-resize-handle gantt-resize-handle--right"
        onMouseDown={isInlineEditing ? undefined : handleResizeStart('right')}
      />
    </div>
  );
};

const GanttRow = ({ index, style, data }: ListChildComponentProps<GanttRowData>) => {
  const row = data.rows[index];
  if (!row) {
    return null;
  }

  const isGroup = row.type === 'member' || row.type === 'project';
  const groupId =
    row.type === 'member'
      ? `member:${row.memberName}`
      : row.type === 'project'
        ? `project:${row.memberName}:${row.projectId}`
        : null;
  const isCollapsed = groupId ? data.collapsedGroups.includes(groupId) : false;
  const rowStyle: CSSProperties = { ...(style as CSSProperties), width: data.totalWidth };

  return (
    <div
      className={`gantt-row gantt-row--${row.type}`}
      style={rowStyle}
      onClick={() => row.task && data.setSelectedTask(row.task)}
    >
      <div className={`gantt-label gantt-label--level-${row.level}`} style={{ width: data.labelWidth }}>
        {isGroup && groupId ? (
          <button
            type="button"
            className="gantt-toggle"
            aria-expanded={!isCollapsed}
            onClick={(event) => {
              event.stopPropagation();
              data.toggleGroup(groupId);
            }}
          >
            <span className="gantt-toggle__icon">{isCollapsed ? '▸' : '▾'}</span>
            <span>{row.label}</span>
          </button>
        ) : (
          row.label
        )}
      </div>
      <div className="gantt-timeline" style={{ width: data.timelineWidth }}>
        {data.weekendRects.map((rect, index) => (
          <div
            key={`weekend-${rect.left}-${rect.width}-${index}`}
            className="gantt-weekend-highlight"
            style={{ left: rect.left, width: rect.width }}
          />
        ))}
        {row.type === 'task' && row.task && row.task.start && row.task.end ? (
          (() => {
            const startDate = data.toUtcDate(row.task.start);
            const endDate = data.toUtcDate(row.task.end);
            const originalDurationDays = data.diffDays(startDate, endDate) + 1;
            const clippedStart =
              startDate < data.timelineStart ? data.timelineStart : startDate;
            const clippedEnd = endDate > data.timelineEnd ? data.timelineEnd : endDate;
            if (clippedEnd < clippedStart) {
              return null;
            }
            const durationDays = data.diffDays(clippedStart, clippedEnd) + 1;
            const left = data.diffDays(data.timelineStart, clippedStart) * data.dayWidth;
            const baseClassName = data.getBarClassName?.(row.task) ?? '';
            const isHighlighted = data.query
              ? data.buildSearchHaystack(row.task).includes(data.query)
              : false;
            const highlightClass = isHighlighted ? 'gantt-bar--highlighted' : '';
            const className = [baseClassName, highlightClass].filter(Boolean).join(' ');
            const tooltip = data.buildTooltip(row.task);

            const barWidth = Math.max(data.dayWidth, durationDays * data.dayWidth);
            return (
              <GanttTaskBar
                task={row.task}
                left={left}
                width={barWidth}
                dayWidth={data.dayWidth}
                durationDays={originalDurationDays}
                className={className}
                tooltip={tooltip}
                setSelectedTask={data.setSelectedTask}
                selectedTaskIds={data.selectedTaskIds}
                toggleTaskSelection={data.toggleTaskSelection}
                setLastError={data.setLastError}
                updateTask={data.updateTask}
                inlineEditTaskKey={data.inlineEditTaskKey}
                startInlineEdit={data.startInlineEdit}
                stopInlineEdit={data.stopInlineEdit}
                showContextMenu={data.showContextMenu}
                taskLookup={data.taskLookup}
              />
            );
          })()
        ) : null}
      </div>
    </div>
  );
};

export default GanttRow;
