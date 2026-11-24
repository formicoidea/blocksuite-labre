import type { BlockMeta } from '@labre/affine-model';
import { type BlockModel, StoreExtension } from '@labre/store';
import type { Subscription } from 'rxjs';
import { filter, groupBy, mergeMap, throttleTime } from 'rxjs/operators';

import { FeatureFlagService } from './feature-flag-service';
import { WriterInfoProvider } from './user-service';

// 30 seconds
const BLOCK_META_THROTTLE_TIME = 30 * 1000;

/**
 * The service is used to add following info to the block.
 * - createdAt: The time when the block is created.
 * - createdBy: The user who created the block.
 * - updatedAt: The time when the block is updated.
 * - updatedBy: The user who updated the block.
 */
export class BlockMetaService extends StoreExtension {
  static override key = 'affine-block-meta-service';

  get isBlockMetaEnabled() {
    const flagService = this.store.get(FeatureFlagService);
    return flagService.getFlag('enable_block_meta') === true;
  }

  /**
   * The throttled meta writer, one per store however often `load()` runs
   * (it runs `loaded()` each time), ended by `disposed()`. Its 30 s window
   * drops later events, it defers none (rxjs `throttleTime` defaults to
   * leading edge only): ending it loses no meta, and frees the store at once
   * instead of when the window of its last local edit closes (#746, ADR
   * 0057, Context 2).
   */
  private _subscription: Subscription | null = null;

  override disposed() {
    super.disposed();
    this._subscription?.unsubscribe();
    this._subscription = null;
  }

  override loaded() {
    if (this._subscription) return;
    this._subscription = this.store.slots.blockUpdated
      .pipe(
        filter(payload => payload.isLocal),
        groupBy(payload => `${payload.type}-${payload.id}`),
        mergeMap(group => group.pipe(throttleTime(BLOCK_META_THROTTLE_TIME)))
      )
      .subscribe(payload => {
        const { type, id } = payload;
        if (!this.isBlockMetaEnabled) return;

        const model = this.store.getBlock(id)?.model;
        if (!model) return;

        if (type === 'add') {
          return this._onBlockCreated(model);
        }

        if (type === 'update') {
          return this._onBlockUpdated(model);
        }
      });
  }

  private readonly _onBlockCreated = (model: BlockModel<BlockMeta>): void => {
    if (!isBlockMetaSupported(model)) {
      return;
    }

    const writer = this._getWriterInfo();
    if (!writer) return;
    const now = getNow();

    this.store.withoutTransact(() => {
      model.props['meta:createdAt'] = now;
      model.props['meta:createdBy'] = writer.id;
    });
  };

  private readonly _onBlockUpdated = (model: BlockModel<BlockMeta>): void => {
    if (!isBlockMetaSupported(model)) {
      return;
    }

    const writer = this._getWriterInfo();
    if (!writer) return;
    const now = getNow();

    this.store.withoutTransact(() => {
      model.props['meta:updatedAt'] = now;
      model.props['meta:updatedBy'] = writer.id;
      if (!model.props['meta:createdAt']) {
        model.props['meta:createdAt'] = now;
      }
      if (!model.props['meta:createdBy']) {
        model.props['meta:createdBy'] = writer.id;
      }
    });
  };

  private readonly _getWriterInfo = () => {
    return this.store.getOptional(WriterInfoProvider)?.getWriterInfo();
  };
}

function isBlockMetaSupported(model: BlockModel) {
  return [
    'meta:createdAt',
    'meta:createdBy',
    'meta:updatedAt',
    'meta:updatedBy',
  ].every(key => model.keys.includes(key));
}

function getNow() {
  return Date.now();
}
