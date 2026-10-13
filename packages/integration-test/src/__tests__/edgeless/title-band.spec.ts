/**
 * The title band in the real editor, both views (ADR 0035 §11; REQ-PR-1 and
 * PR-7).
 *
 * The unit spec (`fragments/doc-title`) mounts the band alone. What only the
 * real editor can say is where it lands and how it moves: under `<doc-title>`
 * in the page view; inside the page's note on the canvas, so it scales with
 * the zoom like the note's own text instead of floating at a fixed size; and
 * nowhere at all, in either view, when the host registers no provider.
 *
 * The "Not shown in this document" row (labre ADR-0045 §7, ADR 0035 §9d
 * amended 2026-10-13) is drawn in both views, and its "Show here" must land
 * a real, rendered card of the page: at the end of the last note in the page
 * view, at the centre of the visible canvas on the canvas, as one undo step.
 * That also pins what the canvas already did for a child page before the
 * row existed: a linked or synced card of it renders on the canvas.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { NoteDisplayMode } from '@labre/affine/model';
import {
  type TitleBandProperty,
  TitleBandExtension,
  type TitleBandService,
  type TitleBandSheetState,
} from '@labre/affine/shared/services';
import { Text } from '@labre/store';
import { signal } from '@preact/signals-core';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PROPERTIES: TitleBandProperty[] = [
  {
    id: 'status',
    namespace: 'workspace',
    name: 'Status',
    type: 'select',
    data: { options: [{ id: 'a', value: 'Doing' }] },
    value: 'a',
    readonly: false,
  },
  {
    id: 'owner',
    namespace: 'workspace',
    name: 'Owner',
    type: 'text',
    data: {},
    value: null,
    readonly: false,
  },
];

function service(): TitleBandService {
  return {
    sheet$: () =>
      signal<TitleBandSheetState>({ status: 'ready', properties: PROPERTIES }),
    set: async () => {},
    notShown$: () => signal([{ docId: CHILD, title: 'Child' }]),
  };
}

const CHILD = 'doc:child';
const BAND = '[data-testid="title-band"]';
const NOT_SHOWN = '[data-testid="title-band-not-shown"]';
const SHOW_HERE = '[data-testid="title-band-show-here"]';

/** The child page the row lists, so its card has something to show. */
function childDoc() {
  if (window.collection.getDoc(CHILD)) return;
  const store = window.collection.createDoc(CHILD).getStore({ id: CHILD });
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('Child') });
    store.addBlock('affine:surface', {}, rootId);
    store.addBlock('affine:note', {}, rootId);
  });
}
const CHIP = '[data-testid="title-band-chip"]';

let cleanup: (() => void) | null = null;

afterEach(() => {
  cleanup?.();
  cleanup = null;
});

/** The page's note: the first one shown in both views (`isPageBlock`). */
async function addPageNote(edgeless: EdgelessRootBlockComponent) {
  window.doc.addBlock(
    'affine:note',
    { xywh: '[0,0,600,200]', displayMode: NoteDisplayMode.DocAndEdgeless },
    window.doc.root!.id
  );
  await wait(100);
  await edgeless.updateComplete;
}

