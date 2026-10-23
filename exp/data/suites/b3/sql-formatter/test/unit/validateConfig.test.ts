import dedent from 'dedent-js';

import { format } from '../../src/sqlFormatter.js';

describe('validateConfig()', () => {
  it('warns (but proceeds) when params values are not all strings', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = format('SELECT ?, ?;', { params: [1, 'two'] as any });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('WARNING: All "params" option values should be strings.');
      // The non-string value is not usable as a parameter value (a numeric 1 even behaves
      // like Layout's WS.NO_SPACE modifier and swallows the preceding whitespace).
      expect(result).toBe(dedent`
        SELECT
        ,
          two;
      `);
    } finally {
      warn.mockRestore();
    }
  });
});
