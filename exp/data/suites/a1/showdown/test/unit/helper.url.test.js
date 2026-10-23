import showdown from 'virtual:showdown';

describe('showdown.helper.applyBaseUrl()', () => {
  it('leaves the url untouched when no non-empty baseUrl is given', () => {
    expect(showdown.helper.applyBaseUrl(undefined, ' foo ')).toBe(' foo ');
    expect(showdown.helper.applyBaseUrl('', 'foo ')).toBe('foo ');
  });

  it('prepends the baseUrl to relative paths but not to absolute ones', () => {
    expect(showdown.helper.applyBaseUrl('http://base.com/', 'page.html')).toBe('http://base.com/page.html');
    expect(showdown.helper.applyBaseUrl('http://base.com/', 'p?q=1')).toBe('http://base.com/p?q=1');
    expect(showdown.helper.applyBaseUrl('http://base.com/', 'foo//bar')).toBe('http://base.com/foo//bar');
    expect(showdown.helper.applyBaseUrl('http://base.com/', '//other.com/x')).toBe('//other.com/x');
    expect(showdown.helper.applyBaseUrl('http://base.com/', '#frag')).toBe('#frag');
    expect(showdown.helper.applyBaseUrl('Stryker was here!', 'a:b')).toBe('a://b');
  });
});
