import {
  ConnectorElementModel,
  type CoreDomainChartElementModel,
  ShapeElementModel,
  StrokeStyle,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import {
  CD_SUBDOMAINS,
  MOVEMENT_COLOR,
  TEAM_TOPOLOGIES,
} from '../shared/consts';
import { addLegend, type LegendSection } from '../shared/prefabs';

/**
 * Build the Notation legend sections. When `present` is given (a content-aware
 * scan of the background), only the sub-domain types / team-topology modes /
 * movement actually used are listed; otherwise the full notation is shown.
 */
export function coreDomainLegendSections(present?: {
  fills: Set<string>;
  movement: boolean;
}): LegendSection[] {
  const has = (c: string) => !present || present.fills.has(c.toLowerCase());
  const subRows = CD_SUBDOMAINS.filter(s => has(s.fill)).map(s => ({
    swatch: 'dot' as const,
    color: s.fill,
    label: s.label,
  }));
  const ttRows = TEAM_TOPOLOGIES.filter(t => has(t.fill)).map(t => ({
    swatch: 'square' as const,
    color: t.fill,
    letter: t.letter,
    label: t.label,
  }));
  const sections: LegendSection[] = [];
  if (subRows.length) sections.push({ title: 'Sub-domains', rows: subRows });
  if (ttRows.length) sections.push({ title: 'Team topologies', rows: ttRows });
  if (!present || present.movement) {
    sections.push({
      title: 'Movement',
      rows: [{ swatch: 'line', color: MOVEMENT_COLOR, label: 'Movement over time' }],
    });
  }
  // Content-aware scan found nothing recognizable → fall back to the full legend.
  if (present && sections.length === 0) return coreDomainLegendSections();
  return sections;
}

/**
 * Insert a content-aware legend next to a Core Domain background: scans the
 * shapes/connectors inside the background's perimeter and lists only the
 * notation actually present. Triggered from the element's contextual toolbar.
 */
export function createCoreDomainLegend(
  std: BlockStdScope,
  bg: CoreDomainChartElementModel
) {
  const gfx = std.get(GfxControllerIdentifier);
  const surface = gfx.surface;
  if (!surface) return;

  const fills = new Set<string>();
  let movement = false;
  for (const el of gfx.getElementsByBound(Bound.deserialize(bg.xywh), {
    type: 'canvas',
  })) {
    if (el instanceof ConnectorElementModel) {
      if (el.strokeStyle === StrokeStyle.Dash) movement = true;
    } else if (el instanceof ShapeElementModel) {
      if (typeof el.fillColor === 'string') fills.add(el.fillColor.toLowerCase());
    }
  }

  const [bx, by, bw] = bg.deserializedXYWH;
  addLegend(surface, std, bx + bw + 30, by, {
    title: 'Légende',
    sections: coreDomainLegendSections({ fills, movement }),
  });
}
