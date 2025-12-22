import { RawImportSchema } from './schema';
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

const extractRawBlocks = (text: string) => {
  const blocks: string[] = [];
  const length = text.length;
  let index = 0;

  while (index < length) {
    if (text[index] !== '{') {
      index += 1;
      continue;
    }

    const start = index;
    let inString = false;
    let escaped = false;
    let foundMembers = false;
    const stack: string[] = ['{'];
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
        if (text.slice(index, index + 9) === '"members"') {
          foundMembers = true;
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
          if (foundMembers) {
            blocks.push(text.slice(start, index));
          }
          break;
        }
        continue;
      }

      index += 1;
    }

    if (stack.length > 0) {
      if (foundMembers) {
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

const parseRawImport = (text: string): RawImport | null => {
  try {
    const repaired = repairJsonText(text);
    const parsed = JSON.parse(repaired) as unknown;
    const result = RawImportSchema.safeParse(parsed);
    return result.success ? (result.data as RawImport) : null;
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
  const rawBlocks = codeBlocks.length > 0 ? codeBlocks : extractRawBlocks(text);
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
