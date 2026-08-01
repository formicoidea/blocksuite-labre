import { DisposableGroup } from '@labre/global/disposable';
import {
  Bound,
  deserializeXYWH,
  getBoundWithRotation,
  getPointsFromBoundWithRotation,
  type IVec,
  linePolygonIntersects,
  PointLocation,
  polygonGetPointTangent,
  polygonNearestPoint,
  randomSeed,
  rotatePoints,
  type SerializedXYWH,
  type XYWH,
} from '@labre/global/gfx';
import { createMutex } from 'lib0/mutex';
import isEqual from 'lodash-es/isEqual';
import { Subject } from 'rxjs';
import * as Y from 'yjs';

import {
  descendantElementsImpl,
  hasDescendantElementImpl,
  isLockedByAncestorImpl,
  isLockedBySelfImpl,
  isLockedImpl,
  lockElementImpl,
  unlockElementImpl,
} from '../../../utils/tree.js';
import type { EditorHost } from '../../../view/index.js';
import type {
  GfxCompatibleInterface,
  GfxGroupCompatibleInterface,
  PointTestOptions,
} from '../base.js';
import { gfxGroupCompatibleSymbol } from '../base.js';
import type { GfxBlockElementModel } from '../gfx-block-model.js';
import type { GfxGroupModel, GfxModel } from '../model.js';
import {
  convertProps,
  field,
  getDerivedProps,
  getFieldPropsSet,
  local,
  updateDerivedProps,
  watch,
} from './decorators/index.js';
import type { SurfaceBlockModel } from './surface-model.js';

export type BaseElementProps = {
  index: string;
  seed: number;
  lockedBySelf?: boolean;
  /** See {@link GfxPrimitiveElementModel.pivotDocId}. */
  pivotDocId?: string;
};

/**
 * Declared `@field()`s that {@link GfxPrimitiveElementModel.clearField} refuses
 * to remove, because they have no meaningful ABSENT state: every one of them is
 * read unconditionally, with no fallback, by code that has no way to cope.
 *
 * - `index` — the fractional z-order key. Gone, the element's stacking is
 *   `undefined` and the layer manager sorts it nowhere, silently.
 * - `xywh` — gone, `elementBound` collapses to `{0,0,0,0}` and the renderer
 *   throws `"undefined" is not valid JSON` on every frame.
 * - `seed` — the roughness seed; gone, the hand-drawn renderers produce a
 *   different shape on every repaint.
 *
 * An optional field is exactly one whose accessor declares a usable default (or
 * `undefined`), and those stay clearable. This list is the short answer to
 * "which declared fields are not optional"; it is a deny-list on purpose, so a
 * new optional field needs no ceremony and a new structural one is a deliberate
 * addition here.
 */
const UNCLEARABLE_ELEMENT_FIELDS = new Set<string>(['index', 'seed', 'xywh']);

/**
 * One arbitration: "this element is excused from that rule".
 *
 * Document DATA, not session state — it records a decision the user made, so it
 * outlives the tab, the framework flag and the client version that wrote it.
 * Deliberately flat and rule-agnostic: the model stores it, the validation
 * engine interprets it, and neither has to know what the other is up to.
 */
export type ValidationException = {
  /** The rule being excused, e.g. `wardley.change-arrow-against-evolution`. */
  ruleId: string;
  /** Who granted it, when the host knows. Absent rather than empty. */
  author?: string;
  /** Epoch ms, taken at the moment of the gesture. */
  at: number;
};

export type SerializedElement = Record<string, unknown> & {
  type: string;
  xywh: SerializedXYWH;
  id: string;
  index: string;
  lockedBySelf?: boolean;
  props: Record<string, unknown>;
};
export abstract class GfxPrimitiveElementModel<
  Props extends BaseElementProps = BaseElementProps,
