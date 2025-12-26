export type GanttZoomLevel = 'day' | 'week' | 'month' | 'quarter';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

export const getPixelsPerDay = (zoom: GanttZoomLevel): number => {
  switch (zoom) {
    case 'day':
      return 40;
    case 'week':
      return 60 / 7;
    case 'month':
      return 20 / 7;
    case 'quarter':
      return 50 / 28;
    default:
      return 20;
  }
};

export const toUtcDate = (value: string) => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day));
};

export const formatIsoDate = (date: Date) => {
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const year = date.getUTCFullYear();
  const month = `${date.getUTCMonth() + 1}`.padStart(2, '0');
  const day = `${date.getUTCDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const addUtcDays = (date: Date, days: number) => {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));
};


export const diffUtcDays = (start: Date, end: Date) => {
  return Math.floor((end.getTime() - start.getTime()) / MS_PER_DAY);
};

export const getXFromDate = (date: Date, timelineStart: Date, dayWidth: number) => {
  return diffUtcDays(timelineStart, date) * dayWidth;
};

export const getDateFromX = (x: number, timelineStart: Date, dayWidth: number) => {
  const days = Math.round(x / dayWidth);
  return addUtcDays(timelineStart, days);
};

export const snapDeltaDays = (deltaX: number, dayWidth: number) => {
  if (dayWidth <= 0) {
    return 0;
  }
  return Math.round(deltaX / dayWidth);
};
