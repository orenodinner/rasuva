import type { CSSProperties } from 'react';
import type { ListChildComponentProps } from 'react-window';
import type { NormalizedTask } from '@domain';

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
  getBarClassName?: (task: NormalizedTask) => string;
  buildTooltip: (task: NormalizedTask) => string;
  buildSearchHaystack: (task: NormalizedTask) => string;
  toUtcDate: (value: string) => Date;
  diffDays: (start: Date, end: Date) => number;
}

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

            if (originalDurationDays === 1) {
              return (
                <div
                  className={`gantt-marker ${className}`}
                  style={{ left: Math.max(0, left + data.dayWidth / 2) }}
                  data-tooltip={tooltip}
                >
                  ★
                </div>
              );
            }

            return (
              <div
                className={`gantt-bar ${className}`}
                style={{
                  left,
                  width: Math.max(data.dayWidth, durationDays * data.dayWidth)
                }}
                data-tooltip={tooltip}
              >
                <span>{row.task.taskName}</span>
              </div>
            );
          })()
        ) : null}
      </div>
    </div>
  );
};

export default GanttRow;
