import { WARDLEY_METHOD } from './natures.js';
import {
  METHOD_FAMILY_COLOR,
  METHOD_RING_WIDTH,
  METHOD_TRANSITIONAL_ALPHA,
} from './node/consts.js';

/**
 * The method tag and the pair the wardley-map-renderer JSON spells it as, in
 * both directions, and the ring each value paints (ADR 0046).
 *
 * A pure module on purpose, like `porter-competition.ts`: this is the only
 * place a `wardley:method/...` value id is related to a family, a phase and a
 * colour. The renderer reads it to paint, an import reads it to write the tag,
 * and nothing here touches an element, a surface or a registry — the painting
 * of a stored document never depends on which tag pack the host seeded.
 */

/**
 * The three method families, spelled as the renderer's `method.category`
 * spells its three defaults.
 */
export type WardleyMethodFamily =
  | 'buying-policy'
  | 'project-management'
  | 'attitudes';

/**
 * The evolution phase a method suits, which is how much of its ring is filled.
 * The renderer's `method.recommendation`, lower-cased.
 */
export type WardleyMethodPhase =
  | 'uncharted'
  | 'transitional'
  | 'industrialized';

export interface WardleyMethodParts {
  family: WardleyMethodFamily;
  phase: WardleyMethodPhase;
}

const PARTS_OF_VALUE: Readonly<Record<string, WardleyMethodParts>> = {
  [WARDLEY_METHOD.build]: { family: 'buying-policy', phase: 'uncharted' },
  [WARDLEY_METHOD.buy]: { family: 'buying-policy', phase: 'transitional' },
  [WARDLEY_METHOD.outsource]: {
    family: 'buying-policy',
    phase: 'industrialized',
  },
  [WARDLEY_METHOD.agile]: { family: 'project-management', phase: 'uncharted' },
  [WARDLEY_METHOD.lean]: {
    family: 'project-management',
    phase: 'transitional',
  },
  [WARDLEY_METHOD.sixSigma]: {
    family: 'project-management',
    phase: 'industrialized',
  },
  [WARDLEY_METHOD.pioneers]: { family: 'attitudes', phase: 'uncharted' },
  [WARDLEY_METHOD.settlers]: { family: 'attitudes', phase: 'transitional' },
  [WARDLEY_METHOD.townPlanners]: {
    family: 'attitudes',
    phase: 'industrialized',
  },
};

/**
 * The family and phase a method value states, `null` when it is not one of the
 * nine.
 *
 * Total over anything a DOCUMENT can carry: defs are runtime configuration and
 * are never persisted, so a node may hold a value whose pack was removed or a
 * newer client added. Such a value names no family, and the node paints as an
 * untagged one rather than guessing a colour.
 */
export function wardleyMethodParts(
  valueId: string | null | undefined
): WardleyMethodParts | null {
  if (typeof valueId !== 'string') return null;
  // `Object.hasOwn`, so `'toString'` does not resolve to a method.
  return Object.hasOwn(PARTS_OF_VALUE, valueId)
    ? PARTS_OF_VALUE[valueId]
    : null;
}

/**
 * The method value a renderer `method: { category, recommendation }` pair
 * states, `null` when it states none of the nine.
 *
 * Forgiving in case and surrounding blanks only — the renderer's own keys are
 * capitalised (`Uncharted`) and its categories kebab-case — and strict
 * everywhere else: a category the renderer config made up (its `methods` list
 * is open) has no ring colour here, and an importer keeps it as foreign data
 * (ADR 0012) rather than painting it as the nearest family.
 */
export function wardleyMethodOf(
  category: string | null | undefined,
  recommendation: string | null | undefined
): string | null {
  if (typeof category !== 'string' || typeof recommendation !== 'string') {
    return null;
  }
  const family = category.trim().toLowerCase();
  const phase = recommendation.trim().toLowerCase();
  for (const [valueId, parts] of Object.entries(PARTS_OF_VALUE)) {
    if (parts.family === family && parts.phase === phase) return valueId;
  }
  return null;
}

/** What a method value paints the ring with. */
export interface WardleyMethodRing {
  /** The ring's line, the family hue. */
  stroke: string;
  /**
   * What fills the ring on top of the paper, `null` for an outline: the paper
   * alone shows through an uncharted method.
   */
  fill: string | null;
  /** The ring's minimum line width. */
  lineWidth: number;
}

/**
 * The ring a method value paints, `null` when the value names no method — the
 * caller then paints the node's own stored fill, exactly as before the tag
 * existed.
 */
export function wardleyMethodRing(
  valueId: string | null | undefined
): WardleyMethodRing | null {
  const parts = wardleyMethodParts(valueId);
  if (!parts) return null;
  const hue = METHOD_FAMILY_COLOR[parts.family];
  switch (parts.phase) {
    case 'uncharted':
      return { stroke: hue, fill: null, lineWidth: METHOD_RING_WIDTH.outline };
    case 'transitional':
      return {
        stroke: hue,
        fill: `${hue}${METHOD_TRANSITIONAL_ALPHA}`,
        lineWidth: METHOD_RING_WIDTH.filled,
      };
    case 'industrialized':
      return { stroke: hue, fill: hue, lineWidth: METHOD_RING_WIDTH.filled };
  }
}
