/**
 * A video shown as an embed keeps its own proportions (issue #738, upstream
 * toeverything/AFFiNE#15904, commit a28cad2).
 *
 * Three facts, each failing before the fix:
 *
 * - the `<video>` is painted with `object-fit: cover`, so whatever box it gets,
 *   the part of the picture outside the box's ratio is cut (embed.ts, video
 *   `render`);
 * - "Turn into embed view" writes the fixed video card size (752 × 544) whatever
 *   the video's own size, so a portrait clip gets a landscape box (embed.ts,
 *   video `action`);
 * - on a canvas the box painted for a card is always the CARD's ratio, scaled
 *   uniformly and centred in the element's bound (attachment-edgeless-block.ts,
 *   ADR 0044 amendment of 2026-11-04). That is why the issue's "uniform scale
 *   already handled" is only half true: a bound written at the video's own
 *   ratio would still be painted as a 752 × 544 box letterboxed in it, so a
 *   port of upstream's embed.ts alone does not fix the canvas.
 *
 * And the guards around the fix, on a real store. « Embed view » measures the
 * clip first (up to 3 s), then writes once; a « Replace » writes at once and
 * never measures. What would have been caught (the reviews of the first port):
 *
 * - a « Replace » by a video losing its frame, or taking two undo steps: its
 *   transaction closed before a late write;
 * - a late write landing after something moved during the read: a replace
 *   (another file), the user's or a peer's resize, the view switched, a
 *   read-only store, a deleted block; it once stamped `embed: true` on the
 *   file an undo had restored;
 * - a conversion taking more than one undo step, or two writes for a double
 *   click;
 * - a stored 752 × 544 video embed painted differently (it letterboxes,
 *   nothing is rewritten on load); a clip that cannot be read keeping
 *   anything but the card's height; an object URL not released.
 */
