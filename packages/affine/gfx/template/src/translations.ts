import type { ChromeWording } from '@labre/affine-shared/services';

/**
 * This package's own wordings, joined into `PACKAGE_WORDINGS` in
 * `@labre/affine/translations` — see that file and
 * `packages/affine/shared/src/services/translation-service/README.md`.
 *
 * Framework-derived template names do NOT live here: a template's tooltip is
 * resolved through the command it derives from (`resolveTemplateName`, in
 * `./toolbar/resolve-name.ts`), and a hand-written template's own name is a
 * key of the framework that authored it, not of this generic panel.
 */

/** The templates-panel tile's hover caption — genuinely generic chrome. */
export const TEMPLATE_PANEL_ADD: ChromeWording = [
  'com.labre.template.panel.add',
  'Add',
];

/** The templates-panel search field's placeholder. */
export const TEMPLATE_PANEL_SEARCH_PLACEHOLDER: ChromeWording = [
  'com.labre.template.panel.search-placeholder',
  'Search file or anything...',
];

/** The built-in "Other" category's own tab label. */
export const TEMPLATE_PANEL_CATEGORY_OTHER: ChromeWording = [
  'com.labre.template.panel.category.other',
  'Other',
];

/** The "Template" senior tool's own button name (`SeniorTool.labelKey`). */
export const TEMPLATE_SENIOR_TOOL_NAME: ChromeWording = [
  'com.labre.template.senior-tool.name',
  'Template',
];

export const TEMPLATE_PACKAGE_WORDINGS: readonly ChromeWording[] = [
  TEMPLATE_PANEL_ADD,
  TEMPLATE_PANEL_CATEGORY_OTHER,
  TEMPLATE_PANEL_SEARCH_PLACEHOLDER,
  TEMPLATE_SENIOR_TOOL_NAME,
];

/**
 * The generic ("Other") diagrams' own seeds: the captions painted onto the
 * five hand-composed templates in `builtin/other.ts` (SWOT, Kanban board,
 * Business model canvas, Fishbone, Gantt chart). Resolved through
 * `Template.localize` — no command draws these scenes, so there is no
 * creation-action call site to resolve them at.
 */
export const SWOT_SEED_STRENGTHS: ChromeWording = [
  'com.labre.template.seed.swot-strengths',
  'Strengths',
];
export const SWOT_SEED_WEAKNESSES: ChromeWording = [
  'com.labre.template.seed.swot-weaknesses',
  'Weaknesses',
];
export const SWOT_SEED_OPPORTUNITIES: ChromeWording = [
  'com.labre.template.seed.swot-opportunities',
  'Opportunities',
];
export const SWOT_SEED_THREATS: ChromeWording = [
  'com.labre.template.seed.swot-threats',
  'Threats',
];

export const KANBAN_SEED_CARD: ChromeWording = [
  'com.labre.template.seed.kanban-card',
  'Card',
];
export const KANBAN_SEED_TODO: ChromeWording = [
  'com.labre.template.seed.kanban-todo',
  'To do',
];
export const KANBAN_SEED_DOING: ChromeWording = [
  'com.labre.template.seed.kanban-doing',
  'Doing',
];
export const KANBAN_SEED_DONE: ChromeWording = [
  'com.labre.template.seed.kanban-done',
  'Done',
];

/** The canvas's own header, distinct from the catalog entry's `name`. */
export const BMC_SEED_TITLE: ChromeWording = [
  'com.labre.template.seed.bmc-title',
  'Business model canvas',
];
export const BMC_SEED_DESIGNED_FOR: ChromeWording = [
  'com.labre.template.seed.bmc-designed-for',
  'Designed for',
];
export const BMC_SEED_DESIGNED_BY: ChromeWording = [
  'com.labre.template.seed.bmc-designed-by',
  'Designed by',
];
export const BMC_SEED_DATE: ChromeWording = [
  'com.labre.template.seed.bmc-date',
  'Date',
];
export const BMC_SEED_VERSION: ChromeWording = [
  'com.labre.template.seed.bmc-version',
  'Version',
];
export const BMC_SEED_KEY_PARTNERSHIPS: ChromeWording = [
  'com.labre.template.seed.bmc-key-partnerships',
  'Key partnerships',
];
export const BMC_SEED_KEY_ACTIVITIES: ChromeWording = [
  'com.labre.template.seed.bmc-key-activities',
  'Key activities',
];
export const BMC_SEED_KEY_RESOURCES: ChromeWording = [
  'com.labre.template.seed.bmc-key-resources',
  'Key resources',
];
export const BMC_SEED_VALUE_PROPOSITIONS: ChromeWording = [
  'com.labre.template.seed.bmc-value-propositions',
  'Value propositions',
];
export const BMC_SEED_CUSTOMER_RELATIONSHIPS: ChromeWording = [
  'com.labre.template.seed.bmc-customer-relationships',
  'Customer relationships',
];
export const BMC_SEED_CHANNELS: ChromeWording = [
  'com.labre.template.seed.bmc-channels',
  'Channels',
];
export const BMC_SEED_CUSTOMER_SEGMENTS: ChromeWording = [
  'com.labre.template.seed.bmc-customer-segments',
  'Customer segments',
];
export const BMC_SEED_COST_STRUCTURE: ChromeWording = [
  'com.labre.template.seed.bmc-cost-structure',
  'Cost structure',
];
export const BMC_SEED_REVENUE_STREAMS: ChromeWording = [
  'com.labre.template.seed.bmc-revenue-streams',
  'Revenue streams',
];

