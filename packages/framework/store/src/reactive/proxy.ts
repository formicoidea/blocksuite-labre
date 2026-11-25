import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import type { YArrayEvent, YMapEvent } from 'yjs';
import { Array as YArray, Map as YMap } from 'yjs';

import { BaseReactiveYData } from './base-reactive-data.js';
import { Boxed, type OnBoxedChange } from './boxed.js';
import { proxies } from './memory.js';
import { native2Y, y2Native } from './native-y.js';
import { type OnTextChange, Text } from './text/index.js';
import type { Releasable } from './release-scope.js';
import { ReleaseScope } from './release-scope.js';
import type { ProxyOptions, TransformOptions, UnRecord } from './types.js';

/**
 * The registry a proxy resolves its Yjs type in: its scope's (the shared
 * tree's is the module-level one, a flat-data block's is its own), or the
 * module-level one for an unscoped caller.
 */
const registryOf = (options?: { scope?: { proxies: typeof proxies } }) =>
  options?.scope?.proxies ?? proxies;

/** A released proxy leaves the registry, so the next reader builds a live one. */
const forget = (
  options: { scope?: { proxies: typeof proxies } } | undefined,
  ySource: object,
  reactive: object
) => {
  const registry = registryOf(options);
  if (registry.get(ySource) === reactive) registry.delete(ySource);
};

export class ReactiveYArray extends BaseReactiveYData<
  unknown[],
  YArray<unknown>
> {
  private readonly _observer = (event: YArrayEvent<unknown>) => {
    this._onObserve(event, () => {
      let retain = 0;
      event.changes.delta.forEach(change => {
        if (change.retain) {
          retain += change.retain;
          return;
        }
        if (change.delete) {
          this._updateWithSkip(() => {
            this._source.splice(retain, change.delete);
          });
          return;
        }
        if (change.insert) {
          const _arr = [change.insert].flat();

          const proxyList = _arr.map(value =>
            createYProxy(value, { scope: this._options.scope })
          );

          this._updateWithSkip(() => {
            this._source.splice(retain, 0, ...proxyList);
          });

          retain += change.insert.length;
        }
      });
    });
  };

  protected _getProxy = () => {
    return new Proxy(this._source, {
      has: (target, p) => {
        return Reflect.has(target, p);
      },
      set: (target, p, value, receiver) => {
        if (typeof p !== 'string') {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'key cannot be a symbol'
          );
        }

        const index = Number(p);
        if (this._skipNext || Number.isNaN(index)) {
          return Reflect.set(target, p, value, receiver);
        }

        if (this._stashed.has(index)) {
          const result = Reflect.set(target, p, value, receiver);
          this._options.onChange?.(this._proxy, true);
          return result;
        }

        const reactive = registryOf(this._options).get(this._ySource);
        if (!reactive) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not subscribed before changes'
          );
        }
        const doc = this._ySource.doc;
        if (!doc) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not bound to a Y.Doc'
          );
        }

        const yData = native2Y(value);
        this._transact(doc, () => {
          if (index < this._ySource.length) {
            this._ySource.delete(index, 1);
          }
          this._ySource.insert(index, [yData]);
        });
        const data = createYProxy(yData, this._options);
        return Reflect.set(target, p, data, receiver);
      },
      get: (target, p, receiver) => {
        if (p === 'splice') {
          return (start: number, deleteCount?: number, ...items: unknown[]) => {
            const doc = this._ySource.doc;
            if (!doc) {
              throw new BlockSuiteError(
                ErrorCode.ReactiveProxyError,
                'YData is not bound to a Y.Doc'
              );
            }
            const count = deleteCount ?? target.length - start;
            const yItems = items.map(item => native2Y(item));
            this._transact(doc, () => {
              this._ySource.delete(start, count);
              this._ySource.insert(start, yItems);
            });

            const result = Array.prototype.splice.apply(target, [
              start,
              count,
              ...yItems.map(yItem => createYProxy(yItem, this._options)),
            ]);

            return result;
          };
        }
        if (p === 'shift') {
          return () => {
            const doc = this._ySource.doc;
            if (!doc) {
              throw new BlockSuiteError(
                ErrorCode.ReactiveProxyError,
                'YData is not bound to a Y.Doc'
              );
            }
            if (target.length === 0) {
              return undefined;
            }
            const result = Array.prototype.shift.call(target);
            this._transact(doc, () => {
              this._ySource.delete(0, 1);
            });
            return result;
          };
        }
        if (p === 'unshift') {
          return (...items: unknown[]) => {
            const doc = this._ySource.doc;
            if (!doc) {
              throw new BlockSuiteError(
                ErrorCode.ReactiveProxyError,
                'YData is not bound to a Y.Doc'
              );
            }
            const yItems = items.map(item => native2Y(item));
            this._transact(doc, () => {
              this._ySource.insert(0, yItems);
            });
            return Array.prototype.unshift.apply(
              target,
              yItems.map(yItem => createYProxy(yItem, this._options))
            );
          };
        }
        return Reflect.get(target, p, receiver);
      },
      deleteProperty: (target, p): boolean => {
        if (typeof p !== 'string') {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'key cannot be a symbol'
          );
        }

        const proxied = registryOf(this._options).get(this._ySource);
        if (!proxied) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not subscribed before changes'
          );
        }
        const doc = this._ySource.doc;
        if (!doc) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not bound to a Y.Doc'
          );
        }

        const index = Number(p);
        if (this._skipNext || Number.isNaN(index)) {
          return Reflect.deleteProperty(target, p);
        }

        this._transact(doc, () => {
          this._ySource.delete(index, 1);
        });
        return Reflect.deleteProperty(target, p);
      },
    });
  };

  protected readonly _proxy: unknown[];

  constructor(
    protected readonly _source: unknown[],
    protected readonly _ySource: YArray<unknown>,
    protected readonly _options: ProxyOptions<unknown[]>
  ) {
    super();
    this._proxy = this._getProxy();
    registryOf(_options).set(_ySource, this);
    _options.scope?.track(this);
    _ySource.observe(this._observer);
  }

  private _observing = true;

  /** @internal Idempotent. */
  _release() {
    if (!this._observing) return;
    this._observing = false;
    this._ySource.unobserve(this._observer);
    forget(this._options, this._ySource, this);
  }

  pop(prop: number) {
    const value = this._source[prop];
    this._stashed.delete(prop);
    this._proxy[prop] = value;
  }

  stash(prop: number) {
    this._stashed.add(prop);
  }
}

