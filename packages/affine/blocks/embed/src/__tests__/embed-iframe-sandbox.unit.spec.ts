/**
 * The iframe an embed block renders: its sandbox, and its provider style.
 *
 * What it would catch:
 * - a provider embed, or an arbitrary url, given a sandbox wider than its own;
 * - a `javascript:` url reaching `src`;
 * - a provider style bound as a `style` text again: a host page without
 *   `style-src-attr` (the read-only viewer, #668) drops such a text whole,
 *   so the rounded corners went; through `styleMap` each property is set
 *   by the CSSOM, from a style object or from a host config's string.
 *
 * The class is constructed here only: a constructor registers once per page
 * and the browser project shares one page (`isolate: false`).
 */
import type { IframeOptions } from '@labre/affine-shared/services';
import { render } from 'lit';
import { beforeAll, describe, expect, test } from 'vitest';

import {
  TRUSTED_SANDBOX,
  UNTRUSTED_SANDBOX,
} from '../common/iframe-sandbox.js';
import { EmbedIframeBlockComponent } from '../embed-iframe-block/embed-iframe-block.js';
import { iframeStyleInfo } from '../embed-iframe-block/iframe-style.js';

beforeAll(() => {
  // `effects()` registers the real tag, but it needs a whole editor: register
  // the class under a test tag so it can simply be constructed here.
  customElements.define('test-embed-iframe-block', EmbedIframeBlockComponent);
});

/**
 * Renders the iframe of a block whose document props and matched provider are
 * given, without building an editor: only `_renderIframe` is exercised.
 */
function renderIframe(props: {
  iframeUrl?: string;
  configName?: string;
  options?: Partial<IframeOptions>;
}) {
  const block = new EmbedIframeBlockComponent();
  const stub = block as unknown as {
    iframeOptions: Partial<IframeOptions> | undefined;
    currentConfigName: string | undefined;
    _renderIframe: () => unknown;
  };
  Object.defineProperty(block, 'model', {
    value: {
      props: { iframeUrl: props.iframeUrl, url: 'https://provider.test/watch' },
    },
  });
  Object.defineProperty(block, 'std', { value: {} });
  Object.defineProperty(block, 'inSurface', { value: false });
  stub.iframeOptions = props.options;
  stub.currentConfigName = props.configName;

  const container = document.createElement('div');
  render(stub._renderIframe(), container);
  return container;
}

describe('an embed iframe is sandboxed', () => {
  test('a provider embed gets the trusted sandbox', () => {
    const iframe = renderIframe({
      iframeUrl: 'https://provider.test/embed/1',
      configName: 'spotify',
    }).querySelector('iframe');

    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('sandbox')).toBe(TRUSTED_SANDBOX);
  });

  test('an arbitrary url gets the untrusted sandbox', () => {
    const iframe = renderIframe({
      iframeUrl: 'https://anything.test/embed/1',
      configName: 'generic',
    }).querySelector('iframe');

    expect(iframe?.getAttribute('sandbox')).toBe(UNTRUSTED_SANDBOX);
  });

  test('a provider can override the sandbox', () => {
    const iframe = renderIframe({
      iframeUrl: 'https://provider.test/embed/1',
      configName: 'spotify',
      options: { sandbox: 'allow-scripts allow-popups' },
    }).querySelector('iframe');

    expect(iframe?.getAttribute('sandbox')).toBe('allow-scripts allow-popups');
  });

  test('a javascript: url renders no iframe at all', () => {
    const container = renderIframe({
      iframeUrl: 'javascript:alert(document.cookie)',
      configName: 'generic',
    });

    expect(container.querySelector('iframe')).toBeNull();
    expect(container.querySelector('embed-iframe-error-card')).not.toBeNull();
  });
});

describe('an embed iframe keeps its provider style', () => {
  test('a style object is set property by property', () => {
    const iframe = renderIframe({
      iframeUrl: 'https://provider.test/embed/1',
      configName: 'generic',
      options: { style: { border: 'none', borderRadius: '8px' } },
    }).querySelector('iframe');

    expect(iframe?.style.borderRadius).toBe('8px');
    expect(iframe?.style.borderStyle).toBe('none');
  });

  test('a host config string is split into its declarations', () => {
    const iframe = renderIframe({
      iframeUrl: 'https://provider.test/embed/1',
      configName: 'generic',
      options: { style: 'border: none; border-radius: 12px;' },
    }).querySelector('iframe');

    expect(iframe?.style.borderRadius).toBe('12px');
    expect(iframe?.style.borderStyle).toBe('none');
  });

  test('no style leaves no style attribute', () => {
    const iframe = renderIframe({
      iframeUrl: 'https://provider.test/embed/1',
      configName: 'generic',
    }).querySelector('iframe');

    expect(iframe?.hasAttribute('style')).toBe(false);
  });

  test('a string keeps one value per property, malformed parts skipped', () => {
    expect(
      iframeStyleInfo('border-radius: 8px;; nonsense ; color:; : red')
    ).toEqual({ 'border-radius': '8px' });
    expect(iframeStyleInfo(undefined)).toEqual({});
  });
});
