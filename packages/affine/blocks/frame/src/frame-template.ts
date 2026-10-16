import { getSurfaceBlock } from '@labre/affine-block-surface';
import { toast } from '@labre/affine-components/toast';
import {
  ConnectorElementModel,
  type FrameBlockModel,
} from '@labre/affine-model';
import {
  type ChromeWording,
  type FrameTemplateFrameRef,
  FrameTemplateProvider,
  type FrameTemplateService,
  NotificationProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { type BlockStdScope, LifeCycleWatcher } from '@labre/std';
import { GfxBlockElementModel } from '@labre/std/gfx';
import type {
  BlockSnapshot,
  DocSnapshot,
  Store,
  TransformerMiddleware,
} from '@labre/store';

import {
  FRAME_TOAST_TEMPLATE_SAVE_FAILED,
  FRAME_TOAST_TEMPLATE_SAVED,
  FRAME_TOAST_TEMPLATE_VIEW,
} from './translations.js';

type ElementJSON = Record<string, unknown>;

/**
 * Narrow a transformer to one frame's members: the surface keeps only the
 * elements and child blocks in `ids` — the surface transformer's own
 * `selectedElements` filter, the same one the drag handle uses
 * (`widgets/drag-handle/src/middleware/blocks-filter.ts`).
 */
function onlyMembers(ids: Set<string>): TransformerMiddleware {
  return ({ slots, transformerConfigs }) => {
    const subscription = slots.beforeExport.subscribe(payload => {
      if (payload.type !== 'block') return;
      if (payload.model.flavour !== 'affine:surface') return;
      transformerConfigs.set('selectedElements', ids);
      payload.model.children = payload.model.children.filter(child =>
        ids.has(child.id)
      );
    });
    return () => subscription.unsubscribe();
  };
}

/**
 * A layer id names a record of the SOURCE surface only. Dropped, so the
 * template lands in the inserting viewer's active layer wherever it goes
 * (ADR 0031 §6) — kept, it would land in its old layer when inserted back
 * into its own document, possibly a hidden one.
 */
function dropLayer(props: Record<string, unknown>) {
  delete props['layer'];
}

/**
 * Serialize `frame` and everything it holds as a template snapshot, through
 * the surface TRANSFORMER: every key of every element's Y.Map crosses as is
 * (`SurfaceBlockTransformer._elementToJSON`), texts in their snapshot form,
 * where `element.serialize()` would flatten them to strings. What is changed:
 *
 * - `layer` is dropped everywhere (see {@link dropLayer});
 * - a member connector whose end is not a member gets that end as a free
 *   position, as a copy-paste does (`serializeConnector`), since the template
 *   job could not remap the id;
 * - the frame's `childElementIds` keep only the members that exist.
 *
 * Read only: nothing is written to the store. `null` when the document has no
 * surface or no root.
 */
export function frameTemplateSnapshot(
  store: Store,
  frame: FrameBlockModel
): DocSnapshot | null {
  const surface = getSurfaceBlock(store);
  const root = store.root;
  if (!surface || !root) return null;

  const members = [frame, ...frame.descendantElements];
  const ids = new Set(members.map(member => member.id));
  const job = store.getTransformer([onlyMembers(ids)]);

  const surfaceSnapshot = job.blockToSnapshot(surface);
  if (!surfaceSnapshot) return null;

  const elements = surfaceSnapshot.props['elements'] as Record<
    string,
    ElementJSON
  >;
  for (const member of members) {
    if (!(member instanceof ConnectorElementModel)) continue;
    const json = elements[member.id];
    if (!json) continue;
    const path = member.absolutePath;
    const sourceId = member.source?.id;
    if (sourceId && !ids.has(sourceId) && path.length) {
      json['source'] = { position: path[0]!.slice(0, 2) };
    }
    const targetId = member.target?.id;
    if (targetId && !ids.has(targetId) && path.length) {
      json['target'] = { position: path[path.length - 1]!.slice(0, 2) };
    }
  }
  Object.values(elements).forEach(dropLayer);

  // A note sits under the page, not the surface: serialized on its own.
  const pageMembers = members
    .filter(
      member =>
        member instanceof GfxBlockElementModel &&
        store.getParent(member.id)?.id === root.id
    )
    .map(member => job.blockToSnapshot(member as GfxBlockElementModel))
    .filter((snapshot): snapshot is BlockSnapshot => !!snapshot);

  for (const block of [...surfaceSnapshot.children, ...pageMembers]) {
    dropLayer(block.props);
    if (block.id === frame.id) {
      const childIds = (block.props['childElementIds'] ?? {}) as Record<
        string,
        boolean
      >;
      block.props['childElementIds'] = Object.fromEntries(
        Object.entries(childIds).filter(([id]) => ids.has(id))
      );
    }
  }

  const title = frame.props.title.toString();
  return {
    type: 'page',
    meta: { id: store.id, title, createDate: Date.now(), tags: [] },
    blocks: {
      type: 'block',
      id: root.id,
      flavour: 'affine:page',
      props: {
        title: {
          '$blocksuite:internal:text$': true,
          delta: title ? [{ insert: title }] : [],
        },
      },
      children: [surfaceSnapshot, ...pageMembers],
    },
  };
}

type BlockUpdate = {
  type: 'add' | 'delete' | 'update';
  id: string;
  flavour: string;
  isLocal: boolean;
};

/**
 * The frame deletion cascade towards the host, pure so a test drives it with
 * any payload: `frameDeleted` for a frame THIS viewer deleted on a writable
 * document, `frameRestored` when the same viewer brings it back (an undo
 * re-adds the block under its own id).
 *
 * `if (!local || readonly) return;` — a deletion that arrives from another
 * peer was reported by that peer, and reporting it again here would make the
 * host act once per connected viewer.
 */
export class FrameDeletionCascade {
  private readonly _deleted = new Set<string>();

  constructor(
    private readonly _store: Pick<Store, 'id' | 'readonly'>,
    private readonly _service: FrameTemplateService
  ) {}

  handle(payload: BlockUpdate) {
    if (payload.flavour !== 'affine:frame') return;
    if (!payload.isLocal || this._store.readonly) return;

    const ref: FrameTemplateFrameRef = {
      docId: this._store.id,
      frameId: payload.id,
    };
    if (payload.type === 'delete') {
      this._deleted.add(payload.id);
      this._service.frameDeleted?.(ref);
      return;
    }
    if (payload.type === 'add' && this._deleted.delete(payload.id)) {
      this._service.frameRestored?.(ref);
    }
  }
}

/** Mounts {@link FrameDeletionCascade} on the editor's store, if a host keeps templates. */
export class FrameTemplateWatcher extends LifeCycleWatcher {
  static override readonly key = 'frame-template-watcher';

  private _subscription?: { unsubscribe: () => void };

  override mounted() {
    const service = this.std.getOptional(FrameTemplateProvider);
    if (!service) return;

    const cascade = new FrameDeletionCascade(this.std.store, service);
    this._subscription = this.std.store.slots.blockUpdated.subscribe(payload =>
      cascade.handle(payload)
    );
  }

  override unmounted() {
    this._subscription?.unsubscribe();
    this._subscription = undefined;
  }
}

/** Frames whose save is in flight, per document: a double click saves once. */
const saving = new Set<string>();

interface NoticeAction {
  key: string;
  label: string;
  onClick: () => void;
}

function tell(
  std: BlockStdScope,
  wording: ChromeWording,
  success: boolean,
  action?: NoticeAction
) {
  const text = translateKey(std, ...wording);
  const notification = std.getOptional(NotificationProvider);
  if (notification) {
    notification.notify({
      title: text,
      accent: success ? 'success' : 'error',
      ...(action ? { actions: [action] } : {}),
    });
    return;
  }
  // The plain toast has no button: without a notification service the
  // action is dropped, and the template is still where the host keeps it.
  toast(std.host, text);
}

/**
 * The success notification's « View », when the host can show its templates
 * (labre P7): it calls `showTemplates` and nothing else. Absent, the
 * notification has no action, as before 0.54.
 */
export function templateViewAction(
  std: BlockStdScope,
  service: FrameTemplateService
): NoticeAction | undefined {
  if (!service.showTemplates) return undefined;
  return {
    key: 'frame-template-view',
    label: translateKey(std, ...FRAME_TOAST_TEMPLATE_VIEW),
    onClick: () => service.showTemplates?.(),
  };
}

/**
 * "Save as template": serialize the frame and hand it to the host. Reads the
 * document and writes nothing to it, so a read-only viewer may save too: the
 * host decides where the template goes and whether this viewer may write it.
 * The viewer always learns the outcome, a rejection included.
 */
export async function saveFrameAsTemplate(
  std: BlockStdScope,
  frame: FrameBlockModel
): Promise<void> {
  const service = std.getOptional(FrameTemplateProvider);
  if (!service) return;

  const key = `${std.store.id}:${frame.id}`;
  if (saving.has(key)) return;

  const snapshot = frameTemplateSnapshot(std.store, frame);
  if (!snapshot) {
    tell(std, FRAME_TOAST_TEMPLATE_SAVE_FAILED, false);
    return;
  }

  saving.add(key);
  try {
    await service.save({
      docId: std.store.id,
      frameId: frame.id,
      title: snapshot.meta.title,
      snapshot,
    });
    tell(
      std,
      FRAME_TOAST_TEMPLATE_SAVED,
      true,
      templateViewAction(std, service)
    );
  } catch (error) {
    console.error(error);
    tell(std, FRAME_TOAST_TEMPLATE_SAVE_FAILED, false);
  } finally {
    saving.delete(key);
  }
}
