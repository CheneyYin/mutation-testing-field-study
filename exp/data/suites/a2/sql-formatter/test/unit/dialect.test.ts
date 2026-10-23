import dedent from 'dedent-js';

import { format } from '../../src/sqlFormatter.js';
import { createDialect } from '../../src/dialect.js';
import { sql } from '../../src/languages/sql/sql.formatter.js';
import { n1ql } from '../../src/languages/n1ql/n1ql.formatter.js';

describe('createDialect()', () => {
  it('returns a cached dialect when called with the same options object', () => {
    expect(createDialect(sql) === createDialect(sql)).toBe(true);
  });

  it('processes dialect format options', () => {
    const sqlDialect = createDialect(sql);
    expect(sqlDialect.formatOptions.alwaysDenseOperators).toEqual([]);
    expect(sqlDialect.formatOptions.tabularOnelineClauses['DELETE FROM']).toBe(true);

    const n1qlDialect = createDialect(n1ql);
    expect(n1qlDialect.formatOptions.tabularOnelineClauses['DELETE FROM']).toBe(true);
  });

  it('keeps tabular oneline clauses on a single line in tabular indent style', () => {
    expect(
      format('DELETE FROM t1, t2 WHERE x', { language: 'sql', indentStyle: 'tabularLeft' })
    ).toBe(dedent`
      DELETE    FROM t1,
      t2
      WHERE     x
    `);
  });
});
