/**
 * A code block is not spellchecked (GitHub issue #733; upstream
 * toeverything/AFFiNE#15902, commit 2ee701d).
 *
 * The code block's editable area inherited the browser's default spellcheck,
 * so identifiers and keywords were underlined as misspelled.
 *
 * `spellcheck` is inherited through the DOM tree: an editable element with no
 * attribute of its own takes the state of its nearest ancestor that has one
 * (HTML spec, "spelling and grammar checking"). `<rich-text>` is a
 * `ShadowlessElement` that renders its `contenteditable` div as a light-DOM
 * child (`affine/rich-text/src/rich-text.ts`, `render()`), so the state that
 * reaches the editable is the one on the nearest `[spellcheck]` ancestor of
 * `<rich-text>`. happy-dom does not implement the `spellcheck` IDL getter, so
 * the spec resolves the inherited state the way the spec says a browser does.
 *
 * The full `CodeBlockComponent` needs an editor host to mount; the spec calls
 * its real `renderBlock()` on the slice of state the template reads, and
 * renders the result with lit.
 */
import { html, nothing, render } from 'lit';
import { afterEach, describe, expect, it } from 'vitest';

import { CodeBlockComponent } from '../code-block.js';

/** The inherited spellcheck state of `el`, `null` when nothing sets it. */
function inheritedSpellcheck(el: Element): string | null {
  return el.closest('[spellcheck]')?.getAttribute('spellcheck') ?? null;
}

/** The fields `CodeBlockComponent#renderBlock` reads, nothing more. */
function renderState() {
  return {
    showLineNumbers: true,
    preview$: { value: false },
    languageInfo$: { value: null },
    collapsed$: { value: false },
    isCommentHighlighted: false,
    std: { getOptional: () => null },
    model: { props: { wrap: false, text: { yText: null } } },
    topContenteditableElement: null,
    store: { readonly: false, history: { undoManager: null } },
    inlineManager: { getSchema: () => null, getRenderer: () => null },
    _inlineRangeProvider: null,
    host: null,
    widgets: {},
    renderChildren: () => nothing,
  };
}

describe('the code block editable area', () => {
  let container: HTMLElement | undefined;

  afterEach(() => {
    container?.remove();
    container = undefined;
  });

  it('turns the browser spellchecker off', () => {
    container = document.createElement('div');
    document.body.append(container);
    const template = CodeBlockComponent.prototype.renderBlock.call(
      renderState() as unknown as CodeBlockComponent
    );
    render(template, container);

    const richText = container.querySelector('rich-text');
    expect(richText).not.toBeNull();
    expect(inheritedSpellcheck(richText!)).toBe('false');
  });

  it('leaves other rich text to the browser default', () => {
    container = document.createElement('div');
    document.body.append(container);
    render(html`<rich-text></rich-text>`, container);

    expect(inheritedSpellcheck(container.querySelector('rich-text')!)).toBe(
      null
    );
  });
});
