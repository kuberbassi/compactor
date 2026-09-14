export const moveQueueItem = <T,>(items: readonly T[], from: number, to: number): T[] => {
  if (from === to || from < 0 || to < 0 || from >= items.length || to >= items.length) return [...items];
  const next = [...items];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
};

export const remapActiveQueueIndex = (current: number | null, from: number, to: number): number | null => {
  if (current === null || from === to) return current;
  if (current === from) return to;
  if (from < current && current <= to) return current - 1;
  if (to <= current && current < from) return current + 1;
  return current;
};
