import { FrameworkBackgroundElementModel } from '@labre/affine-model';
import { DisposableGroup } from '@labre/global/disposable';
import { Bound } from '@labre/global/gfx';
import {
  generateKeyBetween,
  type GfxController,
  GfxExtension,
  type GfxModel,
  type GfxPrimitiveElementModel,
} from '@labre/std/gfx';

/**
 * One already-placed element, as {@link indexOverBackgrounds} needs to read it.
 *
 * Three fields and no model, so the placement can be reasoned about — and
 * tested — without a document: what it is, where it is, and how deep. Blocks
 * and canvas elements both reduce to this, which is what lets a frame (a
 * block) and a Wardley zone (a canvas element) share one answer.
 */
export interface StackedElement {
  /** Fractional index. Sorts lexicographically, which IS the paint order. */
  index: string;
  /** Serialized box. */
  xywh: string;
  /** Whether this is a framework BACKGROUND — a map, a pool, a C4 board… */
  isBackground: boolean;
}

/**
 * How deep something drawn ON a framework board goes: just ABOVE the
 * backgrounds it covers, and below everything else. `null` means the back of
 * the surface.
 *
 * "The back" alone was the first answer and it was wrong, as the recette of
 * #213 found: a Wardley map is a framework BACKGROUND — an opaque one — so an
 * element sent behind the whole surface went behind the map and vanished. What
 * it must be under is the artefacts it groups; what it must be over is the
 * canvas they are drawn on. Those are two different depths, and only the first
 * one is "the back".
 *
 * So: find the topmost background the box actually OVERLAPS — the map it was
 * drawn on, and not some other framework's board parked elsewhere on the same
 * canvas — and mint a key between it and whatever sits directly above it. With
 * no background under it at all there is nothing to clear, and the back of the
 * surface is right again.
 *
 * Two callers want exactly this depth, for the same reason. A Wardley zone is
 * a wash over the components it names, so it is lowered — but not past the map
 * (#213). A frame is a container that renders behind everything it owns, so it
 * too is lowered — and it too vanished under the map. Same problem, same
 * answer, one function.
 *
 * `siblings` need not be sorted: fractional indexes sort lexicographically, so
 * this sorts them itself and reads the paint order straight off the strings.
 */
export function indexOverBackgrounds(
  siblings: readonly StackedElement[],
  box: Bound
): string | null {
  const stack = [...siblings].sort((a, b) =>
    a.index < b.index ? -1 : a.index > b.index ? 1 : 0
  );
  // The LAST match, which is the topmost: a board with two maps on it gets the
  // element above the one it is actually drawn over, whichever was drawn first.
  const under = stack.reduce(
    (found, element, at) =>
      element.isBackground &&
      Bound.deserialize(element.xywh).isOverlapWithBound(box)
        ? at
        : found,
    -1
  );
  if (under < 0) return null;
  // `null` for the upper bound when the background is the topmost element
  // there is — `generateKeyBetween` reads that as "append after".
  return generateKeyBetween(
    stack[under].index,
    stack[under + 1]?.index ?? null
  );
}

/**
 * Where a top-level element belongs in the stack, once the rule "a framework
 * background is a FLOOR, never a lid" is applied. `null` means "leave it
 * alone".
 *
 * ## The rule
 *
 * A background is the canvas the user draws ON. It must therefore stay under
 * everything that overlaps it, and boards must still be able to overlap each
 * other — a board dropped on a board is a cross-reading, not a mistake. Two
 * cases, and they are the same sentence read from either side:
 *
 * 1. `element` is NOT a background — a shape, a node, a foreign framework's
 *    artefact. If a background it overlaps sits ABOVE it, it has been buried:
 *    raise it just above that background ({@link indexOverBackgrounds}), which
 *    is still below every artefact already drawn there. Otherwise nothing.
 * 2. `element` IS a background. If another background it overlaps sits above
 *    it, the same raise applies — superposed boards stack in the order they
 *    were placed, each still under its own artefacts — unless it ENCLOSES that
 *    background, in which case it is the sheet the other is drawn on and stays
 *    under it ({@link encloses}). Otherwise, if it covers an artefact it
 *    overlaps, it is acting as a lid: lower it to just above the floor it lies
 *    on, or to the back of the surface when it lies on bare canvas. Otherwise
 *    nothing.
 *
 * `siblings` are the OTHER top-level elements of the surface — canvas elements
 * and blocks alike, since the surface paints both by index — with `element`
 * itself removed. Nested elements are left out by the caller: a group's child
 * is ordered by its ancestor's index, so moving it would change nothing.
 *
 * ## Idempotence, which is what makes undo safe
 *
 * The function never returns the index the element already has, so a second
 * call about the same element on an unchanged board answers `null`: the rule
 * has a fixed point and reaches it in one step. It answers about the element
 * the user just placed or moved, and about that one only — which is what makes
 * two superposed boards settle in the order the gestures happened rather than
 * in some order the surface would have to arbitrate.
 *
 * That is the whole undo/redo argument, and it restates the frame manager's
 * (`_watchFrameMoved`, #223): an index restored by undo is one the rule had
 * already accepted when it was written, so replaying the rule over a restored
 * state writes nothing — no corrupted depth, and no extra entry pushed onto
 * the history stack.
 */
