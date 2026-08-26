import {
  addSticky,
  ES_HOTSPOT,
  ES_STICKIES,
  placeDddElement,
  STICKY_SIZE,
} from '@labre/affine-gfx-ddd-shared';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { svg, type TemplateResult } from 'lit';

import {
  activateEventStormingFlow,
  createEventStormingBoard,
} from './actions';
import { ES_STICKY_ROLE } from './roles';

/**
 * The Event Storming palette as commands: the board, the eight colour-coded
 * stickies, the hotspot and the flow. Declared once and read by the sub-menu,
 * the keymap, Settings › Shortcuts, the catalogue and the agent
 * (`docs/adr/0008`).
 *
 * Three entries changed shape in WS5 and not one telemetry value moved: the
 * stickies now carry their role, the flow arms the connector tool instead of
 * dropping a drawing, and the board is a new entry with a new `element` value.
 */
const squareSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="3" y="3" width="18" height="18" rx="3" fill="${color}"/></svg>`;
const diamondSwatch = (color: string) =>
  svg`<svg viewBox="0 0 24 24"><rect x="6" y="6" width="12" height="12" transform="rotate(45 12 12)" fill="${color}"/></svg>`;
const flowSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><path d="M4 12 H18" stroke="currentColor" stroke-width="2"/><path d="M16 8 L20 12 L16 16" stroke="currentColor" stroke-width="2" fill="none"/></svg>`;
const boardSwatch = svg`<svg viewBox="0 0 24 24" fill="none"><rect x="2.5" y="4" width="19" height="16" rx="2" fill="#ffffff" stroke="currentColor" stroke-width="1.6"/><rect x="5" y="7.5" width="4" height="4" rx="1" fill="#F5963B"/><rect x="10.5" y="7.5" width="4" height="4" rx="1" fill="#5BA3DB"/><rect x="16" y="7.5" width="4" height="4" rx="1" fill="#FAF2C9" stroke="#c9bd7f" stroke-width="0.6"/><path d="M4.5 16.5 H19.5" stroke="currentColor" stroke-width="1.2"/><path d="M17.5 14.8 L19.8 16.5 L17.5 18.2" stroke="currentColor" stroke-width="1.2"/></svg>`;

/**
 * The aggregate is created BIG — 160 against the standard 120.
 *
 * Size is half of how the notation distinguishes it: on a real wall the
 * aggregate is the large pale sticky a run of commands lands on, and the
 * colour ladder in `ES_STICKIES` carries the other half. Declared here rather
 * than in the shared palette because it is a FORMAT, not a colour: the palette
 * says which yellow, the toolbox says how big.
 */
const AGGREGATE_SIZE = 160;

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
    id: 'addBoard',
    label: 'Event Storming board',
    iconKey: 'ddd-event-storming.board',
    // A NEW telemetry value: every other entry below keeps the `element` string
    // it has emitted since ADR 0008.
    element: 'board',
    icon: boardSwatch,
    run: std => createEventStormingBoard(std.get(GfxControllerIdentifier)),
  },
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
            size: preset.kind === 'aggregate' ? AGGREGATE_SIZE : STICKY_SIZE,
            // The role is what makes a sticky a domain EVENT rather than an
            // orange square: every rule in `rules.ts` reads it, and a sticky
            // placed before WS5 carries none and is never evaluated
            // (promesse #71).
            role: ES_STICKY_ROLE[preset.kind],
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
          // Typed like the rest, and cited by no grammar triplet on purpose —
          // an arc onto a hotspot is a question being parked. See `rules.ts`.
          role: ES_STICKY_ROLE.hotspot,
        })
      ),
  },
  {
    id: 'addFlow',
    label: 'Flow',
    iconKey: 'ddd-event-storming.flow',
    element: 'flow',
    icon: flowSwatch,
    // No longer a placement: the entry arms the connector tool and the user
    // DRAWS the flow between two stickies. See `activateEventStormingFlow` for
    // why the free-floating arrow had to go. The telemetry value is untouched.
    run: std => activateEventStormingFlow(std.get(GfxControllerIdentifier)),
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
