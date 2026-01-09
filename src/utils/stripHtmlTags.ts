/**
 * Strip HTML tags from a string, leaving only text content.
 */
export const stripHtmlTags = (html: string): string => {
  return html.replaceAll(/<[^>]*>/gu, '');
};
