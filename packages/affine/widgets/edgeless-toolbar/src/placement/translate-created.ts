import {
  EdgelessCRUDIdentifier,
  updateXYWH,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxController, GfxModel } from '@labre/std/gfx';

/**
 * Run `body` and report the ids of everything it put on the board — canvas
 * elements and canvas blocks alike.
 *
 * Both subscriptions are synchronous: a Yjs observer fires when the transaction
 * commits, inside the `addElement` / `addBlock` call, so an action that creates
 * on the spot is fully accounted for by the time `body` returns. An action that
 * creates from a promise is NOT, and its artefact is left where the command put
 * it — which is today's behaviour for every command, so nothing regresses.
 */
export function collectCreated(gfx: GfxController, body: () => void): string[] {
  const ids: string[] = [];
  const subscriptions = [
    gfx.surface?.elementAdded.subscribe(({ id }) => {
      ids.push(id);
    }),
    gfx.std.store.slots.blockUpdated.subscribe(payload => {
      if (payload.type === 'add') ids.push(payload.id);
    }),
  ];

  try {
    body();
  } finally {
    subscriptions.forEach(subscription => subscription?.unsubscribe());
  }

  return ids;
}

/**
 * Move a freshly created drawing by `(dx, dy)`, and report what is left to
 * select.
 *
 * Only the TOP-LEVEL items move. An element the same run filed inside a group
 * it also created is carried by that group, and moving it twice would tear the
 * drawing apart. A group is moved through its children — `GfxGroupLikeElement`'s
 * `xywh` setter is a deliberate no-op, its box being derived from what it holds
 * — which is exactly what {@link updateXYWH} does, along with a connector's free
 * endpoints (an anchored one simply follows what it is tied to) and a note's
 * collapsed height. Hence no second opinion here.
 */
export function translateCreated(
  gfx: GfxController,
  ids: string[],
  dx: number,
  dy: number
): string[] {
  const created = new Set(ids);
  const models = ids
    .map(id => gfx.getElementById<GfxModel>(id))
    .filter((model): model is GfxModel => !!model && 'xywh' in model);

  const top = models.filter(
    model => !model.group || !created.has(model.group.id)
  );

  if (dx !== 0 || dy !== 0) {
    const updateElement = gfx.std.get(EdgelessCRUDIdentifier).updateElement;
    // Wrapped, not handed over: `Store.updateBlock` is a prototype method that
    // reads `this.readonly` and `this._crud`. `updateXYWH` happens to re-bind it
    // (`updateBlock.call(ele.store, …)`), so today nothing breaks — but an
    // unbound method sitting in a variable is a landmine that reads correct, and
    // the day that `.call` becomes a plain call the first canvas block placed
    // would throw on `readonly` of undefined.
    const updateBlock: typeof gfx.std.store.updateBlock = (model, props) =>
      gfx.std.store.updateBlock(model, props);
    for (const model of top) {
      const bound = Bound.deserialize(model.xywh);
      bound.x += dx;
      bound.y += dy;
      updateXYWH(model, bound, updateElement, updateBlock);
    }
  }

  return top.map(model => model.id);
}
