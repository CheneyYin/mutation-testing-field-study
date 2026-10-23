import { format } from '../../src/sqlFormatter.js';

describe('validateConfig params validation', () => {
  it('warns when params option values are not all strings', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      format('SELECT 1');
      expect(warn).not.toHaveBeenCalled();

      format('SELECT 1', { params: ['alpha', 'beta'] });
      expect(warn).not.toHaveBeenCalled();

      format('SELECT 1', { params: ['alpha', 42] as unknown as string[] });
      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith('WARNING: All "params" option values should be strings.');
    } finally {
      warn.mockRestore();
    }
  });
});
