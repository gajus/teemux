import { describe, expect, it } from 'vitest';
import { stripAnsi } from './stripAnsi.js';

describe('stripAnsi', () => {
  it('returns plain text unchanged', () => {
    expect(stripAnsi('hello world')).toBe('hello world');
  });

  it('strips single color code', () => {
    expect(stripAnsi('\u001B[31mred text\u001B[0m')).toBe('red text');
  });

  it('strips multiple color codes', () => {
    const input = '\u001B[31mred\u001B[0m \u001B[32mgreen\u001B[0m';
    expect(stripAnsi(input)).toBe('red green');
  });

  it('strips bold code', () => {
    expect(stripAnsi('\u001B[1mbold\u001B[0m')).toBe('bold');
  });

  it('strips dim code', () => {
    expect(stripAnsi('\u001B[2mdim\u001B[0m')).toBe('dim');
  });

  it('strips combined codes', () => {
    // Bold + red
    expect(stripAnsi('\u001B[1;31mbold red\u001B[0m')).toBe('bold red');
  });

  it('strips 256 color codes', () => {
    expect(stripAnsi('\u001B[38;5;196mcolor\u001B[0m')).toBe('color');
  });

  it('strips bright color codes', () => {
    expect(stripAnsi('\u001B[91mbright red\u001B[0m')).toBe('bright red');
  });

  it('handles empty string', () => {
    expect(stripAnsi('')).toBe('');
  });

  it('handles string with only ANSI codes', () => {
    expect(stripAnsi('\u001B[31m\u001B[0m')).toBe('');
  });

  it('preserves newlines', () => {
    expect(stripAnsi('line1\nline2')).toBe('line1\nline2');
  });

  it('preserves tabs', () => {
    expect(stripAnsi('col1\tcol2')).toBe('col1\tcol2');
  });

  it('handles realistic log prefix', () => {
    const input = '\u001B[36m[server]\u001B[0m Starting...';
    expect(stripAnsi(input)).toBe('[server] Starting...');
  });

  it('handles nested formatting', () => {
    const input = '\u001B[1m\u001B[31mERROR\u001B[0m: something failed';
    expect(stripAnsi(input)).toBe('ERROR: something failed');
  });
});
