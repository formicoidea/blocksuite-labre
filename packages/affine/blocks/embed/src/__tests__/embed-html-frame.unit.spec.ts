import { render, type TemplateResult } from 'lit';
import { beforeAll, describe, expect, test, vi } from 'vitest';

import { HOST_PAGE_SANDBOX } from '../common/iframe-sandbox.js';
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
  const iframe = container.querySelector('iframe') as HTMLIFrameElement;
  return { block, iframe };
}

// The private handler is the whole protocol: exercised without a real frame.
function answer(
  block: EmbedHtmlBlockComponent,
  iframe: HTMLIFrameElement,
  event: Partial<MessageEvent>
) {
  Object.defineProperty(block, 'iframe', { value: iframe });
  (
    block as unknown as { _answerFrame: (e: Partial<MessageEvent>) => void }
  )._answerFrame(event);
}

function fakeFrame() {
  const contentWindow = { postMessage: vi.fn() };
  const iframe = { contentWindow } as unknown as HTMLIFrameElement;
  return { contentWindow, iframe };
}

const READY = { type: 'labre:embed-html-ready' };

describe('the html block and its frame', () => {
  test('without a host page it stays on srcdoc', () => {
    const { iframe } = mount();
    expect(iframe.getAttribute('src')).toBeNull();
    expect(iframe.srcdoc).toContain('<p>stored</p>');
    expect(iframe.getAttribute('sandbox')).toBe('allow-scripts');
  });

  test('with a host page it loads it, sandboxed, and keeps the html out of the markup', () => {
    const { iframe } = mount({ frameUrl: '/frame.html' });
    expect(iframe.getAttribute('src')).toBe('/frame.html');
    expect(iframe.srcdoc).toBe('');
    expect(iframe.getAttribute('sandbox')).toBe(HOST_PAGE_SANDBOX);
  });

  test('it sends the stored html to its own frame when asked', () => {
    const { block } = mount({ frameUrl: '/frame.html' });
    const { contentWindow, iframe } = fakeFrame();
    answer(block, iframe, { source: contentWindow as never, data: READY });
    expect(contentWindow.postMessage).toHaveBeenCalledOnce();
    expect(contentWindow.postMessage.mock.calls[0]?.[0].html).toContain(
      '<p>stored</p>'
    );
  });

  test('it answers no other window, and no other message', () => {
    const { block } = mount({ frameUrl: '/frame.html' });
    const { contentWindow, iframe } = fakeFrame();
    answer(block, iframe, { source: window, data: READY });
    answer(block, iframe, { source: contentWindow as never, data: {} });
    answer(block, iframe, { source: contentWindow as never, data: null });
    expect(contentWindow.postMessage).not.toHaveBeenCalled();
  });
});
