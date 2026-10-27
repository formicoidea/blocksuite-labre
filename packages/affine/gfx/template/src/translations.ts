import {
  BLOCK_TYPE_QUOTE,
  CATALOGUE_OTHER,
  type ChromeWording,
} from '@labre/affine-shared/services';

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

/**
 * The built-in "Other" category's own tab label. An alias (L7 dedupe): the
 * same word as {@link CATALOGUE_OTHER}, one key.
 */
export const TEMPLATE_PANEL_CATEGORY_OTHER = CATALOGUE_OTHER;

/**
 * The tab of the frames a host keeps as templates (`FrameTemplateProvider`,
 * `SAVED_FRAMES_CATEGORY`); there is no such tab without that host.
 */
export const TEMPLATE_PANEL_CATEGORY_SAVED_FRAMES: ChromeWording = [
  'com.labre.template.panel.category.saved-frames',
  'Saved frames',
];

/** The "Template" senior tool's own button name (`SeniorTool.labelKey`). */
export const TEMPLATE_SENIOR_TOOL_NAME: ChromeWording = [
  'com.labre.template.senior-tool.name',
  'Template',
];

/* ── The five "Other" tiles' own names (#390) ─────────────────────────────
 *
 * A hand-composed template derives no tile name from a command, so it needs a
 * `nameKey` of its own — the same seam every framework category already uses
 * for its hand-written templates (`gfx/bpmn`, `gfx/edgy`, `gfx/mindmap`…).
 * Only the NAME is chrome here; the captions painted into each scene are
 * seeds, declared further down and resolved through `Template.localize`.
 *
 * `TEMPLATE_NAME_BUSINESS_MODEL_CANVAS` and `BMC_SEED_TITLE` share the same
 * English words on purpose and do NOT collide: the seed is written once into
 * the document, the tile is redrawn every time the panel opens, and the
 * "un mot chrome, une clé" test groups `source: 'chrome'` only.
 */
export const TEMPLATE_NAME_SWOT: ChromeWording = [
  'com.labre.template.name.swot',
  'SWOT',
];
export const TEMPLATE_NAME_KANBAN_BOARD: ChromeWording = [
  'com.labre.template.name.kanban-board',
  'Kanban board',
];
export const TEMPLATE_NAME_BUSINESS_MODEL_CANVAS: ChromeWording = [
  'com.labre.template.name.business-model-canvas',
  'Business model canvas',
];
export const TEMPLATE_NAME_FISHBONE: ChromeWording = [
  'com.labre.template.name.fishbone',
  'Fishbone (Ishikawa)',
];
export const TEMPLATE_NAME_GANTT_CHART: ChromeWording = [
  'com.labre.template.name.gantt-chart',
  'Gantt chart',
];

/* ── The "Slides" category (16:9 slide masks, `builtin/slides/`) ────────
 *
 * Its tab and its tiles are chrome; a tile's name is ALSO written once, at
 * placement, as the title of the frame the mask inserts (a frame title is
 * document content, ADR 0023) — one key for both, like the frame tool's own
 * seed name. Everything painted inside the frame is a seed below.
 */
