import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Covers the console polyfill in src/helpers/misc.js (lines 15-21 and the warn/log/error
// bodies behind them): the branch that installs an alert-backed console when the module is
// loaded in an environment without one. Vitest always evaluates module code inside a
// 'use strict' wrapper, and the polyfill's sloppy-mode `console = {...}` global assignment
// cannot run there (same reason the dist ESM bundle never exercises it), so this spec runs
// the real concatenated source in a bare sloppy-mode CommonJS node child - the same
// subprocess pattern the CLI suite uses - after deleting the global console.
//
// The concatenation order mirrors the dist build (and
// scripts/vite-plugin-showdown-src.mjs): options/showdown/event, then helpers, then the
// makehtml and makemarkdown subparsers (alphabetical), then the converter; loader.js (the
// UMD export epilogue) and src/cli (the bin entry) are not part of it.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

function listJsFiles (dir) {
  return fs.readdirSync(path.join(root, dir))
    .filter((name) => name.endsWith('.js'))
    .sort()
    .map((name) => `${dir}/${name}`);
}

const SRC_FILES = [
  'src/options.js',
  'src/showdown.js',
  'src/event.js',
  ...listJsFiles('src/helpers'),
  ...listJsFiles('src/subParsers/makehtml'),
  ...listJsFiles('src/subParsers/makemarkdown'),
  'src/converter.js'
];

function buildChildScript () {
  const source = SRC_FILES.map((file) => fs.readFileSync(path.join(root, file), 'utf8')).join('\n');
  return [
    'delete globalThis.console;',
    'globalThis.__alerts = [];',
    'globalThis.alert = function (msg) { globalThis.__alerts.push(String(msg)); };',
    source,
    'var threw = null;',
    "try { console.error('polyfill-error-message'); } catch (e) { threw = String(e); }",
    "console.warn('polyfill-warn-message');",
    "console.log('polyfill-log-message');",
    'process.stdout.write(JSON.stringify({',
    '  consoleType: typeof globalThis.console,',
    '  warnType: typeof console.warn,',
    '  logType: typeof console.log,',
    '  errorType: typeof console.error,',
    '  converterType: typeof showdown.Converter,',
    '  alerts: globalThis.__alerts,',
    '  errorThrew: threw',
    '}));'
  ].join('\n');
}

describe('console polyfill (src/helpers/misc.js)', () => {
  it('installs an alert-backed console when the source loads without a console', () => {
    const result = spawnSync(process.execPath, {
      input: buildChildScript(),
      encoding: 'utf8'
    });

    expect(result.status).toBe(0);
    expect(result.stderr).toBe('');
    expect(JSON.parse(result.stdout)).toEqual({
      consoleType: 'object',
      warnType: 'function',
      logType: 'function',
      errorType: 'function',
      converterType: 'function',
      alerts: ['polyfill-warn-message', 'polyfill-log-message'],
      errorThrew: 'polyfill-error-message'
    });
  });
});
