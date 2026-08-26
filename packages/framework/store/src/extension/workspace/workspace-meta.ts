import type { Subject } from 'rxjs';

export type Tag = {
  id: string;
  value: string;
  color: string;
};
export type DocsPropertiesMeta = {
  tags?: {
    options: Tag[];
  };
};
export interface DocMeta {
  id: string;
  title: string;
  tags: string[];
  createDate: number;
  updatedDate?: number;
  favorite?: boolean;
  /**
   * Set by the host when the doc sits in its trash. The doc is still in the
   * workspace — it loads and round-trips as usual — but references to it
   * (linked-doc and synced-doc cards) render as deleted.
   *
   * Optional and absent from documents written before it existed: the meta map
   * is stored key by key, so an older document simply reads `undefined` here
   * and an older reader ignores the key.
   */
  trash?: boolean;
}

export interface WorkspaceMeta {
  get docMetas(): DocMeta[];

  addDocMeta(props: DocMeta, index?: number): void;
  getDocMeta(id: string): DocMeta | undefined;
  setDocMeta(id: string, props: Partial<DocMeta>): void;
  removeDocMeta(id: string): void;

  get properties(): DocsPropertiesMeta;
  setProperties(meta: DocsPropertiesMeta): void;

  get docs(): unknown[] | undefined;
  initialize(): void;

  docMetaAdded: Subject<string>;
  docMetaRemoved: Subject<string>;
  docMetaUpdated: Subject<void>;
}
