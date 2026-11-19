import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { html } from 'lit';
import { afterEach, describe, expect, test } from 'vitest';

import { EdgelessToolIconButton } from '../button/tool-icon-button.js';
import { EDGELESS_TOOLBAR_MORE_TOOLS } from '../translations.js';

/**
 * #679: no button of the edgeless toolbar had an accessible name or exposed
 * its state — every tool rendered `role="button"` and nothing else, so a
 * screen reader read a row of unnamed buttons.
 *
 * `EdgelessToolIconButton` is the narrowest waist every toolbar button goes
 * through. Its name is the wording its tooltip shows, as the host translates
 * it; an owner whose tooltip is a template (a wording beside its shortcut), or
 * empties it while its menu is open, passes that wording as `label`. Its state
 * is `aria-pressed`, on the toolbar's own row only.
 *
 * The real row, every button named and the names unique, is the integration
 * spec's (`edgeless-toolbar-a11y.spec.ts`); the senior tools' declared labels
 * are held by `affine/all`'s `toolbar-names.unit.spec.ts`.
 */

if (!customElements.get('edgeless-tool-icon-button')) {
  customElements.define('edgeless-tool-icon-button', EdgelessToolIconButton);
}

/** A host whose catalogue answers `entries` and nothing else. */
const hostWith = (entries: Record<string, string>): BlockStdScope =>
  ({
    getOptional: () => ({ t: (key: string) => entries[key] }),
  }) as unknown as BlockStdScope;

const mounted: HTMLElement[] = [];

async function button(
  props: Partial<EdgelessToolIconButton>
): Promise<EdgelessToolIconButton> {
  const element = document.createElement('edgeless-tool-icon-button');
  Object.assign(element, props);
  document.body.append(element);
  mounted.push(element);
  await element.updateComplete;
  return element;
}

afterEach(() => {
  mounted.splice(0).forEach(element => element.remove());
});

describe('the accessible name of a toolbar button', () => {
  test('is the translated wording its tooltip shows', async () => {
    const std = hostWith({ [EDGELESS_TOOLBAR_MORE_TOOLS[0]]: "Plus d'outils" });
    const tooltip = translateKey(std, ...EDGELESS_TOOLBAR_MORE_TOOLS);
    const element = await button({ tooltip, onToolbarRow: true });
    expect(element.getAttribute('role')).toBe('button');
    expect(element.getAttribute('aria-label')).toBe("Plus d'outils");
  });

  test('a tooltip drawn as a template names nothing: the label does', async () => {
    const tooltip = html`<affine-tooltip-content-with-shortcut
      data-tip="Eraser"
      data-shortcut="E"
    ></affine-tooltip-content-with-shortcut>`;
    const unnamed = await button({ tooltip, onToolbarRow: true });
    expect(unnamed.hasAttribute('aria-label')).toBe(false);

    const named = await button({ tooltip, label: 'Eraser' });
    expect(named.getAttribute('aria-label')).toBe('Eraser');
  });

  test('the label outlives a tooltip emptied while the menu is open', async () => {
    const element = await button({ tooltip: 'Wardley map', label: 'Wardley' });
    expect(element.getAttribute('aria-label')).toBe('Wardley');
    element.tooltip = '';
    await element.updateComplete;
    expect(element.getAttribute('aria-label')).toBe('Wardley');
  });

  test('"coming soon" shows in the tooltip, never in the name', async () => {
    const element = await button({
      tooltip: 'Frame',
      coming: true,
      onToolbarRow: true,
    });
    expect(element.getAttribute('aria-label')).toBe('Frame');
  });
});

/**
 * GUARD — off the canvas toolbar's row, the element is what it was before
 * #679. Review of #679: deriving the name from the tooltip everywhere named
 * the auto-complete's "add the same object" button "Shape" in English under
 * its translated visible label, and named the outline's display-mode button
 * with a tooltip that empties when its popup opens (WCAG 2.5.3).
 */
describe('off the toolbar row, nothing is added', () => {
  test('no aria-label, no aria-pressed, no tabindex from a tooltip', async () => {
    const element = await button({ tooltip: 'Shape', active: true });
    expect(element.hasAttribute('aria-label')).toBe(false);
    expect(element.hasAttribute('aria-pressed')).toBe(false);
    expect(element.hasAttribute('tabindex')).toBe(false);
  });

  test("an owner's own aria-label is left as it is", async () => {
    const element = document.createElement('edgeless-tool-icon-button');
    element.setAttribute('aria-label', 'Add the same object');
    element.tooltip = 'Shape';
    document.body.append(element);
    mounted.push(element);
    await element.updateComplete;
    element.tooltip = '';
    await element.updateComplete;
    expect(element.getAttribute('aria-label')).toBe('Add the same object');
  });
});

describe('the state of a toolbar button', () => {
  test('on the row, a bound `active` is aria-pressed, and follows it', async () => {
    const element = await button({ tooltip: 'Eraser', onToolbarRow: true });
    expect(element.hasAttribute('aria-pressed')).toBe(false);
    element.active = false;
    await element.updateComplete;
    expect(element.getAttribute('aria-pressed')).toBe('false');
    element.active = true;
    await element.updateComplete;
    expect(element.getAttribute('aria-pressed')).toBe('true');
  });

  test('an action that binds no state announces none', async () => {
    const undo = await button({ tooltip: 'Undo', onToolbarRow: true });
    expect(undo.hasAttribute('aria-pressed')).toBe(false);
  });

  test('off the row (a sub-menu) `active` stays silent', async () => {
    // In `EdgelessCommandMenu`, `active` is the keyboard highlight.
    const element = await button({ tooltip: 'Component', active: true });
    expect(element.hasAttribute('aria-pressed')).toBe(false);
  });
});
