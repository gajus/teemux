// eslint-disable-next-line no-control-regex
const ansiRegex = /\u001B\[[\d;]*m/gu;

export const stripAnsi = (text: string): string => {
  return text.replaceAll(ansiRegex, '');
};

export const globToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replaceAll(/([$()+.?[\\\]^{|}])/gu, '\\$1');
  const regexPattern = escaped.replaceAll('*', '.*');
  return new RegExp(regexPattern, 'iu');
};

export const matchesPattern = (text: string, pattern: string): boolean => {
  if (pattern.includes('*')) {
    return globToRegex(pattern).test(text);
  }

  return text.includes(pattern.toLowerCase());
};

export const matchesFilters = (
  text: string,
  includes: string[],
  excludes: string[],
): boolean => {
  const plain = stripAnsi(text).toLowerCase();

  if (includes.length > 0) {
    const anyMatch = includes.some((pattern) => matchesPattern(plain, pattern));
    if (!anyMatch) {
      return false;
    }
  }

  if (excludes.length > 0) {
    const anyMatch = excludes.some((pattern) => matchesPattern(plain, pattern));
    if (anyMatch) {
      return false;
    }
  }

  return true;
};

export const parseFilterValue = (value: string): string[] => {
  return value
    .split(',')
    .map((segment) => segment.trim())
    .filter(Boolean);
};
