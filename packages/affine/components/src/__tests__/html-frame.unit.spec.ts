/// <reference types="vite/client" />
/**
 * The one frame that runs html in the library (ADR 0047, ADR 0048): the html
 * block, the html attachment and a host's library all mount it.
 *
 * What it would have caught:
 * - a `blob:` url as the `src` of a frame: it has the origin of the app, the
 *   origin of the reader's tokens;
 * - a `srcdoc` for an attachment: without a page from the host it renders nothing;
 * - an answer to another window or another message than the frame's announcement;
 * - a thumbnail that takes the pointer, or a frame that exists before it is seen;
 * - a script of the html that runs without the reader's gesture: a file in a loop
 *   would freeze the page for everyone who opens it, on a browser that keeps the
 *   frame in the page's process;
 * - a template of this component without a sandbox (ADR 0028).
 */
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import {
  CLOSED_SANDBOX,
  HOST_PAGE_SANDBOX,
  HTML_FRAME_READY,
  HtmlFrame,
  registerHtmlFrame,
  UNTRUSTED_SANDBOX,
} from '../html-frame/index.js';

const PAGE = '/frame.html';
const READY = { type: HTML_FRAME_READY };
const BOX_WIDTH = 320;
const BOX_HEIGHT = 200;
const LAYOUT_WIDTH = 1280;
const SCALE = BOX_WIDTH / LAYOUT_WIDTH;

beforeAll(() => {
  registerHtmlFrame();
});

afterEach(() => {
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

async function mount(props: Partial<HtmlFrame>) {
  const frame = new HtmlFrame();
  Object.assign(frame, props);
  document.body.append(frame);
  await frame.updateComplete;
  return frame;
}

/** A fake window for the frame: the handler is the whole protocol. */
function fakeWindow(frame: HtmlFrame) {
  const contentWindow = { postMessage: vi.fn() };
  Object.defineProperty(frame, 'iframe', {
    configurable: true,
    value: { contentWindow, src: PAGE },
  });
  return contentWindow;
}

function announce(frame: HtmlFrame, event: Partial<MessageEvent>) {
  (
    frame as unknown as { _answerFrame: (e: Partial<MessageEvent>) => void }
  )._answerFrame(event);
}

function stubObservers() {
  const reveal: Array<(entries: unknown[]) => void> = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback: (entries: unknown[]) => void) {
        reveal.push(callback);
      }
      disconnect() {}
      observe() {}
    }
  );
  vi.stubGlobal(
    'ResizeObserver',
    class {
      disconnect() {}
      observe() {}
    }
  );
  return reveal;
}

function sizedThumbnail() {
  const frame = new HtmlFrame();
  Object.defineProperty(frame, 'clientWidth', { value: BOX_WIDTH });
  Object.defineProperty(frame, 'clientHeight', { value: BOX_HEIGHT });
  Object.assign(frame, { html: '<p>x</p>', frameUrl: PAGE, thumbnail: true });
  document.body.append(frame);
  return frame;
}

describe('what the frame loads', () => {
  test('registering twice is harmless: the editor and a host may both do it', () => {
    expect(() => registerHtmlFrame()).not.toThrow();
  });

  test('without a page and without the fallback, nothing runs', async () => {
    const frame = await mount({ html: '<script>1</script>' });
    expect(frame.iframe).toBeNull();
  });

  test('with the fallback, a srcdoc that runs nothing before the gesture', async () => {
    const frame = await mount({ html: '<p>x</p>', srcdocFallback: true });
    expect(frame.iframe?.getAttribute('sandbox')).toBe(CLOSED_SANDBOX);
    expect(frame.iframe?.srcdoc).toBe('<p>x</p>');
    expect(frame.iframe?.getAttribute('src')).toBeNull();
  });

  test('after the gesture, a new srcdoc under the untrusted sandbox', async () => {
    const frame = await mount({ html: '<p>x</p>', srcdocFallback: true });
    const closed = frame.iframe;
    frame.scripts = true;
    await frame.updateComplete;
    expect(frame.iframe).not.toBe(closed);
    expect(frame.iframe?.getAttribute('sandbox')).toBe(UNTRUSTED_SANDBOX);
  });

  test('with a page, that page under its sandbox, and the html out of the markup', async () => {
    const frame = await mount({ html: '<p>x</p>', frameUrl: PAGE });
    expect(frame.iframe?.getAttribute('sandbox')).toBe(HOST_PAGE_SANDBOX);
    expect(frame.iframe?.getAttribute('src')).toBe(PAGE);
    expect(frame.iframe?.srcdoc).toBeFalsy();
  });

  test.each([
    'blob:http://localhost/1',
    'data:text/html,x',
    'javascript:alert(1)',
  ])('%s is no page', async frameUrl => {
    const frame = await mount({ html: '<p>x</p>', frameUrl });
    expect(frame.iframe).toBeNull();
  });

  test('a Blob is read as text and never becomes a url', async () => {
    const createObjectURL = vi.fn();
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL }));
    const blob = new Blob(['<p>from a file</p>'], { type: 'text/html' });
    const frame = await mount({ html: blob, frameUrl: PAGE });
    const contentWindow = fakeWindow(frame);

    announce(frame, { source: contentWindow as never, data: READY });
    await vi.waitFor(() =>
      expect(contentWindow.postMessage).toHaveBeenCalledWith(
        { html: '<p>from a file</p>', scripts: false, scroll: true },
        '*'
      )
    );
    expect(createObjectURL).not.toHaveBeenCalled();
  });
});

