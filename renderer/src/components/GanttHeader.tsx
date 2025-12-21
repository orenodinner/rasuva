import type { CSSProperties } from 'react';

export interface GanttTick {
  key: string;
  weekLabel: string;
  dateLabel: string;
}

interface GanttHeaderProps {
  labelWidth: number;
  timelineWidth: number;
  columnWidth: number;
  totalWidth: number;
  labelText: string;
  ticks: GanttTick[];
}

const GanttHeader = ({
  labelWidth,
  timelineWidth,
  columnWidth,
  totalWidth,
  labelText,
  ticks
}: GanttHeaderProps) => {
  const rowStyle: CSSProperties = { minWidth: totalWidth };

  return (
    <div className="gantt-row gantt-row--header" style={rowStyle}>
      <div className="gantt-label gantt-label--header" style={{ width: labelWidth }}>
        {labelText}
      </div>
      <div className="gantt-timeline" style={{ width: timelineWidth }}>
        {ticks.map((tick) => (
          <div key={tick.key} className="gantt-tick" style={{ width: columnWidth }}>
            <span className="gantt-tick__week">{tick.weekLabel}</span>
            <span className="gantt-tick__date">{tick.dateLabel}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default GanttHeader;
