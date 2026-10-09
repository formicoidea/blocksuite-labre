import type { BlockStdScope } from '@labre/std';
import { generateKeyBetweenV2, GfxControllerIdentifier } from '@labre/std/gfx';

import { EdgelessFrameManagerIdentifier } from './frame-manager.js';

/**
 * The one write of the frames' PRESENTATION order (ADR 0034): the
 * order a presentation walks the frames in, held by each frame's
 * `presentationIndex` — a fractional key, never a position.
 *
 * Why one function: two sites wrote that order by hand — the frame panel's
 * drag and the presentation toolbar's order menu — each its own way, neither
 * refusing a read-only document, and the panel taking its undo checkpoint
 * AFTER the write, so the reorder merged into whatever gesture came before.
 * Both now reach this through `canvas.frame.reorder`, and so does a host's own
 * slide panel: the guards below live here, once.
 *
 * Mirrors the selection pane's `reorderPaneElement`
 * (`blocks/surface/src/extensions/selection-pane/actions.ts`):
 *
 * - refuses on a read-only document before reading anything else;
 * - writes nothing when nothing would change — an unchanged write is an empty
 *   undo step, and an undo that "does nothing" reads as a broken undo;
 * - takes ONE `captureSync()` first, so one gesture is one undo step, the
 *   legacy keys `refreshLegacyFrameOrder` may write included (it writes in
 *   the same capture window, so it joins the gesture's step);
 * - writes through `gfx.updateElement`, which is `store.updateBlock` for a
 *   frame — not the CRUD `updateElement`, which would also record the moved
 *   frame's props as the flavour's last-used props.
 */

/**
 * Move the frames `ids` so they sit, as one block, directly BEFORE `before` in
 * the presentation order — `null` puts them at the end. The moved frames keep
 * their current relative order, whatever order `ids` lists them in. Answers
 * whether anything was written.
 *
 * Refused, with nothing written: a read-only document; an id that is not a
 * frame of this document; a `before` that is one of the moved frames, or not
 * a frame; and a target that is where the frames already are.
 *
 * Each moved frame gets a key between its new neighbours, so only the moved
 * frames are written and nothing else shifts. Two neighbours with equal (or
 * inverted) keys cannot be split — `generateKeyBetweenV2` throws on them, and
 * the model's default key is random per frame, so a pasted, imported or
 * hand-made document can carry them: refusing beats throwing in a drop.
 */
export function reorderFramePresentation(
  std: BlockStdScope,
  ids: readonly string[],
  before: string | null
): boolean {
  if (std.store.readonly) return false;

  const manager = std.get(EdgelessFrameManagerIdentifier);
  const frames = manager.frames;
  const moving = new Set(ids);
  if (moving.size === 0) return false;
  if (before !== null && moving.has(before)) return false;

  const known = new Set(frames.map(frame => frame.id));
  for (const id of moving) if (!known.has(id)) return false;
  if (before !== null && !known.has(before)) return false;

  // `frames` is already in presentation order, so filtering keeps the moved
  // frames' relative order.
  const moved = frames.filter(frame => moving.has(frame.id));
  const rest = frames.filter(frame => !moving.has(frame.id));
  const position =
    before === null
      ? rest.length
      : rest.findIndex(frame => frame.id === before);
  const target = [
    ...rest.slice(0, position),
    ...moved,
    ...rest.slice(position),
  ];
  if (target.every((frame, i) => frame === frames[i])) return false;

  std.store.captureSync();
  // Gives a key to legacy frames that have none, keeping their order, so the
  // neighbours' keys below mean what the list shows. A no-op on any document
  // where a frame already carries one.
  manager.refreshLegacyFrameOrder();

  const lower = rest[position - 1]?.props.presentationIndex || null;
  const upper = rest[position]?.props.presentationIndex || null;
  if (lower !== null && upper !== null && lower >= upper) return false;

  const gfx = std.get(GfxControllerIdentifier);
  std.store.transact(() => {
    let previous = lower;
    for (const frame of moved) {
      const presentationIndex = generateKeyBetweenV2(previous, upper);
      gfx.updateElement(frame, { presentationIndex });
      previous = presentationIndex;
    }
  });
  return true;
}
