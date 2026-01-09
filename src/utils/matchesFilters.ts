import { stripAnsi } from './stripAnsi.js';

/**
 * Convert a glob pattern (with * wildcards) to a RegExp.
 * - `*` matches any characters (zero or more)
 * - All other characters are escaped for literal matching
 */
const globToRegex = (pattern: string): RegExp => {
  // Escape regex special characters except *
  const escaped = pattern.replaceAll(/[$()+.?[\\\]^{|}]/gu, '\\$&');
  // Convert * to .*
  const regexPattern = escaped.replaceAll('*', '.*');
  return new RegExp(regexPattern, 'iu');
};

/**
 * Check if text matches a pattern (supports * glob wildcards).
 * If no wildcards, does a simple substring match for better performance.
 */
const matchesPattern = (text: string, pattern: string): boolean => {
  if (pattern.includes('*')) {
    return globToRegex(pattern).test(text);
  }

  return text.includes(pattern.toLowerCase());
};

/**
 * Check if a line matches the given filter criteria.
 * @param line - The line to check (may contain ANSI codes)
 * @param includes - Patterns where ANY match includes the line (OR logic), case-insensitive. Supports * wildcards.
 * @param excludes - Patterns where ANY match excludes the line (OR logic), case-insensitive. Supports * wildcards.
 * @returns true if the line should be included, false if filtered out
 */
export const matchesFilters = (
  line: string,
  includes: string[],
  excludes: string[],
): boolean => {
  const plainText = stripAnsi(line).toLowerCase();

  // Any include must match (OR logic) - case insensitive
  if (includes.length > 0) {
    const anyIncludeMatches = includes.some((pattern) =>
      matchesPattern(plainText, pattern),
    );

    if (!anyIncludeMatches) {
      return false;
    }
  }

  // None of the excludes should match (OR logic for exclusion) - case insensitive
  if (excludes.length > 0) {
    const anyExcludeMatches = excludes.some((pattern) =>
      matchesPattern(plainText, pattern),
    );

    if (anyExcludeMatches) {
      return false;
    }
  }

  return true;
};
