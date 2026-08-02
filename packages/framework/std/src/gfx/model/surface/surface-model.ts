import { DisposableGroup } from '@labre/global/disposable';
import { assertType, type Constructor } from '@labre/global/utils';
import type { Boxed } from '@labre/store';
import { BlockModel, nanoid } from '@labre/store';
import { signal } from '@preact/signals-core';
import { Subject } from 'rxjs';
import * as Y from 'yjs';

import {
  type GfxGroupCompatibleInterface,
  isGfxGroupCompatibleModel,
} from '../base.js';
import type { GfxGroupModel, GfxModel } from '../model.js';
import { createDecoratorState } from './decorators/common.js';
import {
  getFieldPropsSet,
  getLocalPropsSet,
  initializeObservers,
  initializeWatchers,
} from './decorators/index.js';
import {
  GfxGroupLikeElementModel,
  type GfxPrimitiveElementModel,
  syncElementFromY,
} from './element-model.js';
import type { GfxLocalElementModel } from './local-element-model.js';
import { tagsPropToY } from './tags.js';

/**
 * Used for text field
 */
export const SURFACE_TEXT_UNIQ_IDENTIFIER = 'affine:surface:text';
/**
 * Used for field that use Y.Map. E.g. group children field
 */
export const SURFACE_YMAP_UNIQ_IDENTIFIER = 'affine:surface:ymap';

export type SurfaceBlockProps = {
  elements: Boxed<Y.Map<Y.Map<unknown>>>;
};

export interface ElementUpdatedData {
  id: string;
  props: Record<string, unknown>;
  oldValues: Record<string, unknown>;
  local: boolean;
}

export type MiddlewareCtx = {
  type: 'beforeAdd';
  payload: {
    type: string;
    props: Record<string, unknown>;
  };
};

export type SurfaceMiddleware = (ctx: MiddlewareCtx) => void;

/**
 * Prop keys that are never copied onto an element, whatever the caller sends.
 *
 * - `id` / `type` are the element's identity. They are written explicitly when
 *   the element is created and must not be rewritten through a bulk props
 *   assignment (a caller doing `updateElement(id, otherElement.serialize())`
 *   would otherwise stamp a stale identity into the document).
 * - `__proto__` / `constructor` / `prototype` are the prototype-pollution
 *   vector: assigning them mutates the class or `Object.prototype` instead of
 *   the document. They are dropped rather than forwarded to the Y.Map.
 *
 * **This list is load-bearing for security, not just hygiene — do not assume
 * the routing makes it redundant.** `Object.prototype.__proto__` is an
 * accessor **with a setter**, so it is present on the prototype chain of every
 * element type and {@link isDeclaredElementProp} would route it to the
 * instance assignment, i.e. mutate the element's prototype. The only thing
 * stopping that is this deny-list, which is evaluated first.
 *
 * Everything else is either a declared accessor or an unknown key, and both
 * are handled by {@link SurfaceBlockModel._assignElementProp}.
 */
const UNSAFE_ELEMENT_PROP_KEYS = new Set([
  'id',
  'type',
  '__proto__',
  'constructor',
  'prototype',
]);

/**
 * Whether the element class DECLARED this prop, i.e. whether the assignment
 * `element[key] = value` is something the class asked for.
 *
 * Three sources, and no more:
 *
 * - the `@field()` set and the `@local()` set the decorators maintain per
 *   prototype — the authoritative table for every decorated accessor;
 * - a plain accessor **that has a setter**, found by walking the prototype
 *   chain. The only such prop today is `xywh` on `GfxGroupLikeElementModel`,
 *   whose value is derived from the children and whose setter is a deliberate
 *   no-op; since `serialize()` always emits `xywh`, treating it as unknown
 *   would persist a stale derived value into every duplicated group.
 *
 * Explicitly NOT `key in element`, which also matches methods (`serialize`,
 * `isLocked`, …), getter-only derived props (`x`, `y`, `w`, `h`, `group`,
 * `elementBound`, …) and internal instance fields (`_local`, `_preserved`).
 * Assigning to any of those corrupts the model instead of describing it. The
 * descriptor walk stops at the first prototype that owns the key, so a method
 * (data descriptor, no setter) and a getter-only accessor both answer `false`.
 */
