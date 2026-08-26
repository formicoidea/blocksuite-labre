import type { TranslationService } from '@labre/affine-shared/services';

import type {
  BackgroundLabelSource,
  BackgroundTextDef,
  FrameworkBackgroundDef,
} from './def.js';
import { backgroundPlot, backgroundPoint } from './def.js';

/** A background element, seen from the primitive: a bag of declared props. */
export type BackgroundModelLike = Record<string, unknown>;

/**
 * Complain once per distinct problem.
 *
 * Same shape and same reason as the validation engine's own `warnOnce`: these
 * primitives run on the PAINT path, once per piece of the declaration per
 * frame, so a bare `console.warn` about a broken declaration would fill the
 * console at the refresh rate while somebody drags the frame.
 */
const warned = new Set<string>();

function warnOnce(reason: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`[framework-background] ${reason}`);
}

/**
 * The words a label actually says.
 *
 * The user's own text wins over the vocabulary, and the vocabulary over the
 * shipped default — so a framework can be fully i18n'd while still letting the
 * user rename an axis on the canvas.
 *
 * i18n goes through the house seam (`TranslationProvider` /
 * {@link translateKey}), which the host injects and the library never bundles.
 * A key the catalogue does not know falls back to the wording the declaration
 * ships, and a declaration that ships none shows the RAW KEY — ugly on purpose,
 * exactly as everywhere else in the library: a dangling key is a bug the host
 * must see, not an excuse for us to invent somebody else's wording.
 */
export function backgroundLabelText(
  source: BackgroundLabelSource,
  model: BackgroundModelLike,
  translation?: TranslationService | null
): string {
  if (source.prop !== undefined) {
    const value = model[source.prop];
    if (value !== undefined && value !== null) return String(value);
  }
  if (source.labelKey !== undefined) {
    const resolved = translation?.t(source.labelKey);
    if (resolved !== undefined && resolved !== '') return resolved;
    return source.fallback ?? source.labelKey;
  }
  return source.fallback ?? '';
}

/** Whether a `visibleProp` gate is open. No gate means always drawn. */
export function backgroundVisible(
  visibleProp: string | undefined,
  model: BackgroundModelLike
): boolean {
  return visibleProp === undefined ? true : Boolean(model[visibleProp]);
}

/**
 * Whether a piece of the declaration belongs to the variant this INSTANCE is
 * currently reading — the one gate washes, zones and texts all pass through.
 *
 * A variant is a second reading of the same frame (a Core Domain Chart read for
 * migration rather than for investment), so it is declared once, on the piece
 * that belongs to it, and selected by a single model prop. Declaring `variants`
 * with no {@link FrameworkBackgroundDef.variantProp} is a broken declaration and
 * paints nothing: there is no prop to be one of them. It also says so out loud,
 * once — a piece that is invisible everywhere with no diagnostic is the kind of
 * authoring mistake somebody spends an afternoon on.
 *
 * Absent means every variant, which is what everything meant before variants
 * existed.
 */
export function backgroundInVariant(
  def: FrameworkBackgroundDef,
  variants: readonly string[] | undefined,
  model: BackgroundModelLike
): boolean {
  if (variants === undefined) return true;
  if (def.variantProp === undefined) {
    warnOnce(
      `background "${def.type}" declares variants (${variants.join(', ')}) ` +
        `with no variantProp to select them — the piece is never painted.`
    );
    return false;
  }
  return variants.includes(String(model[def.variantProp]));
}

