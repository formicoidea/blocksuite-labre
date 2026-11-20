import {
  EDGELESS_TOOLBAR_WIDGET,
  type EdgelessToolbarWidget,
} from '@labre/affine-widget-edgeless-toolbar';
import type { AnyCommandDescriptor, BlockStdScope } from '@labre/std';

import type { EdgelessTemplateButton } from './toolbar/template-tool-button.js';
import { TEMPLATE_SENIOR_TOOL_NAME } from './translations.js';

/**
 * How far the shortcut walks the toolbar row looking for the Templates button
 * before giving up: more than any row this library assembles (a dozen quick
 * tools, ten senior ones), and a bound so a row that never draws the button
 * cannot spin.
 */
const MAX_ROW_STEPS = 64;

function toolbarOf(std: BlockStdScope): EdgelessToolbarWidget | null {
  const rootId = std.store.root?.id;
  if (!rootId) return null;
  const root = std.view.getBlock(rootId);
  const widget = root?.widgetComponents[EDGELESS_TOOLBAR_WIDGET];
  return (widget as EdgelessToolbarWidget | undefined) ?? null;
}

/**
 * The Templates button, drawn. It is a senior tool, and the senior row is
 * PAGED: past a few frameworks the button is not in the DOM until the row is
 * scrolled to it. The shortcut pages it in through the row's own public
 * keyboard walk (`walkHighlight`, what Alt+←/→ does), backwards because the
 * button sits last (`order: 100`), then drops the highlight: no private state
 * of the toolbar is read or written.
 */
async function templateButtonOf(
  toolbar: EdgelessToolbarWidget
): Promise<EdgelessTemplateButton | null> {
  const find = () =>
    toolbar.shadowRoot?.querySelector<EdgelessTemplateButton>(
      'edgeless-template-button'
    ) ?? null;
  let button = find();
  for (let step = 0; !button && step < MAX_ROW_STEPS; step++) {
    if (!toolbar.walkHighlight(-1)) break;
    await toolbar.updateComplete;
    button = find();
  }
  toolbar.clearHighlight();
  return button;
}

/**
 * The Templates panel from the keyboard: `l` on the canvas opens it, as a
 * click on its toolbar button does, with the caret in its search field; `l`
 * again (the focus outside the field) closes it, as a second click does. In
 * the field `l` is a letter: the panel keeps every keystroke but Escape.
 *
 * `l` because the product owner's first wish, `t`, is the Text tool, and `m`
 * is already the mind map's (ADR 0055). A command rather than the button's own
 * `bindHotKey`, as `m` and `s` are: the paged row often leaves the button out
 * of the DOM, where a hotkey it binds would not exist, and a command is
 * overridable by the host and listed in Settings › Shortcuts.
 *
 * `'editable'`: on a read-only board the toolbar is not drawn and a template
 * cannot be inserted, so the key does nothing there. The `when` refuses the
 * presentation, whose toolbar replaces the row.
 */
const toggleTemplatePanel: AnyCommandDescriptor = {
  id: 'canvas.templates.toggle',
  owner: 'core',
  kind: 'action',
  labelKey: TEMPLATE_SENIOR_TOOL_NAME[0],
  labelFallback: TEMPLATE_SENIOR_TOOL_NAME[1],
  surfaces: [],
  scope: 'edgeless',
  defaultKeys: { mac: ['l'], other: ['l'] },
  availability: 'editable',
  when: std => {
    const toolbar = toolbarOf(std);
    return toolbar !== null && !toolbar.isPresentMode;
  },
  run: async std => {
    const toolbar = toolbarOf(std);
    if (!toolbar) return;
    const button = await templateButtonOf(toolbar);
    await button?.togglePanel({ focusSearch: true });
  },
};

export const templateCommands: AnyCommandDescriptor[] = [toggleTemplatePanel];
