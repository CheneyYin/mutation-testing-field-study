import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

describe('showdown.helper.regexes CommonMark raw-HTML grammar sources', () => {
  it('matches open/close tags, comments (also --!> terminated), PIs, declarations and CDATA', () => {
    const openTag = new RegExp('^' + showdown.helper.regexes.cmOpenTagSource + '[ \t]*$');
    expect(openTag.test('<span>')).toBe(true);
    expect(openTag.test('<div class="x" data-a=\'v\'>')).toBe(true);
    expect(openTag.test('<br/>')).toBe(true);
    expect(openTag.test('<h1 id="a b">')).toBe(true);
    expect(openTag.test('plain text')).toBe(false);
    expect(openTag.test('<div> trailing text')).toBe(false);
    expect(openTag.test('</div>')).toBe(false);

    const closeTag = new RegExp('^' + showdown.helper.regexes.cmCloseTagSource + '[ \t]*$');
    expect(closeTag.test('</div>')).toBe(true);
    expect(closeTag.test('</my-tag >')).toBe(true);
    expect(closeTag.test('</ div>')).toBe(false);
    expect(closeTag.test('<div>')).toBe(false);

    const anyTag = new RegExp('^' + showdown.helper.regexes.cmHTMLTagSource + '$');
    expect(anyTag.test('<!-- comment -->')).toBe(true);
    expect(anyTag.test('<!-- bang-terminated --!>')).toBe(true);
    expect(anyTag.test('<!-->')).toBe(true);
    expect(anyTag.test('<!--->')).toBe(true);
    expect(anyTag.test('<?php echo 1; ?>')).toBe(true);
    expect(anyTag.test('<!DOCTYPE html>')).toBe(true);
    expect(anyTag.test('<![CDATA[ raw & <text> ]]>')).toBe(true);
    expect(anyTag.test('<!-- unterminated')).toBe(false);
    expect(anyTag.test('no tag at all')).toBe(false);
  });
});