export const FISHBONE_SEED_CATEGORY: ChromeWording = [
  'com.labre.template.seed.fishbone-category',
  'CATEGORY',
];
export const FISHBONE_SEED_EFFECT: ChromeWording = [
  'com.labre.template.seed.fishbone-effect',
  'Effect',
];
export const FISHBONE_SEED_ITEM_1: ChromeWording = [
  'com.labre.template.seed.fishbone-item-1',
  'ITEM 1',
];
export const FISHBONE_SEED_ITEM_2: ChromeWording = [
  'com.labre.template.seed.fishbone-item-2',
  'ITEM 2',
];

/** The week-column header above the gantt bars; `{{n}}` is its 1-based index. */
export const GANTT_SEED_WEEK: ChromeWording = [
  'com.labre.template.seed.gantt-week',
  'W{{n}}',
];
export const GANTT_SEED_DISCOVERY: ChromeWording = [
  'com.labre.template.seed.gantt-discovery',
  'Discovery',
];
export const GANTT_SEED_DESIGN: ChromeWording = [
  'com.labre.template.seed.gantt-design',
  'Design',
];
export const GANTT_SEED_BUILD: ChromeWording = [
  'com.labre.template.seed.gantt-build',
  'Build',
];
export const GANTT_SEED_LAUNCH: ChromeWording = [
  'com.labre.template.seed.gantt-launch',
  'Launch',
];

/** Every seed the five "Other" templates write, for `PACKAGE_SEED_WORDINGS`. */
export const OTHER_TEMPLATE_SEEDS: readonly ChromeWording[] = [
  SWOT_SEED_STRENGTHS,
  SWOT_SEED_WEAKNESSES,
  SWOT_SEED_OPPORTUNITIES,
  SWOT_SEED_THREATS,
  KANBAN_SEED_CARD,
  KANBAN_SEED_TODO,
  KANBAN_SEED_DOING,
  KANBAN_SEED_DONE,
  BMC_SEED_TITLE,
  BMC_SEED_DESIGNED_FOR,
  BMC_SEED_DESIGNED_BY,
  BMC_SEED_DATE,
  BMC_SEED_VERSION,
  BMC_SEED_KEY_PARTNERSHIPS,
  BMC_SEED_KEY_ACTIVITIES,
  BMC_SEED_KEY_RESOURCES,
  BMC_SEED_VALUE_PROPOSITIONS,
  BMC_SEED_CUSTOMER_RELATIONSHIPS,
  BMC_SEED_CHANNELS,
  BMC_SEED_CUSTOMER_SEGMENTS,
  BMC_SEED_COST_STRUCTURE,
  BMC_SEED_REVENUE_STREAMS,
  FISHBONE_SEED_CATEGORY,
  FISHBONE_SEED_EFFECT,
  FISHBONE_SEED_ITEM_1,
  FISHBONE_SEED_ITEM_2,
  GANTT_SEED_WEEK,
  GANTT_SEED_DISCOVERY,
  GANTT_SEED_DESIGN,
  GANTT_SEED_BUILD,
  GANTT_SEED_LAUNCH,
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_SEED_WORDINGS` under source `seed`
 * (`packages/affine/all/src/translations.ts`).
 */
export const TEMPLATE_SEED_WORDINGS: readonly ChromeWording[] =
  OTHER_TEMPLATE_SEEDS;
