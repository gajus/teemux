/**
 * Strip ANSI escape codes from text.
 * Removes color codes and other terminal formatting sequences.
 */
export const stripAnsi = (text: string): string => {
  // eslint-disable-next-line no-control-regex
  return text.replaceAll(/\u001B\[[\d;]*m/gu, '');
};