export const TEMPLATE_PANEL_CATEGORY_SLIDES: ChromeWording = [
  'com.labre.template.slides.category',
  'Slides',
];
export const SLIDE_NAME_COVER: ChromeWording = [
  'com.labre.template.slides.name.cover',
  'Cover',
];
export const SLIDE_NAME_COVER_IMAGE: ChromeWording = [
  'com.labre.template.slides.name.cover-image',
  'Cover with image',
];
export const SLIDE_NAME_SECTION: ChromeWording = [
  'com.labre.template.slides.name.section',
  'Section',
];
export const SLIDE_NAME_STATEMENT: ChromeWording = [
  'com.labre.template.slides.name.statement',
  'Statement',
];
export const SLIDE_NAME_TEXT_IMAGE: ChromeWording = [
  'com.labre.template.slides.name.text-image',
  'Text and image',
];
export const SLIDE_NAME_FULL_IMAGE: ChromeWording = [
  'com.labre.template.slides.name.full-image',
  'Full image',
];
export const SLIDE_NAME_TWO_COLUMNS: ChromeWording = [
  'com.labre.template.slides.name.two-columns',
  'Two columns',
];
export const SLIDE_NAME_THREE_COLUMNS: ChromeWording = [
  'com.labre.template.slides.name.three-columns',
  'Three columns',
];
export const SLIDE_NAME_SIX_POINTS: ChromeWording = [
  'com.labre.template.slides.name.six-points',
  'Six points',
];
export const SLIDE_NAME_IMAGE_CARDS: ChromeWording = [
  'com.labre.template.slides.name.image-cards',
  'Image cards',
];
export const SLIDE_NAME_AGENDA: ChromeWording = [
  'com.labre.template.slides.name.agenda',
  'Agenda',
];
/** An alias (L7 dedupe): the quote block's own word, one key. */
export const SLIDE_NAME_QUOTE = BLOCK_TYPE_QUOTE;
export const SLIDE_NAME_TESTIMONIALS: ChromeWording = [
  'com.labre.template.slides.name.testimonials',
  'Testimonials',
];
export const SLIDE_NAME_TEAM: ChromeWording = [
  'com.labre.template.slides.name.team',
  'Team',
];
export const SLIDE_NAME_CONTACT: ChromeWording = [
  'com.labre.template.slides.name.contact',
  'Contact',
];
export const SLIDE_NAME_ORG_CHART: ChromeWording = [
  'com.labre.template.slides.name.org-chart',
  'Org chart',
];
export const SLIDE_NAME_KEY_FIGURES: ChromeWording = [
  'com.labre.template.slides.name.key-figures',
  'Key figures',
];
export const SLIDE_NAME_TIMELINE: ChromeWording = [
  'com.labre.template.slides.name.timeline',
  'Timeline',
];
export const SLIDE_NAME_ROADMAP: ChromeWording = [
  'com.labre.template.slides.name.roadmap',
  'Roadmap',
];
export const SLIDE_NAME_PROCESS: ChromeWording = [
  'com.labre.template.slides.name.process',
  'Process',
];
export const SLIDE_NAME_MATRIX: ChromeWording = [
  'com.labre.template.slides.name.matrix',
  'Two-by-two matrix',
];
export const SLIDE_NAME_VENN: ChromeWording = [
  'com.labre.template.slides.name.venn',
  'Venn diagram',
];
export const SLIDE_NAME_MARKET_SIZE: ChromeWording = [
  'com.labre.template.slides.name.market-size',
  'Market size',
];
export const SLIDE_NAME_PRICING: ChromeWording = [
  'com.labre.template.slides.name.pricing',
  'Pricing',
];
export const SLIDE_NAME_LOGO_WALL: ChromeWording = [
  'com.labre.template.slides.name.logo-wall',
  'Logo wall',
];

export const SLIDE_NAME_GANTT: ChromeWording = [
  'com.labre.template.slides.name.gantt',
  'Gantt plan',
];
export const SLIDE_NAME_CHART_TEXT: ChromeWording = [
  'com.labre.template.slides.name.chart-text',
  'Chart and text',
];
export const SLIDE_NAME_THREE_CHARTS: ChromeWording = [
  'com.labre.template.slides.name.three-charts',
  'Three charts',
];
export const SLIDE_NAME_COLLAGE: ChromeWording = [
  'com.labre.template.slides.name.collage',
  'Text and collage',
];
export const SLIDE_NAME_BENTO: ChromeWording = [
  'com.labre.template.slides.name.bento',
  'Picture bento',
];
export const SLIDE_NAME_IMAGE_GRID: ChromeWording = [
  'com.labre.template.slides.name.image-grid',
  'Picture grid',
];
export const SLIDE_NAME_FEATURE_BENTO: ChromeWording = [
  'com.labre.template.slides.name.feature-bento',
  'Feature bento',
];
export const SLIDE_NAME_PHONE: ChromeWording = [
  'com.labre.template.slides.name.phone',
  'Phone mockup',
];
export const SLIDE_NAME_TABLET: ChromeWording = [
  'com.labre.template.slides.name.tablet',
  'Tablet mockup',
];

/**
 * The slide-mask tile names this package declares (the quote slide's is the
 * quote block's own, declared in `chrome.ts`).
 */
