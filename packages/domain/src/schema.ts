import { z } from 'zod';

export const RawTaskSchema = z.object({
  task_name: z.string(),
  start: z.string().nullable(),
  end: z.string().nullable(),
  raw_date: z.string(),
  note: z.string().nullable().optional(),
  assign: z.array(z.string()).nullable().optional()
});

export const RawProjectSchema = z.object({
  project_id: z.string().nullable(),
  group: z.string().nullable().optional(),
  tasks: z.array(RawTaskSchema)
});

export const RawMemberSchema = z.object({
  name: z.string(),
  projects: z.array(RawProjectSchema)
});

export const RawImportSchema = z.object({
  members: z.array(RawMemberSchema)
});

export const TaskCreateSchema = z.object({
  scheduleId: z.number().int().positive(),
  importId: z.number().int().positive().optional(),
  allowExistingProjectId: z.boolean().optional(),
  projectId: z.string().min(1),
  projectGroup: z.string().nullable(),
  taskName: z.string().min(1),
  memberName: z.string().min(1),
  assignees: z.array(z.string()),
  start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  note: z.string().nullable()
});
