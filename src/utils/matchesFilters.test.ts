import { matchesFilters } from './matchesFilters.js';
import { describe, expect, it } from 'vitest';

describe('matchesFilters', () => {
  describe('with no filters', () => {
    it('returns true for any line', () => {
      expect(matchesFilters('any text', [], [])).toBe(true);
    });

    it('returns true for empty line', () => {
      expect(matchesFilters('', [], [])).toBe(true);
    });
  });

  describe('include filtering (OR logic)', () => {
    it('matches when single include is present', () => {
      expect(matchesFilters('hello world', ['hello'], [])).toBe(true);
    });

    it('does not match when single include is absent', () => {
      expect(matchesFilters('hello world', ['foo'], [])).toBe(false);
    });

    it('matches when any include is present', () => {
      expect(matchesFilters('hello world', ['hello', 'foo'], [])).toBe(true);
    });

    it('matches when all includes are present', () => {
      expect(matchesFilters('hello world foo', ['hello', 'foo'], [])).toBe(
        true,
      );
    });

    it('does not match when no includes are present', () => {
      expect(matchesFilters('hello world', ['foo', 'bar'], [])).toBe(false);
    });

    it('is case insensitive', () => {
      expect(matchesFilters('Hello World', ['hello'], [])).toBe(true);
      expect(matchesFilters('hello world', ['HELLO'], [])).toBe(true);
    });

    it('matches partial words', () => {
      expect(matchesFilters('hello world', ['ell'], [])).toBe(true);
    });
  });

  describe('exclude filtering (OR logic)', () => {
    it('excludes when single pattern matches', () => {
      expect(matchesFilters('error occurred', [], ['error'])).toBe(false);
    });

    it('includes when single pattern does not match', () => {
      expect(matchesFilters('info message', [], ['error'])).toBe(true);
    });

    it('excludes when any pattern matches', () => {
      expect(matchesFilters('warning message', [], ['error', 'warning'])).toBe(
        false,
      );
    });

    it('includes when no patterns match', () => {
      expect(matchesFilters('info message', [], ['error', 'warning'])).toBe(
        true,
      );
    });

    it('is case insensitive', () => {
      expect(matchesFilters('ERROR occurred', [], ['error'])).toBe(false);
      expect(matchesFilters('error occurred', [], ['ERROR'])).toBe(false);
    });

    it('matches partial words', () => {
      expect(matchesFilters('error123', [], ['err'])).toBe(false);
    });
  });

  describe('combined include and exclude', () => {
    it('includes when include matches and exclude does not', () => {
      expect(matchesFilters('info: success', ['info'], ['error'])).toBe(true);
    });

    it('excludes when both include and exclude match', () => {
      expect(matchesFilters('error: info', ['info'], ['error'])).toBe(false);
    });

    it('excludes when include does not match', () => {
      expect(matchesFilters('hello world', ['foo'], ['bar'])).toBe(false);
    });
  });

  describe('with ANSI codes', () => {
    it('ignores ANSI codes when matching includes', () => {
      const line = '\u001B[31merror\u001B[0m: something failed';
      expect(matchesFilters(line, ['error'], [])).toBe(true);
    });

    it('ignores ANSI codes when matching excludes', () => {
      const line = '\u001B[32minfo\u001B[0m: all good';
      expect(matchesFilters(line, [], ['error'])).toBe(true);
    });

    it('matches text inside ANSI codes', () => {
      const line = '\u001B[36m[server]\u001B[0m Starting...';
      expect(matchesFilters(line, ['server'], [])).toBe(true);
    });

    it('handles complex colored output', () => {
      const line =
        '\u001B[90m[teemux]\u001B[0m \u001B[1;31mERROR\u001B[0m: Connection failed';
      // OR logic: matches if error OR connection is present (both are)
      expect(matchesFilters(line, ['error', 'connection'], [])).toBe(true);
      // Also matches with just one term present
      expect(matchesFilters(line, ['error', 'foobar'], [])).toBe(true);
      expect(matchesFilters(line, [], ['error'])).toBe(false);
    });
  });

  describe('glob patterns with *', () => {
    it('matches with * at the end', () => {
      expect(matchesFilters('error: something failed', ['error*'], [])).toBe(
        true,
      );
      expect(matchesFilters('info: all good', ['error*'], [])).toBe(false);
    });

    it('matches with * at the start', () => {
      expect(matchesFilters('request failed', ['*failed'], [])).toBe(true);
      expect(matchesFilters('request succeeded', ['*failed'], [])).toBe(false);
    });

    it('matches with * in the middle', () => {
      expect(matchesFilters('[api] error occurred', ['[api]*error'], [])).toBe(
        true,
      );
      expect(
        matchesFilters('[worker] error occurred', ['[api]*error'], []),
      ).toBe(false);
    });

    it('matches with multiple *', () => {
      expect(matchesFilters('[api] GET /users 200', ['*GET*/users*'], [])).toBe(
        true,
      );
      expect(
        matchesFilters('[api] POST /users 201', ['*GET*/users*'], []),
      ).toBe(false);
    });

    it('matches * as any characters (including empty)', () => {
      expect(matchesFilters('error', ['error*'], [])).toBe(true);
      expect(matchesFilters('error:', ['error*'], [])).toBe(true);
      expect(matchesFilters('error: failed', ['error*'], [])).toBe(true);
    });

    it('is case insensitive with globs', () => {
      expect(matchesFilters('ERROR: failed', ['error*'], [])).toBe(true);
      expect(matchesFilters('error: FAILED', ['*FAILED'], [])).toBe(true);
    });

    it('works with excludes', () => {
      expect(matchesFilters('healthcheck OK', [], ['health*'])).toBe(false);
      expect(matchesFilters('error occurred', [], ['health*'])).toBe(true);
    });

    it('escapes regex special characters in glob patterns', () => {
      // . is escaped (literal), so file.* matches "file." followed by anything
      expect(matchesFilters('file.txt', ['file.*'], [])).toBe(true);
      expect(matchesFilters('file_txt', ['file.*'], [])).toBe(false); // no literal . in text
      expect(matchesFilters('price: $10.00', ['$10*'], [])).toBe(true);
      expect(matchesFilters('[api] log', ['[api]*'], [])).toBe(true);
    });

    it('handles pattern with only *', () => {
      expect(matchesFilters('anything', ['*'], [])).toBe(true);
      expect(matchesFilters('', ['*'], [])).toBe(true);
    });
  });

  describe('edge cases', () => {
    it('handles empty includes array with excludes', () => {
      expect(matchesFilters('hello', [], ['foo'])).toBe(true);
    });

    it('handles empty excludes array with includes', () => {
      expect(matchesFilters('hello', ['hello'], [])).toBe(true);
    });

    it('handles whitespace in includes', () => {
      expect(matchesFilters('hello world', ['hello world'], [])).toBe(true);
    });

    it('handles special regex characters in includes', () => {
      expect(matchesFilters('price: $10.00', ['$10'], [])).toBe(true);
      expect(matchesFilters('path/to/file', ['path/to'], [])).toBe(true);
    });

    it('handles unicode characters', () => {
      expect(matchesFilters('Hello 世界', ['世界'], [])).toBe(true);
    });
  });
});
