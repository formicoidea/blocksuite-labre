import type { UmlNodeKind } from '@labre/affine-model';
import { Bound, type SerializedXYWH, type XYWH } from '@labre/global/gfx';

import {
  type UmlBox,
  umlCompartmentBoxes,
  type UmlComponentGroup,
  umlComponentSiblings,
  umlGroupOf,
  umlStackHeight,
  UML_TIER_SIDE_INSET,
  type UmlTierLines,
  umlTierLineCount,
} from '../component.js';
import { type UmlTierFace, umlTierWrapper } from './tier-metrics.js';

/**
 * The little a fit needs of a canvas TEXT element.
 *
 * Structural, and not `TextElementModel`, for the reason `component.ts` states
 * about `UmlComponentElement`: what is read here is an id, a role, a face,
 * whatever the tier says and where it is — facts a fixture can state as plainly
 * as a model can, which is what lets the decision below be tested without a Yjs
 * document standing behind every box.
 */
export interface UmlTierElement extends UmlTierFace {
  id: string;
  type: string;
  role?: string;
  text?: unknown;
  xywh: SerializedXYWH;
  isLocked(): boolean;
}

/** …and of the SHAPE those words are about. */
export interface UmlNodeShape {
  id: string;
  type: string;
  kind: UmlNodeKind;
  xywh: SerializedXYWH;
  deserializedXYWH: XYWH;
  isLocked(): boolean;
}

/** The surface a fit reads its elements off and writes its boxes back to. */
export interface UmlFitSurface {
  elementModels: readonly unknown[];
  getElementById(id: string): unknown;
}

/**
 * …and the store it writes THROUGH.
 *
 * Passed beside the surface rather than read off it because the two callers hold
 * it differently — the watcher has `std.store`, the morph has the element's own
 * `surface.store` — and because it is the whole of what a fit does to a
 * document: one checkpoint, one transaction.
 */
export interface UmlFitStore {
  readonly: boolean;
  captureSync(): void;
  transact(fn: () => void): void;
}

/**
 * Re-fit the classifier a member belongs to: grow the node to the stack its
 * tiers now need, and put the tiers into the compartments that height yields.
 *
 * ## One function, two callers, and why they are the same act
 *
 * `UmlCompartmentWatcher` calls it when an edit commits — the author typed a
 * fourth attribute line and the box has to grow. `rewriteName` (`morph.ts`)
 * calls it when a morph writes a KEYWORD LINE into the name compartment, which
 * is the same overflow arriving by a different hand: morphing a class called
 * `Ligne` to an interface turns one name line into two (`«interface»` over the
 * name, §9.5.4) and, until the PO's recette of 14/09/2026, nothing re-laid the
 * component — so the second line was painted straight through the rule under it.
 *
 * ## It grows, and never shrinks
 *
 * A box an author has dragged taller has dragged it taller FOR the operations
 * (`component.ts`), and §11.4.4 hands the bottom compartment whatever is left on
 * purpose — an author leaves themselves room to type. A fit that reclaimed it
 * the moment a line was deleted would be undoing a gesture nobody asked it to
 * judge. So the height only ever goes UP; deleting lines moves the separators up
 * (the tiers are re-laid either way) and leaves the box where it was put.
 *
 * Every early return is a case where there is nothing honest to do, and writing
 * nothing is the answer to all of them: a read-only document, a tier whose group
 * was released, a group with no shape in it, a shape that is a picture rather
 * than a divided box, a locked component, and — the common one — a stack that
 * already fits, which is what every edit that did not change the painted line
 * count produces.
 *
 * @param capture whether to open the fit's OWN undo entry. The watcher does
 * (the layout is a consequence of an edit that has already been captured); the
 * morph does not, because its re-layout belongs in the same single ctrl+z as the
 * kind that made it necessary.
 */
