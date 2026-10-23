import { expandPhrases } from '../../src/expandPhrases.js';

describe('expandPhrases() edge cases', () => {
  it('throws when a phrase contains an unexpected character', () => {
    expect(() => expandPhrases(['CREATE (TABLE'])).toThrowError('Unexpected "("');
    expect(() => expandPhrases(['DROP +'])).toThrowError('Unexpected "+"');
  });

  it('treats a trailing | as an empty final alternative', () => {
    expect(expandPhrases(['SELECT ONE |'])).toEqual(['SELECT ONE']);
  });
});
