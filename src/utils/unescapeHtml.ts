/**
 * Unescape HTML entities back to their original characters.
 */
export const unescapeHtml = (text: string): string => {
  return text
    .replaceAll('&quot;', '"')
    .replaceAll('&amp;', '&')
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&#x27;', "'")
    .replaceAll('&#39;', "'");
};
