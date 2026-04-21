import { describe, expect, it } from 'vitest';
import { normalizeUrl } from '../../src/domain/items/normalize-url';

describe('normalizeUrl', () => {
  it('trims whitespace, lowercases protocol and host, removes fragments and tracking params', () => {
    expect(
      normalizeUrl(
        '  HTTPS://Example.COM/Article/?utm_source=newsletter&utm_medium=email&id=42#comments  '
      )
    ).toBe('https://example.com/Article?id=42');
  });

  it('normalizes a trailing slash for root and non-root paths consistently', () => {
    expect(normalizeUrl('https://example.com/')).toBe('https://example.com/');
    expect(normalizeUrl('https://example.com/article/')).toBe('https://example.com/article');
  });
});
