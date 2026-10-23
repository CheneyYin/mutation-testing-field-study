import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

describe('relativePathBaseUrl option', () => {
  it('resolves relative link destinations against the base but keeps anchors and protocol-relative URLs untouched', () => {
    const converter = new showdown.Converter({ relativePathBaseUrl: 'http://example.com/dir/' });
    expect(converter.makeHtml('[link](page.html)')).toBe('<p><a href="http://example.com/dir/page.html">link</a></p>');
    expect(converter.makeHtml('[link](#section)')).toBe('<p><a href="#section">link</a></p>');
    expect(converter.makeHtml('[link](//example.com/x)')).toBe('<p><a href="//example.com/x">link</a></p>');
    expect(converter.makeHtml('[link](foo//bar)')).toBe('<p><a href="http://example.com/dir/foo//bar">link</a></p>');
  });
});

describe('showdown.helper.applyBaseUrl()', () => {
  it('returns the path unchanged when no base URL is given and resolves an empty path to the base itself', () => {
    expect(showdown.helper.applyBaseUrl(undefined, 'page.html ')).toBe('page.html ');
    expect(showdown.helper.applyBaseUrl('', 'page.html')).toBe('page.html');
    expect(showdown.helper.applyBaseUrl('http://example.com/dir/', '')).toBe('http://example.com/dir/');
    expect(showdown.helper.applyBaseUrl('Stryker was here!', '')).toBe('Stryker was here!');
  });
});
