import type * as Y from 'yjs';

import type { GfxPrimitiveElementModel } from '../element-model.js';
import { getObjectPropMeta, setObjectPropMeta } from './common.js';

const observeSymbol = Symbol('observe');
const observerDisposableSymbol = Symbol('observerDisposable');

type ObserveFn<
  E extends Y.YEvent<any> = Y.YEvent<any>,
  T extends GfxPrimitiveElementModel = GfxPrimitiveElementModel,
> = (
  /**
   * The event object of the Y.Map or Y.Array, the `null` value means the observer is initializing.
   */
  event: E | null,
  instance: T,
  /**
   * The transaction object of the Y.Map or Y.Array, the `null` value means the observer is initializing.
   */
  transaction: Y.Transaction | null
) => void;

/**
 * A decorator to observe the y type property.
 * You can think of it is just a decorator version of 'observe' method of Y.Array and Y.Map.
 *
 * The observer function start to observe the property when the model is mounted. And it will
 * re-observe the property automatically when the value is altered.
 * @param fn
 * @returns
 */
export function observe<
  V,
  E extends Y.YEvent<any>,
  T extends GfxPrimitiveElementModel,
>(fn: ObserveFn<E, T>) {
  return function observeDecorator(
    _: unknown,
    context: ClassAccessorDecoratorContext
  ) {
    const prop = context.name;
    return {
      init(this: T, v: V) {
        setObjectPropMeta(observeSymbol, Object.getPrototypeOf(this), prop, fn);
        return v;
      },
    } as ClassAccessorDecoratorResult<GfxPrimitiveElementModel, V>;
  };
}

function getObserveMeta(
  proto: unknown,
  prop: string | symbol
): null | ObserveFn {
  return getObjectPropMeta(proto, observeSymbol, prop);
}

export function startObserve(
  prop: string | symbol,
  receiver: GfxPrimitiveElementModel
) {
  const proto = Object.getPrototypeOf(receiver);
  const observeFn = getObserveMeta(proto, prop as string)!;
  // @ts-expect-error ignore
  const observerDisposable = receiver[observerDisposableSymbol] ?? {};

  // @ts-expect-error ignore
  receiver[observerDisposableSymbol] = observerDisposable;

  if (observerDisposable[prop]) {
    observerDisposable[prop]();
    delete observerDisposable[prop];
  }

  if (!observeFn) {
    return;
  }

  const value = receiver[prop as keyof GfxPrimitiveElementModel] as
    | Y.Map<unknown>
    | Y.Array<unknown>
    | null;

  observeFn(null, receiver, null);

  const fn = (event: Y.YEvent<any>, transaction: Y.Transaction) => {
    observeFn(event, receiver, transaction);
  };

  if (value && 'observe' in value) {
    value.observe(fn);

    observerDisposable[prop] = () => {
      value.unobserve(fn);
    };
  } else if (value != null && typeof value !== 'object') {
    console.warn(
      `Failed to observe "${prop.toString()}" of ${
        receiver.type
      } element, make sure it's a Y type.`
    );
  }
  // Two shapes are deliberately NOT warned about, because neither is the
  // misconfiguration this warning exists to catch (`@observe` on a field that
  // is not a Y type):
  //
  // - **Absent.** `GfxPrimitiveElementModel.tags` defaults to `undefined` and
  //   stays absent until something qualifies the element, so every unqualified
  //   element — i.e. almost all of them — would log once per mount.
  // - **A plain object.** That is the DEGRADED shape a client predating the
  //   field writes through the unknown-key branch (see `../tags.ts`). It is a
  //   document value of another vintage, not a programmer error, and nothing
  //   the user can act on; reading it is handled, and the first write converts
  //   it. Warning once per affected element per mount would be pure noise on a
  //   board the user did nothing wrong to produce.
  //
  // Either way the observer is re-attached the moment a real Y type lands on
  // the key: `@field()`'s setter calls `startObserve`, and `syncElementFromY`
  // calls it for the paths that never reach the setter (a remote peer, undo,
  // redo).
}

/** Whether an `@observe`d nested Y type is declared for this prop. */
export function hasObserveMeta(
  prop: string | symbol,
  receiver: GfxPrimitiveElementModel
): boolean {
  return getObserveMeta(Object.getPrototypeOf(receiver), prop) !== null;
}

export function initializeObservers(
  proto: unknown,
  receiver: GfxPrimitiveElementModel
) {
  const observers = getObjectPropMeta(proto, observeSymbol);

  Object.keys(observers).forEach(prop => {
    startObserve(prop, receiver);
  });

  receiver['_disposable'].add(() => {
    // @ts-expect-error ignore
    Object.values(receiver[observerDisposableSymbol] ?? {}).forEach(dispose =>
      (dispose as () => void)()
    );
  });
}
