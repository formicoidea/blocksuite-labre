import {
  type ChromeWording,
  MINDMAP_NAME,
} from '@labre/affine-shared/services';

/**
 * The mindmap's own seeds: the captions a freshly placed mindmap is written
 * with, wherever the gesture draws one directly (the toolbar's built-in
 * templates, the drag-from-basket tool, a `.mm`/`.opml` import that meets an
 * empty node). Resolved at PLACEMENT and never again (ADR 0016) — a node
 * renamed by its author keeps its name, and a mindmap created before these
 * keys existed keeps the plain text it was given.
 *
 * `root` and `child` are shared by every gesture that draws a plain mindmap
 * with no real content yet (the built-in templates and the basket tool both
 * write the same two words); `topic1`–`topic3` are the three placeholder
 * children the STARTER TEMPLATES draw, one key per position; `imported-node`
 * is what a `.mm` / `.opml` file's own untitled node becomes.
 */
export const MINDMAP_SEED_ROOT: ChromeWording = [
  'com.labre.mindmap.seed.root',
  'Mind Map',
];
export const MINDMAP_SEED_CHILD: ChromeWording = [
  'com.labre.mindmap.seed.child',
  'Text',
];
export const MINDMAP_SEED_TOPIC_1: ChromeWording = [
  'com.labre.mindmap.seed.topic-1',
  'Topic 1',
];
export const MINDMAP_SEED_TOPIC_2: ChromeWording = [
  'com.labre.mindmap.seed.topic-2',
  'Topic 2',
];
export const MINDMAP_SEED_TOPIC_3: ChromeWording = [
  'com.labre.mindmap.seed.topic-3',
  'Topic 3',
];
export const MINDMAP_SEED_IMPORTED_NODE: ChromeWording = [
  'com.labre.mindmap.seed.imported-node',
  'MINDMAP',
];

/**
 * The mindmap model's `addNode` (`packages/affine/model`, a red zone this
 * package never edits) defaults an untitled node's text to the literal
 * `'New node'` when no caller supplies one. Declared here — a seed, resolved
 * at the gesture that calls `addNode`, never again — so every call site that
 * relied on the model's own default can pass this instead:
 * `{ text: translateKey(std, ...MINDMAP_SEED_NEW_NODE) }`. Used by this
 * package's own gestures and by `widgets/edgeless-selected-rect`'s
 * "add sibling / child node" action (`edgeless-auto-complete.ts`);
 * `blocks/root` imports it directly for its own call sites onto the same
 * model.
 */
export const MINDMAP_SEED_NEW_NODE: ChromeWording = [
  'com.labre.mindmap.seed.new-node',
  'New node',
];

/**
 * This package's contribution to the translation-key manifest, listed in
 * `PACKAGE_SEED_WORDINGS` under source `seed`
 * (`packages/affine/all/src/translations.ts`).
 */
export const MINDMAP_SEED_WORDINGS: readonly ChromeWording[] = [
  MINDMAP_SEED_ROOT,
  MINDMAP_SEED_CHILD,
  MINDMAP_SEED_TOPIC_1,
  MINDMAP_SEED_TOPIC_2,
  MINDMAP_SEED_TOPIC_3,
  MINDMAP_SEED_IMPORTED_NODE,
  MINDMAP_SEED_NEW_NODE,
];

/* ── Chrome: the mindmap's own toolbar, senior buttons and template tab ──── */

/**
 * "Mind Map" said as chrome rather than as a seed: the template-panel
 * category tab, the senior/quick tool's own name, and every tooltip that
 * names the mindmap tool — one word, one key, reused across every drawer in
 * this package.
 */
export const MINDMAP_TOOLTIP = MINDMAP_NAME;

/** The Templates panel's "Mind Map" category tab (`TemplateCategory.nameKey`). */
export const MINDMAP_TEMPLATE_CATEGORY = MINDMAP_TOOLTIP;

/**
 * The four starter templates' own tile names (`Template.nameKey`) — chrome,
 * resolved by the panel widget every time it opens, distinct from the seeds
 * ({@link MINDMAP_SEED_WORDINGS}) each starter WRITES into the document.
 */
