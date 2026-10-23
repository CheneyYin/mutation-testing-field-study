import { createDialect } from '../../src/dialect.js';
import { sqlite } from '../../src/languages/sqlite/sqlite.formatter.js';
import { mysql } from '../../src/languages/mysql/mysql.formatter.js';
import { format } from '../../src/sqlFormatter.js';

describe('createDialect()', () => {
  it('caches the dialect per options object', () => {
    expect(createDialect(sqlite)).toBe(createDialect(sqlite));
    expect(createDialect(mysql)).not.toBe(createDialect(sqlite));
  });

  it('defaults alwaysDenseOperators to an empty list and maps tabularOnelineClauses to true', () => {
    const dialect = createDialect(sqlite);
    expect(dialect.formatOptions.alwaysDenseOperators).toEqual([]);
    expect(dialect.formatOptions.tabularOnelineClauses['UPDATE']).toBe(true);
    expect(dialect.formatOptions.tabularOnelineClauses['DELETE FROM']).toBe(true);
    expect(dialect.formatOptions.tabularOnelineClauses['FROM']).toBeUndefined();
  });

  it('formats tabular oneline clauses without indenting their continuation lines', () => {
    expect(
      format(
        'DELETE FROM aaaaaaaaaaaaaaaaaa, bbbbbbbbbbbbbbbbbb, cccccccccccccccccc WHERE x = 1',
        { language: 'sqlite', indentStyle: 'tabularLeft' }
      )
    ).toBe('DELETE    FROM aaaaaaaaaaaaaaaaaa,\nbbbbbbbbbbbbbbbbbb,\ncccccccccccccccccc\nWHERE     x = 1');
  });
});