export function umlFitComponent(
  surface: UmlFitSurface,
  store: UmlFitStore,
  memberId: string,
  { capture = true }: { capture?: boolean } = {}
): void {
  // A read-only document is READ: every write below would be refused, and
  // nobody can have typed the line that would need one.
  if (store.readonly) return;

  const element = (id: string) =>
    (surface.getElementById(id) ?? null) as
      | (UmlTierElement & UmlNodeShape)
      | null;

  const groups = (surface.elementModels as { type: string }[]).filter(
    model => model.type === 'group'
  ) as unknown as UmlComponentGroup[];
  const group = umlGroupOf(memberId, groups);
  if (!group) return;

  // The same pure resolution the exporter and the node view use — group
  // membership, then roles — so the tiers moved here are the tiers the file
  // comes out with.
  const component = umlComponentSiblings(
    group,
    surface.elementModels as { id: string; role?: string }[]
  );
  const node = component.node && element(component.node.id);
  if (!node || node.type !== 'umlNode') return;
  // `isLocked` walks the ancestors too, so this covers a locked GROUP as well
  // as a locked shape — the two ways a reviewer freezes a component.
  if (node.isLocked()) return;

  const { kind } = node;
  const [x, y, w, h] = node.deserializedXYWH;
  // The width the tiers will be laid out at, which is the width their words are
  // WRAPPED at — never the box a tier happens to wear right now, because the
  // text editor shrink-wraps the element it is mounted on while the author
  // types.
  const tierWidth = w - w * UML_TIER_SIDE_INSET * 2;
  const lines = (member: { id: string } | undefined): number | undefined => {
    if (!member) return undefined;
    const tier = element(member.id);
    if (!tier || tier.type !== 'text') return undefined;
    return umlTierLineCount(tier.text, umlTierWrapper(tier, tierWidth));
  };

  const tiers: UmlTierLines = {
    name: lines(component.name),
    attributes: lines(component.attributes),
    operations: lines(component.operations),
  };
  const required = umlStackHeight(kind, tiers);
  // A picture, not a divided box: an actor's label has no stack to overflow,
  // and there is no height at which a stick figure "fits" its name.
  if (required === null) return;

  const height = Math.max(h, required);
  const boxes = umlCompartmentBoxes(kind, x, y, w, height, tiers);

  // Which tier goes in which box. `undefined` on either side is a component
  // somebody took apart by hand, and it is simply skipped.
  const moves: [string | undefined, UmlBox | undefined][] = [
    [component.name?.id, boxes.name],
    [component.attributes?.id, boxes.attributes],
    [component.operations?.id, boxes.operations],
  ];

  const writes: (() => void)[] = [];
  if (height !== h) {
    const xywh = new Bound(x, y, w, height).serialize();
    writes.push(() => (node.xywh = xywh));
  }
  for (const [id, box] of moves) {
    if (!id || !box) continue;
    const tier = element(id);
    if (!tier || tier.type !== 'text' || tier.isLocked()) continue;
    const xywh = new Bound(box.x, box.y, box.w, box.h).serialize();
    if (tier.xywh === xywh) continue;
    writes.push(() => (tier.xywh = xywh));
  }

  // Nothing grew and nothing moved: the stack already fits, which is what most
  // edits produce. An unchanged write would push an empty undo entry and cost
  // the author a ctrl-Z for nothing.
  if (writes.length === 0) return;

  // Its OWN undo entry when the caller asks for one, deliberately. The
  // alternative — letting the writes merge into whatever the author last typed
  // — makes the entry's contents depend on how long they paused before clicking
  // away, and a layout that sometimes comes back with the words and sometimes
  // does not is worse than one that always behaves the same.
  if (capture) store.captureSync();
  // ONE transaction, so the growth and every move are ONE undo entry: an author
  // who undoes it gets the whole layout back, rather than walking it back a tier
  // at a time past a broken picture at every stop.
  store.transact(() => {
    for (const write of writes) write();
  });
}
