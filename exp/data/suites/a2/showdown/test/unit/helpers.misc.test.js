import { describe, it, expect } from 'vitest';
import showdown from 'virtual:showdown';

describe('showdown.helper.stdExtName()', () => {
  it('strips special characters and whitespace from extension names and lowercases them', () => {
    expect(showdown.helper.stdExtName('my-extension')).toBe('myextension');
    expect(showdown.helper.stdExtName('My_Ext.v2?')).toBe('myextv2');
    expect(showdown.helper.stdExtName('foo bar')).toBe('foobar');
  });
});

describe('showdown.helper.cloneObject()', () => {
  it('copies own enumerable properties only when shallow cloning', () => {
    const source = Object.create({ inherited: 'proto-value' });
    source.own = 'own-value';
    const clone = showdown.helper.cloneObject(source);
    expect(clone.own).toBe('own-value');
    expect(clone.inherited).toBeUndefined();
    expect(Object.keys(clone)).toEqual(['own']);
  });

  it('deep clones nested Date objects into real Dates', () => {
    const source = { when: new Date(123), count: 5 };
    const clone = showdown.helper.cloneObject(source, true);
    expect(clone.when instanceof Date).toBe(true);
    expect(clone.when.getTime()).toBe(123);
    expect(clone.count).toBe(5);
  });

  it('falls back to a JSON round-trip when structuredClone is unavailable', () => {
    const original = globalThis.structuredClone;
    delete globalThis.structuredClone;
    try {
      const clone = showdown.helper.cloneObject({ when: new Date(123) }, true);
      expect(clone.when).toBe('1970-01-01T00:00:00.123Z');
    } finally {
      globalThis.structuredClone = original;
    }
  });
});
