import type { CSSProperties } from 'react';
import type { ZoomLevel } from '../state/store';

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
  zoom: ZoomLevel;
  scrollLeft: number;
  ticks: GanttTick[];
}

const GanttHeader = ({
  labelWidth,
  timelineWidth,
  columnWidth,
  totalWidth,
  labelText,
  zoom,
  scrollLeft,
  ticks
}: GanttHeaderProps) => {
  const rowStyle: CSSProperties = { minWidth: totalWidth, width: totalWidth };
  const shouldGroup = zoom !== 'day' || ticks.length > 1;
  const groupedTicks = ticks.reduce<{ key: string; label: string; span: number }[]>(
    (acc, tick) => {
      if (!shouldGroup) {
        acc.push({ key: `${tick.key}-group`, label: tick.weekLabel, span: 1 });
        return acc;
      }
      const lastGroup = acc[acc.length - 1];
      if (lastGroup && lastGroup.label === tick.weekLabel) {
        lastGroup.span += 1;
        return acc;
      }
      acc.push({ key: `${tick.key}-group`, label: tick.weekLabel, span: 1 });
      return acc;
    },
    []
  );
  const labelStyle: CSSProperties = { width: labelWidth };
  const timelineStyle: CSSProperties = {
    width: timelineWidth,
    transform: `translateX(-${scrollLeft}px)`,
    willChange: 'transform'
  };

  const headerRowsStyle: CSSProperties = { minWidth: totalWidth, width: totalWidth };

  return (
    <div className="gantt-header-rows" style={headerRowsStyle}>
      <div className="gantt-row gantt-row--header gantt-row--header-top" style={rowStyle}>
        <div className="gantt-label gantt-label--header" style={labelStyle}>
          {labelText}
        </div>
        <div className="gantt-timeline-clip" style={{ width: timelineWidth }}>
          <div
            className="gantt-timeline gantt-timeline--header gantt-timeline--header-top"
            style={timelineStyle}
          >
            {groupedTicks.map((group) => (
              <div
                key={group.key}
                className="gantt-tick gantt-tick--group"
                style={{ width: columnWidth * group.span }}
              >
                <span className="gantt-tick__week">{group.label}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="gantt-row gantt-row--header gantt-row--header-bottom" style={rowStyle}>
        <div
          className="gantt-label gantt-label--header gantt-label--header-spacer"
          style={labelStyle}
        />
        <div className="gantt-timeline-clip" style={{ width: timelineWidth }}>
          <div className="gantt-timeline gantt-timeline--header" style={timelineStyle}>
            {ticks.map((tick) => (
              <div key={tick.key} className="gantt-tick" style={{ width: columnWidth }}>
                <span className="gantt-tick__date">{tick.dateLabel}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default GanttHeader;