> implements GfxCompatibleInterface
{
  private _lastXYWH!: SerializedXYWH;

  protected _disposable = new DisposableGroup();

  protected _id: string;

  protected _local = new Map<string | symbol, unknown>();

  protected _onChange: (payload: {
    props: Record<string, unknown>;
    oldValues: Record<string, unknown>;
    local: boolean;
  }) => void;

  /**
   * Used to store a copy of data in the yMap.
   */
  protected _preserved = new Map<string, unknown>();

  protected _stashed: Map<keyof Props | string, unknown>;

  propsUpdated = new Subject<{ key: string }>();

  abstract rotate: number;

  surface!: SurfaceBlockModel;

  abstract xywh: SerializedXYWH;

  yMap: Y.Map<unknown>;

  get connectable() {
    return true;
  }

  get deserializedXYWH() {
    if (!this._lastXYWH || this.xywh !== this._lastXYWH) {
      const xywh = this.xywh;
      this._local.set('deserializedXYWH', deserializeXYWH(xywh));
      this._lastXYWH = xywh;
    }

    return (this._local.get('deserializedXYWH') as XYWH) ?? [0, 0, 0, 0];
  }

  /**
   * The bound of the element after rotation.
   * The bound without rotation should be created by `Bound.deserialize(this.xywh)`.
   */
  get elementBound() {
    if (this.rotate) {
      return Bound.from(getBoundWithRotation(this));
    }

    return Bound.deserialize(this.xywh);
  }

  get externalBound(): Bound | null {
    if (!this._local.has('externalBound')) {
      const bound = this.externalXYWH
        ? Bound.deserialize(this.externalXYWH)
        : null;

      this._local.set('externalBound', bound);
    }

    return this._local.get('externalBound') as Bound | null;
  }

  get group(): GfxGroupModel | null {
    return this.surface.getGroup(this.id);
  }

  /**
   * Return the ancestor elements in order from the most recent to the earliest.
   */
  get groups(): GfxGroupModel[] {
    return this.surface.getGroups(this.id);
  }

  get h() {
    return this.deserializedXYWH[3];
  }

  get id() {
    return this._id;
  }

  get isConnected() {
    return this.surface.hasElementById(this.id);
  }

  get responseBound() {
    return this.elementBound.expand(this.responseExtension);
  }

  abstract get type(): string;

  get w() {
    return this.deserializedXYWH[2];
  }

  get x() {
    return this.deserializedXYWH[0];
  }

  get y() {
    return this.deserializedXYWH[1];
  }

  constructor(options: {
    id: string;
    yMap: Y.Map<unknown>;
    model: SurfaceBlockModel;
    stashedStore: Map<unknown, unknown>;
    onChange: (payload: {
      props: Record<string, unknown>;
      oldValues: Record<string, unknown>;
      local: boolean;
    }) => void;
  }) {
    const { id, yMap, model, stashedStore, onChange } = options;

    this._id = id;
    this.yMap = yMap;
    this.surface = model;
    this._stashed = stashedStore as Map<keyof Props, unknown>;
    this._onChange = onChange;

    // DO NOT turn these two into field initializers. `@field()` deliberately
    // does NOT write an `undefined` default into the Y.Map (see
    // `./decorators/field.ts`), and both accessors are declared without an
    // initializer — so these assignments, which go through the SETTER, are the
    // only reason `index` and `seed` reach the document at all. Losing `index`
    // would silently corrupt z-order on every new element.
    this.index = 'a0';
    this.seed = randomSeed();
  }

  containsBound(bounds: Bound): boolean {
    return getPointsFromBoundWithRotation(this).some(point =>
      bounds.containsPoint(point)
    );
  }

  getLineIntersections(start: IVec, end: IVec) {
    const points = getPointsFromBoundWithRotation(this);
    return linePolygonIntersects(start, end, points);
  }

  getNearestPoint(point: IVec) {
    const points = getPointsFromBoundWithRotation(this);
    return polygonNearestPoint(points, point);
  }

  getRelativePointLocation(relativePoint: IVec) {
    const bound = Bound.deserialize(this.xywh);
    const point = bound.getRelativePoint(relativePoint);
    const rotatePoint = rotatePoints([point], bound.center, this.rotate)[0];
    const points = rotatePoints(bound.points, bound.center, this.rotate);
    const tangent = polygonGetPointTangent(points, rotatePoint);
    return new PointLocation(rotatePoint, tangent);
  }

  includesPoint(
    x: number,
    y: number,
    opt: PointTestOptions,
    __: EditorHost
  ): boolean {
    const bound = opt.useElementBound ? this.elementBound : this.responseBound;
    return bound.isPointInBound([x, y]);
  }

  intersectsBound(bound: Bound): boolean {
    return (
      this.containsBound(bound) ||
      bound.points.some((point, i, points) =>
        this.getLineIntersections(point, points[(i + 1) % points.length])
      )
    );
  }

  isLocked(): boolean {
    return isLockedImpl(this);
  }

  isLockedByAncestor(): boolean {
    return isLockedByAncestorImpl(this);
  }

  isLockedBySelf(): boolean {
    return isLockedBySelfImpl(this);
  }

  lock() {
    lockElementImpl(this.surface.store, this);
  }

  onCreated() {}

  onDestroyed() {
    this._disposable.dispose();
    this.propsUpdated.complete();
  }

  pop(prop: keyof Props | string) {
    if (!this._stashed.has(prop)) {
      return;
    }

    const value = this._stashed.get(prop);
    this._stashed.delete(prop);
    // @ts-expect-error ignore
    delete this[prop];

    if (getFieldPropsSet(this).has(prop as string)) {
      if (!isEqual(value, this.yMap.get(prop as string))) {
        this.yMap.set(prop as string, value);
      }
    } else {
      console.warn('pop a prop that is not field or local:', prop);
    }
  }

  serialize() {
    const result = this.yMap.toJSON();
    result.xywh = this.xywh;
    return result as SerializedElement;
  }

  stash(prop: keyof Props | string) {
    if (this._stashed.has(prop)) {
      return;
    }

    if (!getFieldPropsSet(this).has(prop as string)) {
      return;
    }

    const curVal = this[prop as unknown as keyof GfxPrimitiveElementModel];

    this._stashed.set(prop, curVal);

    Object.defineProperty(this, prop, {
      configurable: true,
      enumerable: true,
      get: () => this._stashed.get(prop),
      set: (original: unknown) => {
        const value = convertProps(prop as string, original, this);
        const oldValue = this._stashed.get(prop);
        const derivedProps = getDerivedProps(
          prop as string,
          original,
          this as unknown as GfxPrimitiveElementModel
        );

        this._stashed.set(prop, value);
        this._onChange({
          props: {
            [prop]: value,
          },
          oldValues: {
            [prop]: oldValue,
          },
          local: true,
        });

        updateDerivedProps(
          derivedProps,
          this as unknown as GfxPrimitiveElementModel
        );
      },
    });
  }

  unlock() {
    unlockElementImpl(this.surface.store, this);
  }

  /**
   * Remove an OPTIONAL `@field()` from the document entirely.
   *
   * The missing half of `@field()`. Its setter is unconditional — assigning
   * `undefined` still calls `yMap.set(prop, undefined)` — so "clearing" an
   * optional field through the accessor leaves the KEY behind. The getter reads
   * `undefined` and nothing misbehaves, but the element is no longer
   * byte-identical to one that never had the field: the phantom key syncs to
   * every peer and ships in every snapshot. `init` is already careful to write
   * nothing for an `undefined` default; this is how a field gets back to that
   * state once it has been set.
   *
   * Emits a `delete` action rather than an `update`, so a consumer filtering on
   * `props` will see an EMPTY payload and must inspect `oldValues` — the same
   * shape an undo of the original write produces.
   *
   * ## What it refuses, and why that is load-bearing
   *
   * This is a direct write path into the element's Y.Map, on the class that
   * carries the document format, exported by `@labre/std` and therefore
   * callable by a host. `_assignElementProp` learned the same lesson in the
   * unknown-props change (see `docs/spikes/us-1-8-unknown-props-preservation.md`,
   * whose deny-list is explicitly security rather than hygiene); an unguarded
   * delete re-opens the door from the other side. So:
   *
   * - a key the element class does not DECLARE as a `@field()` is refused. It
   *   is either an unknown key preserved verbatim for a newer client — deleting
   *   it is exactly the data loss that change exists to prevent — or not
   *   document data at all;
   * - a STRUCTURAL field is refused even though it is declared
   *   ({@link UNCLEARABLE_ELEMENT_FIELDS}).
   *
   * Refusal is a no-op plus a `console.warn`, the same way an unencodable value
   * is dropped rather than thrown: a misuse must not take the board down, and
   * must not silently corrupt it either.
   */
  clearField(prop: string) {
    if (UNCLEARABLE_ELEMENT_FIELDS.has(prop)) {
      console.warn(
        `Refusing to clear the structural element field "${prop}": it has no meaningful absent state.`
      );
      return;
    }
    if (!getFieldPropsSet(this).has(prop)) {
      console.warn(
        `Refusing to clear "${prop}": not a declared @field() on this element. Unknown keys are preserved deliberately.`
      );
      return;
    }
    if (!this.yMap.has(prop)) return;

    if (this.yMap.doc) {
      this.surface.store.transact(() => {
        this.yMap.delete(prop);
      });
      // The Y.Map observer prunes `_preserved` on the delete action.
      return;
    }

    this.yMap.delete(prop);
    this._preserved.delete(prop);
  }

  @local()
  accessor display: boolean = true;

  /**
   * In some cases, you need to draw something related to the element, but it does not belong to the element itself.
   * And it is also interactive, you can select element by clicking on it. E.g. the title of the group element.
   * In this case, we need to store this kind of external xywh in order to do hit test. This property should not be synced to the doc.
   * This property should be updated every time it gets rendered.
   */
  @watch((_, instance) => {
    instance['_local'].delete('externalBound');
  })
  @local()
  accessor externalXYWH: SerializedXYWH | undefined = undefined;

  @field(false)
  accessor hidden: boolean = false;

  @field()
  accessor index!: string;

  /**
   * Minimal link target attached to the element. At most one is set.
   * Opaque to the framework; an affine widget shows a hover arrow that
   * opens the doc ({@link linkedDocId}) or the URL ({@link externalLink}).
   */
  @field()
  accessor externalLink: string | undefined = undefined;

  @field()
  accessor linkedDocId: string | undefined = undefined;

  /**
   * Identity binding to a host-owned **pivot record**: this element is an
   * *occurrence* of the document `pivotDocId`. Many elements, across many
   * boards, may carry the same `pivotDocId` — that is the point. A Wardley
   * `component` drawn on three maps is the same component (MF1, ADR 0005).
   *
   * Opaque to the library: the framework never dereferences it, never fetches
   * it, never renders it. Reading it is the host's job, through
   * `PivotPropertiesProvider` (`@labre/affine-shared/services`, ADR 0006).
   * No renderer, no hit-test, no layout and no exporter may read it; it
   * participates in no `@derive`, `@convert` or `@watch` chain, so it cannot
   * move, resize or restyle anything.
   *
   * Orthogonal to {@link linkedDocId} / {@link externalLink}, which are a
   * *hyperlink* (navigation), not an identity. They differ on every axis that
   * matters — cardinality (a hyperlink is one target per element and is
   * exclusive with `externalLink`; a binding is many-elements-to-one-record),
   * lifecycle (a hyperlink is picked from a search modal, a binding is created
   * by promotion) and consumers (an arrow that navigates vs. a hover card and
   * a rules engine). An element may legitimately carry both, and code reading
   * one as a stand-in for the other is a bug.
   *
   * Declared on the BASE class for the same reason as {@link role}: an element
   * re-created from props (paste, duplicate, alt-drag clone, template
   * insertion) only reaches the Y.Map through keys that have a declared
   * accessor, so a binding declared per subclass would be silently dropped on
   * copy — and the loss would be invisible until the next reload.
   *
   * `undefined` = unbound, and no key is written for it, so an element that
   * never binds stays byte-identical to one created before the field existed:
   * optional field, no schema version bump, no migration. Clearing it goes
   * through {@link clearField}, which removes the key rather than leaving a
   * tombstone.
   *
   * A binding to a record that does not (yet) exist — or was deleted, or is
   * invisible to this user — is a legal, persisted state: the library never
   * validates it and never deletes host data. It resolves to `missing` at read
   * time (ADR 0006).
   */
  @field()
  accessor pivotDocId: string | undefined = undefined;

  /**
   * Semantic role of the element, `<framework>:<role>` (see `./role.ts`).
   * `undefined` = neutral: generalist elements carry no role, and no key is
   * written for them at creation.
   *
   * Declared on the BASE class on purpose, even though only framework modules
   * set it: an element re-created from props (paste, duplicate, template
   * insertion) only reaches the Y.Map through keys that have a declared
   * accessor, so a role declared per subclass would be silently dropped on
   * copy. Flat string on purpose — element serialization is one level deep.
   */
  @field()
  accessor role: string | undefined = undefined;

  /**
   * Validation rules this element is excused from (PF8, "no rule is a wall").
   *
   * Declared on the BASE class for the same reason as {@link role}: an element
   * re-created from props (paste, duplicate, template insertion) only reaches
   * the Y.Map through keys that have a declared accessor, so an exception
   * declared per subclass would be silently dropped on copy — and an arbitration
   * the user made explicitly is exactly the kind of thing that must survive a
   * copy.
   *
   * `undefined` = no exception, and no key is written for it, so an element that
   * never got one stays byte-identical to one created before the field existed:
   * optional field, no schema version bump, no migration.
   *
   * Flat JSON on purpose — element serialization is one level deep, and a value
   * a Yjs update can encode is the contract enforced by `_assignElementProp`.
   * The engine that reads it lives in `@labre/affine-block-surface`; the base
   * model only carries the data, and knows nothing about rules.
   */
  @field()
  accessor validationExceptions: ValidationException[] | undefined = undefined;

  /**
   * Id of the validation PROFILE this element's framework is checked against
   * (PF9) — a set of enabled rules and their severities, declared as data by
   * the framework.
   *
   * Carried by the framework's BACKGROUND element, i.e. the root instance, and
   * not by the document: two maps on one canvas are two independent pieces of
   * work, and a sketch has to be able to sit next to a deliverable without
   * either of them dictating the other's requirements (PF9.1). The engine reads
   * it off the background a finding was measured against, which it already
   * names (`Violation.backgroundId`).
   *
   * Declared on the BASE class for the same reason as {@link role} and
   * {@link validationExceptions}: an element re-created from props (paste,
   * duplicate, template insertion) only reaches the Y.Map through keys that
   * have a declared accessor, so a profile declared per subclass would be
   * silently dropped on copy — and duplicating a strict map must give a strict
   * map.
   *
   * `undefined` = "no explicit choice", which resolves to the framework's
   * DEFAULT profile — the most permissive reasonable one, because the sketch
   * wins. No key is written for it, so a document authored before this field
   * existed stays byte-identical: optional field, no schema version bump, no
   * migration. Choosing the default back again removes the key rather than
   * writing it.
   *
   * Flat string on purpose — element serialization is one level deep. The
   * engine that interprets it lives in `@labre/affine-block-surface`; the base
   * model only carries the id, and knows nothing about profiles.
   */
  @field()
  accessor validationProfile: string | undefined = undefined;

  /**
   * The map-quality NUDGES the user has ticked off on this instance (PF7.10) —
   * ids of declarative reminders their framework ships, never rules the engine
   * evaluates.
   *
   * A nudge is an expectation the tool cannot judge ("the map has a title that
   * frames the study"): the content can exist without being good, so nothing
   * here is ever computed. Ticking one is the same gesture as granting an
   * exception — the user says "I have taken care of this" and the tool records
   * it rather than pretending to check it.
   *
   * Carried by the framework's BACKGROUND element, i.e. the root instance, for
   * the same reason {@link validationProfile} is: two maps on one canvas are two
   * independent pieces of work, and a checklist ticked on one says nothing about
   * the other.
   *
   * Declared on the BASE class for the same reason as {@link role} and
   * {@link validationExceptions}: an element re-created from props (paste,
   * duplicate, template insertion) only reaches the Y.Map through keys that have
   * a declared accessor, so a checklist declared per subclass would be silently
   * dropped on copy.
   *
   * `undefined` = nothing ticked, and no key is written for it, so a document
   * authored before this field existed stays byte-identical: optional field, no
   * schema version bump, no migration. Unticking the last one goes through
   * {@link clearField}, which removes the key rather than leaving a tombstone.
   *
   * Flat JSON — an array of strings — on purpose: element serialization is one
   * level deep, and a value a Yjs update can encode is the contract enforced by
   * `_assignElementProp`. The library that interprets the ids lives in
   * `@labre/affine-block-surface`; the base model only carries them, and knows
   * nothing about nudges. Ids of nudges no framework declares any more are kept,
   * not pruned: the tooling comes and goes with a flag, the decision does not.
   */
  @field()
  accessor qualityChecklist: string[] | undefined = undefined;

  @field()
  accessor lockedBySelf: boolean | undefined = false;

  @local()
  accessor opacity: number = 1;

  @local()
  accessor responseExtension: [number, number] = [0, 0];

  @field()
  accessor seed!: number;
}

