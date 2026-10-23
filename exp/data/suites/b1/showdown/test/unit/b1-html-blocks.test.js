import showdown from 'virtual:showdown';

// Covers the makehtml.htmlBlock subparser (src/subParsers/makehtml/htmlBlock.js, the
// subParser registration and entry block, lines 38-43) through the public converter
// surface, on both recognition strategies: the default (legacy balanced-tag) scanner and
// the CommonMark (cmSpec) one. Expected outputs are the literals from specs/showdown.md
// ("HTML blocks", "The markdown attribute").
describe('HTML blocks (makehtml.htmlBlock)', () => {
  it('passes a balanced block-level element through verbatim without parsing its content as markdown', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('<div>\n*this is not emphasis*\n</div>')).toBe(
      '<div>\n*this is not emphasis*\n</div>'
    );
  });

  it('keeps a table block verbatim between two regular paragraphs', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml(
      'This is a regular paragraph.\n\n' +
      '<table>\n    <tr>\n        <td>Foo</td>\n    </tr>\n</table>\n\n' +
      'This is another regular paragraph.'
    )).toBe(
      '<p>This is a regular paragraph.</p>\n' +
      '<table>\n    <tr>\n        <td>Foo</td>\n    </tr>\n</table>\n' +
      '<p>This is another regular paragraph.</p>'
    );
  });

  it('parses the content of a block whose opening tag carries a markdown attribute', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('<div markdown="1">\n*this is emphasis*\n\n# a heading\n</div>')).toBe(
      '<div markdown="1"><p><em>this is emphasis</em></p>\n<h1 id="a-heading">a heading</h1></div>'
    );
  });

  it('recognizes a CommonMark type-1 HTML block verbatim when cmSpec is enabled', () => {
    const converter = new showdown.Converter({ cmSpec: true });
    expect(converter.makeHtml('<pre language="js">\nfoo\n</pre>')).toBe(
      '<pre language="js">\nfoo\n</pre>'
    );
  });
});
