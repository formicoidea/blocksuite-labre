import { insertInlineLatex } from '@labre/affine-inline-latex';
import {
  getSelectedModelsCommand,
  getTextSelectionCommand,
} from '@labre/affine-shared/commands';
import { translateKey } from '@labre/affine-shared/services';
import { type SlashMenuConfig } from '@labre/affine-widget-slash-menu';
import { TeXIcon } from '@blocksuite/icons/lit';

import { insertLatexBlockCommand } from '../commands';
import {
  LATEX_SLASH_BLOCK_CAPTION,
  LATEX_SLASH_BLOCK_DESCRIPTION,
  LATEX_SLASH_BLOCK_NAME,
  LATEX_SLASH_INLINE_CAPTION,
  LATEX_SLASH_INLINE_DESCRIPTION,
  LATEX_SLASH_INLINE_NAME,
  LATEX_TOOLTIP_BLOCK_INTRO,
  LATEX_TOOLTIP_INTRO,
} from '../translations';
import { LatexTooltip } from './tooltips';

/**
 * `items` is the function form (`SlashMenuConfig.items` also accepts a plain
 * array — the widget's own config uses that shape, `blocks/callout`'s does
 * too) rather than a static array, because THIS package's tooltip figures
 * bake real prose into their SVG (`LatexTooltip`'s `str` argument), unlike
 * every skeleton-bar figure elsewhere: resolving it through the seam needs
 * `std`, which only the function form's `ctx` carries.
 */
export const latexSlashMenuConfig: SlashMenuConfig = {
  items: ({ std }) => [
    {
      name: 'Inline equation',
      nameWording: LATEX_SLASH_INLINE_NAME,
      group: '0_Basic@8',
      description: 'Create a inline equation.',
      descriptionWording: LATEX_SLASH_INLINE_DESCRIPTION,
      icon: TeXIcon(),
      tooltip: {
        figure: LatexTooltip(
          translateKey(std, ...LATEX_TOOLTIP_INTRO),
          'E=mc^2',
          false
        ),
        caption: 'Inline equation',
        captionWording: LATEX_SLASH_INLINE_CAPTION,
      },
      searchAlias: ['inlineMath, inlineEquation', 'inlineLatex'],
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getTextSelectionCommand)
          .pipe(insertInlineLatex)
          .run();
      },
    },
    {
      name: 'Equation',
      nameWording: LATEX_SLASH_BLOCK_NAME,
      description: 'Create a equation block.',
      descriptionWording: LATEX_SLASH_BLOCK_DESCRIPTION,
      icon: TeXIcon(),
      tooltip: {
        figure: LatexTooltip(
          translateKey(std, ...LATEX_TOOLTIP_BLOCK_INTRO),
          String.raw`\frac{a}{b} \pm \frac{c}{d} = \frac{ad \pm bc}{bd}`,
          true
        ),
        caption: 'Equation',
        captionWording: LATEX_SLASH_BLOCK_CAPTION,
      },
      searchAlias: ['mathBlock, equationBlock', 'latexBlock'],
      group: '4_Content & Media@10',
      action: ({ std }) => {
        std.command
          .chain()
          .pipe(getSelectedModelsCommand)
          .pipe(insertLatexBlockCommand, {
            place: 'after',
            removeEmptyLine: true,
          })
          .run();
      },
    },
  ],
};
