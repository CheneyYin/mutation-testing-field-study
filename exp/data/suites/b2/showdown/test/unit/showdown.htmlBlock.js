import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

describe('makehtml.htmlBlock subparser', () => {
  it('passes a balanced raw HTML block through verbatim (legacy scanner)', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('some text\n\n<div class="foo">\nraw & content\n</div>\n\nmore text')).toBe(
      '<p>some text</p>\n<div class="foo">\nraw & content\n</div>\n<p>more text</p>'
    );
  });

  it('parses the interior of a markdown="1" block as markdown', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('<div markdown="1">\n*em* text\n</div>')).toBe(
      '<div markdown="1"><p><em>em</em> text</p></div>'
    );
  });

  it('treats --!> as an HTML comment terminator so commented content cannot leak (legacy and cmSpec)', () => {
    const legacy = new showdown.Converter();
    expect(legacy.makeHtml('<!-- this "comment" ends with a bang --!>')).toBe(
      '<!-- this "comment" ends with a bang --!>'
    );
    const cm = new showdown.Converter({ cmSpec: true });
    expect(cm.makeHtml('<!-- this "comment" ends with a bang --!>')).toBe(
      '<!-- this "comment" ends with a bang --!>'
    );
  });

  it('recognizes CommonMark type 7 HTML blocks: a complete tag alone on its line (cmSpec)', () => {
    const converter = new showdown.Converter({ cmSpec: true });
    expect(converter.makeHtml('a paragraph\n\n<span>')).toBe(
      '<p>a paragraph</p>\n<span>'
    );
    expect(converter.makeHtml('a paragraph\n\n</div>')).toBe(
      '<p>a paragraph</p>\n</div>'
    );
  });
});
