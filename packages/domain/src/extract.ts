import { RawImportSchema, RawMemberSchema, RawProjectSchema, RawTaskSchema } from './schema';
import type { RawImport } from './types';

const CODE_BLOCK_REGEX = /```(?:json)?\s*([\s\S]*?)```/g;

const extractCodeBlocks = (text: string) => {
  const blocks: string[] = [];
  CODE_BLOCK_REGEX.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = CODE_BLOCK_REGEX.exec(text)) !== null) {
    const block = match[1].trim();
    if (block.length > 0) {
      blocks.push(block);
    }
  }
  return blocks;
};

const FRAGMENT_KEYS = ['"members"', '"projects"', '"tasks"', '"project_id"', '"task_name"'];

const extractRawBlocks = (text: string) => {
  const blocks: string[] = [];
  const length = text.length;
  let index = 0;

  while (index < length) {
    const startChar = text[index];
    if (startChar !== '{' && startChar !== '[') {
      index += 1;
      continue;
    }

    const start = index;
    let inString = false;
    let escaped = false;
    let foundKey = false;
    const stack: string[] = [startChar];
    index += 1;

    while (index < length) {
      const char = text[index];

      if (inString) {
        if (escaped) {
          escaped = false;
        } else if (char === '\\') {
          escaped = true;
        } else if (char === '"') {
          inString = false;
        }
        index += 1;
        continue;
      }

      if (char === '"') {
        for (const key of FRAGMENT_KEYS) {
          if (text.slice(index, index + key.length) === key) {
            foundKey = true;
            break;
          }
        }
        inString = true;
        index += 1;
        continue;
      }

      if (char === '{' || char === '[') {
        stack.push(char);
        index += 1;
        continue;
      }

      if (char === '}' || char === ']') {
        const top = stack[stack.length - 1];
        if ((char === '}' && top === '{') || (char === ']' && top === '[')) {
          stack.pop();
        } else if (stack.length > 0) {
          stack.pop();
        }
        index += 1;
        if (stack.length === 0) {
          if (foundKey) {
            blocks.push(text.slice(start, index));
          }
          break;
        }
        continue;
      }

      index += 1;
    }

    if (stack.length > 0) {
      if (foundKey) {
        blocks.push(text.slice(start));
      }
      break;
    }
  }

  return blocks;
};

const repairJsonText = (text: string) => {
  const stack: string[] = [];
  let inString = false;
  let escaped = false;
  let output = '';

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    output += char;

    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '"') {
        inString = false;
      }
      continue;
    }

    if (char === '"') {
      inString = true;
      continue;
    }

    if (char === '{' || char === '[') {
      stack.push(char);
      continue;
    }

    if (char === '}' || char === ']') {
      const top = stack[stack.length - 1];
      if ((char === '}' && top === '{') || (char === ']' && top === '[')) {
        stack.pop();
      }
      continue;
    }
  }

  if (inString) {
    output += '"';
  }

  for (let i = stack.length - 1; i >= 0; i -= 1) {
    output += stack[i] === '{' ? '}' : ']';
  }

  return output;
};

const wrapProjectsAsImport = (projects: RawImport['members'][number]['projects']): RawImport => ({
  members: [
    {
      name: '',
      projects
    }
  ]
});

const tryWrapFragment = (value: unknown): RawImport | null => {
  const memberResult = RawMemberSchema.safeParse(value);
  if (memberResult.success) {
    return { members: [memberResult.data] };
  }

  const membersResult = RawMemberSchema.array().safeParse(value);
  if (membersResult.success) {
    return { members: membersResult.data };
  }

  const projectResult = RawProjectSchema.safeParse(value);
  if (projectResult.success) {
    return wrapProjectsAsImport([projectResult.data]);
  }

  const projectsResult = RawProjectSchema.array().safeParse(value);
  if (projectsResult.success) {
    return wrapProjectsAsImport(projectsResult.data);
  }

  const taskResult = RawTaskSchema.safeParse(value);
  if (taskResult.success) {
    return wrapProjectsAsImport([
      {
        project_id: null,
        group: null,
        tasks: [taskResult.data]
      }
    ]);
  }

  const tasksResult = RawTaskSchema.array().safeParse(value);
  if (tasksResult.success) {
    return wrapProjectsAsImport([
      {
        project_id: null,
        group: null,
        tasks: tasksResult.data
      }
    ]);
  }

  if (value && typeof value === 'object' && 'tasks' in value) {
    const container = value as { tasks?: unknown; group?: unknown; project_id?: unknown };
    const embeddedTasks = RawTaskSchema.array().safeParse(container.tasks);
    if (embeddedTasks.success) {
      const projectId =
        typeof container.project_id === 'string' || container.project_id === null
          ? container.project_id
          : null;
      const group = typeof container.group === 'string' ? container.group : null;
      return wrapProjectsAsImport([
        {
          project_id: projectId ?? null,
          group,
          tasks: embeddedTasks.data
        }
      ]);
    }
  }

  return null;
};

const parseRawImport = (text: string): RawImport | null => {
  try {
    const repaired = repairJsonText(text);
    const parsed = JSON.parse(repaired) as unknown;
    const result = RawImportSchema.safeParse(parsed);
    if (result.success) {
      return result.data as RawImport;
    }
    return tryWrapFragment(parsed);
  } catch {
    return null;
  }
};

const mergeRawImports = (imports: RawImport[]): RawImport => {
  const members: RawImport['members'] = [];
  const memberIndex = new Map<
    string,
    {
      member: RawImport['members'][number];
      projects: Map<string | null, RawImport['members'][number]['projects'][number]>;
    }
  >();

  imports.forEach((rawImport) => {
    rawImport.members.forEach((member) => {
      let memberEntry = memberIndex.get(member.name);
      if (!memberEntry) {
        const newMember = { name: member.name, projects: [] as RawImport['members'][number]['projects'] };
        memberEntry = { member: newMember, projects: new Map() };
        memberIndex.set(member.name, memberEntry);
        members.push(newMember);
      }

      member.projects.forEach((project) => {
        const key = project.project_id;
        let targetProject = memberEntry.projects.get(key);
        if (!targetProject) {
          targetProject = {
            project_id: project.project_id,
            group: project.group ?? null,
            tasks: [...project.tasks]
          };
          memberEntry.projects.set(key, targetProject);
          memberEntry.member.projects.push(targetProject);
          return;
        }

        if (!targetProject.group && project.group) {
          targetProject.group = project.group;
        }
        targetProject.tasks.push(...project.tasks);
      });
    });
  });

  return { members };
};

export const extractJsonFromText = (text: string): RawImport | null => {
  const codeBlocks = extractCodeBlocks(text);
  const rawBlocks =
    codeBlocks.length > 0
      ? [
          ...codeBlocks.flatMap((block) => {
            const extracted = extractRawBlocks(block);
            return extracted.length > 0 ? [block, ...extracted] : [block];
          }),
          ...extractRawBlocks(text)
        ]
      : extractRawBlocks(text);
  const uniqueBlocks = Array.from(new Set(rawBlocks.map((block) => block.trim()))).filter(
    (block) => block.length > 0
  );

  const parsedBlocks = uniqueBlocks
    .map((block) => parseRawImport(block))
    .filter((value): value is RawImport => value !== null);

  if (parsedBlocks.length === 0) {
    return null;
  }

  if (parsedBlocks.length === 1) {
    return parsedBlocks[0];
  }

  return mergeRawImports(parsedBlocks);
};
