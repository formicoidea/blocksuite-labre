import { type BlockStdScope, LifeCycleWatcher } from '@labre/std';
import {
  compareLayer,
  GfxBlockElementModel,
  GfxControllerIdentifier,
  GfxGroupLikeElementModel,
  type GfxModel,
  GfxPrimitiveElementModel,
  type SurfaceBlockModel,
} from '@labre/std/gfx';
import {
  computed,
  effect,
  type ReadonlySignal,
  signal,
} from '@preact/signals-core';

/**
 * The layer every element belongs to while the user has created none (ADR
 * 0031 §2). The `@` cannot appear in a nanoid, so it can never collide with a
 * real layer id. Until the layers stage ships, it is the only layer there is.
 */
export const DEFAULT_LAYER_ID = '@default';

/**
 * One row of the selection pane, as the HEADLESS API hands it out (ADR 0031
 * §12): ids and states only, never a wording. Whoever draws the row reads the
 * label off the element at render time — its own text, its label sibling, its
 * role's wording — so a rename on the canvas never has to invalidate this
 * tree, and no element text ever crosses the seam in a payload a host might
 * log.
 */
export interface SelectionPaneNode {
  id: string;
  /** `'layer'` is reserved for the layers stage; nothing produces it yet. */
  kind: 'element' | 'block' | 'layer';
  /** The element `type` (`shape`, `group`…) or the block flavour. */
  type: string;
  /** The element's role, when it carries one. Blocks carry none. */
  role?: string;
  /** The group-like ELEMENT (group, mindmap) this row is listed under. */
  groupId?: string;
  /** Always {@link DEFAULT_LAYER_ID} until user layers exist. */
  layerId: string;
  /** Locked by itself — what the row's lock toggle shows and flips. */
  locked: boolean;
  /** Hidden for this viewer only. `false` until the local-hide stage. */
  hiddenLocal: boolean;
  /** Hidden for everyone. `false` until that stage writes the field. */
  hiddenForEveryone: boolean;
  /** Present on a group or a mindmap: its members, top first. */
  children?: SelectionPaneNode[];
}

/**
 * The group-like ELEMENT a model is listed under, or `null` for a top-level
 * row.
 *
 * Frames are deliberately not containers here, although they are
 * group-compatible for z-order: a frame is a slide, and the pane filters BY
 * frame rather than nesting under one — exactly the line ADR 0031 §4 draws for
 * layers. `group` walks the model's surface, which throws on a model that is
 * not attached to one; such a model is simply a top-level row.
 */
export function paneContainerOf(
  model: GfxModel
): GfxGroupLikeElementModel | null {
  const group = rawGroupOf(model);
  return group instanceof GfxGroupLikeElementModel ? group : null;
}

/** `model.group`, or `null` on a model no surface holds (the getter throws). */
function rawGroupOf(model: GfxModel): unknown {
  try {
    return model.group;
  } catch {
    return null;
  }
}

/**
 * The pane's rows, built from the canvas' models: one pass to bucket every
 * model under its container, one sort per sibling list, top first.
 *
 * Pure, so the budget test can time exactly what a live pane pays. The order
 * is the canvas' own comparator (`compareLayer`) reversed — the paint order,
 * never a second opinion of it — with one shortcut that is exact: two models
 * under the same group-like ancestor are ordered by `compareLayer` on their
 * `index` alone (its ancestor walk finds no difference and falls through to
 * `compareIndex`). So that case reads two cached strings instead of walking
 * two ancestor chains per comparison, and only models stacked under different
 * ancestors (a frame's members beside loose elements) pay the full walk.
 */
export function buildSelectionPaneTree(
  models: readonly GfxModel[]
): SelectionPaneNode[] {
  const present = new Set<string>();
  const groupOf = new Map<GfxModel, unknown>();
  const indexOf = new Map<GfxModel, string>();
  for (const model of models) {
    present.add(model.id);
    groupOf.set(model, rawGroupOf(model));
    indexOf.set(model, model.index);
  }

  const paintOrder = (a: GfxModel, b: GfxModel) => {
    if (groupOf.get(a) !== groupOf.get(b)) return compareLayer(a, b);
    const ai = indexOf.get(a)!;
    const bi = indexOf.get(b)!;
    return ai === bi ? 0 : ai < bi ? -1 : 1;
  };

  const buckets = new Map<string | null, GfxModel[]>();
  for (const model of models) {
    const group = groupOf.get(model);
    const container = group instanceof GfxGroupLikeElementModel ? group : null;
    // A container that is not listed (a stale group id) cannot hold a row:
    // the member is listed at the top level rather than vanishing.
    const key = container && present.has(container.id) ? container.id : null;
    let bucket = buckets.get(key);
    if (!bucket) {
      bucket = [];
      buckets.set(key, bucket);
    }
    bucket.push(model);
  }

  const build = (key: string | null): SelectionPaneNode[] => {
    const bucket = buckets.get(key);
    if (!bucket) return [];
    bucket.sort((a, b) => paintOrder(b, a));
    return bucket.map(model => {
      const block = model instanceof GfxBlockElementModel;
      const role =
        model instanceof GfxPrimitiveElementModel ? model.role : undefined;
      const node: SelectionPaneNode = {
        id: model.id,
        kind: block ? 'block' : 'element',
        type: block ? model.flavour : (model as GfxPrimitiveElementModel).type,
        layerId: DEFAULT_LAYER_ID,
        locked: model.lockedBySelf === true,
        hiddenLocal: false,
        hiddenForEveryone: false,
      };
      if (role !== undefined) node.role = role;
      if (key !== null) node.groupId = key;
      if (model instanceof GfxGroupLikeElementModel) {
        node.children = build(model.id);
      }
      return node;
    });
  };

  return build(null);
}

