export const highlightTerms = (
  html: string,
  terms: string[],
  className: string = '',
): string => {
  if (!terms.length) {
    return html;
  }

  let result = html;
  for (const term of terms) {
    if (!term) {
      continue;
    }

    const escaped = term.replaceAll(/([$()*+.?[\\\]^{|}])/gu, '\\$1');
    const regex = new RegExp('(?![^<]*>)(' + escaped + ')', 'giu');
    const cls = className ? ' class="' + className + '"' : '';
    result = result.replace(regex, '<mark' + cls + '>$1</mark>');
  }

  return result;
};

export const insertCapsulesAfterPrefix = (
  html: string,
  capsules: string,
): string => {
  if (!capsules) {
    return html;
  }

  // Match the source tag prefix: <span style="...">[name]</span> (with optional [ERR] after)
  const prefixMatch =
    /^(<span[^>]*>\[[\w-]+\]<\/span>\s*(?:<span[^>]*>\[ERR\]<\/span>\s*)?)/u.exec(
      html,
    );
  if (prefixMatch) {
    return prefixMatch[1] + capsules + html.slice(prefixMatch[0].length);
  }

  return capsules + html;
};