import {
  AttachmentBlockSchemaExtension,
  type AttachmentBlockModel,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import {
  EMBED_CARD_HEIGHT,
  EMBED_CARD_WIDTH,
} from '@labre/affine-shared/consts';
import { FileSizeLimitProvider } from '@labre/affine-shared/services';
import { readVideoSize } from '@labre/affine-shared/utils';
import { Bound } from '@labre/global/gfx';
import type { Store } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { html, render, type TemplateResult } from 'lit';
import { afterEach, describe, expect, test, vi } from 'vitest';

import { AttachmentEdgelessBlockComponent } from '../attachment-edgeless-block.js';
import {
  type AttachmentEmbedConfig,
  AttachmentEmbedConfigExtension,
  AttachmentEmbedConfigMapIdentifier,
  AttachmentEmbedProvider,
  AttachmentEmbedService,
} from '../embed';
import { replaceAttachmentFile } from '../replace-commands';

/** A portrait clip, as a phone records it (Full HD, upright). */
const CLIP_WIDTH = 1080;
const CLIP_HEIGHT = 1920;
const PORTRAIT = { width: CLIP_WIDTH, height: CLIP_HEIGHT };
/** The bound a portrait video embed would get at half the card's width. */
const PORTRAIT_BOUND = Bound.deserialize('[0,0,376,668]');
/** Any non-empty payload: the size is read from the stubbed metadata. */
const CLIP_BYTES = 16;
/** Two decimals: the ratios compared are of the order of 1. */
const RATIO_DIGITS = 2;
/** Well under the spec timeout: the real wait is 3 s. */
const SHORT_TIMEOUT_MS = 20;
/** A card's box before the gesture. */
const CARD_XYWH = '[0,0,376,211.5]';
/** The card box the gesture writes at once. */
const VIDEO_CARD_XYWH = `[0,0,${EMBED_CARD_WIDTH.video},${EMBED_CARD_HEIGHT.video}]`;
/** A frame a replace keeps (ADR 0044, amendment of 2026-11-04). */
const FRAME_XYWH = '[40,40,400,300]';
/** Well above any test file. */
const MAX_FILE_SIZE = 1_000_000;

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function embedConfigs() {
  const configs: AttachmentEmbedConfig[] = [];
  AttachmentEmbedConfigExtension().setup({
    addImpl: (_id: unknown, factory: () => AttachmentEmbedConfig) => {
      configs.push(factory());
    },
  } as never);
  return configs;
}

function videoConfig() {
  const video = embedConfigs().find(config => config.name === 'video');
  if (!video) throw new Error('no video embed config');
  return video;
}

/** What the video `render` reads of a model. */
function renderedModel() {
  return {
    props: { sourceId$: signal('clip'), type$: signal('video/mp4') },
  };
}

/** A real document holding one attachment, its blob in the store. */
async function storedAttachment(props: Record<string, unknown> = {}) {
  const workspace = new TestWorkspace({
    id: 'video-embed-ratio',
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
  const blob = new Blob([new Uint8Array(CLIP_BYTES)], { type: 'video/mp4' });
  const sourceId = await store.blobSync.set(blob);
  let id = '';
  store.load(() => {
    const root = store.addBlock('affine:page', {});
    const note = store.addBlock('affine:note', {}, root);
    id = store.addBlock(
      'affine:attachment',
      {
        name: 'clip.mp4',
        type: 'video/mp4',
        size: blob.size,
        sourceId,
        style: 'horizontalThin',
        xywh: CARD_XYWH,
        ...props,
      },
      note
    );
  });
  // The gesture starts its own undo step, as every toolbar action does.
  store.captureSync();
  const model = store.getModelById(id) as AttachmentBlockModel;
  return {
    store,
    model,
    sourceId,
    steps: () => store.history.undoManager.undoStack.length,
  };
}

/** The Yjs updates the document emits from now on. */
function recordUpdates(store: Store) {
  const updates: Uint8Array[] = [];
  store.spaceDoc.on('update', (update: Uint8Array) => updates.push(update));
  return updates;
}

/**
 * Every `<video>` the code creates reports `size` once a source is set, as a
 * browser does on `loadedmetadata`, and only once `gate` resolves; with
 * `'error'`, it fails as a browser does on a clip it cannot decode; with
 * `null`, it never answers. Answers the number of videos created.
 */
function videosReport(
  size: { width: number; height: number },
  answer: 'loadedmetadata' | 'error' | null = 'loadedmetadata',
  gate: Promise<void> = Promise.resolve()
) {
  const created: HTMLVideoElement[] = [];
  const create = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((
    tag: string,
    options?: ElementCreationOptions
  ) => {
    const element = create(tag, options);
    if (tag !== 'video') return element;
    const video = element as HTMLVideoElement;
    created.push(video);
    Object.defineProperties(video, {
      videoWidth: { value: size.width },
      videoHeight: { value: size.height },
      src: {
        set(url: string) {
          video.setAttribute('src', url);
          if (!answer) return;
          void (async () => {
            await gate;
            video.dispatchEvent(new Event(answer));
            if (answer === 'error') video.onerror?.(new Event(answer));
            else video.onloadedmetadata?.(new Event(answer));
          })();
        },
        get: () => video.getAttribute('src') ?? '',
      },
    });
    return video;
  }) as typeof document.createElement);
  return created;
}

/** A gate the test opens when it has done what happens meanwhile. */
function metadataGate() {
  let open = () => {};
  const gate = new Promise<void>(resolve => {
    open = resolve;
  });
  return { gate, open };
}

function convert(model: AttachmentBlockModel) {
  return videoConfig().action?.(model, {} as never);
}

function ratioOf(xywh: string) {
  const [, , w, h] = JSON.parse(xywh) as number[];
  return h / w;
}

function styleOf(template: TemplateResult) {
  const host = document.createElement('div');
  document.body.append(host);
  render(template, host);
  return host.firstElementChild as HTMLElement;
}

describe('a video embed keeps its proportions (#738)', () => {
  test('the video is contained in its box, never cropped', () => {
    const view = videoConfig().render?.(renderedModel() as never, 'blob:clip');
    if (!view) throw new Error('no video view');

    const video = styleOf(view);

    expect(video.style.getPropertyValue('object-fit')).toBe('contain');
  });

  test('turning a portrait video into an embed gives it a portrait box, in one undo step', async () => {
    const { gate, open } = metadataGate();
    videosReport(PORTRAIT, 'loadedmetadata', gate);
    const { store, model, steps } = await storedAttachment();
    const before = steps();

    const updates = recordUpdates(store);

    const pending = convert(model);
    open();
    await pending;

    expect(updates).toHaveLength(1);
    expect(model.props.embed).toBe(true);
    expect(ratioOf(model.props.xywh)).toBeCloseTo(
      PORTRAIT.height / PORTRAIT.width,
      RATIO_DIGITS
    );
    expect(steps()).toBe(before + 1);
    store.undo();
    expect([model.props.embed, model.props.xywh]).toEqual([false, CARD_XYWH]);
  });

  test('on a canvas, the box painted for a video embed has its bound ratio', () => {
    const block = {
      model: {
        props: {
          name: 'clip.mp4',
          type: 'video/mp4',
          style$: { value: 'video' },
          embed$: { value: true },
        },
        elementBound: PORTRAIT_BOUND,
      },
      containerStyleMap: null as unknown,
      renderPageContent: () => null,
      // Its blob is loaded: the embed view, not the card, is drawn.
      embedded: () => true,
    };

    AttachmentEdgelessBlockComponent.prototype.renderGfxBlock.call(
      block as never
    );
    const box = styleOf(html`<div style=${block.containerStyleMap}></div>`);

    const ratio = parseFloat(box.style.height) / parseFloat(box.style.width);
    expect(ratio).toBeCloseTo(
      PORTRAIT_BOUND.h / PORTRAIT_BOUND.w,
      RATIO_DIGITS
    );
  });

  test('a stored video embed keeps its 752 × 544 box (nothing rewritten on load)', () => {
    const block = {
      model: {
        props: {
          name: 'clip.mp4',
          type: 'video/mp4',
          style$: { value: 'video' },
          embed$: { value: true },
        },
        elementBound: Bound.deserialize(VIDEO_CARD_XYWH),
      },
      containerStyleMap: null as unknown,
      renderPageContent: () => null,
      // Its blob is loaded: the embed view, not the card, is drawn.
      embedded: () => true,
    };

    AttachmentEdgelessBlockComponent.prototype.renderGfxBlock.call(
      block as never
    );
    const box = styleOf(html`<div style=${block.containerStyleMap}></div>`);

    expect(box.style.width).toBe(`${EMBED_CARD_WIDTH.video}px`);
    expect(box.style.height).toBe(`${EMBED_CARD_HEIGHT.video}px`);
    expect(box.style.transform).toBe('scale(1)');
  });
});

describe('turning a video into an embed when its size is unknown (#738)', () => {
  test('a clip the browser cannot decode keeps the card height', async () => {
    videosReport(PORTRAIT, 'error');
    const { model, steps } = await storedAttachment();
    const before = steps();

    await convert(model);

    expect(model.props.xywh).toBe(VIDEO_CARD_XYWH);
    expect(steps()).toBe(before + 1);
  });

  test('a clip that never answers resolves to null and releases its URL', async () => {
    videosReport(PORTRAIT, null);
    const revoke = vi.spyOn(URL, 'revokeObjectURL');
    const blob = new Blob([new Uint8Array(CLIP_BYTES)], { type: 'video/mp4' });

    const size = await readVideoSize(blob, SHORT_TIMEOUT_MS);

    expect(size).toBeNull();
    expect(revoke).toHaveBeenCalledTimes(1);
  });
});

describe('« Embed view » measures first, then writes once, if nothing moved (#738)', () => {
  test('nothing is written before the clip is read', async () => {
    const { gate, open } = metadataGate();
    videosReport(PORTRAIT, 'loadedmetadata', gate);
    const { store, model } = await storedAttachment();
    const updates = recordUpdates(store);

    const pending = convert(model);
    await Promise.resolve();

    expect(updates).toEqual([]);
    expect([model.props.embed, model.props.xywh]).toEqual([false, CARD_XYWH]);
    open();
    await pending;
  });

  test.each([
    {
      name: 'a replace (another file)',
      meanwhile: (store: Store, model: AttachmentBlockModel) =>
        store.updateBlock(model, { sourceId: 'another-file' }),
      after: { embed: false, xywh: CARD_XYWH },
    },
    {
      name: "the user's resize",
      meanwhile: (store: Store, model: AttachmentBlockModel) =>
        store.updateBlock(model, { xywh: FRAME_XYWH }),
      after: { embed: false, xywh: FRAME_XYWH },
    },
    {
      name: "a peer's resize",
      meanwhile: (store: Store, model: AttachmentBlockModel) =>
        // Untracked, as a change synced from another client.
        store.withoutTransact(() =>
          store.updateBlock(model, { xywh: FRAME_XYWH })
        ),
      after: { embed: false, xywh: FRAME_XYWH },
    },
    {
      name: 'the view switched',
      meanwhile: (store: Store, model: AttachmentBlockModel) =>
        store.updateBlock(model, { embed: true }),
      after: { embed: true, xywh: CARD_XYWH },
    },
  ])(
    'after $name before the clip is read, nothing is written',
    async ({ meanwhile, after }) => {
      const { gate, open } = metadataGate();
      videosReport(PORTRAIT, 'loadedmetadata', gate);
      const { store, model } = await storedAttachment();
      const pending = convert(model);
      meanwhile(store, model);
      const updates = recordUpdates(store);

      open();
      await pending;

      expect(updates).toEqual([]);
      expect({ embed: model.props.embed, xywh: model.props.xywh }).toEqual(
        after
      );
    }
  );

  test('a double click reads the clip once and writes once', async () => {
    const { gate, open } = metadataGate();
    const videos = videosReport(PORTRAIT, 'loadedmetadata', gate);
    const { store, model, steps } = await storedAttachment();
    const before = steps();
    const updates = recordUpdates(store);

    const first = convert(model);
    const second = convert(model);
    open();
    await Promise.all([first, second]);

    expect(updates).toHaveLength(1);
    expect(videos).toHaveLength(1);
    expect(steps()).toBe(before + 1);
  });

  test('a store turned read-only meanwhile is not written', async () => {
    const { gate, open } = metadataGate();
    videosReport(PORTRAIT, 'loadedmetadata', gate);
    const { store, model } = await storedAttachment();
    const pending = convert(model);
    store.readonly = true;
    const updates = recordUpdates(store);

    open();
    await pending;

    expect(updates).toEqual([]);
  });

  test('a document closed meanwhile is not written, and nothing throws (ADR 0057)', async () => {
    const { gate, open } = metadataGate();
    videosReport(PORTRAIT, 'loadedmetadata', gate);
    const { store, model } = await storedAttachment();
    const pending = convert(model);
    store.dispose();
    const updates = recordUpdates(store);

    open();
    await expect(pending).resolves.toBeUndefined();

    expect(updates).toEqual([]);
  });

  test('a block deleted meanwhile is not written', async () => {
    const { gate, open } = metadataGate();
    videosReport(PORTRAIT, 'loadedmetadata', gate);
    const { store, model } = await storedAttachment();
    const pending = convert(model);
    store.deleteBlock(model);
    const updates = recordUpdates(store);

    open();
    await pending;

    expect(updates).toEqual([]);
  });
});

describe('« Replace » by a video keeps its frame (#738, ADR 0044)', () => {
  test('the frame stays, in one undo step, and the clip is never read', async () => {
    const { gate, open } = metadataGate();
    const videos = videosReport(PORTRAIT, 'loadedmetadata', gate);
    const { store, model, sourceId, steps } = await storedAttachment({
      name: 'old.pdf',
      type: 'application/pdf',
      style: 'pdf',
      embed: true,
      xywh: FRAME_XYWH,
    });
    const services = new Map<unknown, unknown>([
      [FileSizeLimitProvider, { maxFileSize: MAX_FILE_SIZE }],
      [
        AttachmentEmbedConfigMapIdentifier,
        new Map(embedConfigs().map(config => [config.name, config])),
      ],
    ]);
    const std = {
      store,
      get: (id: unknown) => services.get(id),
      getOptional: () => null,
    };
    // `replaceAttachmentFile` reads the service by its identifier.
    services.set(
      AttachmentEmbedProvider,
      new AttachmentEmbedService(std as never)
    );
    const before = steps();

    replaceAttachmentFile(std as never, model, {
      name: 'clip.mp4',
      size: CLIP_BYTES,
      type: 'video/mp4',
      sourceId,
    });
    const updates = recordUpdates(store);
    open();
    await new Promise(resolve => setTimeout(resolve, SHORT_TIMEOUT_MS));

    expect({
      embed: model.props.embed,
      type: model.props.type,
      xywh: model.props.xywh,
    }).toEqual({ embed: true, type: 'video/mp4', xywh: FRAME_XYWH });
    expect(steps()).toBe(before + 1);
    expect(updates).toEqual([]);
    expect(videos).toEqual([]);
  });
});
