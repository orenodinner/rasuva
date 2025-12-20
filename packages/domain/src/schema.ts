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
