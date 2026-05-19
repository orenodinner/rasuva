import type { CSSProperties } from 'react';
import type { ZoomLevel } from '../state/store';
import type { WorkloadSegment } from '../utils/workloadSegments';

export interface GanttTick {
  key: string;
  weekLabel: string;
  dateLabel: string;
  yearLabel: string;
  monthLabel: string;
  dayLabel: string;
  isToday: boolean;
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
  workloadSegments: WorkloadSegment[];
}

const GanttHeader = ({
  labelWidth,
  timelineWidth,
  columnWidth,
  totalWidth,
  labelText,
  zoom,
  scrollLeft,
  ticks,
  workloadSegments
}: GanttHeaderProps) => {
  const rowStyle: CSSProperties = { minWidth: totalWidth, width: totalWidth };
  const buildGroups = (
    keySelector: (tick: GanttTick) => string,
    labelSelector: (tick: GanttTick) => string
  ) =>
    ticks.reduce<{ key: string; label: string; span: number; groupKey: string }[]>((acc, tick) => {
      const groupKey = keySelector(tick);
      const label = labelSelector(tick);
      const lastGroup = acc[acc.length - 1];
      if (lastGroup && lastGroup.groupKey === groupKey) {
        lastGroup.span += 1;
        return acc;
      }
      acc.push({ key: `${tick.key}-${groupKey}`, label, span: 1, groupKey });
      return acc;
    }, []);
  const groupedTicks = buildGroups(
    (tick) => tick.weekLabel,
    (tick) => tick.weekLabel
  );
  const yearGroups = buildGroups(
    (tick) => tick.yearLabel,
    (tick) => tick.yearLabel
  );
  const monthGroups = buildGroups(
    (tick) => `${tick.yearLabel}-${tick.monthLabel}`,
    (tick) => tick.monthLabel
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
      <div className="gantt-row gantt-row--header gantt-row--load-summary" style={rowStyle}>
        <div
          className="gantt-label gantt-label--header gantt-load-summary-label"
          style={labelStyle}
        >
          工数負荷状況
        </div>
        <div className="gantt-timeline-clip" style={{ width: timelineWidth }}>
          <div className="gantt-timeline gantt-load-summary-track" style={timelineStyle}>
            {workloadSegments.map((segment) => (
              <div
                key={`summary-${segment.key}`}
                className={`gantt-load-summary-bar gantt-load-summary-bar--${segment.level}`}
                style={{ left: segment.left, width: segment.width }}
                title={`同時進行 ${segment.count}件`}
              >
                {segment.count}
              </div>
            ))}
          </div>
        </div>
      </div>
      {zoom === 'day' ? (
        <>
          <div className="gantt-row gantt-row--header gantt-row--header-top" style={rowStyle}>
            <div className="gantt-label gantt-label--header" style={labelStyle}>
              {labelText}
            </div>
            <div className="gantt-timeline-clip" style={{ width: timelineWidth }}>
              <div
                className="gantt-timeline gantt-timeline--header gantt-timeline--header-top"
                style={timelineStyle}
              >
                {yearGroups.map((group) => (
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
          <div className="gantt-row gantt-row--header gantt-row--header-middle" style={rowStyle}>
            <div
              className="gantt-label gantt-label--header gantt-label--header-spacer"
              style={labelStyle}
            />
            <div className="gantt-timeline-clip" style={{ width: timelineWidth }}>
              <div
                className="gantt-timeline gantt-timeline--header gantt-timeline--header-top"
                style={timelineStyle}
              >
                {monthGroups.map((group) => (
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
                  <div
                    key={tick.key}
                    className={tick.isToday ? 'gantt-tick gantt-tick--today' : 'gantt-tick'}
                    style={{ width: columnWidth }}
                  >
                    <span
                      className={
                        tick.isToday
                          ? 'gantt-tick__date gantt-tick__date--today'
                          : 'gantt-tick__date'
                      }
                    >
                      {tick.dayLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      ) : (
        <>
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
                  <div
                    key={tick.key}
                    className={tick.isToday ? 'gantt-tick gantt-tick--today' : 'gantt-tick'}
                    style={{ width: columnWidth }}
                  >
                    <span
                      className={
                        tick.isToday
                          ? 'gantt-tick__date gantt-tick__date--today'
                          : 'gantt-tick__date'
                      }
                    >
                      {tick.dateLabel}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default GanttHeader;