export const SLIDE_NAME_WORDINGS: readonly ChromeWording[] = [
  SLIDE_NAME_COVER,
  SLIDE_NAME_COVER_IMAGE,
  SLIDE_NAME_SECTION,
  SLIDE_NAME_STATEMENT,
  SLIDE_NAME_TEXT_IMAGE,
  SLIDE_NAME_FULL_IMAGE,
  SLIDE_NAME_TWO_COLUMNS,
  SLIDE_NAME_THREE_COLUMNS,
  SLIDE_NAME_SIX_POINTS,
  SLIDE_NAME_IMAGE_CARDS,
  SLIDE_NAME_AGENDA,
  SLIDE_NAME_TESTIMONIALS,
  SLIDE_NAME_TEAM,
  SLIDE_NAME_CONTACT,
  SLIDE_NAME_ORG_CHART,
  SLIDE_NAME_KEY_FIGURES,
  SLIDE_NAME_TIMELINE,
  SLIDE_NAME_ROADMAP,
  SLIDE_NAME_PROCESS,
  SLIDE_NAME_MATRIX,
  SLIDE_NAME_VENN,
  SLIDE_NAME_MARKET_SIZE,
  SLIDE_NAME_PRICING,
  SLIDE_NAME_LOGO_WALL,
  SLIDE_NAME_GANTT,
  SLIDE_NAME_CHART_TEXT,
  SLIDE_NAME_THREE_CHARTS,
  SLIDE_NAME_COLLAGE,
  SLIDE_NAME_BENTO,
  SLIDE_NAME_IMAGE_GRID,
  SLIDE_NAME_FEATURE_BENTO,
  SLIDE_NAME_PHONE,
  SLIDE_NAME_TABLET,
];

