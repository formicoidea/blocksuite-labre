/**
 * The page note on the canvas shows the document title by default.
 *
 * Until 0.59 `edgeless-page-block-title` drew only what a host's
 * `NoteConfigExtension.pageBlockTitle` returned, and neither the library nor
 * the playground registers one: the canvas showed no title at all, although
 * the note was already wired for a `<doc-title>` (ArrowUp focuses it,
 * `EdgelessNoteInteraction` routes a click on it to the title, the title band
 * is not drawn twice). This spec mounts the element on a real store and pins:
 *
 * - no config, or a config without `pageBlockTitle`: a `<doc-title>` bound to
 *   the note's store, showing the stored title, following an edit of it, and
 *   read-only on a read-only store;
 * - a host `pageBlockTitle` replaces it, `nothing` included (the opt-out);
 * - a note that is not the page note draws no title at all.
 *
 * Whether the title takes a pointer is the note's business, not this
 * element's: the note mask covers the whole note until it is being edited
 * (`edgeless-note-mask.ts`), and `edgeless-note-selection.unit.spec.ts` pins
 * where a click on the title lands once it is.
 */
import { DocTitle } from '@labre/affine-fragment-doc-title';
import {
  NoteBlockModel,
  NoteBlockSchemaExtension,
  NoteDisplayMode,
  RootBlockSchemaExtension,
  type RootBlockModel,
} from '@labre/affine-model';
import { RichText } from '@labre/affine-rich-text';
import type { BlockStdScope } from '@labre/std';
import { effects as stdEffects } from '@labre/std/effects';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { html, nothing } from 'lit';
import { afterEach, beforeAll, describe, expect, test } from 'vitest';

import { EdgelessPageBlockTitle } from '../components/edgeless-page-block-title.js';
import { type NoteConfig, NoteConfigExtension } from '../config.js';

beforeAll(() => {
  stdEffects();
  const define = (name: string, ctor: CustomElementConstructor) => {
    if (!customElements.get(name)) customElements.define(name, ctor);
  };
  define('edgeless-page-block-title', EdgelessPageBlockTitle);
  define('doc-title', DocTitle);
  define('rich-text', RichText);
});

let seq = 0;

function createDoc(title: string) {
  const collection = new TestWorkspace({ id: `note-title-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
  ];
  collection.meta.initialize();
  const store = collection.createDoc().getStore();
  let pageNoteId = '';
  let canvasNoteId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text(title) });
    pageNoteId = store.addBlock('affine:note', {}, rootId);
    canvasNoteId = store.addBlock(
      'affine:note',
      { displayMode: NoteDisplayMode.EdgelessOnly },
      rootId
    );
  });
  const note = (id: string) => store.getModelById(id) as NoteBlockModel;
  return { store, pageNote: note(pageNoteId), canvasNote: note(canvasNoteId) };
}

const mounted: HTMLElement[] = [];

async function mount(note: NoteBlockModel, config?: Partial<NoteConfig>) {
  const std = {
    store: note.store,
    getOptional: (id: unknown) =>
      id === NoteConfigExtension.identifier ? (config ?? null) : null,
  } as unknown as BlockStdScope;
  const element = document.createElement('edgeless-page-block-title');
  element.std = std;
  element.note = note;
  document.body.append(element);
  mounted.push(element);
  await element.updateComplete;
  await settle(element);
  return element;
}

/**
 * `<rich-text>` mounts its inline editor once its own first update is done,
 * and that editor renders the text on its next one.
 */
async function settle(element: HTMLElement) {
  await element.querySelector<DocTitle>('doc-title')?.updateComplete;
  const richText = element.querySelector<RichText>('rich-text');
  if (!richText) return;
  await richText.updateComplete;
  await new Promise(resolve => setTimeout(resolve, 0));
  await richText.updateComplete;
}

const titleText = (element: HTMLElement) =>
  element.querySelector('[data-block-is-title] rich-text')?.textContent ?? '';

afterEach(() => {
  for (const element of mounted.splice(0)) element.remove();
});

describe('the title at the head of the page note', () => {
  test('is the document title when the host configures none', async () => {
    const { store, pageNote } = createDoc('Target architecture');
    for (const config of [undefined, { edgelessNoteHeader: () => html`` }]) {
      const element = await mount(pageNote, config);
      const docTitle = element.querySelector<DocTitle>('doc-title');
      expect(docTitle).not.toBeNull();
      expect(docTitle!.doc).toBe(store);
      expect(titleText(element)).toContain('Target architecture');
    }
  });

  test('follows an edit of the stored title', async () => {
    const { store, pageNote } = createDoc('Draft');
    const element = await mount(pageNote);
    (store.root as RootBlockModel).props.title.insert(' 2', 5);
    await settle(element);
    expect(titleText(element)).toContain('Draft 2');
  });

  test('is read-only on a read-only store', async () => {
    const { store, pageNote } = createDoc('Frozen');
    store.readonly = true;
    const element = await mount(pageNote);
    expect(element.querySelector<RichText>('rich-text')?.readonly).toBe(true);
  });

  test("gives way to the host's pageBlockTitle, nothing included", async () => {
    const { pageNote } = createDoc('Target architecture');

    const hosted = await mount(pageNote, {
      pageBlockTitle: () => html`<h1 class="host-title">Host</h1>`,
    });
    expect(hosted.querySelector<DocTitle>('doc-title')).toBeNull();
    expect(hosted.querySelector('.host-title')?.textContent).toBe('Host');

    const optedOut = await mount(pageNote, { pageBlockTitle: () => nothing });
    expect(optedOut.querySelector<DocTitle>('doc-title')).toBeNull();
    expect(optedOut.textContent?.trim()).toBe('');
  });

  test('is not drawn on a note that is not the page note', async () => {
    const { canvasNote } = createDoc('Target architecture');
    expect(canvasNote).toBeInstanceOf(NoteBlockModel);
    const element = await mount(canvasNote);
    expect(element.querySelector<DocTitle>('doc-title')).toBeNull();
  });
});
