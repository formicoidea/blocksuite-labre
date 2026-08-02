import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { wardleyTemplateCategory } from '../../templates';

/**
 * The SHIPPED templates, read back as a corpus card.
 *
 * A template is factory content: it is the first Wardley map most users ever
 * see, and it is the one map in the repository that somebody drew on purpose.
 * That makes it the natural corpus card — and the guard-rail this slice was
 * missing, because a preset that breaks the rules the same release introduces
 * teaches the wrong thing to exactly the people who trust it most.
 *
 * ## What this reconstructs, and why it is honest
 *
 * A template snapshot stores connectors as `source`/`target` references and no
 * geometry at all: the routed path only exists once the connector manager has
 * laid it out on a live surface. Every Wardley connector is `Straight`, and
 * every Wardley node is centre-anchored (`centerAnchorOnly`), so the drawn line
 * is exactly the segment between the two referenced centres. That is what this
 * builds — not an approximation of routing, the routing itself for this case.
 *
 * The `Straight` half of that is ASSERTED rather than assumed: nothing in the
 * repository holds it true, and a preset that quietly gained a curve would be
 * read as its chord and judged conformant for the wrong shape. {@link cardOf}
 * throws on any other mode.
 *
 * A connector whose ends are not both resolvable is dropped rather than
 * guessed at.
 */

/** One template, flattened to the surface elements it would insert. */
export interface TemplateCard {
  name: string;
  elements: GfxPrimitiveElementModel[];
}

type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  role?: string;
  mode?: number;
  xywh?: string;
  source?: { id?: string; position?: [number, number] };
  target?: { id?: string; position?: [number, number] };
  /** A stored surface text: `{ '$…text$': true, delta: [{ insert }] }`. */
  text?: { delta: { insert: string }[] };
  fontSize?: number;
  textAlign?: string;
};

/**
 * `ConnectorMode.Straight`, spelled out rather than imported.
 *
 * The corpus reads a stored SNAPSHOT — a number in a JSON blob — and the point
 * of the check below is to catch the day that number changes. Importing the
 * enum would make the constant follow the value it is supposed to hold still.
 */
const STRAIGHT_MODE = 0;

const centreOf = (xywh: string): [number, number] => {
  const [x, y, w, h] = JSON.parse(xywh) as number[];
  return [x + w / 2, y + h / 2];
};

/**
 * Turn one template's stored elements into what the engine reads: `id`, `role`,
 * `elementBound`, and for a connector the segment it actually draws.
 */
function cardOf(name: string, raw: Record<string, RawElement>): TemplateCard {
  const endpoint = (
    end: RawElement['source']
  ): [number, number] | undefined => {
    if (end?.position) return end.position;
    const referenced = end?.id === undefined ? undefined : raw[end.id];
    return referenced?.xywh ? centreOf(referenced.xywh) : undefined;
  };

  const elements: GfxPrimitiveElementModel[] = [];
  for (const [id, el] of Object.entries(raw)) {
    if (el.type === 'connector') {
      // The hypothesis this whole reader rests on, made VERIFIABLE instead of
      // merely written down. "The drawn line is the segment between the two
      // centres" is true of a straight connector and of nothing else: a preset
      // that one day ships a curve would be read as its chord, in silence, and
      // the conformance test above would then be judging a shape the map does
      // not draw. `mode` is read off the snapshot, so an absent one counts as a
      // failure too — the model's own default is `Curve`.
      if (el.mode !== STRAIGHT_MODE) {
        throw new Error(
          `[corpus] template "${name}" connector "${id}" has mode ${el.mode} — ` +
            'this reader reconstructs straight segments only. Sample the curve ' +
            'here, or the corpus judges a shape the template does not draw.'
        );
      }
      const from = endpoint(el.source);
      const to = endpoint(el.target);
      // Not resolvable: dropped rather than guessed at.
      if (!from || !to) continue;
      const bound = new Bound(
        Math.min(from[0], to[0]),
        Math.min(from[1], to[1]),
        Math.abs(to[0] - from[0]) || 1,
        Math.abs(to[1] - from[1]) || 1
      );
      elements.push({
        id,
        role: el.role,
        absolutePath: [from, to],
        get elementBound() {
          return bound.clone();
        },
      } as unknown as GfxPrimitiveElementModel);
      continue;
    }

    if (!el.xywh) continue;
    const xywh = el.xywh;
    elements.push({
      id,
      role: el.role,
      // A stored text is a delta, and a `text` role is measured by the ink of
      // its WORDS: reading only the box would judge the shipped templates on a
      // geometry no map has — the very thing this corpus caught in its own
      // fixtures.
      ...(el.text
        ? {
            text: el.text.delta.map(op => op.insert).join(''),
            fontSize: el.fontSize,
            textAlign: el.textAlign,
          }
        : {}),
      get elementBound() {
        return Bound.deserialize(xywh);
      },
    } as unknown as GfxPrimitiveElementModel);
  }
  return { name, elements };
}

/**
 * Every template the Wardley category ships, as corpus cards.
 *
 * `templates` is typed as a list OR a loader; this category declares a literal
 * list, and a lazy one would have to be awaited — which is a different test, on
 * the day a Wardley category ships one.
 */
const shipped = wardleyTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the Wardley template category is expected to be eager');
}

export const TEMPLATE_CARDS: readonly TemplateCard[] = shipped.map(
  (template, i) =>
    cardOf(
      template.name ?? `template-${i}`,
      (template.content as unknown as Snapshot).blocks.children[0].props
        .elements
    )
);