/** The seeds a slide mask writes into the document, shared by every mask. */
export const SLIDE_SEED_EYEBROW: ChromeWording = [
  'com.labre.template.slides.seed.eyebrow',
  'Your name · Company name',
];
export const SLIDE_SEED_COVER_TITLE: ChromeWording = [
  'com.labre.template.slides.seed.cover-title',
  'Presentation title',
];
export const SLIDE_SEED_DATE: ChromeWording = [
  'com.labre.template.slides.seed.date',
  'Date',
];
export const SLIDE_SEED_TITLE: ChromeWording = [
  'com.labre.template.slides.seed.title',
  'Describe this slide',
];
export const SLIDE_SEED_SUBTITLE: ChromeWording = [
  'com.labre.template.slides.seed.subtitle',
  'A short line that sets the context',
];
export const SLIDE_SEED_SECTION_TITLE: ChromeWording = [
  'com.labre.template.slides.seed.section-title',
  'Section title',
];
export const SLIDE_SEED_SECTION_SUBTITLE: ChromeWording = [
  'com.labre.template.slides.seed.section-subtitle',
  'Explain what this section is about',
];
export const SLIDE_SEED_STATEMENT: ChromeWording = [
  'com.labre.template.slides.seed.statement',
  'Add a bold statement to keep your audience focused',
];
export const SLIDE_SEED_HEADING: ChromeWording = [
  'com.labre.template.slides.seed.heading',
  'A key point, in ten words or less',
];
export const SLIDE_SEED_BODY: ChromeWording = [
  'com.labre.template.slides.seed.body',
  'Expand on your point: say why your audience should care, and how it ties into the other ideas on this slide.',
];
export const SLIDE_SEED_IMAGE: ChromeWording = [
  'com.labre.template.slides.seed.image',
  'Image',
];
export const SLIDE_SEED_CAPTION: ChromeWording = [
  'com.labre.template.slides.seed.caption',
  'A picture may be worth a thousand words, but a caption helps',
];
export const SLIDE_SEED_FOOTER: ChromeWording = [
  'com.labre.template.slides.seed.footer',
  'Footer',
];
export const SLIDE_SEED_AGENDA_TITLE: ChromeWording = [
  'com.labre.template.slides.seed.agenda-title',
  'Agenda',
];
export const SLIDE_SEED_AGENDA_ITEM: ChromeWording = [
  'com.labre.template.slides.seed.agenda-item',
  'Agenda item',
];
export const SLIDE_SEED_QUOTE: ChromeWording = [
  'com.labre.template.slides.seed.quote',
  '“Add a quote that captures what your audience should remember.”',
];
export const SLIDE_SEED_QUOTE_AUTHOR: ChromeWording = [
  'com.labre.template.slides.seed.quote-author',
  'Name, Role at Company',
];
export const SLIDE_SEED_TESTIMONIALS_TITLE: ChromeWording = [
  'com.labre.template.slides.seed.testimonials-title',
  'What our clients say',
];
export const SLIDE_SEED_TEAM_TITLE: ChromeWording = [
  'com.labre.template.slides.seed.team-title',
  'Meet the team',
];
export const SLIDE_SEED_PERSON_NAME: ChromeWording = [
  'com.labre.template.slides.seed.person-name',
  'Name',
];
export const SLIDE_SEED_PERSON_ROLE: ChromeWording = [
  'com.labre.template.slides.seed.person-role',
  'Role',
];
export const SLIDE_SEED_CONTACT_TITLE: ChromeWording = [
  'com.labre.template.slides.seed.contact-title',
  'Contact',
];
export const SLIDE_SEED_CONTACT_ADDRESS: ChromeWording = [
  'com.labre.template.slides.seed.contact-address',
  'Address',
];
export const SLIDE_SEED_CONTACT_PHONE: ChromeWording = [
  'com.labre.template.slides.seed.contact-phone',
  'Phone',
];
export const SLIDE_SEED_CONTACT_EMAIL: ChromeWording = [
  'com.labre.template.slides.seed.contact-email',
  'Email',
];
export const SLIDE_SEED_CONTACT_VALUE: ChromeWording = [
  'com.labre.template.slides.seed.contact-value',
  'Add the details here',
];
export const SLIDE_SEED_FIGURE: ChromeWording = [
  'com.labre.template.slides.seed.figure',
  '99%',
];
export const SLIDE_SEED_DETAIL: ChromeWording = [
  'com.labre.template.slides.seed.detail',
  'A short description',
];
export const SLIDE_SEED_FIGURE_LABEL: ChromeWording = [
  'com.labre.template.slides.seed.figure-label',
  'What this number measures',
];
export const SLIDE_SEED_MILESTONE: ChromeWording = [
  'com.labre.template.slides.seed.milestone',
  'Milestone',
];
export const SLIDE_SEED_QUARTER: ChromeWording = [
  'com.labre.template.slides.seed.quarter',
  'Q{{n}}',
];
export const SLIDE_SEED_STEP: ChromeWording = [
  'com.labre.template.slides.seed.step',
  'Step {{n}}',
];
export const SLIDE_SEED_AXIS_VALUE: ChromeWording = [
  'com.labre.template.slides.seed.axis-value',
  'Value',
];
export const SLIDE_SEED_AXIS_EFFORT: ChromeWording = [
  'com.labre.template.slides.seed.axis-effort',
  'Effort',
];
export const SLIDE_SEED_QUADRANT: ChromeWording = [
  'com.labre.template.slides.seed.quadrant',
  'Quadrant',
];
export const SLIDE_SEED_VENN_IDEA: ChromeWording = [
  'com.labre.template.slides.seed.venn-idea',
  'One idea',
];
export const SLIDE_SEED_VENN_OTHER: ChromeWording = [
  'com.labre.template.slides.seed.venn-other',
  'Another idea',
];
export const SLIDE_SEED_VENN_OVERLAP: ChromeWording = [
  'com.labre.template.slides.seed.venn-overlap',
  'The best of both',
];
export const SLIDE_SEED_MARKET_TOTAL: ChromeWording = [
  'com.labre.template.slides.seed.market-total',
  'Total market',
];
export const SLIDE_SEED_MARKET_SERVICEABLE: ChromeWording = [
  'com.labre.template.slides.seed.market-serviceable',
  'Serviceable market',
];
export const SLIDE_SEED_MARKET_OBTAINABLE: ChromeWording = [
  'com.labre.template.slides.seed.market-obtainable',
  'Obtainable market',
];
export const SLIDE_SEED_PLAN: ChromeWording = [
  'com.labre.template.slides.seed.plan',
  'Plan',
];
export const SLIDE_SEED_PRICE: ChromeWording = [
  'com.labre.template.slides.seed.price',
  'Price',
];
export const SLIDE_SEED_FEATURE: ChromeWording = [
  'com.labre.template.slides.seed.feature',
  'A feature of this plan',
];
export const SLIDE_SEED_LOGO: ChromeWording = [
  'com.labre.template.slides.seed.logo',
  'Logo',
];