export abstract class GfxGroupLikeElementModel<
    Props extends BaseElementProps = BaseElementProps,
  >
  extends GfxPrimitiveElementModel<Props>
  implements GfxGroupCompatibleInterface
{
  private _childIds: string[] = [];

  private readonly _mutex = createMutex();

  abstract children: Y.Map<any>;

  [gfxGroupCompatibleSymbol] = true as const;

  get childElements() {
    const elements: GfxModel[] = [];

    for (const key of this.childIds) {
      const element =
        this.surface.getElementById(key) ||
        (this.surface.store.getModelById(key) as GfxBlockElementModel);

      element && elements.push(element);
    }

    return elements;
  }

  /**
   * The ids of the children. Its role is to provide a unique way to access the children.
   * You should update this field through `setChildIds` when the children are added or removed.
   */
  get childIds() {
    return this._childIds;
  }

  get descendantElements(): GfxModel[] {
    return descendantElementsImpl(this);
  }

  get xywh() {
    this._mutex(() => {
      const curXYWH =
        (this._local.get('xywh') as SerializedXYWH) ?? '[0,0,0,0]';
      const newXYWH = this._getXYWH().serialize();

      if (curXYWH !== newXYWH || !this._local.has('xywh')) {
        this._local.set('xywh', newXYWH);

        if (curXYWH !== newXYWH) {
          this._onChange({
            props: {
              xywh: newXYWH,
            },
            oldValues: {
              xywh: curXYWH,
            },
            local: true,
          });
        }
      }
    });

    return (this._local.get('xywh') as SerializedXYWH) ?? '[0,0,0,0]';
  }

  set xywh(_) {}

  protected _getXYWH(): Bound {
    let bound: Bound | undefined;

    this.childElements.forEach(child => {
      if (child instanceof GfxPrimitiveElementModel && child.hidden) {
        return;
      }

      bound = bound ? bound.unite(child.elementBound) : child.elementBound;
    });

    if (bound) {
      this._local.set('xywh', bound.serialize());
    } else {
      this._local.delete('xywh');
    }

    return bound ?? new Bound(0, 0, 0, 0);
  }

  abstract addChild(element: GfxModel): void;

  /**
   * The actual field that stores the children of the group.
   * It should be a ymap decorated with `@field`.
   */
  hasChild(element: GfxCompatibleInterface) {
    return this.childElements.includes(element as GfxModel);
  }

  /**
   * Check if the group has the given descendant.
   */
  hasDescendant(element: GfxCompatibleInterface): boolean {
    return hasDescendantElementImpl(this, element);
  }

  /**
   * Remove the child from the group
   */
  abstract removeChild(element: GfxCompatibleInterface): void;

  /**
   * Set the new value of the childIds
   * @param value the new value of the childIds
   * @param fromLocal if true, the change is happened in the local
   */
  setChildIds(value: string[], fromLocal: boolean) {
    const oldChildIds = this.childIds;
    this._childIds = value;

    this._onChange({
      props: {
        childIds: value,
      },
      oldValues: {
        childIds: oldChildIds,
      },
      local: fromLocal,
    });
  }
}