function isDeclaredElementProp(
  element: GfxPrimitiveElementModel,
  key: string
): boolean {
  if (getFieldPropsSet(element).has(key) || getLocalPropsSet(element).has(key)) {
    return true;
  }

  for (
    let proto: object | null = Object.getPrototypeOf(element);
    proto !== null;
    proto = Object.getPrototypeOf(proto)
  ) {
    const descriptor = Object.getOwnPropertyDescriptor(proto, key);

    if (descriptor) {
      return typeof descriptor.set === 'function';
    }
  }

  return false;
}

/**
 * Depth limit for the encodability check below. Element props are flat by
 * contract; this only exists so a pathologically deep payload cannot turn the
 * check itself into the stack overflow it is meant to prevent.
 */
const MAX_UNKNOWN_PROP_DEPTH = 32;

/**
 * Whether a value can be stored in an element's Y.Map without breaking the
 * document.
 *
 * `Y.Map.set` accepts a value it cannot later encode: a cyclic plain object is
 * stored happily, `serialize()` and `encodeStateVector` keep working, and only
 * `encodeStateAsUpdate` — i.e. persistence and sync — blows the stack. Nothing
 * in the app notices, and no user action can remove the key. So an unknown
 * prop is admitted only if it is provably encodable: a Yjs type (which
 * `_propsToY` may have built from a `Y.Text` / `Y.Map` wrapper payload), a
 * binary blob, a primitive, or a plain object / array of those, acyclic and
 * within the depth limit.
 *
 * Anything else (function, symbol, bigint, class instance, cycle) is rejected,
 * and the key is dropped exactly as it was before unknown props were
 * forwarded at all.
 */
function isEncodableElementValue(
  value: unknown,
  depth = 0,
  seen: Set<object> = new Set()
): boolean {
  if (value === null || value === undefined) {
    return true;
  }

  // Already a Yjs type: `_propsToY` builds these for the wrapper payloads, and
  // Yjs owns their encoding.
  if (value instanceof Y.AbstractType) {
    return true;
  }

  if (value instanceof Uint8Array) {
    return true;
  }

  const type = typeof value;

  if (type === 'string' || type === 'number' || type === 'boolean') {
    return true;
  }

  if (type !== 'object') {
    // function, symbol, bigint
    return false;
  }

  if (depth >= MAX_UNKNOWN_PROP_DEPTH) {
    return false;
  }

  // Cycle detection is per path, so a value shared by two sibling branches
  // (a DAG) is still accepted.
  if (seen.has(value as object)) {
    return false;
  }
  seen.add(value as object);

  try {
    if (Array.isArray(value)) {
      return value.every(item =>
        isEncodableElementValue(item, depth + 1, seen)
      );
    }

    // Only plain objects. A class instance would be silently flattened by the
    // Yjs encoder, which is never what the caller meant.
    //
    // `Object.create(null)` is rejected too, and for a sharper reason: Yjs
    // dispatches on `value.constructor`, which is `undefined` on a
    // null-prototype object, so `Y.Map.set` throws `Unexpected content type`
    // — from inside `store.transact`, which swallows it and takes every
    // remaining prop of the same payload with it.
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype) {
      return false;
    }

    return Object.values(value as Record<string, unknown>).every(item =>
      isEncodableElementValue(item, depth + 1, seen)
    );
  } finally {
    seen.delete(value as object);
  }
}

/**
 * {@link isEncodableElementValue}, but it never throws.
 *
 * The guard is the layer that protects the assignment loop, so it must not be
 * able to break it. Inspecting a value can raise: `Object.values` invokes
 * getters, and a getter that throws — or a hostile proxy trap — would escape
 * into `store.transact`, which swallows the error and silently drops every
 * prop after this one. That is the very failure mode this change removes, so
 * an inspection that blows up means "not storable", nothing more.
 */
