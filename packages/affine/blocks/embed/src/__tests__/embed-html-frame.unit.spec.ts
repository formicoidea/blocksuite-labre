/**
 * The html block runs in the shared frame (ADR 0047, ADR 0048), which holds the
 * protocol and the sandbox (`components/src/__tests__/html-frame.unit.spec.ts`).
 *
 * What it would have caught: a stored block losing its `srcdoc` fallback, which
 * only this block has, or a block that is not interactive, as it always was.
 */
import { render, type TemplateResult } from 'lit';
import { beforeAll, describe, expect, test } from 'vitest';

import { EmbedHtmlBlockComponent } from '../embed-html-block/embed-html-block.js';
import { EmbedHtmlConfigExtension } from '../embed-html-block/embed-html-config.js';

beforeAll(() => {
  customElements.define('test-embed-html-block', EmbedHtmlBlockComponent);
});

function mount(config?: { frameUrl?: string }) {
  const block = new EmbedHtmlBlockComponent();
  Object.defineProperty(block, 'model', {
    value: { id: 'test', props: { html: '<p>stored</p>', style: 'html' } },
  });
  Object.defineProperty(block, 'std', {
    value: {
      selection: { value: [] },
      getOptional: (identifier: unknown) =>
        identifier === EmbedHtmlConfigExtension.identifier ? config : null,
    },
  });
  Object.defineProperty(block, 'renderEmbed', {
    value: (content: () => TemplateResult) => content(),
  });
  const container = document.createElement('div');
  render(block.renderBlock() as TemplateResult, container);
  return container.querySelector('labre-html-frame') as HTMLElement & {
    frameUrl: string | null;
    html: string;
    interactive: boolean;
    noScroll: boolean;
    srcdocFallback: boolean;
  };
}

describe('the html block and its frame', () => {
  test('it keeps its stored html and its srcdoc fallback', () => {
    const frame = mount();
    expect(frame.html).toContain('<p>stored</p>');
    expect(frame.frameUrl).toBeNull();
    expect(frame.srcdocFallback).toBe(true);
    expect(frame.interactive).toBe(true);
    expect(frame.noScroll).toBe(true);
  });

  test('it names the page of its host', () => {
    expect(mount({ frameUrl: '/frame.html' }).frameUrl).toBe('/frame.html');
  });
});
