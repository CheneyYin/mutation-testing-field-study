import { expandPhrases } from '../../src/expandPhrases.js';

describe('expandPhrases()', () => {
  it('throws on phrases containing unexpected characters', () => {
    expect(() => expandPhrases(['FOO-BAR'])).toThrow('Unexpected "-"');
    expect(() => expandPhrases(['FOO(BAR)'])).toThrow('Unexpected "("');
  });
});