function canStoreUnknownPropValue(value: unknown): boolean {
  try {
    return isEncodableElementValue(value);
  } catch {
    return false;
  }
}

export class SurfaceBlockModel extends BlockModel<SurfaceBlockProps> {
  protected _decoratorState = createDecoratorState();

  protected _elementCtorMap: Record<
    string,
    Constructor<
      GfxPrimitiveElementModel,
      ConstructorParameters<typeof GfxPrimitiveElementModel>
    >
  > = Object.create(null);

  protected _elementModels = new Map<
    string,
    {
      mount: () => void;
      unmount: () => void;
      model: GfxPrimitiveElementModel;
    }
  >();

  protected _elementTypeMap = new Map<string, GfxPrimitiveElementModel[]>();

  protected _groupLikeModels = new Map<string, GfxGroupModel>();

  protected _middlewares: SurfaceMiddleware[] = [];

  protected _surfaceBlockModel = true;

  protected localElements = new Set<GfxLocalElementModel>();

  elementAdded = new Subject<{ id: string; local: boolean }>();

  elementRemoved = new Subject<{
    id: string;
    type: string;
    model: GfxPrimitiveElementModel;
    local: boolean;
  }>();

  elementUpdated = new Subject<ElementUpdatedData>();

  localElementAdded = new Subject<GfxLocalElementModel>();

  localElementDeleted = new Subject<GfxLocalElementModel>();

  localElementUpdated = new Subject<{
    model: GfxLocalElementModel;
    props: Record<string, unknown>;
    oldValues: Record<string, unknown>;
  }>();

  private readonly _isEmpty$ = signal(false);

  get elementModels() {
    const models: GfxPrimitiveElementModel[] = [];
    this._elementModels.forEach(model => models.push(model.model));
    return models;
  }

  get elements() {
    return this.props.elements;
  }

  get localElementModels() {
    return this.localElements;
  }

  get registeredElementTypes() {
    return Object.keys(this._elementCtorMap);
  }

  override isEmpty(): boolean {
    return this._isEmpty$.value;
  }

  constructor() {
    super();
    const subscription = this.created.subscribe(() => {
      this._init();
      subscription.unsubscribe();
    });
  }

  private _createElementFromProps(
    props: Record<string, unknown>,
    options: {
      onChange: (payload: {
        id: string;
        props: Record<string, unknown>;
        oldValues: Record<string, unknown>;
        local: boolean;
      }) => void;
    }
  ) {
    const { type, id, ...rest } = props;

    if (!id) {
      throw new Error('Cannot find id in props');
    }

    const yMap = new Y.Map();
    const elementModel = this._createElementFromYMap(
      type as string,
      id as string,
      yMap,
      {
        ...options,
        newCreate: true,
      }
    );

    props = this._propsToY(type as string, props);

    yMap.set('type', type);
    yMap.set('id', id);

    Object.keys(rest).forEach(key => {
      if (props[key] !== undefined) {
        this._assignElementProp(elementModel.model, key, props[key]);
      }
    });

    return elementModel;
  }