export function stackingIndexFor(
  element: StackedElement,
  siblings: readonly StackedElement[]
): string | null {
  const box = Bound.deserialize(element.xywh);
  const overlapping = siblings.filter(sibling =>
    Bound.deserialize(sibling.xywh).isOverlapWithBound(box)
  );

  const buried = overlapping.some(
    sibling =>
      sibling.isBackground &&
      sibling.index > element.index &&
      !encloses(element, box, sibling)
  );
  const lidding =
    element.isBackground &&
    overlapping.some(
      sibling => !sibling.isBackground && sibling.index < element.index
    );

  const next = buried
    ? indexOverBackgrounds(siblings, box)
    : lidding
      ? // Down to the floor it lies on, or to the back of the surface when
        // there is none — the depth `createWardleyArea` mints by hand.
        (indexOverBackgrounds(siblings, box) ?? backOf(siblings))
      : null;

  return next === element.index ? null : next;
}

/**
 * Whether `element` is the SHEET `sibling` is drawn on — a background that
 * strictly encloses another background.
 *
 * The carve-out the "superposed boards" clause needs, and the recette of
 * 2026-09-15 is what named it: a UML diagram frame holds inner backgrounds of
 * its own — a use case subject (§18.1.4), an activity partition (§15.6.4), a
 * composite state (§14.2.4), a combined fragment (§17.6.4) — and a C4 board
 * holds boundaries. Every one of them is drawn INSIDE the sheet and therefore
 * above it, which made the sheet permanently "buried" under its own content:
 * moving or resizing it raised it just above the topmost background it
 * overlapped, and when that background was the topmost element of the stack the
 * opaque sheet went to the very front and hid everything drawn on it.
 *
 * Two superposed PEER boards are a different gesture and keep the old answer.
 * The discriminator is containment and not mere overlap: a sheet is bigger than
 * what is drawn on it, so `element` is its floor only when it wholly encloses
 * it AND covers more ground than it. Equal boxes — two boards dropped on the
 * same spot — enclose each other, which is no statement at all, so they are
 * peers and the raise still applies.
 */
function encloses(
  element: StackedElement,
  box: Bound,
  sibling: StackedElement
): boolean {
  if (!element.isBackground) return false;
  const inner = Bound.deserialize(sibling.xywh);
  return box.contains(inner) && inner.w * inner.h < box.w * box.h;
}

/** A key below every sibling: the back of the surface. */
function backOf(siblings: readonly StackedElement[]): string | null {
  const lowest = siblings.reduce<string | null>(
    (min, sibling) =>
      min === null || sibling.index < min ? sibling.index : min,
    null
  );
  return lowest === null ? null : generateKeyBetween(null, lowest);
}

/**
 * The top-level elements of a surface as {@link StackedElement}s — blocks as
 * well as canvas elements, since the surface paints both by index — minus the
 * one being placed.
 *
 * Read off `gfx.layer.layers` because that is the list the canvas draws from,
 * and shared because both callers of the depth rules need exactly this list:
 * the frame manager (#223) and {@link BackgroundStackingExtension}.
 */
export function stackedElementsOf(
  gfx: GfxController,
  exclude?: GfxModel
): StackedElement[] {
  return gfx.layer.layers.reduce<StackedElement[]>(
    (all, layer) =>
      all.concat(
        layer.elements
          .filter(element => element.group === null && element !== exclude)
          .map(element => ({
            index: element.index,
            xywh: element.xywh,
            isBackground: element instanceof FrameworkBackgroundElementModel,
          }))
      ),
    []
  );
}

/**
 * Keeps {@link stackingIndexFor}'s rule true on a live surface: a framework
 * background is a floor, never a lid — whatever framework it belongs to, and
 * whichever of the two elements arrived first.
 *
 * ENGINE behaviour, not tooling, so it is registered unconditionally: a board
 * whose framework flag is off still has to sit under what the user drops on it
 * (`docs/adr/0009`).
 *
 * Two gestures produce a wrong depth, and they are the two this listens for:
 * an element CREATED (every creation site mints the top of the stack, so a
 * board drawn last covers what it was drawn around) and an element MOVED (onto
 * a board that is above it, or over free elements it then hides). Anything
 * else — a resize, a colour, a rename — cannot change who covers whom.
 *
 * Frames are BLOCKS: their own two gestures are already handled, at creation
 * by `frameIndexAt` and on a move by `_watchFrameMoved` (#223), so this never
 * writes a frame's index. They are read as siblings all the same — a board
 * lowered under a frame must go under the frame.
 *
 * A remote change is ignored: the client that made it ran this same rule and
 * synced the index it decided on. Applying it again here would be a second
 * writer for one gesture.
 */
export class BackgroundStackingExtension extends GfxExtension {
  static override key = 'background-stacking';

  private readonly _disposable = new DisposableGroup();

  constructor(gfx: GfxController) {
    super(gfx);

    const surface = gfx.surface;
    if (!surface) return;

    this._disposable.add(
      surface.elementAdded.subscribe(({ id, local }) => {
        if (local) this._restack(surface.getElementById(id));
      })
    );
    this._disposable.add(
      surface.elementUpdated.subscribe(({ id, props, local }) => {
        if (local && props['xywh']) this._restack(surface.getElementById(id));
      })
    );
  }

  private _restack(model: GfxPrimitiveElementModel | null) {
    // A nested element is ordered by its ancestor's index — `compare` reads
    // that and ignores the child's own, so restacking it would change nothing.
    if (!model || model.group !== null) return;

    const index = stackingIndexFor(
      {
        index: model.index,
        xywh: model.xywh,
        isBackground: model instanceof FrameworkBackgroundElementModel,
      },
      stackedElementsOf(this.gfx, model)
    );
    if (index !== null) this.gfx.updateElement(model, { index });
  }

  override unmounted(): void {
    this._disposable.dispose();
  }
}
