import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SRC_ORDER = [
  'options.js',
  'showdown.js',
  'helpers/lazyDocument.js',
  'helpers/types.js',
  'helpers/escapes.js',
  'helpers/url.js',
  'helpers/encodeCode.js',
  'helpers/markdownEscapes.js',
  'helpers/commonmark.js',
  'helpers/text.js',
  'helpers/misc.js',
  'helpers/regexes.js',
  'helpers/emojis.js',
  'event.js',
  'subParsers/makehtml/blockGamut.js',
  'subParsers/makehtml/htmlBlock.js',
  'subParsers/makehtml/blockquote.js',
  'helpers/gfmAutolinks.js',
  'subParsers/makehtml/ellipsis.js',
  'subParsers/makehtml/underline.js',
  'subParsers/makehtml/entity.js',
  'subParsers/makehtml/autolink.js',
  'subParsers/makehtml/rawHtml.js',
  'subParsers/makehtml/spanGamut.js',
  'subParsers/makehtml/backslash.js',
  'subParsers/makehtml/emphasis.js',
  'subParsers/makehtml/link.js',
  'subParsers/makehtml/nakedUrl.js',
  'subParsers/makehtml/ghMentions.js',
  'subParsers/makehtml/codeBlock.js',
  'subParsers/makehtml/codeSpan.js',
  'subParsers/makehtml/completeHTMLDocument.js',
  'subParsers/makehtml/decodeEntities.js',
  'subParsers/makehtml/disallowedHtmlTags.js',
  'subParsers/makehtml/strikethrough.js',
  'subParsers/makehtml/image.js',
  'subParsers/makehtml/footnotes.js',
  'subParsers/makehtml/githubCodeBlock.js',
  'subParsers/makehtml/hardLineBreaks.js',
  'helpers/hashBlock.js',
  'helpers/hashHTMLBlocks.js',
  'helpers/hashHTMLSpans.js',
  'subParsers/makehtml/heading.js',
  'subParsers/makehtml/horizontalRule.js',
  'helpers/htmlEntities.js',
  'subParsers/makehtml/emoji.js',
  'subParsers/makehtml/list.js',
  'subParsers/makehtml/metadata.js',
  'subParsers/makehtml/paragraphs.js',
  'subParsers/makehtml/stripLinkDefinitions.js',
  'subParsers/makehtml/table.js',
  'subParsers/makehtml/taskListItem.js',
  'helpers/unhashHTMLSpans.js',
  'subParsers/makemarkdown/blockquote.js',
  'subParsers/makemarkdown/break.js',
  'subParsers/makemarkdown/codeBlock.js',
  'subParsers/makemarkdown/codeSpan.js',
  'subParsers/makemarkdown/emphasis.js',
  'subParsers/makemarkdown/footnotes.js',
  'subParsers/makemarkdown/header.js',
  'subParsers/makemarkdown/hr.js',
  'subParsers/makemarkdown/image.js',
  'subParsers/makemarkdown/input.js',
  'subParsers/makemarkdown/links.js',
  'subParsers/makemarkdown/list.js',
  'subParsers/makemarkdown/listItem.js',
  'subParsers/makemarkdown/node.js',
  'subParsers/makemarkdown/paragraph.js',
  'subParsers/makemarkdown/pre.js',
  'subParsers/makemarkdown/strikethrough.js',
  'subParsers/makemarkdown/strong.js',
  'subParsers/makemarkdown/table.js',
  'subParsers/makemarkdown/tableCell.js',
  'subParsers/makemarkdown/txt.js',
  'subParsers/makemarkdown/underline.js',
  'converter.js',
  'loader.js'
];

function loadShowdown () {
  const srcDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'src');
  const concat = SRC_ORDER.map(file => fs.readFileSync(path.join(srcDir, file), 'utf8')).join('\n');
  return new Function('module', concat + '\nreturn showdown;')(undefined);
}

describe('edge case regressions', () => {
  const showdown = loadShowdown();

  it('stdExtName strips special characters, whitespace and lowercases the name', () => {
    expect(showdown.helper.stdExtName('my Extension?')).toBe('myextension');
    expect(showdown.helper.stdExtName('the_cool+extension.')).toBe('thecoolextension');
  });

  it('cloneObject shallow copy only clones own properties', () => {
    const source = Object.create({ inherited: 'from-proto' });
    source.own = 'own-value';
    const clone = showdown.helper.cloneObject(source);
    expect(clone.own).toBe('own-value');
    expect(clone.inherited).toBeUndefined();
    expect(Object.keys(clone)).toEqual(['own']);
  });

  it('cloneObject deep clone preserves Date values', () => {
    const original = { when: new Date(0), name: 'orig' };
    const clone = showdown.helper.cloneObject(original, true);
    expect(clone.name).toBe('orig');
    expect(clone.when instanceof Date).toBe(true);
    expect(clone.when.getTime()).toBe(0);
    expect(clone.when).not.toBe(original.when);
  });

  it('applyBaseUrl prepends the base URL only to relative paths', () => {
    expect(showdown.helper.applyBaseUrl('http://example.com/dir/page', 'sub'))
      .toBe('http://example.com/dir/sub');
    expect(showdown.helper.applyBaseUrl('http://example.com/', '#anchor')).toBe('#anchor');
    expect(showdown.helper.applyBaseUrl(undefined, ' foo ')).toBe(' foo ');
    expect(showdown.helper.applyBaseUrl('Stryker was here!', './foo')).toBe('foo');
  });

  it('applyBaseUrl leaves protocol-relative URLs untouched', () => {
    expect(showdown.helper.applyBaseUrl('https://base.example.com/', '//cdn.example.com/lib.js'))
      .toBe('//cdn.example.com/lib.js');
  });

  it('escapes backslash-escaped HTML tags inside raw HTML blocks', () => {
    const converter = new showdown.Converter({ backslashEscapesHTMLTags: true });
    expect(converter.makeHtml('<div>\n\\<span>\n\\</span>\n</div>'))
      .toBe('<div>\n&lt;span&gt;\n&lt;/span&gt;\n</div>');
  });
});
