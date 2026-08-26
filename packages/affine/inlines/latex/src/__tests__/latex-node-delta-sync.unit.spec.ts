/**
 * An inline equation follows its delta — upstream #14924.
 *
 * `latex$` was seeded once in `connectedCallback` and never looked at the
 * delta again. When the delta changed underneath the node (undo, a remote
 * edit, a paste replacing the equation) the node kept painting the formula it
 * was created with, so the stored document and the screen disagreed.
 */
import type { AffineTextAttributes } from '@labre/affine-shared/types';
import type { DeltaInsert } from '@labre/store';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { AffineLatexNode } from '../latex-node/latex-node.js';

beforeAll(() => {
  if (!customElements.get('affine-latex-node')) {
    customElements.define('affine-latex-node', AffineLatexNode);
  }
});

function deltaWith(latex: string) {
  return {
    insert: ' ',
    attributes: { latex },
  } as DeltaInsert<AffineTextAttributes>;
}

function createNode(latex: string) {
  const node = document.createElement('affine-latex-node') as AffineLatexNode;
  node.delta = deltaWith(latex);
  node.startOffset = 0;
  node.endOffset = 1;
  node.editor = {
    formatText: vi.fn(),
    setInlineRange: vi.fn(),
  } as never;
  node.std = { store: { readonly: false } } as never;
  document.body.append(node);
  return node;
}

describe('AffineLatexNode', () => {
  it('repaints when the delta changes underneath it', async () => {
    const node = createNode('\\alpha');
    await node.updateComplete;
    expect(node.latex$.value).toBe('\\alpha');

    node.delta = deltaWith('\\beta');
    await node.updateComplete;

    expect(node.latex$.value).toBe('\\beta');
    expect(node.latexEditorSignal.value).toBe('\\beta');

    node.remove();
  });

  it('leaves the draft alone while the editor is open', async () => {
    const node = createNode('\\alpha');
    await node.updateComplete;

    // The editor being open is what a live edit looks like from here.
    (node as unknown as { _isEditorOpen: boolean })._isEditorOpen = true;
    node.latexEditorSignal.value = '\\gamma';

    node.delta = deltaWith('\\beta');
    await node.updateComplete;

    expect(node.latexEditorSignal.value).toBe('\\gamma');

    node.remove();
  });
});
