import type { IframeOptions } from '@labre/affine-shared/services';
import { render } from 'lit';
import { beforeAll, describe, expect, test } from 'vitest';

import {
  TRUSTED_SANDBOX,
  UNTRUSTED_SANDBOX,
} from '../embed-iframe-block/consts.js';
import { EmbedIframeBlockComponent } from '../embed-iframe-block/embed-iframe-block.js';

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
