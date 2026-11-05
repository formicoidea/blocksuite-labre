import { LatexBlockSchema } from '@labre/affine-model';
import {
  BlockHtmlAdapterExtension,
  type BlockHtmlAdapterMatcher,
  HastUtils,
  type HtmlAST,
} from '@labre/affine-shared/adapters';

/**
 * KaTeX is loaded on the first formula: this module sits in the store entry, and
 * a server that opens a page to read it should not pay for a renderer it may
 * never call. `trust` stays off, so `\href` and `\url` cannot print a scheme.
 */
async function renderFormula(latex: string): Promise<HtmlAST> {
  try {
    const { default: katex } = await import('katex');
    return {
      type: 'element',
      tagName: 'div',
      properties: { className: ['affine-latex'] },
      children: HastUtils.parseFragment(
        katex.renderToString(latex, { displayMode: true, strict: 'ignore' })
      ),
    };
  } catch {
    return {
      type: 'element',
      tagName: 'code',
      properties: { className: ['affine-latex'] },
      children: [{ type: 'text', value: latex }],
    };
  }
}

export const latexBlockHtmlAdapterMatcher: BlockHtmlAdapterMatcher = {
  flavour: LatexBlockSchema.model.flavour,
  toMatch: () => false,
  fromMatch: o => o.node.flavour === LatexBlockSchema.model.flavour,
  toBlockSnapshot: {},
  fromBlockSnapshot: {
    enter: async (o, context) => {
      const latex = o.node.props.latex;
      if (typeof latex !== 'string' || !latex) return;
      context.walkerContext
        .openNode(await renderFormula(latex), 'children')
        .closeNode();
    },
  },
};

export const LatexBlockHtmlAdapterExtension = BlockHtmlAdapterExtension(
  latexBlockHtmlAdapterMatcher
);
