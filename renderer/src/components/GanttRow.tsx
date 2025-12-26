import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import type { ListChildComponentProps } from 'react-window';
import type { NormalizedTask, TaskUpdateInput } from '@domain';
import { useTaskInteraction } from '../hooks/useTaskInteraction';

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
  collapsedGroups: string[];
  toggleGroup: (groupId: string) => void;
  setSelectedTask: (task: NormalizedTask) => void;
  setLastError: (message: string | null) => void;
  triggerEditFocus: () => void;
  updateTask: (input: TaskUpdateInput) => Promise<boolean>;
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
  setLastError: (message: string | null) => void;
  triggerEditFocus: () => void;
  updateTask: (input: TaskUpdateInput) => Promise<boolean>;
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
  setLastError,
  triggerEditFocus,
  updateTask
}: GanttTaskBarProps) => {
  const { barRef, isDragging, handleMoveStart, handleResizeStart } = useTaskInteraction({
    task,
    dayWidth,
    barLeft: left,
    barWidth: width,
    durationDays,
    onUpdate: async (target, newStart, newEnd) => {
      const previousStart = target.start;
      const previousEnd = target.end;
      try {
        const ok = await updateTask({
          currentTaskKeyFull: target.taskKeyFull,
          memberName: target.memberName,
          projectId: target.projectId,
          projectGroup: target.projectGroup,
          taskName: target.taskName,
          start: newStart,
          end: newEnd,
          note: target.note,
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
    onSelect: setSelectedTask
  });

  const draggingClass = isDragging ? 'gantt-bar--dragging' : '';
  const barClassName = ['gantt-bar', className, draggingClass].filter(Boolean).join(' ');

  const handleDoubleClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.stopPropagation();
    setSelectedTask(task);
    triggerEditFocus();
  };

  const handleContextMenu = (event: ReactMouseEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setSelectedTask(task);
    window.api?.showTaskContextMenu?.(task);
  };

  return (
    <div
      ref={barRef}
      className={barClassName}
      style={{ left, width: Math.max(dayWidth, width) }}
      data-tooltip={tooltip}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={handleDoubleClick}
      onContextMenu={handleContextMenu}
    >
      <div
        className="gantt-resize-handle gantt-resize-handle--left"
        onMouseDown={handleResizeStart('left')}
      />
      <div className="gantt-bar-content" onMouseDown={handleMoveStart}>
        <span>{task.taskName}</span>
      </div>
      <div
        className="gantt-resize-handle gantt-resize-handle--right"
        onMouseDown={handleResizeStart('right')}
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
                setLastError={data.setLastError}
                triggerEditFocus={data.triggerEditFocus}
                updateTask={data.updateTask}
              />
            );
          })()
        ) : null}
      </div>
    </div>
  );
};

export default GanttRow;
