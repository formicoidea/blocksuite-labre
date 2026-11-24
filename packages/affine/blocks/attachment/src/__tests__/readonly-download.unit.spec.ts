/**
 * A reader of a read-only document can get an attachment out of it (issue #744,
 * upstream toeverything/AFFiNE#15905, commit 268371c, ADR 0058).
 *
 * The library offered two ways to download an attachment: the toolbar's
 * Download (`configs/toolbar.ts`, `d.download`) and the host's peek view
 * (`@Peekable` on `AttachmentBlockComponent`). On a read-only store both were
 * shut: `ToolbarContext.activated` answers `false` first thing
 * (`toolbar-service/context.ts`), and `enableOn` was `!readonly && pdf`
 * (`attachment-block.ts`). A click on the card only selects it (page) or does
 * nothing (canvas). So nothing in the library let the reader download.
 *
 * `!readonly && pdf` was not a Labre decision: it is upstream's line of
 * toeverything/AFFiNE#11641 (2025-04, "disable opening peek view with pdf
 * viewer in readonly and sharing modes"), synced here in c332148b8, which
 * upstream itself reverted in #14761 (2026-04) before #15905 opened the peek
 * view to every type on read-only.
 *
 * The product owner's decision (2026-11-24): upstream's catch-up AND a
 * Download button the library draws in the card on read-only only. What would
 * be caught here:
 *
 * - the peek view shut on read-only again, or opened to non-PDF files on an
 *   editable document, or opened without a host provider;
 * - the in-card Download missing on read-only, drawn on an editable document
 *   (which must look as before), or drawn for a citation;
 * - a Download that writes to the document, or that does not run the
 *   toolbar's own download path (the blob url, the file's name);
 * - a canvas gesture or the peek view's double click reaching past the button.
 */
import { PeekViewProvider, isPeekable } from '@labre/affine-components/peek';
import {
  AttachmentBlockSchemaExtension,
  type AttachmentBlockModel,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  CitationProvider,
  FileSizeLimitProvider,
  ToolbarContext,
} from '@labre/affine-shared/services';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { html, render } from 'lit';
import { afterEach, beforeAll, describe, expect, test, vi } from 'vitest';

import { AttachmentBlockComponent } from '../attachment-block.js';
import { AttachmentEmbedProvider } from '../embed';
import { ATTACHMENT_BUTTON_DOWNLOAD } from '../translations';

const TAG = 'test-readonly-attachment';
const FILE_NAME = 'report.zip';
const BLOB_URL = 'blob:report';
/** Any size: the file is never read. */
const FILE_SIZE = 16;
/** Well above any test file: the size limit plays no part here. */
const MAX_FILE_SIZE = 1_000_000;

