import { stripAnsi } from './stripAnsi.js';

/**
 * Check if a line matches the given filter criteria.
 *
 * @param line - The line to check (may contain ANSI codes)
 * @param includes - Terms where ANY match includes the line (OR logic), case-insensitive
 * @param excludes - Terms where ANY match excludes the line (OR logic), case-insensitive
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
    const anyIncludeMatches = includes.some((term) =>
      plainText.includes(term.toLowerCase()),
    );

    if (!anyIncludeMatches) {
      return false;
    }
  }

  // None of the excludes should match (OR logic for exclusion) - case insensitive
  if (excludes.length > 0) {
    const anyExcludeMatches = excludes.some((pattern) =>
      plainText.includes(pattern.toLowerCase()),
    );

    if (anyExcludeMatches) {
      return false;
    }
  }

  return true;
};
