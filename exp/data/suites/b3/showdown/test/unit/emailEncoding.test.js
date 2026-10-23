import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

/**
 * Exercises showdown.helper.encodeEmailAddress (src/helpers/url.js): with encodeEmails
 * enabled, every character of a mailto autolink's address — including the scheme and
 * the @ — is replaced by its decimal character reference.
 */
describe('encodeEmails (src/helpers/url.js)', () => {
  it('encodes mailto autolinks as decimal character references', () => {
    const converter = new showdown.Converter({ encodeEmails: true });
    expect(converter.makeHtml('<me@example.com>'))
      .toBe('<p><a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#109;&#101;&#64;&#101;' +
        '&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;">&#109;&#101;&#64;&#101;' +
        '&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;</a></p>');
  });
});
