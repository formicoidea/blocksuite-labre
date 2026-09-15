/**
 * The HEADLESS half of the UML pack: everything a host, an exporter, a rule or
 * a test can read and call without mounting an editor. The lit side — the
 * senior button, its menu, the element views and the renderers — is reached
 * through `./view` and is never re-exported here (`docs/adr/0009` on why the
 * two halves are separate entry points), and the shortcut rows are reached
 * through `./commands-manifest`, whose whole point is importing none of this.
 *
 * Unlike the older packs this index re-exports each module WHOLE rather than
 * naming members one by one. UML 2.5.1 is the largest notation the library
 * carries and its headless surface is the notation itself — the roles, the
 * geometry, the grammar of a property or an operation, the IR and the two
 * writers — so a curated list would have been a second inventory to keep in
 * step with the first, and the thing it usually catches (a member leaking that
 * should have stayed private) is caught here by the module boundary instead:
 * what a module does not export, this file cannot.
 */

/* ── What the notation IS: roles, geometry, the seeds it writes ─────────── */
export * from './background.js';
export * from './board-hit.js';
export * from './component.js';
export * from './consts.js';
// The two morph declarations and the line table they read. Headless data: what a
// classifier and a relationship may BECOME, which kinds are reachable from
// which, and the patch each is worth. The toolbar module that draws them is
// `./view.js`; these are what it is parameterized by, and what the unit and
// integration suites exercise without one.
export * from './edge-morph.js';
export * from './edge-styles.js';
export * from './keywords.js';
export * from './kinds.js';
export * from './legend.js';
export * from './morph.js';
// The combined fragment's operator table — the picker's DATA, and the words
// `§17.6.4`'s pentagon tag is offered under. Headless like `kinds.ts` beside it.
export * from './operators.js';
export * from './presets.js';
export * from './reading.js';
export * from './roles.js';

/* ── What a finished diagram is HELD TO: the rule pack and its two levels ─ */
export * from './profiles.js';
export * from './rules.js';

/* ── What it can be READ as: the grammar, the IR and the two writers ────── */
// The draw.io reader and the one impure step in front of it. Two modules and
// not one, and the split is ADR 0019's: `importDrawio` is pure and synchronous
// like every other interchange reader (`docs/adr/0012` P3), `decodeDrawio`
// needs `DecompressionStream` and is the command's to call.
export * from './drawio-decode.js';
export * from './drawio-import.js';
export * from './export.js';
export * from './filename.js';
export * from './grammar.js';
export * from './interchange.js';
export * from './model.js';
export * from './plantuml.js';
export * from './xmi.js';
// The XMI reader, and the tolerant tokenizer under it. Exported for the reason
// P3 gives: the parser is a pure function of a string, so a host that is not an
// editor — labre-mcp, a script, a test — calls it without a surface in sight.
export * from './xmi-import.js';
export * from './xml-reader.js';

/* ── The toolbox, for the host that composes the command registry and the
      translation-key manifest out of the frameworks it installed (see
      `packages/affine/all/src/{commands,translations}.ts`) ──────────────── */
export { umlCommandIcons, umlCommands } from './commands.js';
export { umlCommandsManifest } from './commands-manifest.js';
export { umlTranslationEntries } from './translations.js';
