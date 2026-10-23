import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

describe('backslashEscapesHTMLTags option', () => {
  it('turns backslash-escaped HTML tags into escaped entities', () => {
    const converter = new showdown.Converter({ backslashEscapesHTMLTags: true });
    expect(converter.makeHtml(String.raw`\<div\>hello\</div\>`)).toBe('<p>&lt;div&amp;gt;hello&lt;/div&amp;gt;</p>');
    expect(converter.makeHtml(String.raw`para with \<div\> inside`)).toBe('<p>para with &lt;div&amp;gt; inside</p>');
    expect(converter.makeHtml(String.raw`\<div>hello\</div>`)).toBe('<p>&lt;div&gt;hello&lt;/div&gt;</p>');
  });
});
