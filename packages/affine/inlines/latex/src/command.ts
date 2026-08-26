import {
  DocModeProvider,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type { AffineInlineEditor } from '@labre/affine-shared/types';
import type { Command, TextSelection } from '@labre/std';
import type { InlineRange } from '@labre/std/inline';

function openInlineLatexEditor(
  inlineEditor: AffineInlineEditor,
  index: number
) {
  inlineEditor
    .waitForUpdate()
    .then(async () => {
      await inlineEditor.waitForUpdate();

      const textPoint = inlineEditor.getTextPoint(index);
      if (!textPoint) return;
      const [text] = textPoint;
      const latexNode = text.parentElement?.closest('affine-latex-node');
      if (!latexNode) return;
      latexNode.toggleEditor();
    })
    .catch(console.error);
}

/**
 * An inline equation can only replace a range living in a single block, so a
 * selection spanning several blocks is refused instead of silently applying to
 * its first block.
 */
function getSingleBlockInlineRange(
  textSelection: TextSelection
): InlineRange | null {
  if (textSelection.to) {
    return null;
  }

  return {
    index: textSelection.from.index,
    length: textSelection.from.length,
  };
}

export const insertInlineLatex: Command<{
  currentTextSelection?: TextSelection;
  textSelection?: TextSelection;
}> = (ctx, next) => {
  const textSelection = ctx.textSelection ?? ctx.currentTextSelection;
  if (!textSelection) return;

  const blockComponent = ctx.std.view.getBlock(textSelection.from.blockId);
  if (!blockComponent) return;

  const richText = blockComponent.querySelector('rich-text');
  if (!richText) return;

  const inlineEditor = richText.inlineEditor;
  if (!inlineEditor) return;

  const inlineRange = getSingleBlockInlineRange(textSelection);
  if (!inlineRange) return;

  // A non-collapsed selection becomes the equation source, so selecting a
  // formula and asking for an inline equation renders what was already typed.
  const latex = textSelection.isCollapsed()
    ? ''
    : inlineEditor.yTextString.slice(
        inlineRange.index,
        inlineRange.index + inlineRange.length
      );

  inlineEditor.insertText(inlineRange, ' ', { latex });
  inlineEditor.setInlineRange({
    index: inlineRange.index,
    length: 1,
  });

  const mode = ctx.std.get(DocModeProvider).getEditorMode() ?? 'page';
  const ifEdgelessText = blockComponent.closest('affine-edgeless-text');
  ctx.std.getOptional(TelemetryProvider)?.track('Latex', {
    from:
      mode === 'page'
        ? 'doc'
        : ifEdgelessText
          ? 'edgeless text'
          : 'edgeless note',
    page: mode === 'page' ? 'doc' : 'edgeless',
    segment: mode === 'page' ? 'doc' : 'whiteboard',
    module: 'inline equation',
    control: 'create inline equation',
  });

  // Only an empty equation needs the editor right away; one built from a
  // selection already has its content.
  if (textSelection.isCollapsed()) {
    openInlineLatexEditor(inlineEditor, inlineRange.index + 1);
  }

  next();
};