/** The label of a chart placeholder: a dashed zone, like a picture's. */
export const SLIDE_SEED_CHART: ChromeWording = [
  'com.labre.template.slides.seed.chart',
  'Chart',
];
/** The label of a device mockup's screen zone. */
export const SLIDE_SEED_SCREEN: ChromeWording = [
  'com.labre.template.slides.seed.screen',
  'Screen',
];
export const SLIDE_SEED_TASK: ChromeWording = [
  'com.labre.template.slides.seed.task',
  'Task',
];
export const SLIDE_SEED_MONTH: ChromeWording = [
  'com.labre.template.slides.seed.month',
  'Month {{n}}',
];

export const SLIDE_SEED_WORDINGS: readonly ChromeWording[] = [
  SLIDE_SEED_EYEBROW,
  SLIDE_SEED_COVER_TITLE,
  SLIDE_SEED_DATE,
  SLIDE_SEED_TITLE,
  SLIDE_SEED_SUBTITLE,
  SLIDE_SEED_SECTION_TITLE,
  SLIDE_SEED_SECTION_SUBTITLE,
  SLIDE_SEED_STATEMENT,
  SLIDE_SEED_HEADING,
  SLIDE_SEED_BODY,
  SLIDE_SEED_IMAGE,
  SLIDE_SEED_CAPTION,
  SLIDE_SEED_FOOTER,
  SLIDE_SEED_AGENDA_TITLE,
  SLIDE_SEED_AGENDA_ITEM,
  SLIDE_SEED_QUOTE,
  SLIDE_SEED_QUOTE_AUTHOR,
  SLIDE_SEED_TESTIMONIALS_TITLE,
  SLIDE_SEED_TEAM_TITLE,
  SLIDE_SEED_PERSON_NAME,
  SLIDE_SEED_PERSON_ROLE,
  SLIDE_SEED_CONTACT_TITLE,
  SLIDE_SEED_CONTACT_ADDRESS,
  SLIDE_SEED_CONTACT_PHONE,
  SLIDE_SEED_CONTACT_EMAIL,
  SLIDE_SEED_CONTACT_VALUE,
  SLIDE_SEED_FIGURE,
  SLIDE_SEED_DETAIL,
  SLIDE_SEED_FIGURE_LABEL,
  SLIDE_SEED_MILESTONE,
  SLIDE_SEED_QUARTER,
  SLIDE_SEED_STEP,
  SLIDE_SEED_AXIS_VALUE,
  SLIDE_SEED_AXIS_EFFORT,
  SLIDE_SEED_QUADRANT,
  SLIDE_SEED_VENN_IDEA,
  SLIDE_SEED_VENN_OTHER,
  SLIDE_SEED_VENN_OVERLAP,
  SLIDE_SEED_MARKET_TOTAL,
  SLIDE_SEED_MARKET_SERVICEABLE,
  SLIDE_SEED_MARKET_OBTAINABLE,
  SLIDE_SEED_PLAN,
  SLIDE_SEED_PRICE,
  SLIDE_SEED_FEATURE,
  SLIDE_SEED_LOGO,
  SLIDE_SEED_CHART,
  SLIDE_SEED_SCREEN,
  SLIDE_SEED_TASK,
  SLIDE_SEED_MONTH,
];

export const TEMPLATE_PACKAGE_WORDINGS: readonly ChromeWording[] = [
  TEMPLATE_PANEL_ADD,
  TEMPLATE_PANEL_SEARCH_PLACEHOLDER,
  TEMPLATE_PANEL_CATEGORY_SAVED_FRAMES,
  TEMPLATE_SENIOR_TOOL_NAME,
  TEMPLATE_NAME_SWOT,
  TEMPLATE_NAME_KANBAN_BOARD,
  TEMPLATE_NAME_BUSINESS_MODEL_CANVAS,
  TEMPLATE_NAME_FISHBONE,
  TEMPLATE_NAME_GANTT_CHART,
  TEMPLATE_PANEL_CATEGORY_SLIDES,
  ...SLIDE_NAME_WORDINGS,
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
export const TEMPLATE_SEED_WORDINGS: readonly ChromeWording[] = [
  ...OTHER_TEMPLATE_SEEDS,
  ...SLIDE_SEED_WORDINGS,
];