  /**
   * Copies one serialized prop onto an element, routing it EXPLICITLY.
   *
   * Three outcomes, in order:
   *
   * 1. an unsafe key ({@link UNSAFE_ELEMENT_PROP_KEYS}) is dropped;
   * 2. a key the element class **declared** ({@link isDeclaredElementProp})
   *    goes through its accessor, exactly as before;
   * 3. anything else is an unknown key and is written verbatim into the
   *    element's Y.Map, provided the value is encodable.
   *
   * Step 2 deliberately does **not** ask `key in element`. That question is far
   * wider than "did the class declare this prop": it also matches every method
   * (`serialize`, `isLocked`, `stash`…), every getter-only derived prop (`x`,
   * `y`, `w`, `h`, `group`, `elementBound`…) and every internal instance field
   * (`_local`, `_preserved`…). Routing those to the instance is what used to
   * corrupt the model — a data key named `serialize` shadowed the method with a
   * string, and a data key named `x` threw `TypeError: only a getter`, which
   * `store.transact` swallows, silently losing every prop after it in the same
   * bulk update. With the declared-prop sets, such a key is simply unknown data:
   * it lands in the Y.Map, where it shadows nothing (methods and derived getters
   * live on the prototype and are read from there).
   *
   * Step 3 refuses a value it could not encode. `Y.Map.set` accepts a cyclic
   * object and only fails later, in `encodeStateAsUpdate` — i.e. it breaks
   * persistence and sync for good, invisibly. Dropping the key restores the
   * pre-existing behaviour for that one prop and keeps the document sound; the
   * doc's "values stay flat JSON" claim is now enforced rather than assumed.
   *
   * An `undefined` value is never written on the unknown branch either, so
   * spreading an absent option (`{ ...opts }` with `opts.foo === undefined`)
   * cannot mint a phantom key that is invisible in `serialize()` yet real for
   * every peer. Declared fields keep accepting `undefined`, which is how an
   * optional field is cleared.
   *
   * The asymmetry that follows is deliberate: an unknown key already present
   * in the Y.Map can never be removed through `updateElement`, since
   * `undefined` is the only way to ask for that and it is ignored here. On a
   * client that does not declare the field, an unknown key is immortal. That
   * is the right direction to err for a preservation contract — the client
   * that understands the field can still clear it through its accessor — but
   * it does mean this API cannot delete what it does not understand.
   *
   * The value is already Y-converted at this point: both call sites run the
   * whole props object through {@link _propsToY} first, which is key-agnostic.
   *
   * See `docs/spikes/us-1-8-unknown-props-preservation.md`.
   */
  private _assignElementProp(
    element: GfxPrimitiveElementModel,
    key: string,
    value: unknown
  ) {
    if (UNSAFE_ELEMENT_PROP_KEYS.has(key)) {
      return;
    }

    if (isDeclaredElementProp(element, key)) {
      // @ts-expect-error ignore
      element[key] = value;
      return;
    }

    if (value === undefined) {
      return;
    }

    if (!canStoreUnknownPropValue(value)) {
      console.warn(
        `Dropping unknown element prop "${key}": the value cannot be encoded ` +
          `into the document (expected a Yjs type, or flat JSON without cycles).`
      );
      return;
    }

    element.yMap.set(key, value);
  }

  private _createElementFromYMap(
    type: string,
    id: string,
    yMap: Y.Map<unknown>,
    options: {
      onChange: (payload: {
        id: string;
        props: Record<string, unknown>;
        oldValues: Record<string, unknown>;
        local: boolean;
      }) => void;
      skipFieldInit?: boolean;
      newCreate?: boolean;
    }
  ) {
    const stashed = new Map<string | symbol, unknown>();
    const Ctor = this._elementCtorMap[type];

    if (!Ctor) {
      throw new Error(`Invalid element type: ${yMap.get('type')}`);
    }
    const state = this._decoratorState;

    state.creating = true;
    state.skipField = options.skipFieldInit ?? false;

    let mounted = false;
    // @ts-expect-error ignore
    Ctor['_decoratorState'] = state;

    const elementModel = new Ctor({
      id,
      yMap,
      model: this,
      stashedStore: stashed,
      onChange: payload => mounted && options.onChange({ id, ...payload }),
    }) as GfxPrimitiveElementModel;

    // @ts-expect-error ignore
    delete Ctor['_decoratorState'];
    state.creating = false;
    state.skipField = false;

    const unmount = () => {
      mounted = false;
      elementModel.onDestroyed();
    };

    const mount = () => {
      initializeObservers(Ctor.prototype, elementModel);
      initializeWatchers(Ctor.prototype, elementModel);
      elementModel['_disposable'].add(
        syncElementFromY(elementModel, payload => {
          mounted &&
            options.onChange({
              id,
              ...payload,
            });
        })
      );
      mounted = true;
      elementModel.onCreated();
    };

    return {
      model: elementModel,
      mount,
      unmount,
    };
  }

