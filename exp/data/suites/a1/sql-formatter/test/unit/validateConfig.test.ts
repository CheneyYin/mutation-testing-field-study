import { format } from '../../src/sqlFormatter.js';

describe('validateConfig: params option values', () => {
  it('warns when params contain non-string values and stays silent when all values are strings', () => {
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    try {
      format('SELECT :foo', { language: 'postgresql', params: { foo: 123 } as any });
      expect(warnSpy.mock.calls).toEqual([['WARNING: All "params" option values should be strings.']]);

      warnSpy.mockClear();
      format('SELECT ?', { params: ['foo', 123] as any });
      expect(warnSpy.mock.calls).toEqual([['WARNING: All "params" option values should be strings.']]);

      warnSpy.mockClear();
      expect(format('SELECT ?', { params: ['foo', 'bar'] })).toBe('SELECT\n  foo');
      expect(warnSpy).not.toHaveBeenCalled();

      warnSpy.mockClear();
      format('SELECT :foo', { language: 'postgresql', params: { foo: 'bar' } });
      expect(warnSpy).not.toHaveBeenCalled();
    } finally {
      warnSpy.mockRestore();
    }
  });
});
