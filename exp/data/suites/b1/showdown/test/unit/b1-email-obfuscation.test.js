import showdown from 'virtual:showdown';

// Covers src/helpers/url.js encodeEmailAddress (lines 28-33) through the public converter
// surface: an angle-bracket email autolink with the default encodeEmails: true option must
// obfuscate the address (and the mailto: prefix) with decimal character references.
// Expected output is the literal from specs/showdown.md, section "Automatic links -
// Email addresses".
describe('email address obfuscation (encodeEmails)', () => {
  it('encodes every character of an angle-bracket email autolink as decimal character references', () => {
    const converter = new showdown.Converter();
    expect(converter.makeHtml('<address@example.com>')).toBe(
      '<p><a href="&#109;&#97;&#105;&#108;&#116;&#111;&#58;&#97;&#100;&#100;&#114;&#101;&#115;&#115;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;">' +
      '&#97;&#100;&#100;&#114;&#101;&#115;&#115;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;</a></p>'
    );
  });

  it('encodes a bare address identically through showdown.helper.encodeEmailAddress', () => {
    expect(showdown.helper.encodeEmailAddress('me@example.com')).toBe(
      '&#109;&#101;&#64;&#101;&#120;&#97;&#109;&#112;&#108;&#101;&#46;&#99;&#111;&#109;'
    );
  });
});
