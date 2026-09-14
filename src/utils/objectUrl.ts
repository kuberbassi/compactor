export interface ObjectUrlOwner<T> {
  current: () => T;
  replace: (next: T) => void;
  cleanup: () => void;
}

export const createObjectUrlOwner = <T>(
  initial: T,
  getUrls: (value: T) => string[],
): ObjectUrlOwner<T> => {
  let value = initial;

  const revokeDeparted = (next: T) => {
    const retainedUrls = new Set(getUrls(next));
    getUrls(value).forEach(url => {
      if (!retainedUrls.has(url)) URL.revokeObjectURL(url);
    });
  };

  return {
    current: () => value,
    replace: next => {
      revokeDeparted(next);
      value = next;
    },
    cleanup: () => {
      getUrls(value).forEach(url => URL.revokeObjectURL(url));
      value = initial;
    },
  };
};
