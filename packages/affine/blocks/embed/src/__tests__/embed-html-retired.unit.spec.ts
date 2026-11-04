/**
 * What is left of a stored html block is a card (ADR 0048, amendment of 2026-11-04).
 *
 * What it would have caught: a frame coming back, or the stored html reaching the
 * page in any form.
 */
import { render, type TemplateResult } from 'lit';
import { beforeAll, describe, expect, test } from 'vitest';

import { EmbedHtmlBlockComponent } from '../embed-html-block/embed-html-block.js';

beforeAll(() => {
  customElements.define('test-embed-html-block', EmbedHtmlBlockComponent);
});

function mount() {
  const block = new EmbedHtmlBlockComponent();
  Object.defineProperty(block, 'model', {
    value: {
      id: 'test',
      props: { html: '<p>stored words</p>', style: 'html' },
    },
  });
  Object.defineProperty(block, 'std', {
    value: { selection: { value: [] }, getOptional: () => null },
  });
  Object.defineProperty(block, 'renderEmbed', {
    value: (content: () => TemplateResult) => content(),
  });
  const container = document.createElement('div');
  render(block.renderBlock() as TemplateResult, container);
  return container;
}

describe('a retired html block', () => {
  test('its card says what it is and holds no frame', () => {
    const card = mount();
    expect(card.querySelector('.affine-embed-html-retired')).toBeTruthy();
    expect(card.querySelector('iframe, labre-html-frame')).toBeNull();
    expect(card.textContent).toContain('HTML block');
    expect(card.textContent).not.toContain('stored words');
  });
});
