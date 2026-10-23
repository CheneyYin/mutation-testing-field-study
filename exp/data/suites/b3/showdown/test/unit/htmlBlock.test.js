import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

/**
 * Exercises the makehtml.htmlBlock subparser (src/subParsers/makehtml/htmlBlock.js):
 * raw HTML blocks are shielded from markdown parsing, and the backslashEscapesHTMLTags
 * option encodes backslash-escaped tags instead of letting them through as live HTML.
 */
describe('makehtml.htmlBlock (src/subParsers/makehtml/htmlBlock.js)', () => {
  it('shields raw HTML blocks from markdown parsing', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('<div>*not emphasized*</div>'))
      .toBe('<div>*not emphasized*</div>');
  });

  it('encodes backslash-escaped HTML tags when backslashEscapesHTMLTags is enabled', () => {
    const converter = new showdown.Converter({ backslashEscapesHTMLTags: true });
    expect(converter.makeHtml('\\<div>hello\\</div>'))
      .toBe('<p>&lt;div&gt;hello&lt;/div&gt;</p>');
  });
});
