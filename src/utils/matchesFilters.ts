import { stripAnsi } from './stripAnsi.js';

/**
 * Check if a line matches the given filter criteria.
 *
 * @param line - The line to check (may contain ANSI codes)
 * @param queries - Terms that must ALL be present (AND logic), case-insensitive
 * @param excludes - Terms where ANY match excludes the line (OR logic), case-insensitive
 * @returns true if the line should be included, false if filtered out
 */
export const matchesFilters = (
  line: string,
  queries: string[],
  excludes: string[],
): boolean => {
  const plainText = stripAnsi(line).toLowerCase();

  // All queries must match (AND logic) - case insensitive
  if (queries.length > 0) {
    const allQueriesMatch = queries.every((query) =>
      plainText.includes(query.toLowerCase()),
    );

    if (!allQueriesMatch) {
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
