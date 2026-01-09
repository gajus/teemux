import { stripHtmlTags } from './stripHtmlTags.js';
import { unescapeHtml } from './unescapeHtml.js';

/**
 * Apply syntax highlighting to JSON text that uses HTML-escaped quotes (&quot;).
 * Uses placeholder technique to avoid double-wrapping strings.
 */
export const highlightJsonText = (text: string): string => {
  // First, extract and mark all JSON strings with placeholders
  const strings: string[] = [];
  let result = text.replaceAll(
    /&quot;((?:(?!&quot;).)*)&quot;/gu,
    (_match, content) => {
      strings.push(content as string);
      return `\u0000STR${strings.length - 1}\u0000`;
    },
  );

  // Booleans and null
  result = result.replaceAll(
    /\b(true|false|null)\b/gu,
    '<span class="json-bool">$1</span>',
  );

  // Numbers
  result = result.replaceAll(
    /(?<!\w)(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/gu,
    '<span class="json-number">$1</span>',
  );

  // Restore strings with appropriate highlighting
  result = result.replaceAll(
    /\0STR(\d+)\0(\s*:)?/gu,
    (_match, index, colon) => {
      const content = strings[Number.parseInt(index as string, 10)];
      if (colon) {
        // This is a key
        return `<span class="json-key">&quot;${content}&quot;</span>${colon}`;
      }

      // This is a value
      return `<span class="json-string">&quot;${content}&quot;</span>`;
    },
  );

  return result;
};

/**
 * Process HTML text, applying JSON highlighting only to text outside of HTML tags.
 */
export const syntaxHighlightJson = (html: string): string => {
  let result = '';
  let index = 0;

  while (index < html.length) {
    if (html[index] === '<') {
      // Find end of tag
      const tagEnd = html.indexOf('>', index);
      if (tagEnd === -1) {
        result += html.slice(index);
        break;
      }
      result += html.slice(index, tagEnd + 1);
      index = tagEnd + 1;
    } else {
      // Find next tag or end of string
      const nextTag = html.indexOf('<', index);
      const textEnd = nextTag === -1 ? html.length : nextTag;
      const text = html.slice(index, textEnd);

      // Highlight JSON syntax in this text segment
      result += highlightJsonText(text);
      index = textEnd;
    }
  }

  return result;
};

/**
 * Detect if the content (after prefix) is valid JSON and apply syntax highlighting.
 * Returns the original HTML if not valid JSON.
 */
export const highlightJson = (html: string): string => {
  // Extract the text content (strip HTML tags) to check if it's JSON
  const textContent = stripHtmlTags(html);

  // Unescape HTML entities for JSON parsing
  const unescaped = unescapeHtml(textContent);

  // Find where the actual log content starts (after the prefix like [name])
  const prefixMatch = /^(\[[\w-]+\]\s*)/u.exec(unescaped);
  const prefix = prefixMatch?.[0] ?? '';
  const content = unescaped.slice(prefix.length).trim();

  // Check if the content is valid JSON
  if (!content.startsWith('{') && !content.startsWith('[')) {
    return html;
  }

  try {
    JSON.parse(content);
  } catch {
    return html;
  }

  // It's valid JSON - now highlight it
  // Find the position after the prefix span in the HTML
  const prefixHtmlMatch = /^(<span[^>]*>\[[^\]]+\]<\/span>\s*)/u.exec(html);
  const htmlPrefix = prefixHtmlMatch?.[0] ?? '';
  const jsonHtml = html.slice(htmlPrefix.length);

  // Apply syntax highlighting to the JSON portion
  const highlighted = syntaxHighlightJson(jsonHtml);

  return htmlPrefix + highlighted;
};
