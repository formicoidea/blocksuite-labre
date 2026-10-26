import { type Container, createIdentifier } from '@labre/global/di';
import { BlockSuiteError } from '@labre/global/exceptions';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import { type BlockSnapshot, Extension, type Store } from '@labre/store';

import { getSurfaceComponent } from '../utils/get-surface-block';
import { EdgelessCRUDIdentifier } from './crud-extension';
import { applyCreationLayer } from './user-layers/creation.js';

export type ClipboardConfigCreationContext = {
  /**
   * element old id to new id
   */
  oldToNewIdMap: Map<string, string>;
  /**
   * element old id to new layer index
   */
  originalIndexes: Map<string, string>;

  /**
   * frame old id to new presentation index
   */
  newPresentationIndexes: Map<string, string>;
};

/**
 * A block a paste is ready to write (`EdgelessClipboardConfig.prepare`).
 * `write` is synchronous for a config that follows the contract; a Promise is
 * the legacy `createBlock` behind the default `prepare`.
 */
export interface PreparedClipboardBlock {
  write(): string | null | Promise<string | null>;
  afterWrite?(): void;
}

export const EdgelessClipboardConfigIdentifier =
  createIdentifier<EdgelessClipboardConfig>('edgeless-clipboard-config');

export abstract class EdgelessClipboardConfig extends Extension {
  static key: string;

  constructor(readonly std: BlockStdScope) {
    super();
  }

  get surface() {
    return getSurfaceComponent(this.std);
  }

  get crud() {
    return this.std.get(EdgelessCRUDIdentifier);
  }

  onBlockSnapshotPaste = async (
    snapshot: BlockSnapshot,
    doc: Store,
    parent?: string,
    index?: number
  ) => {
    // The clipboard's block path follows the elements' rule (ADR 0031 §6):
    // a layer of this surface is kept, anything else lands in the active one.
    applyCreationLayer(this.std, snapshot.props);
    const block = await this.std.clipboard.pasteBlockSnapshot(
      snapshot,
      doc,
      parent,
      index
    );
    return block?.id ?? null;
  };

  /**
   * `onBlockSnapshotPaste` in two halves, for `prepare`: the snapshot is
   * converted now, the blocks are written by `write`, and the import
   * middlewares run in `afterWrite`.
   */
  prepareBlockSnapshotPaste = async (
    snapshot: BlockSnapshot,
    doc: Store,
    parent?: string,
    index?: number
  ): Promise<PreparedClipboardBlock | null> => {
    applyCreationLayer(this.std, snapshot.props);
    const prepared = await this.std.clipboard.prepareBlockSnapshot(
      snapshot,
      parent,
      index
    );
    if (!prepared) return null;

    let flush: (() => unknown) | undefined;
    return {
      write: () => {
        const inserted = prepared.insert(doc);
        flush = inserted?.flushAfterImport;
        return inserted?.id ?? null;
      },
      afterWrite: () => flush?.(),
    };
  };

  abstract createBlock(
    snapshot: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ): string | null | Promise<string | null>;

  /**
   * The paste's two-phase contract (ADR 0042): everything slow (a blob fetch,
   * a snapshot conversion) happens here and writes nothing; the returned
   * `write` adds the block synchronously, because the paste calls every
   * block's `write` and creates every canvas element in ONE transaction, which
   * is one undo step and one update for a peer. `afterWrite` runs in the
   * paste's second transaction, once every pasted model exists.
   *
   * The default defers to `createBlock`, so a config written before the
   * contract keeps working; an async `createBlock` then still writes after
   * the paste's transaction and may cost its own undo step.
   */
  prepare(
    snapshot: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ): PreparedClipboardBlock | null | Promise<PreparedClipboardBlock | null> {
    return { write: () => this.createBlock(snapshot, context) };
  }

  /**
   * `createBlock` for a config that implements `prepare`: prepares, then
   * writes in one transaction of its own.
   */
  protected async createPreparedBlock(
    snapshot: BlockSnapshot,
    context: ClipboardConfigCreationContext
  ): Promise<string | null> {
    const prepared = await this.prepare(snapshot, context);
    if (!prepared) return null;
    const result: { id: string | null | Promise<string | null> } = {
      id: null,
    };
    this.std.store.transact(() => {
      result.id = prepared.write();
    });
    const id = await result.id;
    prepared.afterWrite?.();
    return id;
  }

  static override setup(di: Container) {
    if (!this.key) {
      throw new BlockSuiteError(
        BlockSuiteError.ErrorCode.ValueNotExists,
        'Key is not defined in the EdgelessClipboardConfig'
      );
    }

    di.add(
      this as unknown as { new (std: BlockStdScope): EdgelessClipboardConfig },
      [StdIdentifier]
    );

    di.addImpl(EdgelessClipboardConfigIdentifier(this.key), provider =>
      provider.get(this)
    );
  }
}