export function syncElementFromY(
  model: GfxPrimitiveElementModel,
  callback: (payload: {
    props: Record<string, unknown>;
    oldValues: Record<string, unknown>;
    local: boolean;
  }) => void
) {
  const disposables: Record<string, () => void> = {};
  const observer = (
    event: Y.YMapEvent<unknown>,
    transaction: Y.Transaction
  ) => {
    const props: Record<string, unknown> = {};
    const oldValues: Record<string, unknown> = {};

    event.keysChanged.forEach(key => {
      const type = event.changes.keys.get(key);
      const oldValue = event.changes.keys.get(key)?.oldValue;

      if (!type) {
        return;
      }

      if (type.action === 'update' || type.action === 'add') {
        const value = model.yMap.get(key);

        if (value instanceof Y.Text) {
          disposables[key]?.();
          disposables[key] = watchText(key, value, callback);
        }

        model['_preserved'].set(key, value);
        props[key] = value;
        oldValues[key] = oldValue;
      } else {
        model['_preserved'].delete(key);
        oldValues[key] = oldValue;
      }
    });

    callback({
      props,
      oldValues,
      local: transaction.local,
    });
  };

  Array.from(model.yMap.entries()).forEach(([key, value]) => {
    if (value instanceof Y.Text) {
      disposables[key] = watchText(key, value, callback);
    }

    model['_preserved'].set(key, value);
  });

  model.yMap.observe(observer);
  disposables['ymap'] = () => {
    model.yMap.unobserve(observer);
  };

  return () => {
    Object.values(disposables).forEach(fn => fn());
  };
}

function watchText(
  key: string,
  value: Y.Text,
  callback: (payload: {
    props: Record<string, unknown>;
    oldValues: Record<string, unknown>;
    local: boolean;
  }) => void
) {
  const fn = (_: Y.YTextEvent, transaction: Y.Transaction) => {
    callback({
      props: {
        [key]: value,
      },
      oldValues: {},
      local: transaction.local,
    });
  };

  value.observe(fn);

  return () => {
    value.unobserve(fn);
  };
}