export class ReactiveYMap extends BaseReactiveYData<UnRecord, YMap<unknown>> {
  private readonly _observer = (event: YMapEvent<unknown>) => {
    this._onObserve(event, () => {
      event.keysChanged.forEach(key => {
        const type = event.changes.keys.get(key);
        if (!type) {
          return;
        }
        if (type.action === 'delete') {
          this._updateWithSkip(() => {
            delete this._source[key];
          });
        } else if (type.action === 'add' || type.action === 'update') {
          const current = this._ySource.get(key);
          this._updateWithSkip(() => {
            this._source[key] = registryOf(this._options).has(current)
              ? registryOf(this._options).get(current)
              : createYProxy(current, this._options);
          });
        }
      });
    });
  };

  protected _getProxy = () => {
    return new Proxy(this._source, {
      has: (target, p) => {
        return Reflect.has(target, p);
      },
      set: (target, p, value, receiver) => {
        if (typeof p !== 'string') {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'key cannot be a symbol'
          );
        }
        if (this._skipNext) {
          return Reflect.set(target, p, value, receiver);
        }

        if (this._stashed.has(p)) {
          const result = Reflect.set(target, p, value, receiver);
          this._options.onChange?.(this._proxy, true);
          return result;
        }

        const reactive = registryOf(this._options).get(this._ySource);
        if (!reactive) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not subscribed before changes'
          );
        }
        const doc = this._ySource.doc;
        if (!doc) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not bound to a Y.Doc'
          );
        }

        const yData = native2Y(value);
        this._transact(doc, () => {
          this._ySource.set(p, yData);
        });
        const data = createYProxy(yData, this._options);
        return Reflect.set(target, p, data, receiver);
      },
      get: (target, p, receiver) => {
        return Reflect.get(target, p, receiver);
      },
      deleteProperty: (target, p) => {
        if (typeof p !== 'string') {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'key cannot be a symbol'
          );
        }
        if (this._skipNext) {
          return Reflect.deleteProperty(target, p);
        }

        const proxied = registryOf(this._options).get(this._ySource);
        if (!proxied) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not subscribed before changes'
          );
        }
        const doc = this._ySource.doc;
        if (!doc) {
          throw new BlockSuiteError(
            ErrorCode.ReactiveProxyError,
            'YData is not bound to a Y.Doc'
          );
        }

        this._transact(doc, () => {
          this._ySource.delete(p);
        });

        return Reflect.deleteProperty(target, p);
      },
    });
  };

  protected readonly _proxy: UnRecord;

  // eslint-disable-next-line sonarjs/no-identical-functions
  constructor(
    protected readonly _source: UnRecord,
    protected readonly _ySource: YMap<unknown>,
    protected readonly _options: ProxyOptions<UnRecord>
  ) {
    super();
    this._proxy = this._getProxy();
    registryOf(_options).set(_ySource, this);
    _options.scope?.track(this);
    _ySource.observe(this._observer);
  }

  private _observing = true;

  /** @internal Idempotent. */
  _release() {
    if (!this._observing) return;
    this._observing = false;
    this._ySource.unobserve(this._observer);
    forget(this._options, this._ySource, this);
  }

  // eslint-disable-next-line sonarjs/no-identical-functions
  pop(prop: string) {
    const value = this._source[prop];
    this._stashed.delete(prop);
    this._proxy[prop] = value;
  }

  stash(prop: string) {
    this._stashed.add(prop);
  }
}

