import { createDialect } from '../../src/dialect.js';
import { bigquery, sql } from '../../src/allDialects.js';

describe('createDialect()', () => {
  it('returns the cached dialect instance for the same dialect options', () => {
    const sqlDialect = createDialect(sql);
    expect(sqlDialect.formatOptions.identifierDashes).toBe(false);
    expect(createDialect(sql)).toBe(sqlDialect);

    const bigqueryDialect = createDialect(bigquery);
    expect(bigqueryDialect.formatOptions.identifierDashes).toBe(true);
    expect(bigqueryDialect).not.toBe(sqlDialect);
  });
});
