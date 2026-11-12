import { adoptEmotionStyles } from '@labre/affine-shared/styles';
import { adoptShadowlessStyles } from '@labre/std';

/**
 * A public page's Content-Security-Policy blocks `<style>` elements: the
 * library's styles go to adopted sheets (ADR 0050). The library's emotion
 * instance inserts each rule as `css()` is called, at the import of the
 * table and database modules, so the switch has to happen before they
 * evaluate: `canvas-viewer.ts` imports this module first, and ES modules
 * evaluate in import order, so its top level runs before any block module.
 * The editor, which never imports it, keeps its `<style>` elements.
 */
export function adoptViewerPageStyles(): void {
  if (typeof document === 'undefined') return;
  adoptShadowlessStyles();
  adoptEmotionStyles();
}

adoptViewerPageStyles();
