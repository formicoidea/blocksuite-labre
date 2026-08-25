import { describe, expect, it } from 'vitest';

import {
  printToPdfStyles,
  waitForImages,
} from '../../utils/print-to-pdf.js';

describe('printToPdfStyles', () => {
  it('only applies to the print medium', () => {
    expect(printToPdfStyles.trimStart().startsWith('@media print')).toBe(true);
  });

  it('forces a light colour scheme so nothing prints white on white', () => {
    expect(printToPdfStyles).toContain('color-scheme: light !important');
    expect(printToPdfStyles).toContain('--affine-text-primary: #000 !important');
    expect(printToPdfStyles).toContain(
      '--affine-background-primary: #fff !important'
    );
    // dark theme text is repainted, including text painted through a fill colour
    expect(printToPdfStyles).toContain("[data-theme='dark']");
    expect(printToPdfStyles).toContain(
      '-webkit-text-fill-color: #000 !important'
    );
  });
});

describe('printToPdfStyles code blocks and quotes', () => {
  it('keeps the surfaces that carry code, quotes and borders visible', () => {
    // pinning every background to #fff would flatten these three away
    expect(printToPdfStyles).toContain(
      '--affine-background-code-block: #f5f5f5 !important'
    );
    expect(printToPdfStyles).toContain('--affine-quote-color: #e3e3e3');
    expect(printToPdfStyles).toContain('--affine-border-color: #e3e3e3');
  });
});

describe('waitForImages', () => {
  const tick = () => new Promise(resolve => setTimeout(resolve, 0));

  const image = (complete: boolean) => {
    const img = document.createElement('img');
    Object.defineProperty(img, 'complete', { value: complete });
    Object.defineProperty(img, 'naturalWidth', { value: complete ? 10 : 0 });
    return img;
  };

  it('resolves at once when every image is already decoded', async () => {
    const container = document.createElement('div');
    container.append(image(true), image(true));

    let settled = false;
    void waitForImages(container).then(() => (settled = true));
    await tick();

    expect(settled).toBe(true);
  });

  it('waits for an image that has not loaded yet', async () => {
    const container = document.createElement('div');
    const pending = image(false);
    container.append(pending);

    let settled = false;
    const done = waitForImages(container).then(() => (settled = true));
    await tick();
    expect(settled).toBe(false);

    pending.dispatchEvent(new Event('load'));
    await done;
    expect(settled).toBe(true);
  });

  it('gives up on an image that errors instead of hanging the print', async () => {
    const container = document.createElement('div');
    const broken = image(false);
    container.append(broken);

    let settled = false;
    const done = waitForImages(container).then(() => (settled = true));
    await tick();
    expect(settled).toBe(false);

    broken.dispatchEvent(new Event('error'));
    await done;
    expect(settled).toBe(true);
  });

  it('also waits for images living inside a shadow root', async () => {
    const container = document.createElement('div');
    const host = document.createElement('div');
    const shadow = host.attachShadow({ mode: 'open' });
    const pending = image(false);
    shadow.append(pending);
    container.append(host);

    let settled = false;
    const done = waitForImages(container).then(() => (settled = true));
    await tick();
    expect(settled).toBe(false);

    pending.dispatchEvent(new Event('load'));
    await done;
    expect(settled).toBe(true);
  });
});