describe('the handshake', () => {
  test('it answers its own frame', async () => {
    const frame = await mount({ html: '<p>x</p>', frameUrl: PAGE });
    const contentWindow = fakeWindow(frame);
    announce(frame, { source: contentWindow as never, data: READY });
    expect(contentWindow.postMessage).toHaveBeenCalledWith(
      { html: '<p>x</p>', scripts: false, scroll: true },
      '*'
    );
  });

  test('it allows scripts only once the host says so', async () => {
    const frame = await mount({ html: '<p>x</p>', frameUrl: PAGE });
    const closed = frame.iframe;
    frame.scripts = true;
    await frame.updateComplete;
    // What a document may run is fixed when it loads: a new frame.
    expect(frame.iframe).not.toBe(closed);

    const contentWindow = fakeWindow(frame);
    announce(frame, { source: contentWindow as never, data: READY });
    expect(contentWindow.postMessage).toHaveBeenCalledWith(
      { html: '<p>x</p>', scripts: true, scroll: true },
      '*'
    );
  });

  test('a closed document that refreshes to the page is not answered again', async () => {
    const frame = await mount({ html: '<p>x</p>', frameUrl: PAGE });
    const contentWindow = fakeWindow(frame);
    announce(frame, { source: contentWindow as never, data: READY });
    announce(frame, { source: contentWindow as never, data: READY });
    expect(contentWindow.postMessage).toHaveBeenCalledTimes(1);

    frame.remove();
    document.body.append(frame);
    announce(frame, { source: contentWindow as never, data: READY });
    expect(contentWindow.postMessage).toHaveBeenCalledTimes(2);
  });

  test('it answers no other window, and no other message', async () => {
    const frame = await mount({ html: '<p>x</p>', frameUrl: PAGE });
    const contentWindow = fakeWindow(frame);
    announce(frame, { source: window, data: READY });
    announce(frame, { source: contentWindow as never, data: {} });
    announce(frame, { source: contentWindow as never, data: null });
    expect(contentWindow.postMessage).not.toHaveBeenCalled();
  });

  test('new html reloads the page, which wrote its document once', async () => {
    const frame = await mount({ html: '<p>x</p>', frameUrl: PAGE });
    const contentWindow = fakeWindow(frame);
    announce(frame, { source: contentWindow as never, data: READY });
    const iframe = frame.iframe as unknown as { src: string };
    iframe.src = 'changed-by-the-frame';

    frame.html = '<p>y</p>';
    await frame.updateComplete;
    expect(iframe.src).toBe(PAGE);
  });
});

describe('the pointer', () => {
  test('a preview lets the pointer through until it is interactive', async () => {
    const frame = await mount({ html: '<p>x</p>', frameUrl: PAGE });
    expect(frame.iframe?.hasAttribute('inert')).toBe(true);
    expect(frame.iframe?.getAttribute('tabindex')).toBe('-1');

    frame.interactive = true;
    await frame.updateComplete;
    expect(frame.iframe?.hasAttribute('inert')).toBe(false);
    expect(frame.iframe?.hasAttribute('tabindex')).toBe(false);
  });
});

describe('a thumbnail', () => {
  test('has no frame until it has been in view', async () => {
    const reveal = stubObservers();
    const frame = sizedThumbnail();
    await frame.updateComplete;
    expect(frame.iframe).toBeNull();

    reveal[0]?.([{ isIntersecting: false }]);
    await frame.updateComplete;
    expect(frame.iframe).toBeNull();

    reveal[0]?.([{ isIntersecting: true }]);
    await frame.updateComplete;
    expect(frame.iframe).not.toBeNull();
  });

  test('is a page laid out wide and scaled, never interactive', async () => {
    const reveal = stubObservers();
    const frame = sizedThumbnail();
    frame.interactive = true;
    await frame.updateComplete;
    reveal[0]?.([{ isIntersecting: true }]);
    await frame.updateComplete;

    const style = frame.iframe?.style;
    expect(style?.width).toBe(`${LAYOUT_WIDTH}px`);
    expect(style?.transform).toBe(`scale(${SCALE})`);
    expect(style?.height).toBe(`${BOX_HEIGHT / SCALE}px`);
    expect(frame.iframe?.hasAttribute('inert')).toBe(true);
    expect(frame.iframe?.getAttribute('scrolling')).toBe('no');
  });

  test('never runs scripts, whatever it is told', async () => {
    const reveal = stubObservers();
    const frame = sizedThumbnail();
    frame.scripts = true;
    await frame.updateComplete;
    reveal[0]?.([{ isIntersecting: true }]);
    await frame.updateComplete;

    const contentWindow = fakeWindow(frame);
    announce(frame, { source: contentWindow as never, data: READY });
    expect(contentWindow.postMessage).toHaveBeenCalledWith(
      { html: '<p>x</p>', scripts: false, scroll: false },
      '*'
    );
  });
});

describe('the source of the component', () => {
  const sources = Object.values(
    import.meta.glob<string>('../html-frame/*.ts', {
      query: '?raw',
      import: 'default',
      eager: true,
    })
  ).join('\n');

  test('every template carries a sandbox (ADR 0028)', () => {
    const tags = sources.split('<iframe').slice(1);
    expect(tags.length).toBeGreaterThan(0);
    expect(tags.every(tag => tag.trimStart().startsWith('sandbox=${'))).toBe(
      true
    );
  });

  test('it never makes a url of what it runs', () => {
    expect(sources).not.toContain('createObjectURL');
  });
});
