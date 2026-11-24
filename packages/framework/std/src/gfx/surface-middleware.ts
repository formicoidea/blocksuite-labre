import { type Container, createIdentifier } from '@labre/global/di';
import { BlockSuiteError, ErrorCode } from '@labre/global/exceptions';
import { Extension } from '@labre/store';

import { LifeCycleWatcher } from '../extension/lifecycle-watcher.js';
import { StdIdentifier } from '../identifier.js';
import type { BlockStdScope } from '../scope/std-scope.js';
import { onSurfaceAdded } from '../utils/gfx.js';
import { GfxControllerIdentifier } from './identifiers.js';
import type { SurfaceMiddleware } from './model/surface/surface-model.js';

export abstract class SurfaceMiddlewareBuilder extends Extension {
  static key: string = '';

  abstract middleware: SurfaceMiddleware;

  get gfx() {
    return this.std.provider.get(GfxControllerIdentifier);
  }

  constructor(protected std: BlockStdScope) {
    super();
  }

  static override setup(di: Container) {
    if (!this.key) {
      throw new BlockSuiteError(
        ErrorCode.ValueNotExists,
        'The surface middleware builder should have a static key property.'
      );
    }

    di.addImpl(SurfaceMiddlewareBuilderIdentifier(this.key), this, [
      StdIdentifier,
    ]);
  }

  mounted(): void {}

  unmounted(): void {}
}

export const SurfaceMiddlewareBuilderIdentifier =
  createIdentifier<SurfaceMiddlewareBuilder>('SurfaceMiddlewareBuilder');

/**
 * Installs the mounted editor's surface middlewares on the store's surface,
 * and takes them back on unmount: the surface lives as long as the store,
 * and a middleware closes over its editor's std (see
 * `surface-middleware-teardown.unit.spec.ts`).
 */
export class SurfaceMiddlewareExtension extends LifeCycleWatcher {
  static override key: string = 'surfaceMiddleware';

  private _release = () => {};

  override mounted(): void {
    const middlewares = Array.from(
      this.std.provider.getAll(SurfaceMiddlewareBuilderIdentifier).values(),
      builder => builder.middleware
    );

    let restore = () => {};
    const stop = onSurfaceAdded(this.std.store, surface => {
      if (surface) {
        restore = surface.applyMiddlewares(middlewares);
        queueMicrotask(() => stop());
      }
    });
    // A store with no surface yet keeps the effect waiting until unmount.
    this._release = () => {
      stop();
      restore();
    };
  }

  override unmounted(): void {
    this._release();
    this._release = () => {};
  }
}
