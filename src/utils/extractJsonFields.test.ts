import { extractJsonFields } from './extractJsonFields.js';
import { describe, expect, it } from 'vitest';

describe('extractJsonFields', () => {
  describe('basic extraction', () => {
    it('extracts top-level string field', () => {
      const json = { level: 'error', message: 'something failed' };
      const result = extractJsonFields(json, ['level']);
      expect(result).toEqual([{ key: 'level', value: 'error' }]);
    });

    it('extracts multiple top-level fields', () => {
      const json = { level: 'error', message: 'something failed' };
      const result = extractJsonFields(json, ['level', 'message']);
      expect(result).toEqual([
        { key: 'level', value: 'error' },
        { key: 'message', value: 'something failed' },
      ]);
    });

    it('extracts number fields as strings', () => {
      const json = { code: 500, count: 42 };
      const result = extractJsonFields(json, ['code', 'count']);
      expect(result).toEqual([
        { key: 'code', value: '500' },
        { key: 'count', value: '42' },
      ]);
    });

    it('extracts boolean fields as strings', () => {
      const json = { failed: false, success: true };
      const result = extractJsonFields(json, ['success', 'failed']);
      expect(result).toEqual([
        { key: 'success', value: 'true' },
        { key: 'failed', value: 'false' },
      ]);
    });
  });

  describe('nested extraction', () => {
    it('extracts nested fields with dot notation', () => {
      const json = { error: { code: 404, message: 'not found' } };
      const result = extractJsonFields(json, ['error.message']);
      expect(result).toEqual([{ key: 'message', value: 'not found' }]);
    });

    it('extracts deeply nested fields', () => {
      const json = { response: { data: { user: { name: 'John' } } } };
      const result = extractJsonFields(json, ['response.data.user.name']);
      expect(result).toEqual([{ key: 'name', value: 'John' }]);
    });

    it('extracts object values as JSON strings', () => {
      const json = {
        error: { details: { field: 'email', reason: 'invalid' } },
      };
      const result = extractJsonFields(json, ['error.details']);
      expect(result).toEqual([
        { key: 'details', value: '{"field":"email","reason":"invalid"}' },
      ]);
    });

    it('extracts array values as JSON strings', () => {
      const json = { tags: ['error', 'critical'] };
      const result = extractJsonFields(json, ['tags']);
      expect(result).toEqual([{ key: 'tags', value: '["error","critical"]' }]);
    });
  });

  describe('missing fields', () => {
    it('skips missing top-level fields', () => {
      const json = { level: 'error' };
      const result = extractJsonFields(json, ['level', 'missing']);
      expect(result).toEqual([{ key: 'level', value: 'error' }]);
    });

    it('skips missing nested fields', () => {
      const json = { error: { message: 'failed' } };
      const result = extractJsonFields(json, ['error.code', 'error.message']);
      expect(result).toEqual([{ key: 'message', value: 'failed' }]);
    });

    it('skips when parent path does not exist', () => {
      const json = { level: 'error' };
      const result = extractJsonFields(json, ['missing.field']);
      expect(result).toEqual([]);
    });

    it('skips null values', () => {
      const json = { level: 'error', message: null };
      const result = extractJsonFields(json, ['level', 'message']);
      expect(result).toEqual([{ key: 'level', value: 'error' }]);
    });

    it('skips undefined values', () => {
      const json = { level: 'error', message: undefined };
      const result = extractJsonFields(json, ['level', 'message']);
      expect(result).toEqual([{ key: 'level', value: 'error' }]);
    });
  });

  describe('edge cases', () => {
    it('returns empty array for null input', () => {
      const result = extractJsonFields(null, ['level']);
      expect(result).toEqual([]);
    });

    it('returns empty array for undefined input', () => {
      const result = extractJsonFields(undefined, ['level']);
      expect(result).toEqual([]);
    });

    it('returns empty array for non-object input', () => {
      const result = extractJsonFields('string', ['level']);
      expect(result).toEqual([]);
    });

    it('returns empty array for empty paths', () => {
      const json = { level: 'error' };
      const result = extractJsonFields(json, []);
      expect(result).toEqual([]);
    });

    it('handles empty string values', () => {
      const json = { level: '' };
      const result = extractJsonFields(json, ['level']);
      expect(result).toEqual([{ key: 'level', value: '' }]);
    });

    it('handles zero values', () => {
      const json = { count: 0 };
      const result = extractJsonFields(json, ['count']);
      expect(result).toEqual([{ key: 'count', value: '0' }]);
    });

    it('uses last segment as key for nested paths', () => {
      const json = { aa: { bb: { cc: 'value' } } };
      const result = extractJsonFields(json, ['aa.bb.cc']);
      expect(result).toEqual([{ key: 'cc', value: 'value' }]);
    });
  });
});
