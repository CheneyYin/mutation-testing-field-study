import { describe, it, expect, vi } from 'vitest';

/**
 * Exercises the console polyfill at the top of src/helpers/misc.js: when showdown loads
 * in an environment without a console, it installs one whose log/warn funnel through
 * alert() and whose error() rethrows the message. The module is re-loaded (vi.resetModules)
 * with console stubbed to undefined so the polyfill branch executes.
 */
describe('console polyfill (src/helpers/misc.js)', () => {
  it('installs an alert-backed console when the module loads without one', async () => {
    const originalAlert = globalThis.alert;
    const alerts = [];
    globalThis.alert = (msg) => { alerts.push(msg); };

    vi.resetModules();
    // An undefined (but existing) global binding makes `typeof console === 'undefined'`
    // true inside the module while keeping strict-mode assignment legal.
    vi.stubGlobal('console', undefined);

    let showdownModule;
    try {
      showdownModule = await import("virtual:showdown");

      // the polyfill replaced the undefined console
      const polyfillConsole = globalThis.console;
      expect(typeof polyfillConsole.log).toBe('function');
      expect(typeof polyfillConsole.warn).toBe('function');
      expect(typeof polyfillConsole.error).toBe('function');

      // discard anything logged while the module graph loaded, then assert the exact calls
      alerts.length = 0;
      polyfillConsole.log('A');
      polyfillConsole.warn('W');
      expect(alerts).toEqual(['A', 'W']);

      // error() rethrows its message instead of alerting
      expect(() => polyfillConsole.error('E')).toThrow('E');
      expect(alerts).toEqual(['A', 'W']);

      // the module still fully loaded and works without a console
      expect(new showdownModule.default.Converter().makeHtml('hello world'))
        .toBe('<p>hello world</p>');
    } finally {
      vi.unstubAllGlobals();
      if (originalAlert === undefined) {
        delete globalThis.alert;
      } else {
        globalThis.alert = originalAlert;
      }
    }
  });
});
