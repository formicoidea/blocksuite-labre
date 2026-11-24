import type {
  Doc,
  ExtensionType,
  GetStoreOptions,
  RemoveStoreOptions,
} from '../extension';
import { DocIdentifier } from '../extension/workspace';
import { type Query, Store } from './store';

export class StoreContainer {
  private readonly _storeMap = new Map<string, Store>();

  constructor(readonly doc: Doc) {}

  getStore = ({
    readonly,
    query,
    provider,
    extensions,
    id,
  }: GetStoreOptions = {}) => {
    const key =
      this._keyOf({ readonly, query, id }) ?? this.doc.workspace.idGenerator();

    if (this._storeMap.has(key)) {
      return this._storeMap.get(key) as Store;
    }

    const storeExtension: ExtensionType = {
      setup: di => {
        di.addImpl(DocIdentifier, () => this.doc);
      },
    };

    const store: Store = new Store({
      doc: this.doc,
      readonly,
      query,
      provider,
      extensions: [storeExtension].concat(extensions ?? []),
      // A disposed store is forgotten under the key it was built with, so
      // the next `getStore()` with the same options builds a new one from
      // Yjs (#746, ADR 0057). Only that store: a newer one under the same key
      // (built after an explicit `removeStore`) stays.
      onDispose: () => {
        if (this._storeMap.get(key) === store) this._storeMap.delete(key);
      },
    });

    this._storeMap.set(key, store);

    return store;
  };

  /**
   * Forget a store without disposing of it: the next `getStore()` with the
   * same options builds a new one, and this one stays live for whoever holds
   * it. Idempotent. Closing a document is `store.dispose()`, which already
   * forgets the store (ADR 0057).
   */
  removeStore = ({ readonly, query, id }: RemoveStoreOptions) => {
    const key = this._keyOf({ readonly, query, id });
    if (key === null) return;
    this._storeMap.delete(key);
  };

  /**
   * The key a store is cached under, the same for `getStore` and
   * `removeStore`; `null` when the options name none (only a direct
   * container call without an id: `doc.getStore()` always passes the
   * sub-document's guid).
   *
   * `readonly: false` with neither a query nor an id is keyed like
   * `readonly: true` (`{ readonlyKey: 'false' }`): it used to mint a random
   * key per call, a new store each time that `removeStore` could not name
   * (#746, ADR 0057, part 2). It stays distinct from the default store,
   * whose key is the guid: toggling the default store's local `readonly`
   * must not reach it (`doc.unit.spec.ts`, "local readonly"). An `id`
   * still wins over `readonly: false`, as before.
   */
  private _keyOf({ readonly, query, id }: RemoveStoreOptions): string | null {
    if (readonly || query) return this._getQueryKey({ readonly, query });
    if (id) return id;
    if (readonly === false) return this._getQueryKey({ readonly, query });
    return null;
  }

  private readonly _getQueryKey = (
    idOrOptions: string | { readonly?: boolean; query?: Query }
  ) => {
    if (typeof idOrOptions === 'string') {
      return idOrOptions;
    }
    const { readonly, query } = idOrOptions;
    const readonlyKey = this._getReadonlyKey(readonly);
    const key = JSON.stringify({
      readonlyKey,
      query,
    });
    return key;
  };

  private _getReadonlyKey(readonly?: boolean): 'true' | 'false' {
    return (readonly?.toString() as 'true' | 'false') ?? 'false';
  }
}
