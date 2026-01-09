import {
  highlightJson,
  highlightJsonText,
  syntaxHighlightJson,
} from './highlightJson.js';
import { describe, expect, it } from 'vitest';

describe('highlightJsonText', () => {
  it('highlights string keys', () => {
    const input = '{&quot;name&quot;:&quot;value&quot;}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-key">&quot;name&quot;</span>');
  });

  it('highlights string values', () => {
    const input = '{&quot;name&quot;:&quot;value&quot;}';
    const result = highlightJsonText(input);

    expect(result).toContain(
      '<span class="json-string">&quot;value&quot;</span>',
    );
  });

  it('highlights numbers', () => {
    const input = '{&quot;count&quot;:42}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-number">42</span>');
  });

  it('highlights negative numbers', () => {
    const input = '{&quot;temp&quot;:-10}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-number">-10</span>');
  });

  it('highlights decimal numbers', () => {
    const input = '{&quot;price&quot;:19.99}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-number">19.99</span>');
  });

  it('highlights exponential numbers', () => {
    const input = '{&quot;big&quot;:1e10}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-number">1e10</span>');
  });

  it('highlights boolean true', () => {
    const input = '{&quot;active&quot;:true}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-bool">true</span>');
  });

  it('highlights boolean false', () => {
    const input = '{&quot;active&quot;:false}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-bool">false</span>');
  });

  it('highlights null', () => {
    const input = '{&quot;value&quot;:null}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-bool">null</span>');
  });

  it('handles complex JSON with multiple types', () => {
    const input =
      '{&quot;name&quot;:&quot;test&quot;,&quot;count&quot;:42,&quot;active&quot;:true,&quot;data&quot;:null}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-key">&quot;name&quot;</span>');
    expect(result).toContain(
      '<span class="json-string">&quot;test&quot;</span>',
    );
    expect(result).toContain('<span class="json-key">&quot;count&quot;</span>');
    expect(result).toContain('<span class="json-number">42</span>');
    expect(result).toContain(
      '<span class="json-key">&quot;active&quot;</span>',
    );
    expect(result).toContain('<span class="json-bool">true</span>');
    expect(result).toContain('<span class="json-key">&quot;data&quot;</span>');
    expect(result).toContain('<span class="json-bool">null</span>');
  });

  it('does not double-wrap keys as strings', () => {
    const input = '{&quot;key&quot;:&quot;value&quot;}';
    const result = highlightJsonText(input);

    // Key should only have json-key class, not json-string
    expect(result).not.toContain('json-key"><span class="json-string"');
    expect(result).not.toContain('json-string"><span class="json-key"');
  });

  it('handles empty string values', () => {
    const input = '{&quot;empty&quot;:&quot;&quot;}';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-string">&quot;&quot;</span>');
  });

  it('handles arrays', () => {
    const input = '[&quot;a&quot;,&quot;b&quot;,1,true]';
    const result = highlightJsonText(input);

    expect(result).toContain('<span class="json-string">&quot;a&quot;</span>');
    expect(result).toContain('<span class="json-string">&quot;b&quot;</span>');
    expect(result).toContain('<span class="json-number">1</span>');
    expect(result).toContain('<span class="json-bool">true</span>');
  });
});

describe('syntaxHighlightJson', () => {
  it('preserves existing HTML tags while highlighting text', () => {
    const input = '<span style="color:red">{&quot;key&quot;:42}</span>';
    const result = syntaxHighlightJson(input);

    expect(result).toContain('<span style="color:red">');
    expect(result).toContain('</span>');
    expect(result).toContain('<span class="json-key">');
    expect(result).toContain('<span class="json-number">42</span>');
  });

  it('handles text without HTML tags', () => {
    const input = '{&quot;key&quot;:&quot;value&quot;}';
    const result = syntaxHighlightJson(input);

    expect(result).toContain('<span class="json-key">&quot;key&quot;</span>');
    expect(result).toContain(
      '<span class="json-string">&quot;value&quot;</span>',
    );
  });
});

describe('highlightJson', () => {
  it('highlights valid JSON with prefix', () => {
    const input =
      '<span style="color:#0AA">[app]</span> {&quot;status&quot;:&quot;ok&quot;}';
    const result = highlightJson(input);

    expect(result).toContain('<span style="color:#0AA">[app]</span>');
    expect(result).toContain(
      '<span class="json-key">&quot;status&quot;</span>',
    );
    expect(result).toContain('<span class="json-string">&quot;ok&quot;</span>');
  });

  it('returns original HTML for non-JSON content', () => {
    const input = '<span>[app]</span> This is not JSON';
    const result = highlightJson(input);

    expect(result).toBe(input);
  });

  it('returns original HTML for invalid JSON', () => {
    const input = '<span>[app]</span> {invalid json}';
    const result = highlightJson(input);

    expect(result).toBe(input);
  });

  it('highlights JSON array', () => {
    const input = '<span>[app]</span> [1, 2, 3]';
    const result = highlightJson(input);

    expect(result).toContain('<span class="json-number">1</span>');
    expect(result).toContain('<span class="json-number">2</span>');
    expect(result).toContain('<span class="json-number">3</span>');
  });

  it('handles JSON without prefix', () => {
    const input = '{&quot;direct&quot;:true}';
    const result = highlightJson(input);

    expect(result).toContain(
      '<span class="json-key">&quot;direct&quot;</span>',
    );
    expect(result).toContain('<span class="json-bool">true</span>');
  });

  it('handles nested JSON objects', () => {
    const input = '{&quot;outer&quot;:{&quot;inner&quot;:&quot;value&quot;}}';
    const result = highlightJson(input);

    expect(result).toContain('<span class="json-key">&quot;outer&quot;</span>');
    expect(result).toContain('<span class="json-key">&quot;inner&quot;</span>');
    expect(result).toContain(
      '<span class="json-string">&quot;value&quot;</span>',
    );
  });
});