describe('the title band', () => {
  test('sits under the page title in the page view', async () => {
    cleanup = await setupEditor('page', [TitleBandExtension(service())]);
    await wait(100);

    const band = document.querySelector(`doc-title ${BAND}`);
    expect(band).not.toBeNull();
    expect(band!.querySelectorAll(CHIP)).toHaveLength(2);
    // The "Not shown" row is the band's in the page view too.
    expect(band!.querySelector(NOT_SHOWN)).not.toBeNull();
  });

  test('"Show here" ends the last note with a card of the page', async () => {
    cleanup = await setupEditor('page', [TitleBandExtension(service())]);
    childDoc();
    await wait(100);

    const noteId = window.doc.addBlock('affine:note', {}, window.doc.root!.id);
    window.doc.addBlock('affine:paragraph', { text: new Text('a') }, noteId);
    await wait(100);
    const note = window.doc.getBlock(noteId)!.model;
    const before = note.children.length;
    document.querySelector<HTMLElement>(`doc-title ${SHOW_HERE}`)!.click();
    await wait(100);

    const last = note.children.at(-1)!;
    expect(note.children).toHaveLength(before + 1);
    expect(last.flavour).toBe('affine:embed-linked-doc');
    expect(
      (last as unknown as { props: { pageId: string } }).props.pageId
    ).toBe(CHILD);
    expect(
      document.querySelector(
        `affine-embed-linked-doc-block[data-block-id="${last.id}"]`
      )
    ).not.toBeNull();
  });

  test('an empty chip opens its editor and hands the value to the host', async () => {
    const band = service();
    const set = vi.fn(async () => {});
    band.set = set;
    cleanup = await setupEditor('page', [TitleBandExtension(band)]);
    await wait(100);

    const owner = document.querySelector<HTMLElement>(
      `doc-title ${CHIP}[data-property-id="owner"]`
    );
    expect(owner?.dataset.empty).toBe('true');
    owner!.click();
    await wait(100);
    await userEvent.keyboard('Ada{Enter}');
    await wait(50);

    expect(set).toHaveBeenCalledWith(window.doc.id, 'owner', 'Ada');
  });

  test('sits in the page note on the canvas and follows the zoom', async () => {
    cleanup = await setupEditor('edgeless', [TitleBandExtension(service())]);
    const edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    await addPageNote(edgeless);

    const band = () =>
      document.querySelector<HTMLElement>(`affine-edgeless-note ${BAND}`);
    expect(band()).not.toBeNull();
    expect(band()!.querySelectorAll(CHIP)).toHaveLength(2);
    expect(
      band()!.querySelector('[data-testid="title-band-not-shown"]')
    ).not.toBeNull();

    const chipWidth = () =>
      band()!.querySelector<HTMLElement>(CHIP)!.getBoundingClientRect().width;

    const viewport = edgeless.service.gfx.viewport;
    viewport.setViewport(1, [300, 100]);
    await wait(100);
    const atOne = chipWidth();
    viewport.setViewport(2, [300, 100]);
    await wait(100);
    const atTwo = chipWidth();

    expect(atOne).toBeGreaterThan(0);
    expect(atTwo / atOne).toBeCloseTo(2, 1);
  });

  test('"Show here" centres a card of the page on the canvas, one undo step', async () => {
    cleanup = await setupEditor('edgeless', [TitleBandExtension(service())]);
    childDoc();
    const edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    await addPageNote(edgeless);
    const viewport = edgeless.service.gfx.viewport;
    viewport.setViewport(1, [300, 100]);
    await wait(100);

    const cards = () =>
      window.doc.getBlocksByFlavour('affine:embed-linked-doc');
    expect(cards()).toHaveLength(0);
    document
      .querySelector<HTMLElement>(`affine-edgeless-note ${SHOW_HERE}`)!
      .click();
    await wait(200);

    expect(cards()).toHaveLength(1);
    const card = cards()[0]!.model as unknown as {
      id: string;
      parent: { flavour: string } | null;
      props: { pageId: string; xywh: string; style: string };
    };
    expect(card.parent?.flavour).toBe('affine:surface');
    expect(card.props.pageId).toBe(CHILD);
    expect(card.props.style).toBe('vertical');
    const [x, y, w, h] = JSON.parse(card.props.xywh) as number[];
    expect(x + w / 2).toBeCloseTo(viewport.centerX, 0);
    expect(y + h / 2).toBeCloseTo(viewport.centerY, 0);
    expect(edgeless.service.gfx.selection.selectedIds).toEqual([card.id]);
    // The card the canvas draws for a child page, unchanged by this row.
    expect(
      document.querySelector(
        `affine-embed-edgeless-linked-doc-block[data-block-id="${card.id}"]`
      )
    ).not.toBeNull();

    window.doc.undo();
    await wait(100);
    expect(cards()).toHaveLength(0);
    expect(document.querySelector('affine-edgeless-note')).not.toBeNull();
  });

  test('a synced card of a page renders on the canvas', async () => {
    cleanup = await setupEditor('edgeless');
    childDoc();
    const surface = window.doc.getBlocksByFlavour('affine:surface')[0]!.model;
    const id = window.doc.addBlock(
      'affine:embed-synced-doc',
      { pageId: CHILD, xywh: '[0,0,400,300]' },
      surface
    );
    await wait(200);
    expect(
      document.querySelector(
        `affine-embed-edgeless-synced-doc-block[data-block-id="${id}"]`
      )
    ).not.toBeNull();
  });

  test('draws nothing, in either view, without a provider', async () => {
    cleanup = await setupEditor('edgeless');
    const edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    await addPageNote(edgeless);
    expect(document.querySelector('affine-edgeless-note')).not.toBeNull();
    expect(document.querySelector(BAND)).toBeNull();
    cleanup();

    cleanup = await setupEditor('page');
    await wait(100);
    expect(document.querySelector('doc-title')).not.toBeNull();
    expect(document.querySelector(BAND)).toBeNull();
  });
});
