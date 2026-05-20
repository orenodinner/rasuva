export const sanitizeMemberOrder = (order: string[], availableMembers: string[]) => {
  const available = new Set(availableMembers);
  const seen = new Set<string>();
  const sanitized: string[] = [];

  order.forEach((name) => {
    if (!available.has(name) || seen.has(name)) {
      return;
    }
    seen.add(name);
    sanitized.push(name);
  });

  availableMembers.forEach((name) => {
    if (!seen.has(name)) {
      sanitized.push(name);
    }
  });

  return sanitized;
};

export const moveMemberInOrder = (
  currentOrder: string[],
  memberName: string,
  direction: 'up' | 'down'
) => {
  const index = currentOrder.indexOf(memberName);
  if (index < 0) {
    return currentOrder;
  }
  const targetIndex = direction === 'up' ? index - 1 : index + 1;
  if (targetIndex < 0 || targetIndex >= currentOrder.length) {
    return currentOrder;
  }

  const nextOrder = [...currentOrder];
  [nextOrder[index], nextOrder[targetIndex]] = [nextOrder[targetIndex], nextOrder[index]];
  return nextOrder;
};
