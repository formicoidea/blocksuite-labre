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
    let idOrOptions: string | { readonly?: boolean; query?: Query };
    if (readonly || query) {
      idOrOptions = { readonly, query };
    } else if (!id) {
      idOrOptions = this.doc.workspace.idGenerator();
    } else {
      idOrOptions = id;
    }
    const key = this._getQueryKey(idOrOptions);

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
    let idOrOptions: string | { readonly?: boolean; query?: Query };
    if (readonly || query) {
      idOrOptions = { readonly, query };
    } else if (!id) {
      return;
    } else {
      idOrOptions = id;
    }
    const key = this._getQueryKey(idOrOptions);
    this._storeMap.delete(key);
  };

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
