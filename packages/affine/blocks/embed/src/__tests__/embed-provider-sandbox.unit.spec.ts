/// <reference types="vite/client" />
import { ThemeProvider } from '@labre/affine-shared/services';
import { render, type TemplateResult } from 'lit';
import { beforeAll, describe, expect, test } from 'vitest';

import { PROVIDER_PLAYER_SANDBOX } from '../common/iframe-sandbox.js';
import { EmbedFigmaBlockComponent } from '../embed-figma-block/embed-figma-block.js';
import { EmbedLoomBlockComponent } from '../embed-loom-block/embed-loom-block.js';
import { EmbedYoutubeBlockComponent } from '../embed-youtube-block/embed-youtube-block.js';

beforeAll(() => {
  // `effects()` registers the real tags, but they need a whole editor: register
  // the classes under test tags so they can simply be constructed here.
  customElements.define('test-embed-youtube-block', EmbedYoutubeBlockComponent);
  customElements.define('test-embed-figma-block', EmbedFigmaBlockComponent);
  customElements.define('test-embed-loom-block', EmbedLoomBlockComponent);
});

/**
 * Renders the block template of a dedicated player without building an editor:
 * `renderEmbed` is short-circuited to its content, and the handful of services
 * the template reads are stubbed.
 */
function renderPlayer(
  Ctor: new () => {
    renderBlock: () => unknown;
  },
  props: Record<string, unknown>
) {
  const block = new Ctor();
  Object.defineProperty(block, 'model', { value: { id: 'test', props } });
  Object.defineProperty(block, 'std', {
    value: {
      selection: { value: [] },
      get: (identifier: unknown) =>
        identifier === ThemeProvider ? { theme: 'light' } : {},
    },
  });
  Object.defineProperty(block, 'store', {
    value: { get: () => ({ buildUrl: (url: string) => url }) },
  });
  Object.defineProperty(block, 'renderEmbed', {
    value: (content: () => TemplateResult) => content(),
  });

  const container = document.createElement('div');
  render(block.renderBlock() as TemplateResult, container);
  return container;
}

describe('a dedicated provider player is sandboxed', () => {
  test('the youtube player carries the provider sandbox', () => {
    const iframe = renderPlayer(EmbedYoutubeBlockComponent, {
      url: 'https://www.youtube.com/watch?v=aqz-KE-bpKQ',
      videoId: 'aqz-KE-bpKQ',
      title: 'Big Buck Bunny',
    }).querySelector('iframe');

    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('sandbox')).toBe(PROVIDER_PLAYER_SANDBOX);
  });

  test('the figma player carries the provider sandbox', () => {
    const iframe = renderPlayer(EmbedFigmaBlockComponent, {
      url: 'https://www.figma.com/file/abc/Board',
      title: 'Board',
    }).querySelector('iframe');

    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('sandbox')).toBe(PROVIDER_PLAYER_SANDBOX);
  });

  test('the loom player carries the provider sandbox', () => {
    const iframe = renderPlayer(EmbedLoomBlockComponent, {
      url: 'https://www.loom.com/share/abc',
      videoId: 'abc',
      title: 'Walkthrough',
    }).querySelector('iframe');

    expect(iframe).not.toBeNull();
    expect(iframe?.getAttribute('sandbox')).toBe(PROVIDER_PLAYER_SANDBOX);
  });

  test('the three players keep `allow-same-origin`', () => {
    // Without it the youtube player cannot reach its cache storage and paints
    // a black frame: the sandbox must never be tightened past this point
    // without re-testing the three players in a browser with network.
    expect(PROVIDER_PLAYER_SANDBOX.split(' ')).toContain('allow-same-origin');
  });
});

/**
 * Guard. Would have caught #389: the dedicated youtube / figma / loom players
 * shipped their `<iframe>` with no `sandbox` at all, because the policy lived
 * inside `embed-iframe-block/` and nothing checked the other templates.
 *
 * Every `<iframe>` this package renders points at a third party, so every one
 * of them must carry a sandbox. A new embed block is covered for free.
 */
describe('every iframe rendered by this package is sandboxed', () => {
  const sources = import.meta.glob<string>('../**/*.ts', {
    query: '?raw',
    import: 'default',
    eager: true,
  });

  const openingTags = Object.entries(sources)
    .filter(([path]) => !path.includes('__tests__'))
    .flatMap(([path, source]) =>
      // block comments are blanked out, offsets kept (they mention iframes in
      // prose); an opening tag is only real when an attribute follows the name
      [
        ...source
          .replace(/\/\*[\s\S]*?\*\//g, comment =>
            comment.replace(/[^\n]/g, ' ')
          )
          .matchAll(/<iframe\s[^>]*>/g),
      ].map(match => ({
        path,
        tag: match[0],
        line: source.slice(0, match.index).split('\n').length,
      }))
    );

  test('the sweep actually found the shipped iframes', () => {
    // A silent zero would turn the guard below into a no-op.
    expect(openingTags.length).toBeGreaterThanOrEqual(5);
  });

  test.each(
    openingTags.map(
      found => [`${found.path}:${found.line}`, found.tag] as const
    )
  )('%s carries a non-empty sandbox', (_where, tag) => {
    const sandbox = /\bsandbox=(?:"([^"]*)"|\$\{([^}]+)\})/.exec(tag);

    expect(sandbox).not.toBeNull();
    expect((sandbox?.[1] ?? sandbox?.[2] ?? '').trim()).not.toBe('');
  });
});
