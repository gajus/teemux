/**
 * Convert URLs in HTML text to clickable anchor tags.
 * Supports http://, https://, and file:// URLs.
 * Avoids double-linking URLs that are already in href attributes.
 */
export const linkifyUrls = (html: string): string => {
  // Match URLs that are not already inside href attributes
  // Supports http://, https://, and file:// URLs
  // Exclude common delimiters and HTML entities (&quot; &amp; etc)
  const urlRegex = /(?<!href=["'])(?:https?|file):\/\/[^\s<>"'{}&]+/gu;

  return html.replaceAll(urlRegex, (url) => {
    // Remove trailing punctuation that's likely not part of the URL
    const cleanUrl = url.replace(/[.,;:!?)\]]+$/u, '');
    const trailing = url.slice(cleanUrl.length);

    // Escape HTML entities in the URL for the href attribute
    const escapedHref = cleanUrl
      .replaceAll('&', '&amp;')
      .replaceAll('"', '&quot;');

    return `<a href="${escapedHref}" target="_blank" rel="noopener">${cleanUrl}</a>${trailing}`;
  });
};
