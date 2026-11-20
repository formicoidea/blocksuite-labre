/**
 * The "Stop presentation" button reads a fill / on-fill pair of the theme (#683).
 *
 * Why this spec exists: the button was painted with the theme's warning colour
 * (`warningColor`, set inline) under an icon hard-coded to `white`. Everywhere
 * else the warning colour is a TEXT colour, so a host theme that made it
 * readable as text on a dark menu left the white icon unreadable (1.90:1 with
 * `#fca5a5`, under the 3:1 of WCAG 1.4.11). The button now reads
 * `button/error` for its fill and `button/pureWhiteText` for its icon, from its
 * stylesheet, and no longer reads the warning colour at all.
 *
 * **This spec would have caught** the button going back to the warning colour,
 * to a literal white icon, or to an inline `style` attribute.
 *
 * Why half of it reads the stylesheet's text: happy-dom drops the whole
 * `.edgeless-frame-navigator-stop` rule, because it does not parse the nested
 * `svg { … }` block inside it (the rule comes back with no declaration at all,
 * `padding` included), so the computed fill and icon colour of the mounted
 * button cannot be read here. What CAN be computed is that the button does not
 * resolve to the warning colour: the old inline `style` did, sentinel and all.
 */
import { EdgelessLegacySlotIdentifier } from '@labre/affine-block-surface';
import {
  EditPropsStore,
  ViewportElementProvider,
} from '@labre/affine-shared/services';
import type { BlockComponent } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { signal } from '@preact/signals-core';
import { cssVar } from '@toeverything/theme';
import { cssVarV2 } from '@toeverything/theme/v2';
import { Subject } from 'rxjs';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { PresentationToolbar } from '../edgeless-toolbar/presentation-toolbar';
import { EdgelessFrameManagerIdentifier } from '../frame-manager';

const STOP_SELECTOR = '.edgeless-frame-navigator-stop';

// Sentinels, one per variable, so a match can only come from the right one.
const FILL = 'rgb(1, 2, 3)';
const WARNING = 'rgb(7, 8, 9)';

/** The smallest edgeless the toolbar mounts against: no frame, no tool. */
function fakeEdgeless() {
  const services = new Map<unknown, unknown>([
    [
      GfxControllerIdentifier,
      {
        tool: {
          currentToolOption$: signal(null),
          currentTool$: signal(null),
          setTool: () => {},
        },
        selection: { selectedElements: [] },
      },
    ],
    [
      EditPropsStore,
      { getStorage: () => undefined, setStorage: () => undefined },
    ],
    [EdgelessFrameManagerIdentifier, { frames: [] }],
    [
      EdgelessLegacySlotIdentifier,
      {
        navigatorSettingUpdated: new Subject(),
        navigatorFrameChanged: new Subject(),
        fullScreenToggled: new Subject(),
      },
    ],
    [ViewportElementProvider, { viewportElement: document.body }],
  ]);
  const std = {
    get: (id: unknown) => services.get(id),
    getOptional: (id: unknown) => services.get(id) ?? null,
  };
  return {
    std,
    host: document.body,
    store: { readonly: false },
    bindHotKey: () => {},
  } as unknown as BlockComponent;
}

async function mountStopButton() {
  const toolbar = new PresentationToolbar(fakeEdgeless());
  document.body.append(toolbar);
  await toolbar.updateComplete;
  const button =
    toolbar.shadowRoot?.querySelector<HTMLButtonElement>(STOP_SELECTOR);
  if (!button) throw new Error('the stop button did not render');
  return button;
}

/**
 * The stop button's own rule, its nested `svg` block included: everything from
 * its selector to the `::before` rule that follows it in the stylesheet.
 */
function stopRuleBody() {
  const text = [PresentationToolbar.styles]
    .flat()
    .map(style => String(style))
    .join('\n');
  const start = text.indexOf(`${STOP_SELECTOR} {`);
  const end = text.indexOf(`${STOP_SELECTOR}::before`);
  if (start === -1 || end < start) throw new Error('no stop button rule');
  return text.slice(start, end);
}

describe('the Stop presentation button (#683)', () => {
  beforeAll(() => {
    customElements.define('test-presentation-toolbar-683', PresentationToolbar);
    const root = document.documentElement.style;
    root.setProperty('--affine-v2-button-error', FILL);
    root.setProperty('--affine-warning-color', WARNING);
  });

  afterEach(() => {
    document.body.replaceChildren();
  });

  it('does not resolve its fill to the warning colour', async () => {
    const button = await mountStopButton();
    // `button/error`, or nothing where happy-dom dropped the rule; never the
    // warning colour, which the old inline style resolved to.
    const fill = getComputedStyle(button).backgroundColor;
    expect(fill).not.toBe(WARNING);
    expect(['', FILL]).toContain(fill);
    expect(button.hasAttribute('style')).toBe(false);
  });

  it('fills with button/error and draws its icon in button/pureWhiteText', () => {
    const body = stopRuleBody();
    const [own, svg] = body.split('svg {');
    expect(own).toContain(`background: ${cssVarV2('button/error')};`);
    expect(svg).toContain(`color: ${cssVarV2('button/pureWhiteText')};`);
    expect(body).not.toContain(cssVar('warningColor'));
    expect(body).not.toContain('white;');
  });
});
