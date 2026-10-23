import { format } from '../../src/sqlFormatter.js';

describe('params option values warning', () => {
  it('warns when params values are not all strings and stays quiet otherwise', () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});

    format('SELECT 1', { params: ['foo', 42] as unknown as string[] });
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith('WARNING: All "params" option values should be strings.');

    warn.mockClear();
    format('SELECT 1', { params: ['foo', 'bar'] });
    expect(warn).not.toHaveBeenCalled();

    warn.mockClear();
    format('SELECT 1');
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
