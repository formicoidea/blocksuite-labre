/**
 * A value of the document is one value for one CSS property, on a real editor.
 *
 * What it would have caught: the first render of Lit's `styleMap` joining its
 * values into one `style` string. A colour, a size or a name is whatever a client
 * wrote to the document, so a value holding a `;` declared properties of its own
 * on the reader's screen, in a read-only document, with no gesture. A token, a
 * `var()`, an `rgb()` or an `oklch()` must reach the browser unchanged, as stored
 * documents hold them. `affine/all` `style-map-boundary.unit.spec.ts` holds that
 * no package goes back to Lit's.
 */
import { styleMap } from '@labre/global/lit';
import { type Store, Text } from '@labre/store';
import { html, render } from 'lit';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const SECOND_DECLARATION = 'red;outline-style:dotted';
const RUN = 'run';
const OPACITY = 0.5;

function styledElements(blockId: string) {
  const block = document.querySelector(`[data-block-id="${blockId}"]`);
  if (!block) throw new Error(`no block ${blockId}`);
  return [...block.querySelectorAll<HTMLElement>('[style]')];
}

const addedDeclarations = (blockId: string) =>
  styledElements(blockId).filter(el => el.style.outlineStyle !== '');

function colouredRun(blockId: string, color: string) {
  return styledElements(blockId).find(el => el.style.color === color);
}

function paragraph(doc: Store, noteId: string, color: string) {
  return doc.addBlock(
    'affine:paragraph',
    { text: new Text([{ insert: RUN, attributes: { color } as never }]) },
    noteId
  );
}

describe.each(['page', 'edgeless'] as const)('in the %s view', mode => {
  let noteId!: string;

  beforeEach(async () => {
    const cleanup = await setupEditor(mode);
    noteId = addNote(window.doc);
    return cleanup;
  });

  test('a colour declares nothing but a colour', async () => {
    const id = paragraph(window.doc, noteId, SECOND_DECLARATION);
    await wait();

    expect(addedDeclarations(id)).toEqual([]);
    expect(colouredRun(id, 'red')).toBeUndefined();
  });

  test('a reader is held to the same', async () => {
    const id = paragraph(window.doc, noteId, SECOND_DECLARATION);
    window.doc.readonly = true;
    await wait();

    expect(addedDeclarations(id)).toEqual([]);
    window.doc.readonly = false;
  });

  test.each([
    'var(--affine-text-highlight-foreground-red)',
    'rgb(10, 20, 30)',
    'oklch(0.7 0.1 200)',
    'transparent',
  ])('%s reaches the browser as stored', async color => {
    const id = paragraph(window.doc, noteId, color);
    await wait();

    expect(colouredRun(id, color)).toBeDefined();
  });

  test('a refused value falls back, it keeps no earlier one', async () => {
    const id = paragraph(window.doc, noteId, 'rgb(10, 20, 30)');
    await wait();
    expect(colouredRun(id, 'rgb(10, 20, 30)')).toBeDefined();

    const model = window.doc.getModelById(id)!;
    (model.props as { text: Text }).text.format(0, RUN.length, {
      color: SECOND_DECLARATION,
    } as never);
    await wait();

    expect(addedDeclarations(id)).toEqual([]);
    expect(colouredRun(id, 'rgb(10, 20, 30)')).toBeUndefined();
  });
});

describe('in the canvas', () => {
  beforeEach(() => setupEditor('edgeless'));

  test('a frame background declares nothing else', async () => {
    const doc = window.doc;
    const surface = doc.getModelsByFlavour('affine:surface')[0];
    const id = doc.addBlock(
      'affine:frame',
      { title: new Text('frame'), background: SECOND_DECLARATION },
      surface
    );
    await wait();

    const block = document.querySelector<HTMLElement>(
      `[data-block-id="${id}"]`
    );
    const styled = [block!, ...styledElements(id)];
    expect(styled.filter(el => el.style.outlineStyle !== '')).toEqual([]);
  });

  test("another client's cursor colour declares nothing else", async () => {
    const doc = window.doc;
    const { awareness } = doc.awarenessStore;
    const peer = awareness.clientID + 1;
    awareness.states.set(peer, {
      color: SECOND_DECLARATION,
      user: { name: 'peer' },
      selectionV2: { [doc.id]: [{ type: 'cursor', x: 100, y: 100 }] },
    });
    awareness.meta.set(peer, { clock: 1, lastUpdated: Date.now() });
    awareness.emit('change', [
      { added: [peer], updated: [], removed: [] },
      'remote',
    ]);
    await wait();

    const widget = document.querySelector(
      'affine-edgeless-remote-selection-widget'
    );
    const root = widget?.shadowRoot ?? widget;
    const cursor = root?.querySelector<SVGElement>('.remote-cursor svg');
    awareness.states.delete(peer);
    expect(cursor).toBeTruthy();
    expect(cursor!.style.outlineStyle).toBe('');
  });
});

describe('the directive', () => {
  const sample = (info: Record<string, string | number | null | undefined>) => {
    const host = document.createElement('div');
    const draw = (next: typeof info) =>
      render(html`<i style=${styleMap(next)}></i>`, host);
    draw(info);
    return { el: host.firstElementChild as HTMLElement, draw };
  };

  test('reads names the way Lit does', () => {
    const { el } = sample({
      backgroundColor: 'red',
      'border-top-width': '2px',
      '--my-size': '3px',
      webkitBoxOrient: 'vertical',
      opacity: OPACITY,
      color: 'blue !important',
      width: null,
    });
    expect(el.style.backgroundColor).toBe('red');
    expect(el.style.borderTopWidth).toBe('2px');
    expect(el.style.getPropertyValue('--my-size')).toBe('3px');
    expect(el.style.getPropertyValue('-webkit-box-orient')).toBe('vertical');
    expect(el.style.opacity).toBe(String(OPACITY));
    expect(el.style.color).toBe('blue');
    expect(el.style.getPropertyPriority('color')).toBe('important');
    expect(el.style.width).toBe('');
  });

  test('drops a property that left the map', () => {
    const { el, draw } = sample({ color: 'red', width: '2px' });
    draw({ color: 'blue' });
    expect(el.style.color).toBe('blue');
    expect(el.style.width).toBe('');
  });

  test('refuses a static neighbour in the attribute', () => {
    const host = document.createElement('div');
    expect(() =>
      render(html`<i style="top: 0; ${styleMap({ color: 'red' })}"></i>`, host)
    ).toThrow();
  });
});
