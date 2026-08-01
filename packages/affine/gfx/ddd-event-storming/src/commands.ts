import {
  addConnector,
  addSticky,
  ES_HOTSPOT,
  ES_STICKIES,
  placeDddElement,
} from '@labre/affine-gfx-ddd-shared';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import { svg, type TemplateResult } from 'lit';

/**
 * The Event Storming palette as commands: the seven colour-coded stickies, the
 * hotspot and a flow arrow. Declared once and read by the sub-menu, the keymap,
 * Settings › Shortcuts, the catalogue and the agent (`docs/adr/0008`).
 */
const squareSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="${color}"/></svg>`;
const diamondSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" fill="${color}"/></svg>`;
const flowSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M4 12 H18" stroke="currentColor" stroke-width="2"/><path d="M16 8 L20 12 L16 16" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;

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
  ...ES_STICKIES.map(
    (preset): Spec => ({
      id: `add${preset.kind[0].toUpperCase()}${preset.kind.slice(1)}`,
      label: preset.label,
      iconKey: `ddd-event-storming.sticky.${preset.kind}`,
      element: `sticky:${preset.kind}`,
      icon: squareSwatch(preset.fill),
      run: std =>
        placeDddElement(std, (surface, cx, cy) =>
          addSticky(surface, std, cx, cy, {
            fill: preset.fill,
            text: preset.text,
            label: preset.label,
          })
        ),
    })
  ),
  {
    id: 'addHotspot',
    label: ES_HOTSPOT.label,
    iconKey: 'ddd-event-storming.sticky.hotspot',
    element: 'sticky:hotspot',
    icon: diamondSwatch(ES_HOTSPOT.fill),
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        addSticky(surface, std, cx, cy, {
          fill: ES_HOTSPOT.fill,
          text: ES_HOTSPOT.text,
          label: ES_HOTSPOT.label,
          shapeType: 'diamond',
        })
      ),
  },
  {
    id: 'addFlow',
    label: 'Flow',
    iconKey: 'ddd-event-storming.flow',
    element: 'flow',
    icon: flowSwatch,
    run: std =>
      placeDddElement(std, (surface, cx, cy) =>
        addConnector(surface, cx - 110, cy, cx + 110, cy, { rearArrow: true })
      ),
  },
];

export const eventStormingCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: `ddd-event-storming.${spec.id}`,
    owner: 'ddd-event-storming',
    kind: 'artefact',
    labelKey: `com.labre.commands.ddd-event-storming.${spec.id}`,
    labelFallback: spec.label,
    category: 'stickies',
    iconKey: spec.iconKey,
    surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
    order,
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    availability: 'always',
    run: spec.run,
    telemetry: { framework: 'ddd-event-storming', element: spec.element },
  })
);

export const eventStormingCommandIcons: Record<string, TemplateResult> =
  Object.fromEntries(SPECS.map(spec => [spec.iconKey, spec.icon]));
