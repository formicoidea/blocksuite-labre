/**
 * A heading's inline equation shows in its outline entry (GitHub issue #735;
 * upstream toeverything/AFFiNE#15813, commit 3fb5c7f).
 *
 * Inline LaTeX is stored as a one-space insert carrying the source on
 * `attributes.latex` (`affine/inlines/latex/src/command.ts`). The outline's
 * `_TextBlockPreview` renders `delta.insert` only and drops a blank insert, so
 * `Heading with $x^2$` showed as "Heading with": the formula vanished from the
 * table of contents. This spec mounts the real `affine-outline-block-preview`
 * on a heading built in a store and reads back what it rendered.
 *
 * NOTE: `vitest.config.ts` of this package lists its specs one by one; this
 * file must be added to that `include` list to run in `yarn test:unit`.
 */
import {
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { AffineTextAttributes } from '@labre/affine-shared/types';
import type { EditorHost } from '@labre/std';
import { type BlockModel, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { ContextProvider } from '@lit/context';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test, vi } from 'vitest';

import {
  AFFINE_OUTLINE_BLOCK_PREVIEW,
  OutlineBlockPreview,
} from '../card/outline-preview.js';
import { type TocContext, tocContext } from '../config.js';

// katex refuses to render when, at import time, `document.compatMode` is not
// standards mode; happy-dom leaves it undefined. A real page has a doctype, so
// the spec gives it one before katex loads.
vi.hoisted(() => {
  Object.defineProperty(document, 'compatMode', {
    configurable: true,
    value: 'CSS1Compat',
  });
});

// The vanilla-extract stylesheet needs its Vite plugin, which this package's
// suite does not load; only `textSpan` (the truncated span) is asserted on.
vi.mock('../card/outline-preview.css', () => ({
  outlineBlockPreview: 'preview',
  icon: 'icon',
  iconDisabled: 'icon-disabled',
  text: 'text',
  textGeneral: 'text-general',
  subtypeStyles: { h1: 'h1', h2: 'h2' },
  textSpan: 'text-span',
  linkedDocText: 'linked-doc-text',
  linkedDocPreviewUnavailable: 'linked-unavailable',
  linkedDocPreviewAvailable: 'linked-available',
  linkedDocTextUnavailable: 'linked-text-unavailable',
}));

if (!customElements.get(AFFINE_OUTLINE_BLOCK_PREVIEW)) {
  customElements.define(AFFINE_OUTLINE_BLOCK_PREVIEW, OutlineBlockPreview);
}

/** A level-1 heading reading "Heading with " then the inline equation x^2. */
function aHeadingWithInlineLatex(): BlockModel {
  const collection = new TestWorkspace({ id: 'outline-inline-latex' });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
  ];
  collection.meta.initialize();
  const store = collection.createDoc().getStore();

  let headingId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    const noteId = store.addBlock('affine:note', {}, rootId);
    headingId = store.addBlock(
      'affine:paragraph',
      {
        type: 'h1',
        text: new Text<AffineTextAttributes>([
          { insert: 'Heading with ' },
          // How `insertInlineLatex` stores an equation: one space + the source.
          { insert: ' ', attributes: { latex: 'x^2' } },
        ]),
      },
      noteId
    );
  });
  return store.getBlock(headingId)!.model;
}

async function mountPreview(block: BlockModel) {
  const context: TocContext = {
    editor$: signal({
      std: { getOptional: () => null },
    } as unknown as EditorHost),
    enableSorting$: signal(false),
    showIcons$: signal(false),
    fitPadding$: signal([0, 0, 0, 0]),
  };
  const host = document.createElement('div');
  new ContextProvider(host, { context: tocContext, initialValue: context });
  const preview = document.createElement(
    AFFINE_OUTLINE_BLOCK_PREVIEW
  ) as OutlineBlockPreview;
  preview.block = block;
  host.append(preview);
  document.body.append(host);
  await preview.updateComplete;
  return preview;
}

afterEach(() => {
  document.body.replaceChildren();
});

describe('an outline heading entry', () => {
  test('keeps the text around an inline equation', async () => {
    const preview = await mountPreview(aHeadingWithInlineLatex());
    expect(preview.textContent).toContain('Heading with');
  });

  test('shows the inline equation', async () => {
    const preview = await mountPreview(aHeadingWithInlineLatex());
    const entry = preview.querySelector(
      '[data-testid="outline-block-preview-h1"]'
    );
    expect(entry).not.toBeNull();
    // Whatever the rendering (MathML, source text), the formula's symbols
    // must reach the entry after the heading text: "x" and the exponent "2".
    const compact = Array.from(entry!.textContent ?? '')
      .filter(char => char.trim().length > 0)
      .join('');
    expect(compact.startsWith('Headingwith')).toBe(true);
    const formula = compact.slice('Headingwith'.length);
    expect(formula).toContain('x');
    expect(formula).toContain('2');
  });

  test('gives the equation as MathML inside the truncated text span', async () => {
    const preview = await mountPreview(aHeadingWithInlineLatex());
    const entry = preview.querySelector(
      '[data-testid="outline-block-preview-h1"]'
    );
    // MathML is what a screen reader reads the formula from; the span keeps
    // the entry's nowrap/ellipsis styling (`textSpan`, mocked as text-span).
    const math = entry?.querySelector('.text-span math');
    expect(math).not.toBeNull();
    expect(math?.querySelector('msup')).not.toBeNull();
    expect(
      math?.querySelector('annotation[encoding="application/x-tex"]')
        ?.textContent
    ).toBe('x^2');
  });
});
