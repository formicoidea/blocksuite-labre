/**
 * The title band in the real editor, both views (ADR 0035 §11; REQ-PR-1 and
 * PR-7).
 *
 * The unit spec (`fragments/doc-title`) mounts the band alone. What only the
 * real editor can say is where it lands and how it moves: under `<doc-title>`
 * in the page view; inside the page's note on the canvas, so it scales with
 * the zoom like the note's own text instead of floating at a fixed size; and
 * nowhere at all, in either view, when the host registers no provider.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { NoteDisplayMode } from '@labre/affine/model';
import {
  type TitleBandProperty,
  TitleBandExtension,
  type TitleBandService,
  type TitleBandSheetState,
} from '@labre/affine/shared/services';
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
    notShown$: () => signal([{ docId: 'child', title: 'Child' }]),
  };
}

const BAND = '[data-testid="title-band"]';
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
    // The page view's "Not shown" row is the host's own, never the band's.
    expect(band!.querySelector('[data-testid="title-band-not-shown"]')).toBe(
      null
    );
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
