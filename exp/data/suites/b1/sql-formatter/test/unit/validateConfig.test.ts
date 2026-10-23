import dedent from 'dedent-js';

import { format } from '../../src/sqlFormatter.js';

// Covers the non-string params warning in src/validateConfig.ts (line 30): params values
// that are not strings must not abort formatting - the formatter warns through console.warn
// and still formats the query. (A non-string value that is actually substituted into the
// query would break the layout, so the unreferenced case is the one that must keep working.)
describe('validateConfig', () => {
  it('warns but does not throw when params values are not strings', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      const result = format('SELECT 1;', {
        params: { total: 42 } as unknown as { total: string },
      });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('WARNING: All "params" option values should be strings.');
      expect(result).toBe(dedent`
        SELECT
          1;
      `);
    } finally {
      warn.mockRestore();
    }
  });
});
