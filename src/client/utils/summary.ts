const escapeHtml = (text: string): string => {
  return text
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;');
};

const tryParseJsonContent = (text: string): null | Record<string, unknown> => {
  const prefixMatch = /^\[[\w-]+\]\s*/u.exec(text);
  const content = prefixMatch
    ? text.slice(prefixMatch[0].length).trim()
    : text.trim();
  if (!content.startsWith('{') && !content.startsWith('[')) {
    return null;
  }

  try {
    return JSON.parse(content) as Record<string, unknown>;
  } catch {
    return null;
  }
};

export const buildSummaryCapsules = (
  raw: string,
  summaryPaths: string[],
): string => {
  if (!summaryPaths.length) {
    return '';
  }

  const json = tryParseJsonContent(raw);
  if (!json) {
    return '';
  }

  const capsules: string[] = [];

  for (const path of summaryPaths) {
    const segments = path.split('.');
    let current: unknown = json;

    for (const segment of segments) {
      if (current && typeof current === 'object' && segment in current) {
        current = (current as Record<string, unknown>)[segment];
      } else {
        current = undefined;
        break;
      }
    }

    if (current !== undefined && current !== null) {
      const key = segments[segments.length - 1];
      let value =
        typeof current === 'object' ? JSON.stringify(current) : String(current);
      if (value.length > 50) {
        value = value.slice(0, 47) + '...';
      }

      capsules.push(
        '<span class="summary-capsule">' +
          '<span class="summary-capsule-key">' +
          escapeHtml(key) +
          ':</span> ' +
          '<span class="summary-capsule-value">' +
          escapeHtml(value) +
          '</span></span>',
      );
    }
  }

  return capsules.join('');
};
