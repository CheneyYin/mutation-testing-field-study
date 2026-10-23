import showdown from 'virtual:showdown';

describe('backslashEscapesHTMLTags option', () => {
  it('escapes backslash-escaped multi-character HTML tags into entities', () => {
    const converter = new showdown.Converter({ backslashEscapesHTMLTags: true });
    expect(converter.makeHtml('\\<code>some text\\</code> more')).toBe(
      '<p>&lt;code&gt;some text&lt;/code&gt; more</p>'
    );
  });
});
