import type { CommandDescriptor } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import {
  activateWardleyConnector,
  createWardleyBackground,
  createWardleyInertia,
  createWardleyMarket,
  createWardleyNode,
  createWardleyPipeline,
} from './actions';
import {
  wardleyAnchorIcon,
  wardleyArrowIcon,
  wardleyBackgroundIcon,
  wardleyBenefitIcon,
  wardleyComponentIcon,
  wardleyEcosystemIcon,
  wardleyEvolutionGradientIcon,
  wardleyInertiaIcon,
  wardleyLinkIcon,
  wardleyMarketIcon,
  wardleyMethodIcon,
  wardleyOpportunityIcon,
  wardleyPipelineIcon,
} from './toolbar/icons';

/**
 * The Wardley toolbox as {@link CommandDescriptor}s — the SINGLE declaration
 * the senior sub-menu, the keymap, Settings › Shortcuts, the catalogue and the
 * agent all read (`docs/adr/0008`). Before PF3 the same artefacts were spelled
 * twice: 13 hard-coded buttons in `toolbar/wardley-menu.ts` and 7 shortcut
 * descriptors in `shortcuts.ts`. The six that existed only in the menu were
 * invisible to Settings › Shortcuts, and nothing detected the omission.
 *
 * The seven ids that already shipped keep their id AND their `labelKey`
 * verbatim, so persisted host override tables and translation catalogues stay
 * valid. The six promoted ones ship keyless (`{ mac: [], other: [] }`) — still
 * registered, so a host override on their id actually binds.
 *
 * Declaration order IS the sub-menu order, kept identical to the pre-PF3
 * button row so the switchover is invisible on the canvas.
 */
interface Spec {
  /** Un-namespaced id; `wardley.` is prepended. */
  id: string;
  /** English default, verbatim from the button it replaces. */
  label: string;
  /** Historical label key, for the seven commands that already shipped. */
  labelKey?: string;
  /** Second keystroke of the `w` chord; absent = keyless by intent. */
  key?: string;
  iconKey: string;
  category: 'backgrounds' | 'nodes' | 'connectors';
  kind: 'artefact' | 'tool';
  /** Historical `FrameworkElementEvent.element` value — do not rename. */
  element: string;
  run: (gfx: GfxController) => void;
}

const SPECS: Spec[] = [
  {
    id: 'addBackground',
    label: 'Wardley map background',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addBackground',
    key: 'b',
    iconKey: 'wardley.background',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:classic',
    run: gfx => createWardleyBackground(gfx, 'classic'),
  },
  {
    id: 'addOpportunityBackground',
    label: 'Opportunity background (gradient)',
    iconKey: 'wardley.background.opportunity',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:opportunity',
    run: gfx => createWardleyBackground(gfx, 'opportunity'),
  },
  {
    id: 'addBenefitBackground',
    label: 'Benefit / Investment background (gradient)',
    iconKey: 'wardley.background.benefit',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:benefit',
    run: gfx => createWardleyBackground(gfx, 'benefit'),
  },
  {
    id: 'addEvolutionBackground',
    label: 'Evolution background (Wardley presentation)',
    iconKey: 'wardley.background.evolution',
    category: 'backgrounds',
    kind: 'artefact',
    element: 'background:evolution-gradient',
    run: gfx => createWardleyBackground(gfx, 'evolution-gradient'),
  },
  {
    id: 'addComponent',
    label: 'Component',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addComponent',
    key: 'c',
    iconKey: 'wardley.component',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:component',
    run: gfx => createWardleyNode(gfx, 'component'),
  },
  {
    id: 'addMethod',
    label: 'Component + method',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addMethod',
    key: 'm',
    iconKey: 'wardley.method',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:method',
    run: gfx => createWardleyNode(gfx, 'method'),
  },
  {
    id: 'addMarket',
    label: 'Market',
    iconKey: 'wardley.market',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:market',
    run: createWardleyMarket,
  },
  {
    id: 'addEcosystem',
    label: 'Ecosystem',
    iconKey: 'wardley.ecosystem',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:ecosystem',
    run: gfx => createWardleyNode(gfx, 'ecosystem'),
  },
  {
    id: 'addAnchor',
    label: 'Anchor',
    iconKey: 'wardley.anchor',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:anchor',
    run: gfx => createWardleyNode(gfx, 'anchor'),
  },
  {
    id: 'addPipeline',
    label: 'Pipeline',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addPipeline',
    key: 'p',
    iconKey: 'wardley.pipeline',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:pipeline',
    run: createWardleyPipeline,
  },
  {
    id: 'linkTool',
    label: 'Link',
    labelKey: 'com.labre.keyboardShortcuts.wardley.linkTool',
    key: 'l',
    iconKey: 'wardley.link',
    category: 'connectors',
    kind: 'tool',
    element: 'connector:link',
    run: gfx => activateWardleyConnector(gfx, 'link'),
  },
  {
    id: 'evolutionArrow',
    label: 'Arrow (evolution)',
    labelKey: 'com.labre.keyboardShortcuts.wardley.evolutionArrow',
    key: 'a',
    iconKey: 'wardley.arrow',
    category: 'connectors',
    kind: 'tool',
    element: 'connector:arrow',
    run: gfx => activateWardleyConnector(gfx, 'arrow'),
  },
  {
    id: 'addInertia',
    label: 'Inertia',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addInertia',
    key: 'i',
    iconKey: 'wardley.inertia',
    category: 'nodes',
    kind: 'artefact',
    element: 'node:inertia',
    run: createWardleyInertia,
  },
];

export const wardleyCommands: CommandDescriptor[] = SPECS.map(
  (spec, order) => ({
    id: `wardley.${spec.id}`,
    owner: 'wardley',
    kind: spec.kind,
    labelKey: spec.labelKey ?? `com.labre.commands.wardley.${spec.id}`,
    labelFallback: spec.label,
    category: spec.category,
    iconKey: spec.iconKey,
    surfaces: ['senior-menu', 'catalogue', 'palette', 'agent'],
    order,
    scope: 'edgeless',
    defaultKeys: spec.key
      ? { mac: ['w', spec.key], other: ['w', spec.key] }
      : { mac: [], other: [] },
    availability: 'always',
    run: std => spec.run(std.get(GfxControllerIdentifier)),
    telemetry: { framework: 'wardley', element: spec.element },
  })
);

/** `iconKey` → template. Never travels through either manifest (ADR 0008). */
export const wardleyCommandIcons: Record<string, TemplateResult> = {
  'wardley.background': wardleyBackgroundIcon,
  'wardley.background.opportunity': wardleyOpportunityIcon,
  'wardley.background.benefit': wardleyBenefitIcon,
  'wardley.background.evolution': wardleyEvolutionGradientIcon,
  'wardley.component': wardleyComponentIcon,
  'wardley.method': wardleyMethodIcon,
  'wardley.market': wardleyMarketIcon,
  'wardley.ecosystem': wardleyEcosystemIcon,
  'wardley.anchor': wardleyAnchorIcon,
  'wardley.pipeline': wardleyPipelineIcon,
  'wardley.link': wardleyLinkIcon,
  'wardley.arrow': wardleyArrowIcon,
  'wardley.inertia': wardleyInertiaIcon,
};
