import { createIdentifier } from '@labre/global/di';
import type { Observable } from 'rxjs';
import type * as Y from 'yjs';

import type { Store, StoreOptions, YBlock } from '../../model';
import type { AwarenessStore } from '../../yjs';
import type { Workspace } from './workspace.js';
import type { DocMeta } from './workspace-meta.js';

export type GetStoreOptions = Omit<StoreOptions, 'schema' | 'doc'>;
export type RemoveStoreOptions = Pick<
  StoreOptions,
  'query' | 'id' | 'readonly'
>;

export interface Doc {
  readonly id: string;
  get meta(): DocMeta | undefined;

  remove(): void;
  load(initFn?: () => void): void;
  get ready(): boolean;
  dispose(): void;

  clear(): void;
  getStore(options?: GetStoreOptions): Store;
  removeStore(options: RemoveStoreOptions): void;

  /**
   * The default store (`getStore()`) if one is open; never builds one
   * (ADR 0057).
   */
  get defaultStore(): Store | null;

  /**
   * The default store each time one is built, and `null` when it is
   * released (`store.dispose()`) or removed (ADR 0057). Code of another
   * document that follows this one listens here and never keeps a released
   * store.
   */
  get defaultStoreChanged(): Observable<Store | null>;

  get loaded(): boolean;
  get awarenessStore(): AwarenessStore;

  get workspace(): Workspace;

  get rootDoc(): Y.Doc;
  get spaceDoc(): Y.Doc;
  get yBlocks(): Y.Map<YBlock>;
}

export const DocIdentifier = createIdentifier<Doc>('store-doc');
