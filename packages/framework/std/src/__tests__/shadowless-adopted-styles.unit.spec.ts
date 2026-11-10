/**
 * A host under a strict Content-Security-Policy (`style-src` without
 * `'unsafe-inline'`) gets the light-DOM styles as adopted style sheets: the
 * canvas viewer on a public Labre site drew nothing because every `<style>`
 * element `ShadowlessElement` appended to `<head>` was blocked (ADR 0050).
 *
 * What it would have caught:
 * - `adoptShadowlessStyles` leaving the styles registered before it was
 *   called (most of them: classes finalize at import) in `<style>` only;
 * - a class finalized after the switch still appending a `<style>`;
 * - the editor's default (no switch) no longer writing `<style>` elements.
 */
import { css } from 'lit';
import { describe, expect, test } from 'vitest';

import { adoptShadowlessStyles, ShadowlessElement } from '../view/index.js';

const adoptedText = () =>
  document.adoptedStyleSheets
    .flatMap(sheet => [...sheet.cssRules])
    .map(rule => rule.cssText)
    .join('\n');

const headText = () =>
  [...document.head.querySelectorAll('style')]
    .map(style => style.textContent)
    .join('\n');

describe('light-DOM styles under a strict style-src', () => {
  test('stay <style> elements by default, move to adopted sheets on demand', () => {
    class BeforeSwitch extends ShadowlessElement {
      static override styles = css`
        .adopted-before-switch {
          color: red;
        }
      `;
    }
    customElements.define('adopted-before-switch', BeforeSwitch);
    expect(headText()).toContain('.adopted-before-switch');
    expect(adoptedText()).not.toContain('.adopted-before-switch');

    adoptShadowlessStyles();
    adoptShadowlessStyles();
    expect(adoptedText()).toContain('.adopted-before-switch');
    expect(adoptedText().match(/\.adopted-before-switch/g)).toHaveLength(1);

    class AfterSwitch extends ShadowlessElement {
      static override styles = css`
        .adopted-after-switch {
          color: blue;
        }
      `;
    }
    customElements.define('adopted-after-switch', AfterSwitch);
    expect(adoptedText()).toContain('.adopted-after-switch');
    expect(headText()).not.toContain('.adopted-after-switch');
  });
});
