import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

describe('showdown.helper.encodeEmailAddress / encodeEmails option', () => {
  it('entity-encodes an angle-bracket email autolink (both href and text)', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('<john@example.com>')).toBe(
      '<p><a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#106;&#111;&#104;&#110;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;">' +
      '&#106;&#111;&#104;&#110;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;</a></p>'
    );
  });

  it('encodes every character of an address as a decimal character reference', () => {
    expect(showdown.helper.encodeEmailAddress('a@b.io')).toBe('&#97;&#64;&#98;&#46;&#105;&#111;');
  });
});