beforeAll(() => {
  customElements.define(TAG, class extends AttachmentBlockComponent {});
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** An attachment card of `type`, in a store that is or is not read-only. */
function card(type: string, readonly: boolean, peekView = true) {
  const store = { readonly };
  const std = {
    store,
    getOptional: (id: unknown) =>
      id === PeekViewProvider && peekView ? { peek: vi.fn() } : null,
  };
  const block = document.createElement(TAG) as AttachmentBlockComponent;
  Object.defineProperties(block, {
    std: { value: std },
    model: { value: { props: { type }, store } },
  });
  return { block, toolbar: new ToolbarContext(std as never) };
}

/** A real store holding one attachment, as a reader's document holds it. */
function storedAttachment(props: Record<string, unknown> = {}) {
  const workspace = new TestWorkspace({
    id: 'readonly-download',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc0').getStore({
    id: 'doc0',
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      AttachmentBlockSchemaExtension,
    ],
  });
  let id = '';
  store.load(() => {
    const root = store.addBlock('affine:page', {});
    const note = store.addBlock('affine:note', {}, root);
    id = store.addBlock(
      'affine:attachment',
      {
        name: FILE_NAME,
        type: 'application/zip',
        size: FILE_SIZE,
        sourceId: 'blob-1',
        style: 'horizontalThin',
        ...props,
      },
      note
    );
  });
  return { store, model: store.getModelById(id) as AttachmentBlockModel };
}

/**
 * The block constructed by its tag under the std the editor gives it, its
 * blob loaded. The citation service answers "not a citation"; the embed one
 * answers a plain card, or, with `embed`, a stand-in for the embed view.
 */
function mountedCard(store: Store, model: AttachmentBlockModel, embed = false) {
  const host = document.createElement('div');
  document.body.append(host);
  const services = new Map<unknown, unknown>([
    [CitationProvider, { isCitationModel: () => false }],
    [FileSizeLimitProvider, { maxFileSize: MAX_FILE_SIZE }],
    [
      AttachmentEmbedProvider,
      {
        renderThumbnail: () => null,
        getRender: () =>
          embed ? () => html`<div data-testid="embed-view"></div>` : null,
        shouldShowStatus: () => false,
      },
    ],
  ]);
  const std = {
    host,
    store,
    get: (id: unknown) => services.get(id),
    getOptional: () => null,
  };
  // What the download toast reads to find its container: no root block,
  // so the toast goes to the body.
  Object.assign(host, { std, store: { root: null } });
  const block = document.createElement(TAG) as AttachmentBlockComponent;
  Object.defineProperties(block, {
    std: { value: std },
    host: { value: host },
    model: { value: model },
    store: { value: store },
  });
  block.resourceController.blobUrl$.value = BLOB_URL;

  const container = document.createElement('div');
  host.append(container);
  render(
    html`${embed ? block['renderEmbedView']() : block['renderCardView']()}`,
    container
  );
  return {
    block,
    container,
    button: () =>
      container.querySelector<HTMLButtonElement>(
        '[data-testid="attachment-download"]'
      ),
  };
}

describe('downloading an attachment from a read-only doc (#744)', () => {
  test('a PDF still opens in the host peek view (upstream #14761)', () => {
    expect(isPeekable(card('application/pdf', true).block)).toBe(true);
  });

  test('a non-PDF file opens in the host peek view (upstream 268371c)', () => {
    const { block, toolbar } = card('application/zip', true);

    expect(toolbar.activated).toBe(false);
    expect(isPeekable(block)).toBe(true);
  });

  test('without a host peek view, read-only peeks nothing', () => {
    expect(isPeekable(card('application/zip', true, false).block)).toBe(false);
  });
});

describe('what an editable doc does (guard)', () => {
  test.each([
    { type: 'application/pdf', peeked: true },
    { type: 'application/zip', peeked: false },
  ])('$type opens in the peek view: $peeked', ({ type, peeked }) => {
    expect(isPeekable(card(type, false).block)).toBe(peeked);
  });

  test('without a host peek view nothing is peekable', () => {
    expect(isPeekable(card('application/pdf', false, false).block)).toBe(false);
  });

  test('the card draws no Download', () => {
    const { store, model } = storedAttachment();

    expect(mountedCard(store, model).button()).toBeNull();
  });
});

describe('the in-card Download on a read-only doc (#744)', () => {
  test.each(['horizontalThin', 'cubeThick'])(
    'a %s card draws a button named after the file',
    style => {
      const { store, model } = storedAttachment({ style });
      store.readonly = true;

      const button = mountedCard(store, model).button();

      expect(button?.tagName).toBe('BUTTON');
      expect(button?.type).toBe('button');
      expect(button?.getAttribute('aria-label')).toBe(
        ATTACHMENT_BUTTON_DOWNLOAD[1].replace('{{name}}', FILE_NAME)
      );
      expect(button?.textContent?.trim()).toBe('Download');
    }
  );

  test('a citation draws none, as the toolbar offers none', () => {
    const { store, model } = storedAttachment({ footnoteIdentifier: '1' });
    store.readonly = true;

    expect(mountedCard(store, model).button()).toBeNull();
  });

  test('a click downloads the blob under its name and writes nothing', () => {
    const { store, model } = storedAttachment();
    store.readonly = true;
    const { button } = mountedCard(store, model);
    const clicked: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').mockImplementation(
      function (this: HTMLAnchorElement) {
        clicked.push(this);
        return true;
      }
    );
    const updates: Uint8Array[] = [];
    store.spaceDoc.on('update', (update: Uint8Array) => updates.push(update));

    button()?.click();

    expect(clicked.map(a => [a.download, a.getAttribute('href')])).toEqual([
      [FILE_NAME, BLOB_URL],
    ]);
    expect(updates).toEqual([]);
    expect(store.readonly).toBe(true);
  });

  test('its gestures stop at the button: no selection, pan or peek', () => {
    const { store, model } = storedAttachment();
    store.readonly = true;
    const { container, button } = mountedCard(store, model);
    const reached: string[] = [];
    ['pointerdown', 'mousedown', 'click', 'dblclick', 'keydown'].forEach(type =>
      container.addEventListener(type, () => reached.push(type))
    );
    vi.spyOn(HTMLAnchorElement.prototype, 'dispatchEvent').mockReturnValue(
      true
    );

    const target = button();
    target?.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
    target?.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    target?.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
    target?.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );
    target?.click();

    expect(reached).toEqual([]);
  });
});

describe('an embedded attachment on a read-only doc (#744)', () => {
  test.each([
    { type: 'application/pdf', style: 'pdf', inline: false },
    { type: 'video/mp4', style: 'video', inline: false },
    { type: 'audio/mpeg', style: 'horizontalThin', inline: true },
  ])(
    'a $type embed keeps a Download (beside it: $inline)',
    ({ type, style, inline }) => {
      const { store, model } = storedAttachment({ type, style, embed: true });
      store.readonly = true;

      const { container, button } = mountedCard(store, model, true);

      const embed = container.querySelector(
        '.affine-attachment-embed-container'
      );
      expect(embed?.querySelector('[data-testid="embed-view"]')).not.toBeNull();
      expect(button()?.closest('.affine-attachment-embed-container')).toBe(
        embed
      );
      expect(
        button()?.classList.contains('affine-attachment-embed-download')
      ).toBe(true);
      expect(embed?.classList.contains('inline-download')).toBe(inline);
    }
  );

  test('an editable embed draws no Download', () => {
    const { store, model } = storedAttachment({
      type: 'video/mp4',
      style: 'video',
      embed: true,
    });

    expect(mountedCard(store, model, true).button()).toBeNull();
  });
});
