import type { TaskStatus } from '@domain';

const STATUS_LABELS: Record<TaskStatus, string> = {
  scheduled: '予定あり',
  unscheduled: '未確定',
  invalid_date: '日付不正'
};

export const getStatusLabel = (status: TaskStatus) => STATUS_LABELS[status] ?? status;
