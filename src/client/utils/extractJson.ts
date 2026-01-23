export type ExtractedJson = {
  contentHtml: string;
  json: JsonValue;
  prefixHtml: string;
  suffixHtml: string;
};

export type ExtractedLine = {
  contentHtml: string;
  prefixHtml: string;
  processName: null | string;
};

export type JsonValue =
  | boolean
  | JsonValue[]
  | null
  | number
  | string
  | { [key: string]: JsonValue };

/**
 * Extracts JSON from a log line.
 * Returns the prefix HTML (e.g., [process-name]), parsed JSON, and suffix HTML.
 * Returns null if no valid JSON is found.
 */
export const extractJsonFromLine = (
  raw: string,
  html: string,
): ExtractedJson | null => {
  // Match optional prefix like "[process-name] " in raw text
  const prefixMatch = /^\[[\w-]+\]\s*/u.exec(raw);
  const prefixLength = prefixMatch ? prefixMatch[0].length : 0;
  const content = prefixMatch ? raw.slice(prefixLength).trim() : raw.trim();

  // Check if content looks like JSON
  if (!content.startsWith('{') && !content.startsWith('[')) {
    return null;
  }

  try {
    const json = JSON.parse(content) as JsonValue;

    // Extract prefix HTML - match the source tag: <span style="...">[name]</span> (with optional [ERR])
    const htmlPrefixMatch =
      /^(<span[^>]*>\[[\w-]+\]<\/span>\s*(?:<span[^>]*>\[ERR\]<\/span>\s*)?)/u.exec(
        html,
      );
    const prefixHtml = htmlPrefixMatch ? htmlPrefixMatch[1] : '';
    const contentHtml = htmlPrefixMatch
      ? html.slice(htmlPrefixMatch[0].length)
      : html;
    const suffixHtml = '';

    return { contentHtml, json, prefixHtml, suffixHtml };
  } catch {
    return null;
  }
};

/**
 * Extracts line parts (prefix and content) from a log line.
 * Works for both JSON and non-JSON lines.
 */
export const extractLineParts = (raw: string, html: string): ExtractedLine => {
  // Match optional prefix like "[process-name] " in raw text
  const prefixMatch = /^\[([\w-]+)\]\s*/u.exec(raw);
  const processName = prefixMatch ? prefixMatch[1] : null;

  // Extract prefix HTML - match the source tag: <span style="...">[name]</span> (with optional [ERR])
  const htmlPrefixMatch =
    /^(<span[^>]*>\[[\w-]+\]<\/span>\s*(?:<span[^>]*>\[ERR\]<\/span>\s*)?)/u.exec(
      html,
    );
  const prefixHtml = htmlPrefixMatch ? htmlPrefixMatch[1] : '';
  const contentHtml = htmlPrefixMatch
    ? html.slice(htmlPrefixMatch[0].length)
    : html;

  return { contentHtml, prefixHtml, processName };
};

/**
 * Extracts the color from an HTML prefix containing an inline style.
 * The server assigns ANSI colors which ansi-to-html converts to inline styles.
 *
 * Example input: <span style="color:#00FF00">[process-name]</span>
 * Returns: "#00FF00"
 */
export const extractColorFromPrefix = (html: string): null | string => {
  // Match color in inline style: style="color:#XXXXXX" or style="color:rgb(...)"
  const colorMatch = /style="[^"]*color:\s*([^;"]+)/iu.exec(html);
  if (colorMatch) {
    return colorMatch[1].trim();
  }

  return null;
};

/**
 * Generates a default color for a process based on its name.
 * Used as fallback when no color is found in the HTML.
 */
export const getDefaultColor = (processName: string): string => {
  // Use predefined set of colors for better aesthetics
  const colors = [
    '#4CAF50', // Green
    '#2196F3', // Blue
    '#FF9800', // Orange
    '#9C27B0', // Purple
    '#00BCD4', // Cyan
    '#E91E63', // Pink
    '#CDDC39', // Lime
    '#FF5722', // Deep Orange
  ];

  // Simple hash to generate consistent color for a process
  let hash = 0;

  for (const char of processName) {
    const codePoint = char.codePointAt(0) ?? 0;
    hash = (hash * 31 + codePoint) % 1_000_000_007;
  }

  return colors[Math.abs(hash) % colors.length];
};

/**
 * Extracts the process name from raw log line.
 */
export const extractProcessName = (raw: string): null | string => {
  const match = /^\[([\w-]+)\]/u.exec(raw);
  return match ? match[1] : null;
};
