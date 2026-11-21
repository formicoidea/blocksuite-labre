import {
  EDGELESS_TOOLBAR_WIDGET,
  type EdgelessToolbarWidget,
  SeniorToolIdentifier,
} from '@labre/affine-widget-edgeless-toolbar';
import type { AnyCommandDescriptor, BlockStdScope } from '@labre/std';

import { TEMPLATE_SENIOR_TOOL_ID } from './toolbar/senior-tool.js';
import type { EdgelessTemplateButton } from './toolbar/template-tool-button.js';
import { TEMPLATE_SENIOR_TOOL_NAME } from './translations.js';

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
 * scrolled to it. It is the LAST tool of the row (`order: 100`), so one step
 * of the row's own public keyboard walk backwards from no highlight
 * (`walkHighlight(-1)`, what Alt+← does) lands on it and shows the last page;
 * the highlight is then dropped. `walkHighlight` / `clearHighlight` exist with
 * the same meaning on the base and in the toolbar keyboard model of ADR 0054:
 * no private state of the toolbar is read or written.
 */
async function templateButtonOf(
  toolbar: EdgelessToolbarWidget
): Promise<EdgelessTemplateButton | null> {
  const find = () =>
    toolbar.shadowRoot?.querySelector<EdgelessTemplateButton>(
      'edgeless-template-button'
    ) ?? null;
  const drawn = find();
  if (drawn) return drawn;
  toolbar.clearHighlight();
  let button: EdgelessTemplateButton | null = null;
  if (toolbar.walkHighlight(-1)) {
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
  // Free when the assembly has no Templates button (a host that removed it):
  // `l` then does nothing and reaches whatever else binds it.
  when: std => {
    const toolbar = toolbarOf(std);
    return (
      toolbar !== null &&
      !toolbar.isPresentMode &&
      std.provider.getAll(SeniorToolIdentifier).has(TEMPLATE_SENIOR_TOOL_ID)
    );
  },
  run: async std => {
    const toolbar = toolbarOf(std);
    if (!toolbar) return;
    const page = toolbar.scrollSeniorToolIndex;
    const button = await templateButtonOf(toolbar);
    if (!button) return;
    const shown = toolbar.scrollSeniorToolIndex;
    await button.togglePanel({
      focusSearch: true,
      // The row goes back to the page the user was looking at, unless they
      // paged it themselves while the panel was open.
      onClose: () => {
        if (toolbar.scrollSeniorToolIndex === shown) {
          toolbar.scrollSeniorToolIndex = page;
        }
      },
    });
  },
};

export const templateCommands: AnyCommandDescriptor[] = [toggleTemplatePanel];
