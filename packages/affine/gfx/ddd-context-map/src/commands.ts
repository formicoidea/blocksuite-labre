import {
  addBubble,
  addCloud,
  addLegend,
  addRelationship,
  CLOUD,
  CM_BUBBLE,
  CM_RELATIONSHIPS,
  type LegendRow,
  type LegendSection,
  placeDddElement,
} from '@labre/affine-gfx-ddd-shared';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import { svg, type TemplateResult } from 'lit';

/**
 * The Context Map palette as commands: the bounded-context bubble, the cloud,
 * the nine relationship patterns and the notation legend (`docs/adr/0008`).
 */
const bubbleSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="2" y="7" width="20" height="10" rx="5" fill="#e6f0fa" stroke="#2f6fb0" stroke-width="1.6"/></svg>`;
const cloudSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M6 17 C3 17 2 14 4.5 12.5 C4 9 8 8 9.5 10 C11 6.5 16 7.5 16 11 C19 10.5 20.5 14 18 16 C18 17 16.5 17 15 17 Z" fill="#f0eef6" stroke="#6d6e71" stroke-width="1.4"/></svg>`;
const legendSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="3" y="4" width="18" height="16" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="7" cy="9" r="1.6" fill="currentColor"/><circle cx="7" cy="14" r="1.6" fill="currentColor"/><path d="M11 9 H18 M11 14 H18" stroke="currentColor" stroke-width="1.4"/></svg>`;
const relationSwatch = (dashed: boolean, arrow: boolean) =>
  svg`<svg viewBox="0 0 24 24" fill="none"><path d="M3 12 H${arrow ? 17 : 21}" stroke="currentColor" stroke-width="2" stroke-dasharray="${dashed ? '3 3' : '0'}"/>${arrow ? svg`<path d="M15 8 L21 12 L15 16" stroke="currentColor" stroke-width="2" fill="none"/>` : ''}</svg>`;

/** The notation legend's sections, built from the same relationship presets. */
function legendSections(): LegendSection[] {
  const patRows = (kinds: string[]): LegendRow[] =>
    CM_RELATIONSHIPS.filter(r => kinds.includes(r.kind)).map(
      (r): LegendRow => ({
        swatch: 'line',
        color: '#1f2328',
        label: `${r.abbrev} — ${r.label}`,
      })
    );
  return [
    {
      title: 'Boundaries',
      rows: [
        { swatch: 'square', color: CM_BUBBLE.fill, label: 'Bounded Context' },
        {
          swatch: 'square',
          color: CLOUD.fill,
          label: 'System / Big Ball of Mud',
        },
      ],
    },
    {
      title: 'Mutually dependent',
      rows: patRows(['partnership', 'sharedKernel']),
    },
    {
      title: 'Upstream → Downstream (U/D)',
      rows: patRows([
        'customerSupplier',
        'conformist',
        'acl',
        'ohs',
        'publishedLanguage',
      ]),
    },
    {
      title: 'Separate / no integration',
      rows: patRows(['separateWays', 'bbom']),
    },
  ];
}

interface Spec {
  id: string;
  label: string;
  iconKey: string;
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  icon: TemplateResult;
  run: (std: BlockStdScope) => void;
}

const SPECS: Spec[] = [
  {
    id: 'addBoundedContext',
    label: 'Bounded Context',
    iconKey: 'ddd-context-map.bubble',
    element: 'bounded-context',
    icon: bubbleSwatch,
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        addBubble(surface, cx, cy, 'Bounded Context')
      ),
  },
  {
    id: 'addCloud',
    label: 'Cloud / System (Big Ball of Mud)',
    iconKey: 'ddd-context-map.cloud',
    element: 'cloud',
    icon: cloudSwatch,
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        addCloud(surface, std, cx, cy, 'System')
      ),
  },
  ...CM_RELATIONSHIPS.map(
    (preset): Spec => ({
      id: `add${preset.kind[0].toUpperCase()}${preset.kind.slice(1)}`,
      label: preset.label,
      iconKey: `ddd-context-map.relationship.${preset.kind}`,
      element: `relationship:${preset.kind}`,
      icon: relationSwatch(preset.dashed, preset.upDown),
      run: std =>
        placeDddElement(std, (surface, cx, cy) =>
          addRelationship(surface, std, cx, cy, preset)
        ),
    })
  ),
  {
    id: 'addLegend',
    label: 'Legend',
    iconKey: 'ddd-context-map.legend',
    // Deliberately NOT `kind: 'legend'`: this palette entry has always emitted
    // `FrameworkElementAdded` with element `'legend'`, and ADR 0008's
    // no-analytics-breakage rule outranks the taxonomy tidy-up. Promoting it
    // to `FrameworkLegendCreated` is a telemetry change, not a refactor.
    element: 'legend',
    icon: legendSwatch,
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        addLegend(surface, std, cx - 140, cy - 210, {
          title: 'Légende',
          sections: legendSections(),
          width: 290,
        })
      ),
  },
];

export const contextMapCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: `ddd-context-map.${spec.id}`,
    owner: 'ddd-context-map',
    kind: 'artefact',
    labelKey: `com.labre.commands.ddd-context-map.${spec.id}`,
    labelFallback: spec.label,
    category: 'map',
    iconKey: spec.iconKey,
    surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
    order,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'always',
    run: spec.run,
    telemetry: { framework: 'ddd-context-map', element: spec.element },
  })
);

export const contextMapCommandIcons: Record<string, TemplateResult> =
  Object.fromEntries(SPECS.map(spec => [spec.iconKey, spec.icon]));
