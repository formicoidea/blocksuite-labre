import type { SerializedXYWH } from '@labre/global/gfx';
import { Bound } from '@labre/global/gfx';
import type { GfxViewInteractionConfig } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import { REF_H, REF_W } from '../cynefin/consts';
import { cynefinCroppedXYWH } from '../cynefin/crop';
import { CynefinInteraction } from '../cynefin/element-view';

/**
 * A Cynefin frame crops itself onto its drawing when a resize handle is let go
 * (Notion "Ajuster les bordures des fonds de cartes au plus proche des bords",
 * PO 23/09/2026).
 *
 * What this would have caught: the diagram is a figurative reproduction fitted
 * uniformly into its element, so dragged off its 1080 × 777 proportion it
 * LETTERBOXES — 400 model units of nothing either side at 1600 × 600. A
 * framework background being caught by its border and by nothing else
 * (`model/src/elements/framework-background/hit-test.ts`), the frame the user
 * has to aim at ended up four hundred units from anything drawn, and no amount
 * of care with the margins of the artwork would have moved it.
 */

/**
 * `GfxViewInteractionExtension` hands its config straight to the DI container,
 * so the only way in is to run the extension's `setup` with a container that
 * keeps the factory.
 */
function interactionConfig() {
  let config: GfxViewInteractionConfig | undefined;
  CynefinInteraction.setup?.({
    addImpl: (_identifier: unknown, factory: () => unknown) => {
      config = factory() as GfxViewInteractionConfig;
    },
  } as never);
  if (!config) throw new Error('CynefinInteraction registered no config');
  return config;
}

const xywh = (x: number, y: number, w: number, h: number): SerializedXYWH =>
  `[${x},${y},${w},${h}]`;

/**
 * One resize, played to its end: what the model was written with, and when,
 * against the commit of the stashed `xywh` the manager does last.
 */
function resizeEnd({
  readonly = false,
  box,
  resizeEnabled = true,
}: {
  readonly?: boolean;
  box: SerializedXYWH;
  resizeEnabled?: boolean;
}) {
  const log: string[] = [];
  const model = {
    resizeEnabled,
    _xywh: box,
    get xywh() {
      return this._xywh;
    },
    set xywh(next: SerializedXYWH) {
      log.push(`write ${next}`);
      this._xywh = next;
    },
  };
  const std = { store: { readonly } };
  const handlers = interactionConfig().handleResize!({
    std,
    model,
  } as never);
  const commit = vi.fn(() => log.push('commit'));
  handlers.onResizeEnd!({ default: commit } as never);
  return { log, model, commit };
}

describe('a Cynefin frame cropped onto its drawing', () => {
  it('brings the border back to the picture, centre for centre', () => {
    const cropped = cynefinCroppedXYWH(xywh(0, 0, 1600, 600));
    expect(cropped).not.toBeNull();

    const before = Bound.deserialize(xywh(0, 0, 1600, 600));
    const after = Bound.deserialize(cropped!);
    // The drawing is what it always was: the uniform fit of 1080 × 777 into
    // 1600 × 600, which the height binds.
    const s = 600 / REF_H;
    expect(after.w).toBeCloseTo(REF_W * s, 6);
    expect(after.h).toBeCloseTo(REF_H * s, 6);
    // 383 units of nothing on each side, gone.
    expect(after.x).toBeCloseTo(383.0115, 3);
    expect(after.y).toBeCloseTo(0, 6);
    // Same centre, so a rotated frame does not move either.
    expect(after.center[0]).toBeCloseTo(before.center[0], 6);
    expect(after.center[1]).toBeCloseTo(before.center[1], 6);
  });

  it('says there is nothing to do at the ratio the frame was drawn at', () => {
    expect(cynefinCroppedXYWH(xywh(12, 34, REF_W, REF_H))).toBeNull();
    // And within half a unit of it: below that there is nothing to see, and a
    // write would cost an undo entry for a gesture that changed nothing.
    expect(cynefinCroppedXYWH(xywh(0, 0, REF_W + 0.4, REF_H))).toBeNull();
  });

  it('is idempotent: cropping a cropped frame is a no-op', () => {
    const once = cynefinCroppedXYWH(xywh(0, 0, 700, 900))!;
    expect(once).not.toBeNull();
    expect(cynefinCroppedXYWH(once)).toBeNull();
  });

  it('refuses a degenerate box rather than dividing by zero', () => {
    expect(cynefinCroppedXYWH(xywh(0, 0, 0, 600))).toBeNull();
    expect(cynefinCroppedXYWH(xywh(0, 0, 1600, -1))).toBeNull();
  });
});

describe('the end of a resize gesture', () => {
  it('writes the cropped box, then lets the manager commit it — one step', () => {
    const { log, model } = resizeEnd({ box: xywh(0, 0, 1600, 600) });

    // The order is the whole point: `xywh` is STASHED during the gesture, so
    // writing before the commit changes what is committed instead of adding a
    // second write. One Yjs write, one undo step.
    expect(log).toHaveLength(2);
    expect(log[1]).toBe('commit');
    expect(Bound.deserialize(model.xywh).w).toBeCloseTo(833.9768, 3);
  });

  it('writes nothing at all when the frame is already on its drawing', () => {
    const { log, commit } = resizeEnd({ box: xywh(0, 0, REF_W, REF_H) });
    expect(log).toEqual(['commit']);
    expect(commit).toHaveBeenCalledOnce();
  });

  it('writes nothing in a readonly store, and still commits', () => {
    const { log, model } = resizeEnd({
      readonly: true,
      box: xywh(0, 0, 1600, 600),
    });
    expect(log).toEqual(['commit']);
    expect(model.xywh).toBe(xywh(0, 0, 1600, 600));
  });

  /**
   * The crop is a GESTURE, and the seam is what guarantees it.
   *
   * A cascade watching `xywh` would fire on a peer's resize as well — every
   * screen would re-crop a frame nobody on that screen touched, and each peer
   * would get an undo entry for someone else's drag — and it would fire again
   * on a document being loaded. `handleResize` only ever runs for the hand on
   * the handle, which is why the config carries nothing else.
   */
  it('is attached to the resize gesture and to nothing else', () => {
    const config = interactionConfig();
    expect(Object.keys(config)).toEqual(['handleResize']);
    const handlers = config.handleResize!({
      std: { store: { readonly: false } },
      model: { resizeEnabled: true, xywh: xywh(0, 0, 1600, 600) },
    } as never);
    expect(Object.keys(handlers).sort()).toEqual([
      'beforeResize',
      'onResizeEnd',
    ]);
  });

  it('still hides the handles of a frame whose resize is turned off', () => {
    const config = interactionConfig();
    const handlers = config.handleResize!({
      std: { store: { readonly: false } },
      model: { resizeEnabled: false, xywh: xywh(0, 0, 1600, 600) },
    } as never);
    const set = vi.fn();
    handlers.beforeResize!({ set } as never);
    expect(set).toHaveBeenCalledWith({ allowedHandlers: [] });
  });
});
