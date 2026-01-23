export const extractJsonFields = (
  json: unknown,
  paths: string[],
): Array<{ key: string; value: string }> => {
  if (!json || typeof json !== 'object') {
    return [];
  }

  const results: Array<{ key: string; value: string }> = [];
  for (const path of paths) {
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
      const value =
        typeof current === 'object' ? JSON.stringify(current) : String(current);
      results.push({ key, value });
    }
  }

  return results;
};
