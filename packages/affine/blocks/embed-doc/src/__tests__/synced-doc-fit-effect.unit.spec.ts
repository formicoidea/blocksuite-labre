import { describe, expect, it } from 'vitest';

import { EmbedSyncedDocBlockComponent } from '../embed-synced-doc-block/embed-synced-doc-block.js';

/**
 * When the edgeless fit effect is installed, upstream #14019.
 *
 * The fit effect observes the block and refits the nested editor to its
 * content on every resize. It reads the nested viewport's bounding rect, and
 * that rect is cached until the viewport's own resize observer clears it — an
 * observer registered when the nested editor renders. Installing the fit
 * effect first therefore made its observer fire first too, and the first
 * resize after a zoom change fitted to the previous size: a one-time content
 * mismatch inside the block.
 *
 * The effect is now installed from `updated`, and only once the synced view has
 * actually been rendered.
 */

/** The two lifecycle hooks read only these members off the instance. */
function stubComponent() {
  const installs: number[] = [];

  return {
    installs,
    instance: {
      _hasRenderedSyncedView: false,
      _hasInitedFitEffect: false,
      _initEdgelessFitEffect: () => installs.push(1),
      disposables: { addFromEvent: () => {} },
      syncedDocCard: undefined,
    },
  };
}

function firstUpdated(instance: unknown) {
  EmbedSyncedDocBlockComponent.prototype.firstUpdated.call(instance as never);
}

function updated(instance: unknown) {
  EmbedSyncedDocBlockComponent.prototype.updated.call(
    instance as never,
    new Map()
  );
}

describe('embed synced doc fit effect', () => {
  it('is not installed by the first render pass', () => {
    const { installs, instance } = stubComponent();

    firstUpdated(instance);

    expect(installs).toHaveLength(0);
  });

  it('waits for the synced view to have been rendered', () => {
    const { installs, instance } = stubComponent();

    // A card-only or still-loading block renders no nested editor, so there is
    // no viewport to fit to yet.
    updated(instance);

    expect(installs).toHaveLength(0);
  });

  it('is installed once the synced view has rendered, and only once', () => {
    const { installs, instance } = stubComponent();

    instance._hasRenderedSyncedView = true;
    updated(instance);
    updated(instance);

    expect(installs).toHaveLength(1);
  });
});
