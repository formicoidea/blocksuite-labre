/**
 * The reader's gesture on an html attachment (ADR 0048).
 *
 * What it would have caught: scripts that start without a gesture, a press outside
 * that leaves the frame taking the pointer, or a page reloaded when the interaction
 * ends, which would throw away what the reader did in it.
 */
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { registerHtmlFrame } from '@labre/affine-components/html-frame';

import { ATTACHMENT_HTML_VIEW_TAG, AttachmentHtmlView } from '../html-view.js';

beforeAll(() => {
  registerHtmlFrame();
  customElements.define(ATTACHMENT_HTML_VIEW_TAG, AttachmentHtmlView);
});

afterEach(() => {
  document.body.replaceChildren();
  vi.restoreAllMocks();
});

async function mount(store: object = newStore()) {
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
  const view = new AttachmentHtmlView();
  Object.assign(view, {
    embed: true,
    frameUrl: '/frame.html',
    model: {
      props: {
        name: 'a.html',
        sourceId$: signal(undefined),
        xywh: '[0,0,752,300]',
        xywh$: signal('[0,0,752,300]'),
      },
      store,
    },
    std: { getOptional: () => null },
  });
  document.body.append(view);
  await view.updateComplete;
  const frame = view.shadowRoot?.querySelector(
    'labre-html-frame'
  ) as HTMLElement & {
    interactive: boolean;
    scripts: boolean;
  };
  const button = view.shadowRoot?.querySelector<HTMLButtonElement>(
    '[data-testid="attachment-html-interact"]'
  );
  return { view, frame, button };
}

function newStore() {
  return {
    blobSync: { get: async () => null },
    readonly: false,
    updateBlock: vi.fn(),
  };
}

const press = (target: EventTarget) =>
  target.dispatchEvent(
    new Event('pointerdown', { bubbles: true, composed: true })
  );

describe('the gesture', () => {
  test('nothing runs and nothing takes the pointer before it', async () => {
    const { frame } = await mount();
    expect(frame.scripts).toBe(false);
    expect(frame.interactive).toBe(false);
  });

  test('Interact lets the pointer in and starts the scripts', async () => {
    const { view, frame, button } = await mount();
    button?.click();
    await view.updateComplete;
    expect(frame.interactive).toBe(true);
    expect(frame.scripts).toBe(true);
  });

  test('a press outside takes the pointer back and leaves the page running', async () => {
    const { view, frame, button } = await mount();
    button?.click();
    await view.updateComplete;

    press(view);
    await view.updateComplete;
    expect(frame.interactive).toBe(true);

    press(document.body);
    await view.updateComplete;
    expect(frame.interactive).toBe(false);
    expect(frame.scripts).toBe(true);
  });

  test('stopping by the button leaves the page running too', async () => {
    const { view, frame, button } = await mount();
    button?.click();
    await view.updateComplete;
    button?.click();
    await view.updateComplete;
    expect(frame.interactive).toBe(false);
    expect(frame.scripts).toBe(true);
  });

  test('full screen starts the scripts', async () => {
    const { view, frame } = await mount();
    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: view,
    });
    document.dispatchEvent(new Event('fullscreenchange'));
    await view.updateComplete;
    expect(frame.interactive).toBe(true);
    expect(frame.scripts).toBe(true);

    Object.defineProperty(document, 'fullscreenElement', {
      configurable: true,
      value: null,
    });
    document.dispatchEvent(new Event('fullscreenchange'));
    await view.updateComplete;
    expect(frame.interactive).toBe(false);
    expect(frame.scripts).toBe(true);
  });

  test('Interact turns on every embed view of the document, and a press outside all of them turns them off', async () => {
    const store = newStore();
    const one = await mount(store);
    const two = await mount(store);
    const elsewhere = await mount();

    one.button?.click();
    await one.view.updateComplete;
    await two.view.updateComplete;
    expect(two.frame.interactive).toBe(true);
    expect(two.frame.scripts).toBe(true);
    expect(elsewhere.frame.scripts).toBe(false);

    press(two.view);
    await two.view.updateComplete;
    expect(one.frame.interactive).toBe(true);

    press(document.body);
    await one.view.updateComplete;
    await two.view.updateComplete;
    expect(one.frame.interactive).toBe(false);
    expect(two.frame.interactive).toBe(false);
    expect(two.frame.scripts).toBe(true);
  });

  test('a view that arrives during the interaction stays closed', async () => {
    const store = newStore();
    const one = await mount(store);
    one.button?.click();
    const late = await mount(store);
    expect(late.frame.scripts).toBe(false);
  });

  test("the height is the block's, with a handle only outside the interaction", async () => {
    const store = newStore();
    const { view, button } = await mount(store);
    expect(view.style.height).toBe('300px');
    const handle = () =>
      view.shadowRoot?.querySelector<HTMLElement>(
        '[data-testid="attachment-html-height"]'
      );
    expect(handle()).not.toBeNull();

    handle()?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true })
    );
    expect(store.updateBlock).toHaveBeenCalledWith(expect.anything(), {
      xywh: '[0,0,752,324]',
    });

    button?.click();
    await view.updateComplete;
    expect(handle()).toBeNull();
  });

  test('a read-only document has no handle', async () => {
    const { view } = await mount({ ...newStore(), readonly: true });
    expect(
      view.shadowRoot?.querySelector('[data-testid="attachment-html-height"]')
    ).toBeNull();
  });

  test('a thumbnail has no gesture', async () => {
    const view = new AttachmentHtmlView();
    Object.assign(view, {
      embed: false,
      frameUrl: '/frame.html',
      model: {
        props: {
          name: 'a.html',
          sourceId$: signal(undefined),
          xywh: '[0,0,752,300]',
          xywh$: signal('[0,0,752,300]'),
        },
        store: newStore(),
      },
      std: { getOptional: () => null },
    });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.stubGlobal(
      'ResizeObserver',
      class {
        disconnect() {}
        observe() {}
      }
    );
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        disconnect() {}
        observe() {}
      }
    );
    document.body.append(view);
    await view.updateComplete;
    expect(
      view.shadowRoot?.querySelector('[data-testid="attachment-html-interact"]')
    ).toBeNull();
    vi.unstubAllGlobals();
  });
});
