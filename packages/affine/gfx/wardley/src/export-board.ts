import {
  ConnectorElementModel,
  TextElementModel,
  WardleyBackgroundElementModel,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import type { WardleyExportBoard } from './export.js';
import { WARDLEY_ROLE } from './roles.js';

/**
 * The half of the OWM export that needs LIVE element models: picking the
 * artefacts out of a surface by `instanceof`. Kept out of `export.ts` so the
 * serializer and the OWM vocabulary the readers share stay editor-free — the
 * headless `./interchange` entry imports `export.ts` and must not load an
 * element class (ADR 0012, P3 as amended 2026-10-14).
 */
export function wardleyBoardFrom(
  elements: readonly GfxPrimitiveElementModel[]
): WardleyExportBoard {
  const maps: WardleyBackgroundElementModel[] = [];
  const nodes: WardleyNodeElementModel[] = [];
  const labels: TextElementModel[] = [];
  const notes: TextElementModel[] = [];
  const connectors: ConnectorElementModel[] = [];

  for (const element of elements) {
    if (element instanceof WardleyBackgroundElementModel) maps.push(element);
    else if (element instanceof WardleyNodeElementModel) nodes.push(element);
    else if (element instanceof ConnectorElementModel) connectors.push(element);
    else if (element instanceof TextElementModel) {
      if (element.role === WARDLEY_ROLE.label) labels.push(element);
      else if (element.role === undefined) notes.push(element);
    }
  }

  return { maps, nodes, labels, notes, connectors };
}