  private _initElementModels() {
    const elementsYMap = this.elements.getValue()!;
    const addToType = (type: string, model: GfxPrimitiveElementModel) => {
      const sameTypeElements = this._elementTypeMap.get(type) || [];

      if (sameTypeElements.indexOf(model) === -1) {
        sameTypeElements.push(model);
      }

      this._elementTypeMap.set(type, sameTypeElements);

      if (isGfxGroupCompatibleModel(model)) {
        this._groupLikeModels.set(model.id, model);
      }
    };
    const removeFromType = (type: string, model: GfxPrimitiveElementModel) => {
      const sameTypeElements = this._elementTypeMap.get(type) || [];
      const index = sameTypeElements.indexOf(model);

      if (index !== -1) {
        sameTypeElements.splice(index, 1);
      }

      if (this._groupLikeModels.has(model.id)) {
        this._groupLikeModels.delete(model.id);
      }
    };
    const onElementsMapChange = (
      event: Y.YMapEvent<Y.Map<unknown>>,
      transaction: Y.Transaction
    ) => {
      const { changes, keysChanged } = event;
      const addedElements: {
        mount: () => void;
        model: GfxPrimitiveElementModel;
      }[] = [];
      const deletedElements: {
        unmount: () => void;
        model: GfxPrimitiveElementModel;
      }[] = [];

      keysChanged.forEach(id => {
        const change = changes.keys.get(id);
        const element = this.elements.getValue()!.get(id);

        switch (change?.action) {
          case 'add':
            if (element) {
              const hasModel = this._elementModels.has(id);
              const model = hasModel
                ? this._elementModels.get(id)!
                : this._createElementFromYMap(
                    element.get('type') as string,
                    element.get('id') as string,
                    element,
                    {
                      onChange: payload => {
                        this.elementUpdated.next(payload);
                        Object.keys(payload.props).forEach(key => {
                          model.model.propsUpdated.next({ key });
                        });
                      },
                      skipFieldInit: true,
                    }
                  );

              !hasModel && this._elementModels.set(id, model);
              addToType(model.model.type, model.model);
              addedElements.push(model);
            }
            break;
          case 'delete':
            if (this._elementModels.has(id)) {
              const { model, unmount } = this._elementModels.get(id)!;
              removeFromType(model.type, model);
              this._elementModels.delete(id);
              deletedElements.push({ model, unmount });
            }
            break;
        }
      });

      addedElements.forEach(({ mount, model }) => {
        mount();
        this.elementAdded.next({ id: model.id, local: transaction.local });
      });
      deletedElements.forEach(({ unmount, model }) => {
        unmount();
        this.elementRemoved.next({
          id: model.id,
          type: model.type,
          model,
          local: transaction.local,
        });
      });
    };

    elementsYMap.forEach((val, key) => {
      const model = this._createElementFromYMap(
        val.get('type') as string,
        val.get('id') as string,
        val,
        {
          onChange: payload => {
            this.elementUpdated.next(payload),
              Object.keys(payload.props).forEach(key => {
                model.model.propsUpdated.next({ key });
              });
          },
          skipFieldInit: true,
        }
      );

      this._elementModels.set(key, model);
    });

    this._elementModels.forEach(({ mount, model }) => {
      addToType(model.type, model);
      mount();
    });

    Object.values(this.store.blocks.peek()).forEach(block => {
      if (isGfxGroupCompatibleModel(block.model)) {
        this._groupLikeModels.set(block.id, block.model);
      }
    });

    elementsYMap.observe(onElementsMapChange);

    const subscription = this.store.slots.blockUpdated.subscribe(payload => {
      switch (payload.type) {
        case 'add':
          if (isGfxGroupCompatibleModel(payload.model)) {
            this._groupLikeModels.set(payload.id, payload.model);
          }

          break;
        case 'delete':
          if (isGfxGroupCompatibleModel(payload.model)) {
            this._groupLikeModels.delete(payload.id);
          }
          {
            const group = this.getGroup(payload.id);
            if (group) {
              // oxlint-disable-next-line unicorn/prefer-dom-node-remove
              group.removeChild(payload.model as GfxModel);
            }
          }

          break;
      }
    });

    this.deleted.subscribe(() => {
      elementsYMap.unobserve(onElementsMapChange);
      subscription.unsubscribe();
    });
  }

