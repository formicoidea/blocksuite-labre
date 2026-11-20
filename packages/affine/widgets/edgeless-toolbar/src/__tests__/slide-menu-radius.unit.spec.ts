/**
 * The menu that slides out above the canvas toolbar (`edgeless-slide-menu`:
 * the framework sub-menus and the shape, connector, pen, note, frame, mind map
 * and text menus) rounds its top corners at 8px; its bottom edge, which meets
 * the toolbar, stays square.
 *
 * Pinned on purpose: #199 moved these corners to the toolbar's 16px in 0.35.0,
 * and that was reverted on a product decision. A later "same family of chrome,
 * same corner" alignment must change this spec with it, not past it.
 *
 * The radius is read as the COMPUTED style of `.menu-container` on a really
 * mounted `edgeless-slide-menu`, so the rule that reaches the element is the
 * one held, not a copy of the source text.
 */
import { Subject } from 'rxjs';
import { afterEach, describe, expect, test } from 'vitest';

import { EdgelessSlideMenu } from '../menu/slide-menu.js';

if (!customElements.get('edgeless-slide-menu')) {
  customElements.define('edgeless-slide-menu', EdgelessSlideMenu);
}

const mounted: HTMLElement[] = [];

afterEach(() => {
  mounted.splice(0).forEach(element => element.remove());
});

async function slideMenu() {
  const element = document.createElement(
    'edgeless-slide-menu'
  ) as EdgelessSlideMenu;
  // `firstUpdated` subscribes to the toolbar's resize slot.
  element.toolbarSlots = {
    resize: new Subject(),
  } as unknown as EdgelessSlideMenu['toolbarSlots'];
  document.body.append(element);
  mounted.push(element);
  await element.updateComplete;
  return element;
}

describe('the slide-out menu above the canvas toolbar', () => {
  test('rounds its top corners at 8px and keeps its bottom edge square', async () => {
    const element = await slideMenu();
    const container = element.shadowRoot!.querySelector(
      '.menu-container'
    ) as HTMLElement;
    expect(container).not.toBeNull();

    const style = getComputedStyle(container);
    expect(style.borderTopLeftRadius).toBe('8px');
    expect(style.borderTopRightRadius).toBe('8px');
    expect(style.borderBottomLeftRadius).toBe('0px');
    expect(style.borderBottomRightRadius).toBe('0px');
  });
});
