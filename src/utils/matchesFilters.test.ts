import { describe, expect, it } from 'vitest';
import { matchesFilters } from './matchesFilters.js';

describe('matchesFilters', () => {
  describe('with no filters', () => {
    it('returns true for any line', () => {
      expect(matchesFilters('any text', [], [])).toBe(true);
    });

    it('returns true for empty line', () => {
      expect(matchesFilters('', [], [])).toBe(true);
    });
  });

  describe('query filtering (AND logic)', () => {
    it('matches when single query is present', () => {
      expect(matchesFilters('hello world', ['hello'], [])).toBe(true);
    });

    it('does not match when single query is absent', () => {
      expect(matchesFilters('hello world', ['foo'], [])).toBe(false);
    });

    it('matches when all queries are present', () => {
      expect(matchesFilters('hello world foo', ['hello', 'foo'], [])).toBe(
        true,
      );
    });

    it('does not match when only some queries are present', () => {
      expect(matchesFilters('hello world', ['hello', 'foo'], [])).toBe(false);
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

  describe('combined query and exclude', () => {
    it('includes when query matches and exclude does not', () => {
      expect(matchesFilters('info: success', ['info'], ['error'])).toBe(true);
    });

    it('excludes when both query and exclude match', () => {
      expect(matchesFilters('error: info', ['info'], ['error'])).toBe(false);
    });

    it('excludes when query does not match', () => {
      expect(matchesFilters('hello world', ['foo'], ['bar'])).toBe(false);
    });
  });

  describe('with ANSI codes', () => {
    it('ignores ANSI codes when matching queries', () => {
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
      expect(matchesFilters(line, ['error', 'connection'], [])).toBe(true);
      expect(matchesFilters(line, [], ['error'])).toBe(false);
    });
  });

  describe('edge cases', () => {
    it('handles empty queries array with excludes', () => {
      expect(matchesFilters('hello', [], ['foo'])).toBe(true);
    });

    it('handles empty excludes array with queries', () => {
      expect(matchesFilters('hello', ['hello'], [])).toBe(true);
    });

    it('handles whitespace in queries', () => {
      expect(matchesFilters('hello world', ['hello world'], [])).toBe(true);
    });

    it('handles special regex characters in queries', () => {
      expect(matchesFilters('price: $10.00', ['$10'], [])).toBe(true);
      expect(matchesFilters('path/to/file', ['path/to'], [])).toBe(true);
    });

    it('handles unicode characters', () => {
      expect(matchesFilters('Hello 世界', ['世界'], [])).toBe(true);
    });
  });
});