  private _propsToY(type: string, props: Record<string, unknown>) {
    const ctor = this._elementCtorMap[type];

    if (!ctor) {
      throw new Error(`Invalid element type: ${type}`);
    }

    Object.entries(props).forEach(([key, val]) => {
      if (val instanceof Object) {
        if (Reflect.has(val, SURFACE_TEXT_UNIQ_IDENTIFIER)) {
          const yText = new Y.Text();
          yText.applyDelta(Reflect.get(val, 'delta'));
          Reflect.set(props, key, yText);
        }

        if (Reflect.has(val, SURFACE_YMAP_UNIQ_IDENTIFIER)) {
          const childJson = Reflect.get(val, 'json') as Record<string, unknown>;
          const childrenYMap = new Y.Map<unknown>();

          Object.keys(childJson).forEach(childId => {
            childrenYMap.set(childId, childJson[childId]);
          });
          Reflect.set(props, key, childrenYMap);
        }
      }
    });

    // `tags` is declared on the BASE class, so no per-class `propsToY` hook
    // covers it. Run before the class hook, which may legitimately not exist.
    tagsPropToY(props);

    // @ts-expect-error ignore
    return ctor.propsToY ? ctor.propsToY(props) : props;
  }

  private _watchGroupRelationChange() {
    const isGroup = (
      element: GfxPrimitiveElementModel
    ): element is GfxGroupLikeElementModel =>
      element instanceof GfxGroupLikeElementModel;

    const disposable = this.elementUpdated.subscribe(({ id, oldValues }) => {
      const element = this.getElementById(id)!;

      if (
        isGroup(element) &&
        oldValues['childIds'] &&
        element.childIds.length === 0
      ) {
        this.deleteElement(id);
      }
    });
    this.deleted.subscribe(() => {
      disposable.unsubscribe();
    });
  }

  private _watchChildrenChange() {
    const updateIsEmpty = () => {
      this._isEmpty$.value =
        this._elementModels.size === 0 && this.children.length === 0;
    };

    const disposables = new DisposableGroup();
    disposables.add(this.elementAdded.subscribe(updateIsEmpty));
    disposables.add(this.elementRemoved.subscribe(updateIsEmpty));
    this.store.slots.blockUpdated.subscribe(payload => {
      if (['add', 'delete'].includes(payload.type)) {
        updateIsEmpty();
      }
    });
    this.deleted.subscribe(() => {
      disposables.dispose();
    });
  }

  protected _extendElement(
    ctorMap: Record<
      string,
      Constructor<
        GfxPrimitiveElementModel,
        ConstructorParameters<typeof GfxPrimitiveElementModel>
      >
    >
  ) {
    Object.assign(this._elementCtorMap, ctorMap);
  }

  protected _init() {
    this._initElementModels();
    this._watchGroupRelationChange();
    this._watchChildrenChange();
  }

  getConstructor(type: string) {
    return this._elementCtorMap[type];
  }

  addElement<T extends object = Record<string, unknown>>(
    props: Partial<T> & { type: string }
  ) {
    if (this.store.readonly) {
      throw new Error('Cannot add element in readonly mode');
    }

    const middlewareCtx: MiddlewareCtx = {
      type: 'beforeAdd',
      payload: {
        type: props.type,
        props,
      },
    };

    this._middlewares.forEach(mid => mid(middlewareCtx));

    props = middlewareCtx.payload.props as Partial<T> & { type: string };

    const id = nanoid();

    // @ts-expect-error ignore
    props.id = id;

    const elementModel = this._createElementFromProps(props, {
      onChange: payload => {
        this.elementUpdated.next(payload);
        Object.keys(payload.props).forEach(key => {
          elementModel.model.propsUpdated.next({ key });
        });
      },
    });

    this._elementModels.set(id, elementModel);

    this.store.transact(() => {
      this.elements.getValue()!.set(id, elementModel.model.yMap);
    });

    return id;
  }

