/**
 * One header design for every side panel: the frame panel's.
 *
 * Why it exists: the selection pane drew its own header (a bold title, a
 * divider, touch-sized text buttons) beside the frame panel's 36px row with a
 * secondary-text title and icon buttons, and the product owner asked for the
 * native one. The design now lives once, in `panelHeaderStyles`
 * (`@labre/affine-shared/styles`), and each panel adopts it whole; this spec
 * fails the day one of them restyles its header on its own instead.
 */
import { FramePanelHeader } from '@labre/affine-fragment-frame-panel';
import { panelHeaderStyles } from '@labre/affine-shared/styles';
import { EdgelessSelectionPaneWidget } from '@labre/affine-widget-edgeless-toolbar';
import type { CSSResultGroup } from 'lit';
import { describe, expect, it } from 'vitest';

/** Every stylesheet a component declares, as one text. */
function cssTextOf(styles: CSSResultGroup | undefined): string {
  if (styles === undefined) return '';
  if (!Array.isArray(styles)) return 'cssText' in styles ? styles.cssText : '';
  return (styles as CSSResultGroup[]).map(cssTextOf).join('\n');
}

describe('side panel headers', () => {
  it.each([
    ['the frame panel', FramePanelHeader],
    ['the selection pane', EdgelessSelectionPaneWidget],
  ])('%s takes its header from panelHeaderStyles', (_, component) => {
    expect(cssTextOf(component.styles)).toContain(panelHeaderStyles.cssText);
  });
});
