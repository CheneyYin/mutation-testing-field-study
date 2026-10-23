import { expandSinglePhrase } from '../../src/expandPhrases.js';

describe('expandSinglePhrase()', () => {
  it('returns single item when no [optional blocks] found', () => {
    expect(expandSinglePhrase('INSERT INTO')).toEqual(['INSERT INTO']);
  });

  it('expands expression with one [optional block] at the end', () => {
    expect(expandSinglePhrase('DROP TABLE [IF EXISTS]')).toEqual([
      'DROP TABLE',
      'DROP TABLE IF EXISTS',
    ]);
  });

  it('expands expression with one [optional block] at the middle', () => {
    expect(expandSinglePhrase('CREATE [TEMPORARY] TABLE')).toEqual([
      'CREATE TABLE',
      'CREATE TEMPORARY TABLE',
    ]);
  });

  it('expands expression with one [optional block] at the start', () => {
    expect(expandSinglePhrase('[EXPLAIN] SELECT')).toEqual(['SELECT', 'EXPLAIN SELECT']);
  });

  it('expands multiple [optional] [blocks]', () => {
    expect(expandSinglePhrase('CREATE [OR REPLACE] [MATERIALIZED] VIEW')).toEqual([
      'CREATE VIEW',
      'CREATE MATERIALIZED VIEW',
      'CREATE OR REPLACE VIEW',
      'CREATE OR REPLACE MATERIALIZED VIEW',
    ]);
  });

  it('expands expression with optional [multi|choice|block]', () => {
    expect(expandSinglePhrase('CREATE [TEMP|TEMPORARY|VIRTUAL] TABLE')).toEqual([
      'CREATE TABLE',
      'CREATE TEMP TABLE',
      'CREATE TEMPORARY TABLE',
      'CREATE VIRTUAL TABLE',
    ]);
  });

  it('removes braces around {mandatory} {block}', () => {
    expect(expandSinglePhrase('CREATE {TEMP} {TABLE}')).toEqual(['CREATE TEMP TABLE']);
  });

  it('expands expression with mandatory {multi|choice|block}', () => {
    expect(expandSinglePhrase('CREATE {TEMP|TEMPORARY|VIRTUAL} TABLE')).toEqual([
      'CREATE TEMP TABLE',
      'CREATE TEMPORARY TABLE',
      'CREATE VIRTUAL TABLE',
    ]);
  });

  it('expands nested []-block inside []-block', () => {
    expect(expandSinglePhrase('CREATE [[OR] REPLACE] TABLE')).toEqual([
      'CREATE TABLE',
      'CREATE REPLACE TABLE',
      'CREATE OR REPLACE TABLE',
    ]);
  });

  it('expands nested {}-block inside {}-block', () => {
    expect(expandSinglePhrase('CREATE {{OR} REPLACE} TABLE')).toEqual(['CREATE OR REPLACE TABLE']);
  });

  it('expands nested {}-block inside []-block', () => {
    expect(expandSinglePhrase('FOR RS [USE AND KEEP {UPDATE | EXCLUSIVE} LOCKS]')).toEqual([
      'FOR RS',
      'FOR RS USE AND KEEP UPDATE LOCKS',
      'FOR RS USE AND KEEP EXCLUSIVE LOCKS',
    ]);
  });

  it('throws error when encountering unbalanced ][-braces', () => {
    expect(() => expandSinglePhrase('CREATE [TABLE')).toThrowErrorMatchingInlineSnapshot(
      `"Unbalanced parenthesis in: CREATE [TABLE"`
    );
    expect(() => expandSinglePhrase('CREATE TABLE]')).toThrowErrorMatchingInlineSnapshot(
      `"Unbalanced parenthesis in: CREATE TABLE]"`
    );
  });

  it('throws error when encountering unbalanced }{-braces', () => {
    expect(() => expandSinglePhrase('CREATE {TABLE')).toThrowErrorMatchingInlineSnapshot(
      `"Unbalanced parenthesis in: CREATE {TABLE"`
    );
    expect(() => expandSinglePhrase('CREATE TABLE}')).toThrowErrorMatchingInlineSnapshot(
      `"Unbalanced parenthesis in: CREATE TABLE}"`
    );
  });
});

describe('degenerate phrases', () => {
  it('throws on unexpected characters, returns no phrases for an empty phrase and drops a trailing empty alternative', () => {
    // an unexpected character aborts parsing (expandPhrases.ts:69)
    expect(() => expandSinglePhrase('foo=bar')).toThrowError('Unexpected "="');
    // an empty phrase has no alternatives to expand (expandPhrases.ts:72)
    expect(expandSinglePhrase('')).toEqual([]);
    // a trailing `|` yields an empty final alternative, which expands to nothing
    expect(expandSinglePhrase('SELECT |')).toEqual(['SELECT']);
  });
});
