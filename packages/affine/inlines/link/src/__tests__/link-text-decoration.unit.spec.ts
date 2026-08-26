/**
 * Strikethrough (and underline) on a link — upstream #15109 / issue #15106.
 *
 * `affineTextStyles(attributes, override)` spreads the override LAST, so the
 * anchor's inline style is the last word on `text-decoration`. The link node
 * used to name `'none'` in that override, which erased the decoration computed
 * from `strike` / `underline`: the toolbar button lit up, the line never came.
 *
 * These tests read the rendered anchor, not the intermediate object, because
 * the whole defect lived in which of two style sources reached the DOM.
 */
import type { AffineTextAttributes } from '@labre/affine-shared/types';
import type { DeltaInsert } from '@labre/store';
import { render } from 'lit';
import { beforeAll, describe, expect, it } from 'vitest';

import { AffineLink } from '../link-node/affine-link.js';

beforeAll(() => {
  if (!customElements.get('affine-link')) {
    customElements.define('affine-link', AffineLink);
  }
});

/** The anchor's inline `style` attribute for a link carrying `attributes`. */
function anchorStyleOf(attributes: AffineTextAttributes) {
  const node = document.createElement('affine-link') as AffineLink;
  node.delta = {
    insert: 'labre',
    attributes,
  } as DeltaInsert<AffineTextAttributes>;

  const container = document.createElement('div');
  render(node.render(), container);

  const anchor = container.querySelector('a');
  expect(anchor).not.toBeNull();
  return anchor!.getAttribute('style') ?? '';
}

const LINK = 'https://labre.example/doc';

describe('affine-link text decoration', () => {
  it('renders a struck link with a line through it', () => {
    expect(anchorStyleOf({ link: LINK, strike: true })).toContain(
      'line-through'
    );
  });

  it('renders an underlined link underlined', () => {
    expect(anchorStyleOf({ link: LINK, underline: true })).toContain(
      'underline'
    );
  });

  it('leaves a plain link undecorated', () => {
    const style = anchorStyleOf({ link: LINK });
    expect(style).not.toContain('line-through');
    expect(style).toContain('text-decoration:none');
  });
});