export function createYProxy<Data>(
  yAbstract: unknown,
  options: ProxyOptions<Data> = {}
): Data {
  const registry = registryOf(options);
  if (registry.has(yAbstract)) {
    return registry.get(yAbstract)!.proxy as Data;
  }

  const transform: TransformOptions['transform'] = (value, origin) => {
    if (value instanceof Text) {
      value.bind(options.onChange as OnTextChange, options.scope);
      return value;
    }
    if (Boxed.is(origin)) {
      (value as Boxed).bind(options.onChange as OnBoxedChange, options.scope);
      return value;
    }
    if (origin instanceof YArray) {
      const data = new ReactiveYArray(
        value as unknown[],
        origin,
        options as ProxyOptions<unknown[]>
      );
      return data.proxy;
    }
    if (origin instanceof YMap) {
      const data = new ReactiveYMap(
        value as UnRecord,
        origin,
        options as ProxyOptions<UnRecord>
      );
      return data.proxy;
    }

    return value;
  };

  return y2Native(yAbstract, { transform }) as Data;
}

type PropListener = (data: unknown, isLocal: boolean) => void;

/**
 * The proxy tree of ONE nested prop (a block's `Y.Map` or `Y.Array` value
 * and everything under it), shared by every store on the document, and
 * released with the last store that uses it (#746, ADR 0057, amendment of
 * 2026-11-25).
 *
 * One proxy per Yjs type is what keeps two stores on a document from ever
 * reading different nested values: a proxy skips the local writes it made
 * itself, recognised by their proxy origin or a local origin, and Yjs keeps
 * the OUTER origin of a nested transaction, so a second proxy on the same
 * type could never tell a sibling's write made inside `store.transact` from
 * its own, and kept the old value (the first landing of ADR 0057 did that).
 * What a store adds is a listener: each store's sync controller is notified
 * of a change under the prop (the module-level registry used to bind the
 * tree to the first store alone, so a preview never was), and a released
 * store takes its listener back. The tree detaches from Yjs, and leaves the
 * registry, when its last listener goes.
 */
class SharedPropTree {
  private readonly _listeners = new Map<ReleaseScope, PropListener>();

  private readonly _handles = new Map<ReleaseScope, Releasable>();

  /** Everything built under the prop: the module-level registry. */
  readonly scope = new ReleaseScope(proxies);

  released = false;

  readonly options: ProxyOptions<unknown> = {
    onChange: (data, isLocal) => {
      this._listeners.forEach(listener => listener(data, isLocal));
    },
    scope: this.scope,
  };

  /**
   * Notify `onChange` of the changes under the prop until the returned
   * handle is released. One listener per block scope: the same block asking
   * again (its prop written then observed) replaces its own.
   */
  listen(owner: ReleaseScope, onChange: PropListener): Releasable {
    this._listeners.set(owner, onChange);
    let handle = this._handles.get(owner);
    if (!handle) {
      handle = {
        _release: () => {
          this._listeners.delete(owner);
          this._handles.delete(owner);
          if (this._listeners.size > 0) return;
          this.released = true;
          this.scope.release();
        },
      };
      this._handles.set(owner, handle);
    }
    return handle;
  }
}

/** The shared tree of each nested prop, by its top-level Yjs type. */
const sharedTrees = new WeakMap<object, SharedPropTree>();

/**
 * @internal
 * The value a block's sync controller reads for a prop: for a `Y.Map` or a
 * `Y.Array`, the proxy of the shared tree, with `onChange` listening to it
 * until `scope` (the block's) is released; anything else (a `Text`, a
 * `Boxed`, a plain value) built for this store alone, as before.
 */
export function attachYProxy<Data>(
  yAbstract: unknown,
  { onChange, scope }: { onChange: PropListener; scope: ReleaseScope }
): Data {
  const shared =
    (yAbstract instanceof YArray || yAbstract instanceof YMap) &&
    !Boxed.is(yAbstract);
  if (!shared) return createYProxy<Data>(yAbstract, { onChange, scope });
  let tree = sharedTrees.get(yAbstract);
  if (!tree || tree.released) {
    tree = new SharedPropTree();
    sharedTrees.set(yAbstract, tree);
  }
  scope.track(tree.listen(scope, onChange));
  return createYProxy<Data>(yAbstract, tree.options as ProxyOptions<Data>);
}
