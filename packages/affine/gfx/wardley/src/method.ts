import { WARDLEY_METHOD } from './natures.js';
import { METHOD_STYLE, type WardleyMethodStyle } from './node/consts.js';

/**
 * The method tag and the pair the wardley-map-renderer JSON spells it as, in
 * both directions, and the prefabricated ring each value paints (ADR 0046).
 *
 * A pure module on purpose, like `porter-competition.ts`: this is the only
 * place a `wardley:method/...` value id is related to a family, a phase and a
 * style. The renderer reads it to paint, an import reads it to write the tag,
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
  [WARDLEY_METHOD.make]: { family: 'buying-policy', phase: 'uncharted' },
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

const STYLE_OF_VALUE: Readonly<Record<string, WardleyMethodStyle>> = {
  [WARDLEY_METHOD.make]: METHOD_STYLE.make,
  [WARDLEY_METHOD.buy]: METHOD_STYLE.buy,
  [WARDLEY_METHOD.outsource]: METHOD_STYLE.outsource,
  [WARDLEY_METHOD.agile]: METHOD_STYLE.agile,
  [WARDLEY_METHOD.lean]: METHOD_STYLE.lean,
  [WARDLEY_METHOD.sixSigma]: METHOD_STYLE.sixSigma,
  [WARDLEY_METHOD.pioneers]: METHOD_STYLE.pioneers,
  [WARDLEY_METHOD.settlers]: METHOD_STYLE.settlers,
  [WARDLEY_METHOD.townPlanners]: METHOD_STYLE.townPlanners,
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
 * is open) is not a method here — Labre has no custom category (PO decision,
 * 2026-10-28) — and an importer keeps it as foreign data (ADR 0012) rather
 * than filing it under the nearest family.
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

/**
 * The prefabricated ring a method value paints (`METHOD_STYLE`), `null`
 * when the value names no method — the caller then paints the node's own
 * stored fill, exactly as before the tag existed.
 */
export function wardleyMethodStyle(
  valueId: string | null | undefined
): WardleyMethodStyle | null {
  if (typeof valueId !== 'string') return null;
  return Object.hasOwn(STYLE_OF_VALUE, valueId)
    ? STYLE_OF_VALUE[valueId]
    : null;
}
