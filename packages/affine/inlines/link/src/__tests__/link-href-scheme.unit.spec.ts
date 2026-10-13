/**
 * `affine-link` never renders a refused scheme as an href.
 *
 * What it would have caught: the anchor used to take `normalizeUrl(link)` as
 * its href, and `normalizeUrl` filters no scheme, so a `javascript:` link
 * already stored in a document (imported, pasted, shared by a peer) became a
 * clickable anchor. The guard sits at render because stored documents are
 * never rewritten on load: the text stays, the href goes.
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

/** The rendered anchor for a link node carrying `link`. */
function anchorFor(link: string) {
  const node = document.createElement('affine-link') as AffineLink;
  node.delta = {
    insert: 'labre',
    attributes: { link },
  } as DeltaInsert<AffineTextAttributes>;

  const container = document.createElement('div');
  render(node.render(), container);

  const anchor = container.querySelector('a');
  expect(anchor).not.toBeNull();
  return anchor!;
}

describe('affine-link href', () => {
  it.each([
    'javascript:void(0)',
    ' JaVaScRiPt:void(0)',
    'java\tscript:void(0)',
    'data:text/html,x',
    'vbscript:msgbox(1)',
  ])('renders no href for %j', link => {
    expect(anchorFor(link).hasAttribute('href')).toBe(false);
  });

  it('keeps the text of a refused link', () => {
    const anchor = anchorFor('javascript:void(0)');
    expect(anchor.querySelector('v-text')).not.toBeNull();
  });

  it('renders an https link as its normalized href', () => {
    expect(anchorFor('https://example.com/a').getAttribute('href')).toBe(
      'https://example.com/a'
    );
    expect(anchorFor('example.com').getAttribute('href')).toBe(
      'https://example.com'
    );
  });
});
