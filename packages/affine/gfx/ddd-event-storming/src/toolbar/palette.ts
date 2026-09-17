import type {
  FrameworkPalette,
  NamedPalette,
} from '@labre/affine-components/color-picker';
import { ES_HOTSPOT, ES_STICKIES } from '@labre/affine-gfx-ddd-shared';
import { neutralPalettes } from '@labre/affine-gfx-shape';
import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * The Event Storming swatches' own names, resolved by `resolvePaletteLabel`
 * (`@labre/affine-components/color-picker`) through each swatch's own
 * {@link NamedPalette.labelWording} — the mechanism `WARDLEY_PALETTE_WORDINGS`
 * established, reused here without either package naming the other.
 *
 * Exported so `../translations.ts` can list them under source `chrome`: a
 * swatch's name is toolbar chrome, re-rendered on every locale switch, never
 * seeded into a document. They are this framework's OWN keys even though the
 * colours come from `ddd-shared` — the shared file declares no `com.labre.*`
 * key of its own, by design (see its header).
 */
export const ES_PALETTE_WORDING_DOMAIN_EVENT: ChromeWording = [
  'com.labre.ddd-event-storming.palette.domain-event-orange',
  'Domain event orange',
];
export const ES_PALETTE_WORDING_COMMAND: ChromeWording = [
  'com.labre.ddd-event-storming.palette.command-blue',
  'Command blue',
];
export const ES_PALETTE_WORDING_AGGREGATE: ChromeWording = [
  'com.labre.ddd-event-storming.palette.aggregate-cream',
  'Aggregate cream',
];
export const ES_PALETTE_WORDING_ACTOR: ChromeWording = [
  'com.labre.ddd-event-storming.palette.actor-yellow',
  'Actor yellow',
];
export const ES_PALETTE_WORDING_CONSTRAINT: ChromeWording = [
  'com.labre.ddd-event-storming.palette.constraint-yellow',
  'Constraint yellow',
];
export const ES_PALETTE_WORDING_POLICY: ChromeWording = [
  'com.labre.ddd-event-storming.palette.policy-lilac',
  'Policy lilac',
];
export const ES_PALETTE_WORDING_READ_MODEL: ChromeWording = [
  'com.labre.ddd-event-storming.palette.read-model-green',
  'Read model green',
];
export const ES_PALETTE_WORDING_SYSTEM: ChromeWording = [
  'com.labre.ddd-event-storming.palette.external-system-pink',
  'External system pink',
];
export const ES_PALETTE_WORDING_HOTSPOT: ChromeWording = [
  'com.labre.ddd-event-storming.palette.hotspot-magenta',
  'Hotspot magenta',
];

export const ES_PALETTE_WORDINGS: readonly ChromeWording[] = [
  ES_PALETTE_WORDING_DOMAIN_EVENT,
  ES_PALETTE_WORDING_COMMAND,
  ES_PALETTE_WORDING_AGGREGATE,
  ES_PALETTE_WORDING_ACTOR,
  ES_PALETTE_WORDING_CONSTRAINT,
  ES_PALETTE_WORDING_POLICY,
  ES_PALETTE_WORDING_READ_MODEL,
  ES_PALETTE_WORDING_SYSTEM,
  ES_PALETTE_WORDING_HOTSPOT,
];

/**
 * The sticky fills, by kind — derived from {@link ES_STICKIES} rather than
 * restated, so a hue changed in the shared table changes the shelf with it.
 */
const ES_FILL = Object.fromEntries(
  ES_STICKIES.map(sticky => [sticky.kind, sticky.fill])
) as Record<(typeof ES_STICKIES)[number]['kind'], string>;

/**
 * The DDD Crew / Brandolini **colour code**, surfaced as ready-made swatches.
 *
 * Event Storming is the one notation here where the colour IS the vocabulary:
 * an orange sticky is a domain event and a blue one a command, and that holds
 * on a wall, in a book and on this canvas. The shelf is therefore the sticky
 * table itself, in the order the grammar reads it (`ES_STICKIES`: an actor
 * issues a command, a command lands on an aggregate, an aggregate raises an
 * event), with the hotspot's neon diamond last.
 *
 * They are SHORTCUTS, never constraints: a sticky's KIND is written in its
 * role, not read off its fill, so nothing breaks when an author repaints one.
 */
const ES_PALETTES: NamedPalette[] = [
  {
    key: 'Domain event orange',
    value: ES_FILL.domainEvent,
    labelWording: ES_PALETTE_WORDING_DOMAIN_EVENT,
  },
  {
    key: 'Command blue',
    value: ES_FILL.command,
    labelWording: ES_PALETTE_WORDING_COMMAND,
  },
  {
    key: 'Aggregate cream',
    value: ES_FILL.aggregate,
    labelWording: ES_PALETTE_WORDING_AGGREGATE,
  },
  {
    key: 'Actor yellow',
    value: ES_FILL.actor,
    labelWording: ES_PALETTE_WORDING_ACTOR,
  },
  {
    key: 'Constraint yellow',
    value: ES_FILL.constraint,
    labelWording: ES_PALETTE_WORDING_CONSTRAINT,
  },
  {
    key: 'Policy lilac',
    value: ES_FILL.policy,
    labelWording: ES_PALETTE_WORDING_POLICY,
  },
  {
    key: 'Read model green',
    value: ES_FILL.readModel,
    labelWording: ES_PALETTE_WORDING_READ_MODEL,
  },
  {
    key: 'External system pink',
    value: ES_FILL.system,
    labelWording: ES_PALETTE_WORDING_SYSTEM,
  },
  {
    key: 'Hotspot magenta',
    value: ES_HOTSPOT.fill,
    labelWording: ES_PALETTE_WORDING_HOTSPOT,
  },
];

/**
 * From the default editor palette we keep ONLY the neutrals — the historical
 * colours say nothing in this notation.
 */
export const ES_PALETTE_LIST: NamedPalette[] = [
  ...ES_PALETTES,
  ...neutralPalettes(),
];

/**
 * Event Storming's page of the colour pickers' carousel (`docs/adr/0027`).
 * Registered from the FLAG-GATED view extension, because offering hues is
 * TOOLING: a board drawn while the flag was on keeps every colour it was
 * painted with when the flag goes off (`docs/adr/0009`).
 */
export const EVENT_STORMING_FRAMEWORK_PALETTE: FrameworkPalette = {
  framework: 'ddd-event-storming',
  labelWording: ['com.labre.framework.ddd-event-storming', 'Event Storming'],
  palettes: ES_PALETTE_LIST,
};
