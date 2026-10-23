import showdown from 'virtual:showdown';

describe('showdown.helper.stdExtName()', () => {
  it('strips special characters and whitespace from extension names and lowercases them', () => {
    expect(showdown.helper.stdExtName('My_Ext. name?')).toBe('myextname');
    expect(showdown.helper.stdExtName('Twitter.Emoji')).toBe('twitteremoji');
  });
});

describe('showdown.helper.cloneObject()', () => {
  it('shallow clone copies own properties only and keeps nested objects by reference', () => {
    const nested = { x: 1 };
    const proto = { inherited: 'from-proto' };
    const source = Object.create(proto);
    source.own = 'value';
    source.nested = nested;
    const clone = showdown.helper.cloneObject(source);
    expect(clone).toEqual({ own: 'value', nested: { x: 1 } });
    expect(clone.inherited).toBeUndefined();
    expect(clone.nested).toBe(nested);
  });

  it('deep clone keeps nested Date objects as real Dates', () => {
    const source = { when: new Date(0) };
    const clone = showdown.helper.cloneObject(source, true);
    expect(clone.when instanceof Date).toBe(true);
    expect(clone.when.getTime()).toBe(0);
    expect(clone.when).not.toBe(source.when);
  });
});
