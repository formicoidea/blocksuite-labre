/**
 * An attachment gesture that resumes after an `await` leaves a closed
 * document alone (#746, ADR 0057).
 *
 * A released store throws on every write. Two attachment gestures wait
 * before they write: « Turn into image » measures the image
 * (`turnIntoImageBlock`, after `getAttachmentBlob` and `readImageSize`), and
 * « Replace » waits for the file dialog (`AttachmentBlockComponent.replace`).
 * A host that closed the document meanwhile (`store.dispose()`) made the
 * write throw, an unhandled rejection, and nothing could ask: `readonly`,
 * `hasBlock` and `getBlock` answer "writable and present" on a released
 * store. They now check `store.disposed` after the await and abandon the
 * gesture. « Embed view » on a video has its own case in
 * `video-embed-ratio.unit.spec.ts`.
 */
import {
  AttachmentBlockSchemaExtension,
  type AttachmentBlockModel,
  ImageBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, describe, expect, test, vi } from 'vitest';

// Mocked below (`vi.mock` is hoisted above these imports).
import { AttachmentBlockComponent } from '../attachment-block.js';
import { AttachmentEmbedConfigExtension } from '../embed.js';

const gates = vi.hoisted(() => ({
  measure: null as null | ((size: { width: number; height: number }) => void),
  dialog: null as null | ((answer: unknown) => void),
}));

vi.mock('@labre/affine-shared/utils', async original => ({
  ...(await original<typeof import('@labre/affine-shared/utils')>()),
  readImageSize: () =>
    new Promise(resolve => {
      gates.measure = resolve;
    }),
}));

vi.mock('@labre/affine-block-image', async original => ({
  ...(await original<typeof import('@labre/affine-block-image')>()),
  pickReplacement: () =>
    new Promise(resolve => {
      gates.dialog = resolve;
    }),
}));

const written = vi.hoisted(() => ({ calls: 0 }));
vi.mock('../replace-commands.js', async original => ({
  ...(await original<typeof import('../replace-commands.js')>()),
  writeAttachmentAnswer: () => {
    written.calls += 1;
    return 'written';
  },
}));

const BYTES = 8;
/** What the stubbed measure answers. */
const MEASURED_WIDTH = 40;
const MEASURED = { width: MEASURED_WIDTH, height: MEASURED_WIDTH / 2 };

afterEach(() => {
  gates.measure = null;
  gates.dialog = null;
  written.calls = 0;
});

async function storedAttachment() {
  const workspace = new TestWorkspace({
    id: 'closed-mid-gesture',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const store = workspace.createDoc('doc').getStore({
    extensions: [
      RootBlockSchemaExtension,
      NoteBlockSchemaExtension,
      AttachmentBlockSchemaExtension,
      ImageBlockSchemaExtension,
    ],
  });
  const sourceId = await store.blobSync.set(
    new Blob([new Uint8Array(BYTES)], { type: 'image/png' })
  );
  let id = '';
  store.load(() => {
    const root = store.addBlock('affine:page', {});
    const note = store.addBlock('affine:note', {}, root);
    id = store.addBlock(
      'affine:attachment',
      { name: 'a.png', type: 'image/png', size: BYTES, sourceId },
      note
    );
  });
  const model = store.getModelById(id) as AttachmentBlockModel;
  return { workspace, store, model };
}

const recordUpdates = (store: Store) => {
  const updates: Uint8Array[] = [];
  store.spaceDoc.on('update', (update: Uint8Array) => updates.push(update));
  return updates;
};

const until = (check: () => boolean) =>
  vi.waitFor(() => expect(check()).toBe(true));

function imageConfig() {
  const configs: { name: string; action?: Function }[] = [];
  AttachmentEmbedConfigExtension().setup({
    addImpl: (_id: unknown, factory: () => (typeof configs)[number]) => {
      configs.push(factory());
    },
  } as never);
  return configs.find(config => config.name === 'image')!;
}

/** The few members of `std` « Turn into image » reads before it waits. */
const stdOf = (model: AttachmentBlockModel) =>
  ({
    view: { getBlock: () => ({ model }) },
    get: () => ({ selection: { has: () => false } }),
    selection: { filter: () => [] },
  }) as never;

describe('a document closed while an attachment gesture waits (ADR 0057)', () => {
  test('« Turn into image »: the store disposed during the measure, nothing written, nothing thrown', async () => {
    const { workspace, store, model } = await storedAttachment();
    try {
      const pending = imageConfig().action!(model, stdOf(model));
      await until(() => gates.measure !== null);
      store.dispose();
      const updates = recordUpdates(store);
      gates.measure!(MEASURED);

      await expect(pending).resolves.toBeUndefined();
      expect(updates).toEqual([]);
      expect(store.getBlock(model.id)?.flavour).toBe('affine:attachment');
    } finally {
      workspace.dispose();
    }
  });

  test('« Replace »: the store disposed during the file dialog, nothing written, nothing thrown', async () => {
    if (!customElements.get('test-attachment-block')) {
      customElements.define('test-attachment-block', AttachmentBlockComponent);
    }
    const { workspace, store, model } = await storedAttachment();
    try {
      const block = new AttachmentBlockComponent();
      block.std = { store, getOptional: () => null } as never;
      Object.defineProperty(block, 'model', { value: model });
      Object.defineProperty(block, 'blockId', { value: model.id });

      const pending = block.replace();
      await until(() => gates.dialog !== null);
      store.dispose();
      gates.dialog!({
        kind: 'file',
        source: {
          sourceId: 'x',
          name: 'b.pdf',
          type: 'application/pdf',
          size: 1,
        },
      });

      await expect(pending).resolves.toBeUndefined();
      expect(written.calls).toBe(0);
    } finally {
      workspace.dispose();
    }
  });
});
