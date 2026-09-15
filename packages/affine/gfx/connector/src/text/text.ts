/**
 * The barrel's door onto the label editor.
 *
 * It used to carry a SECOND copy of `mountConnectorLabelEditor`, byte-alike
 * with the one in `edgeless-connector-label-editor.ts` — and since this file is
 * what `text/index.ts` re-exports, the toolbar and the keyboard reached this
 * copy while the connector view's double-click imported the other one directly.
 * Two bodies, one behaviour, and no way to add the per-end selector
 * (`docs/adr/0018` phase 2) to both at once without adding it twice.
 *
 * One body now lives next door; this file only forwards it.
 */
export * from './edgeless-connector-label-editor.js';