  addLocalElement(elem: GfxLocalElementModel) {
    this.localElements.add(elem);
    this.localElementAdded.next(elem);
  }

  applyMiddlewares(middlewares: SurfaceMiddleware[]) {
    this._middlewares = middlewares;
  }

  deleteElement(id: string) {
    if (this.store.readonly) {
      throw new Error('Cannot remove element in readonly mode');
    }

    if (!this.hasElementById(id)) {
      return;
    }

    this.store.transact(() => {
      const element = this.getElementById(id)!;
      const group = this.getGroup(id);

      if (element instanceof GfxGroupLikeElementModel) {
        element.childIds.forEach(childId => {
          if (this.hasElementById(childId)) {
            this.deleteElement(childId);
          } else if (this.store.hasBlock(childId)) {
            this.store.deleteBlock(this.store.getBlock(childId)!.model);
          }
        });
      }

      // oxlint-disable-next-line unicorn/prefer-dom-node-remove
      group?.removeChild(element as GfxModel);

      this.elements.getValue()!.delete(id);
    });
  }

  deleteLocalElement(elem: GfxLocalElementModel) {
    if (this.localElements.delete(elem)) {
      this.localElementDeleted.next(elem);
    }
  }

  override dispose(): void {
    super.dispose();

    this.elementAdded.complete();
    this.elementRemoved.complete();
    this.elementUpdated.complete();

    this._elementModels.forEach(({ unmount }) => unmount());
    this._elementModels.clear();
  }

  getElementById(id: string): GfxPrimitiveElementModel | null {
    return this._elementModels.get(id)?.model ?? null;
  }

  getElementsByType(type: string): GfxPrimitiveElementModel[] {
    return this._elementTypeMap.get(type) || [];
  }

  getGroup(elem: string | GfxModel): GfxGroupModel | null {
    elem =
      typeof elem === 'string'
        ? ((this.getElementById(elem) ??
            this.store.getBlock(elem)?.model) as GfxModel)
        : elem;

    if (!elem) return null;

    assertType<GfxModel>(elem);

    for (const group of this._groupLikeModels.values()) {
      if (group.hasChild(elem)) {
        return group;
      }
    }

    return null;
  }

  /**
   * Get all groups in the group chain. The last group is the top level group.
   * @param id
   * @returns
   */
  getGroups(id: string): GfxGroupModel[] {
    const groups: GfxGroupModel[] = [];
    const visited = new Set<GfxGroupModel>();
    let group = this.getGroup(id);

    while (group) {
      if (visited.has(group)) {
        console.warn('Exists a cycle in group relation');
        break;
      }
      visited.add(group);
      groups.push(group);
      group = this.getGroup(group.id);
    }

    return groups;
  }

  hasElementById(id: string): boolean {
    return this._elementModels.has(id);
  }

  isGroup(element: GfxModel): element is GfxModel & GfxGroupCompatibleInterface;
  isGroup(id: string): boolean;
  isGroup(element: string | GfxModel): boolean {
    if (typeof element === 'string') {
      const el = this.getElementById(element);
      if (el) return isGfxGroupCompatibleModel(el);

      const blockModel = this.store.getBlock(element)?.model;
      if (blockModel) return isGfxGroupCompatibleModel(blockModel);

      return false;
    } else {
      return isGfxGroupCompatibleModel(element);
    }
  }

  updateElement<T extends object = Record<string, unknown>>(
    id: string,
    props: Partial<T>
  ) {
    if (this.store.readonly) {
      throw new Error('Cannot update element in readonly mode');
    }

    const elementModel = this.getElementById(id);

    if (!elementModel) {
      throw new Error(`Element ${id} is not found`);
    }

    this.store.transact(() => {
      props = this._propsToY(
        elementModel.type,
        props as Record<string, unknown>
      ) as T;
      Object.entries(props).forEach(([key, value]) => {
        this._assignElementProp(elementModel, key, value);
      });
    });
  }
}