/**
 * The element props whose change can move, nest, lock or re-role a row. A
 * drag writes `xywh` every frame and must not rebuild the tree every frame.
 */
const TREE_KEYS = new Set([
  'index',
  'lockedBySelf',
  'children',
  'childIds',
  'role',
]);

/**
 * The live tree behind {@link selectionPaneTree}, one per editor.
 *
 * The tree is a `computed` over a revision counter, bumped by the few events
 * that can change a row (an element or block added or removed, a reorder, a
 * regroup, a lock) — never by geometry. A `computed` is lazy, so an editor
 * whose pane is closed and whose host never reads the tree pays the counter
 * bump and nothing else; an open pane pays one rebuild per relevant change,
 * not one per frame.
 *
 * It also holds whether the LIBRARY's own panel is open (`open$`), which is
 * what the toggle command reads. A host that replaced the panel through
 * `SelectionPaneExtension` owns its own open state; `open$` then stays false
 * and the toggle always opens.
 */
export class SelectionPaneModel extends LifeCycleWatcher {
  static override key = 'selection-pane-model';

  private readonly _revision$ = signal(0);

  private _disposeSurfaceEffect: (() => void) | null = null;

  private _subscriptions: { unsubscribe(): void }[] = [];

  /** Whether the library's own panel is on screen. Written by that panel. */
  readonly open$ = signal(false);

  readonly tree$: ReadonlySignal<SelectionPaneNode[]> = computed(() => {
    this._revision$.value;
    const gfx = this.std.get(GfxControllerIdentifier);
    if (!gfx.surface$.value) return [];
    return buildSelectionPaneTree(gfx.gfxElements);
  });

  /** Force a rebuild; for a change no subscribed event reports. */
  invalidate() {
    // `peek`, not `value`: called from inside an effect, a READ would
    // subscribe that effect to the counter it is about to bump.
    this._revision$.value = this._revision$.peek() + 1;
  }

  override mounted() {
    super.mounted();
    const gfx = this.std.get(GfxControllerIdentifier);
    const store = this.std.store;

    this._subscriptions.push(
      gfx.layer.slots.layerUpdated.subscribe(() => this.invalidate()),
      store.slots.blockUpdated.subscribe(payload => {
        if (payload.type !== 'update' || TREE_KEYS.has(payload.props.key)) {
          this.invalidate();
        }
      })
    );

    // The surface is a signal: it may arrive after mount, or be replaced.
    this._disposeSurfaceEffect = effect(() => {
      const surface = gfx.surface$.value;
      this._watchSurface(surface);
    });
  }

  private _surfaceSubscriptions: { unsubscribe(): void }[] = [];

  private _watchSurface(surface: SurfaceBlockModel | null) {
    this._surfaceSubscriptions.forEach(sub => sub.unsubscribe());
    this._surfaceSubscriptions = [];
    if (!surface) return;
    this._surfaceSubscriptions.push(
      surface.elementAdded.subscribe(() => this.invalidate()),
      surface.elementRemoved.subscribe(() => this.invalidate()),
      surface.elementUpdated.subscribe(({ props }) => {
        for (const key of Object.keys(props)) {
          if (TREE_KEYS.has(key)) {
            this.invalidate();
            return;
          }
        }
      })
    );
    this.invalidate();
  }

  override unmounted() {
    this._disposeSurfaceEffect?.();
    this._disposeSurfaceEffect = null;
    this._watchSurface(null);
    this._subscriptions.forEach(sub => sub.unsubscribe());
    this._subscriptions = [];
    this.open$.value = false;
    super.unmounted();
  }
}

/**
 * The headless data API of the selection pane (ADR 0031 §12): a signal of
 * rows, z-order, top first, ids only.
 *
 * What a host's own pane renders from, and what the library's panel renders
 * from — one tree, so the two cannot disagree about the order of a canvas.
 * Edgeless editors only: the model is registered by the surface's edgeless
 * view extension.
 */
export function selectionPaneTree(
  std: BlockStdScope
): ReadonlySignal<SelectionPaneNode[]> {
  return std.get(SelectionPaneModel).tree$;
}