/** A label's clickable box in element-local coordinates (axis-aligned, padded). */
export interface BackgroundLabelHit {
  /** The declaration id of the text. */
  id: string;
  /** The model prop the in-place editor must write back to. */
  prop: string;
  /**
   * The words currently DRAWN there.
   *
   * The editor must open on this, not on `model[prop]`: a label whose prop has
   * never been written shows its vocabulary, and opening an empty box on it
   * would silently offer to erase a name the user can see.
   */
  text: string;
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

/** Rough per-character advance — only used to size generous hit boxes. */
const approxTextWidth = (text: string, fontSize: number) =>
  Math.max(fontSize, text.length * fontSize * 0.6);

/** Padding so double-clicking a label is forgiving. */
const HIT_PAD = 6;

/**
 * Every text of a declaration, in PAINTING ORDER: the side-band labels, the
 * zone labels, then each axis' title followed by its end labels.
 *
 * One walk, used by both the renderer and the hit tester, so a label can never
 * be drawn in one place and clicked in another.
 *
 * The bands lead because a band is part of the card, which is painted first.
 * Two gates are INHERITED here rather than restated by every framework: a zone's
 * variants reach its label, and an axis' visibility reaches its title. Both are
 * overridden by a text that names its own.
 *
 * ## What this walk does NOT contain
 *
 * The names of the zones an INSTANCE declares
 * ({@link FrameworkBackgroundDef.instanceZones} — a BPMN pool's lanes). This
 * walk takes a declaration and nothing else, on purpose: it is what makes the
 * hit boxes a pure function of the same data the renderer paints from, and
 * every consumer of it — `backgroundLabelHits` above, the renderer's text
 * stage — is built on that. Instance zone names come from the model, exist in a
 * number the declaration does not know, and are anchored to a band whose
 * position the declaration does not know either; widening the signature to take
 * a model would push that question onto every caller to serve one of them.
 *
 * They are therefore drawn renderer-side and are NOT hit-testable: a zone name
 * cannot be renamed by double-clicking it on the canvas. That is a deliberate
 * limit and not an oversight — a zone is created and destroyed through its
 * framework's own tooling, so that is where it is renamed too, and a label the
 * hit tester never returns can never be drawn in one place and clicked in
 * another either.
 */
export function backgroundTexts(
  def: FrameworkBackgroundDef
): BackgroundTextDef[] {
  const texts: BackgroundTextDef[] = [];
  for (const band of def.chrome?.sideBands ?? []) {
    if (band.label) texts.push(band.label);
  }
  for (const zone of def.zones ?? []) {
    if (!zone.label) continue;
    texts.push(
      zone.variants === undefined || zone.label.variants !== undefined
        ? zone.label
        : { ...zone.label, variants: zone.variants }
    );
  }
  for (const axis of def.axes ?? []) {
    // The title shares the axis' visibility; the end labels have their own.
    if (axis.title) {
      texts.push(
        axis.visibleProp === undefined
          ? axis.title
          : { ...axis.title, visibleProp: axis.visibleProp }
      );
    }
    texts.push(...(axis.endLabels ?? []));
  }
  return texts;
}

/**
 * Clickable boxes of every VISIBLE, EDITABLE label — those the declaration
 * binds to a model prop; a label that only names an i18n key is vocabulary,
 * not user text, and is not offered for editing.
 *
 * Positions come from the same declaration the renderer paints from, so the
 * boxes track the drawn text by construction.
 */
export function backgroundLabelHits(
  def: FrameworkBackgroundDef,
  model: BackgroundModelLike,
  w: number,
  h: number,
  translation?: TranslationService | null
): BackgroundLabelHit[] {
  const plot = backgroundPlot(def, w, h);
  const hits: BackgroundLabelHit[] = [];

  for (const text of backgroundTexts(def)) {
    if (text.prop === undefined) continue;
    // A label the instance's variant does not paint is not there to be
    // double-clicked either: an editor opening on invisible words would offer
    // to rename something the user cannot see.
    if (!backgroundInVariant(def, text.variants, model)) continue;
    if (!backgroundVisible(text.visibleProp, model)) continue;

    const words = backgroundLabelText(text, model, translation);
    const size = text.style.size;
    const tw = approxTextWidth(words, size);
    const [ax, ay] = backgroundPoint(text.anchor, plot);

    if (text.vertical) {
      hits.push({
        id: text.id,
        prop: text.prop,
        text: words,
        minX: ax - size - HIT_PAD,
        maxX: ax + size * 0.4 + HIT_PAD,
        minY: ay - tw / 2 - HIT_PAD,
        maxY: ay + tw / 2 + HIT_PAD,
      });
      continue;
    }

    const align = text.align ?? 'left';
    const minX =
      align === 'right' ? ax - tw : align === 'center' ? ax - tw / 2 : ax;
    const maxX =
      align === 'right' ? ax : align === 'center' ? ax + tw / 2 : ax + tw;
    hits.push({
      id: text.id,
      prop: text.prop,
      text: words,
      minX: minX - HIT_PAD,
      maxX: maxX + HIT_PAD,
      minY: ay - size - HIT_PAD,
      maxY: ay + size * 0.3 + HIT_PAD,
    });
  }

  return hits;
}

/** First label whose padded box contains the element-local point, or null. */
export function hitTestBackgroundLabel(
  hits: readonly BackgroundLabelHit[],
  lx: number,
  ly: number
): BackgroundLabelHit | null {
  for (const hit of hits) {
    if (lx >= hit.minX && lx <= hit.maxX && ly >= hit.minY && ly <= hit.maxY) {
      return hit;
    }
  }
  return null;
}