export const MINDMAP_TEMPLATE_NAME_STYLE_1: ChromeWording = [
  'com.labre.mindmap.template.style-1',
  'Mind Map — Style 1',
];
export const MINDMAP_TEMPLATE_NAME_STYLE_2: ChromeWording = [
  'com.labre.mindmap.template.style-2',
  'Mind Map — Style 2',
];
export const MINDMAP_TEMPLATE_NAME_STYLE_3: ChromeWording = [
  'com.labre.mindmap.template.style-3',
  'Mind Map — Style 3',
];
export const MINDMAP_TEMPLATE_NAME_STYLE_4: ChromeWording = [
  'com.labre.mindmap.template.style-4',
  'Mind Map — Style 4',
];

export const MINDMAP_LAYOUT_LABEL: ChromeWording = [
  'com.labre.mindmap.toolbar.layout',
  'Layout',
];

/**
 * The three layout directions — a different concept from `gfx/text`'s own
 * "Left" / "Right" text alignment (`TEXT_ALIGN_LEFT`/`RIGHT`), so kept as
 * this package's own keys: the English word coincides, the meaning (which
 * way the tree grows vs. how a line of text sits) does not.
 */
export const MINDMAP_LAYOUT_LEFT: ChromeWording = [
  'com.labre.mindmap.toolbar.layout.left',
  'Left',
];

export const MINDMAP_LAYOUT_RADIAL: ChromeWording = [
  'com.labre.mindmap.toolbar.layout.radial',
  'Radial',
];

export const MINDMAP_LAYOUT_RIGHT: ChromeWording = [
  'com.labre.mindmap.toolbar.layout.right',
  'Right',
];

export const MINDMAP_IMPORT_TOOLTIP: ChromeWording = [
  'com.labre.mindmap.toolbar.import-tooltip',
  'Support import of FreeMind,OPML.',
];

export const MINDMAP_IMPORT_FAILED_TOAST: ChromeWording = [
  'com.labre.mindmap.toolbar.import-failed',
  'Import failed, please try again',
];

export const MINDMAP_IMPORTING_PLACEHOLDER: ChromeWording = [
  'com.labre.mindmap.toolbar.importing-placeholder',
  'Importing mind map...',
];

export const MINDMAP_ADD_MEDIA_TOOLTIP: ChromeWording = [
  'com.labre.mindmap.toolbar.add-media',
  'Add media',
];

export const MINDMAP_EDGELESS_TEXT_TOOLTIP: ChromeWording = [
  'com.labre.mindmap.toolbar.edgeless-text',
  'Canvas Text',
];

/** The promoted "Add file" senior tool's own name/tooltip. */
export const MINDMAP_ADD_FILE_TOOL: ChromeWording = [
  'com.labre.mindmap.senior-tool.add-file',
  'Add file',
];

/**
 * This package's chrome contribution to the manifest, listed in
 * `PACKAGE_WORDINGS` under source `chrome`. `STYLE_MENU_LABEL` and
 * `TOOL_NAME_TEXT` (this package's own "Style" menu and standalone "Text"
 * senior tool) are declared once in `chrome.ts` — shared with `gfx/shape` and
 * `widgets/edgeless-selected-rect` — and imported directly at their call
 * sites rather than re-declared here.
 */
export const MINDMAP_CHROME_WORDINGS: readonly ChromeWording[] = [
  MINDMAP_TEMPLATE_NAME_STYLE_1,
  MINDMAP_TEMPLATE_NAME_STYLE_2,
  MINDMAP_TEMPLATE_NAME_STYLE_3,
  MINDMAP_TEMPLATE_NAME_STYLE_4,
  MINDMAP_LAYOUT_LABEL,
  MINDMAP_LAYOUT_LEFT,
  MINDMAP_LAYOUT_RADIAL,
  MINDMAP_LAYOUT_RIGHT,
  MINDMAP_IMPORT_TOOLTIP,
  MINDMAP_IMPORT_FAILED_TOAST,
  MINDMAP_IMPORTING_PLACEHOLDER,
  MINDMAP_ADD_MEDIA_TOOLTIP,
  MINDMAP_EDGELESS_TEXT_TOOLTIP,
  MINDMAP_ADD_FILE_TOOL,
];
