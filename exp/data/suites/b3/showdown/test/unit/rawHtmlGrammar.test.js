import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

/**
 * Exercises the CommonMark inline raw-HTML grammar assembled in src/helpers/regexes.js
 * (the cm* constants and showdown.helper.regexes): open tags with attributes, the
 * deliberate `--!>` comment-end-bang deviation, processing instructions, declarations
 * and CDATA sections. All of these are hashed verbatim by makehtml/rawHtml.js, which
 * builds its recognizer from cmHTMLTagSource.
 */
describe('inline raw HTML grammar (src/helpers/regexes.js)', () => {
  it('passes open and close tags with attributes through verbatim', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('foo <b class="x" data-y=\'1\'>bar</b> baz'))
      .toBe('<p>foo <b class="x" data-y=\'1\'>bar</b> baz</p>');
  });

  it('terminates comments at --!> and keeps the commented-out markup inert', () => {
    const converter = new showdown.Converter();
    // `--!>` (the HTML comment-end-bang state) closes the comment just like `-->`,
    // so the <b> inside never becomes live HTML.
    expect(converter.makeHtml('foo <!-- <b>x</b> --!> baz'))
      .toBe('<p>foo <!-- <b>x</b> --!> baz</p>');
  });

  it('passes processing instructions, declarations and CDATA sections through verbatim', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('foo <?php echo 7; ?> bar'))
      .toBe('<p>foo <?php echo 7; ?> bar</p>');
    expect(converter.makeHtml('foo <!DOCTYPE html> bar'))
      .toBe('<p>foo <!DOCTYPE html> bar</p>');
    expect(converter.makeHtml('foo <![CDATA[bar]]> baz'))
      .toBe('<p>foo <![CDATA[bar]]> baz</p>');
  });
});
