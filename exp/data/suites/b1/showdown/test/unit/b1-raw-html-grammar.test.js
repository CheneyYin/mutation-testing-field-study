import showdown from 'virtual:showdown';

// Covers the CommonMark inline raw-HTML grammar constants declared at load time in
// src/helpers/regexes.js (the cmAttributeName/cmAttributeValue/cmAttribute/cmOpenTag/
// cmCloseTag chain, lines 17-21, and cmHTMLComment/cmProcessingInstruction, lines 26-27)
// by building regexes from the exported grammar sources and asserting concrete matches.
// These sources are the shared grammar the cmSpec HTML-block type-7 start condition and
// the inline raw-HTML construct are built from.
describe('raw-HTML grammar sources (showdown.helper.regexes)', () => {
  it('matches complete open tags and close tags via cmOpenTagSource and cmCloseTagSource', () => {
    const openTag = new RegExp('^' + showdown.helper.regexes.cmOpenTagSource + '$');
    const closeTag = new RegExp('^' + showdown.helper.regexes.cmCloseTagSource + '$');
    expect(openTag.test('<div>')).toBe(true);
    expect(openTag.test('<div class="foo bar">')).toBe(true);
    expect(openTag.test("<span data-x='1'>")).toBe(true);
    expect(openTag.test('<hr />')).toBe(true);
    expect(openTag.test('<hr>')).toBe(true);
    expect(openTag.test('</div>')).toBe(false);
    expect(openTag.test('<div')).toBe(false);
    expect(openTag.test('<123>')).toBe(false);
    expect(closeTag.test('</div>')).toBe(true);
    expect(closeTag.test('</div >')).toBe(true);
    expect(closeTag.test('<div>')).toBe(false);
    expect(closeTag.test('</div foo>')).toBe(false);
  });

  it('recognizes comments, processor instructions, declarations and CDATA via cmHTMLTagSource', () => {
    const htmlTag = new RegExp('^' + showdown.helper.regexes.cmHTMLTagSource + '$');
    expect(htmlTag.test('<!-- a comment -->')).toBe(true);
    expect(htmlTag.test('<!-->')).toBe(true);
    expect(htmlTag.test('<!--->')).toBe(true);
    expect(htmlTag.test('<?php echo 1; ?>')).toBe(true);
    expect(htmlTag.test('<!DOCTYPE html>')).toBe(true);
    expect(htmlTag.test('<![CDATA[raw & <data>]]>')).toBe(true);
    expect(htmlTag.test('just plain text')).toBe(false);
    expect(htmlTag.test('a <div> b')).toBe(false);
    expect(htmlTag.test('<div')).toBe(false);
  });

  it('terminates comments on the --!> comment-end-bang form as well as -->', () => {
    const htmlTag = new RegExp('^' + showdown.helper.regexes.cmHTMLTagSource + '$');
    expect(htmlTag.test('<!-- commented out --!>')).toBe(true);
    expect(htmlTag.test('<!-- commented out -->')).toBe(true);
    // the comment body may not contain a bare `--` terminator followed by junk
    expect(htmlTag.test('<!-- a -- b -->')).toBe(true);
  });
});
