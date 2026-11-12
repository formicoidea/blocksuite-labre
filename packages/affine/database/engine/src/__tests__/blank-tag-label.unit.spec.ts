import { effects as menuEffects } from '@labre/affine-components/context-menu';
import { signal } from '@preact/signals-core';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { MultiTagSelect } from '../core/component/tags/multi-tag-select.js';
import { MultiTagView } from '../core/component/tags/multi-tag-view.js';
import { SelectGroupView } from '../core/group-by/renderer/select-group.js';
import type { SelectTag } from '../core/logical/index.js';
import { TAG_UNTITLED } from '../translations.js';

/**
 * A select option whose name is empty or blank draws a fallback label
 * (issue #657, ported from toeverything/AFFiNE#15807): `TAG_UNTITLED`,
 * `com.labre.data-view.tag.untitled`, "Untitled" in English.
 *
 * The name was a pill's only content, so an option named `''` or `'   '`
 * drew an empty pill: invisible in a cell and in the tag menu, and, as a
 * kanban group title, a zero-height strip nothing could click to rename.
 * The layout half (the title keeps a height and takes the click) needs a
 * real browser: `integration-test/…/page/database-blank-tag.spec.ts`.
 *
 * What it would have caught:
 * - a blank option drawn empty in a cell (`affine-multi-tag-view`), in the
 *   tag menu's pills and options (`affine-multi-tag-select`), or as a group
 *   title (`data-view-group-title-select-view`);
 * - a named option drawn with the fallback, or a name trimmed on display;
 * - typing the fallback into the tag menu not finding the blank options it
 *   draws under that label;
 * - the group title's rename menu not opening on a blank option, or starting
 *   from the label instead of the stored name;
 * - the label written back: display only, the options keep `''` and `'   '`.
 */

const UNTITLED = TAG_UNTITLED[1];

const OPTIONS: SelectTag[] = [
  { id: 'empty', value: '', color: 'var(--affine-tag-blue)' },
  { id: 'blank', value: '   ', color: 'var(--affine-tag-green)' },
  { id: 'done', value: 'Done', color: 'var(--affine-tag-red)' },
];

const texts = (root: Element, selector: string) =>
  [...root.querySelectorAll(selector)].map(node => node.textContent?.trim());

beforeAll(() => {
  if (!customElements.get('affine-menu')) menuEffects();
  const elements: [string, CustomElementConstructor][] = [
    ['affine-multi-tag-view', MultiTagView],
    ['affine-multi-tag-select', MultiTagSelect],
    ['data-view-group-title-select-view', SelectGroupView],
  ];
  elements.forEach(([name, element]) => {
    if (!customElements.get(name)) customElements.define(name, element);
  });
});

afterEach(() => {
  document.body.replaceChildren();
});

describe('a select option with a blank name', () => {
  it('a cell draws the fallback label, and a name as stored', async () => {
    const view = new MultiTagView();
    view.options = OPTIONS;
    view.value = ['empty', 'blank', 'done'];
    document.body.append(view);
    await view.updateComplete;

    expect(texts(view, '[data-testid="tag-selected"]')).toEqual([
      UNTITLED,
      UNTITLED,
      'Done',
    ]);
    expect(OPTIONS.map(option => option.value)).toEqual(['', '   ', 'Done']);
  });

  it('the tag menu draws the fallback, and finds blank options by it', async () => {
    const select = new MultiTagSelect();
    select.options = signal(OPTIONS);
    select.value = signal(['empty']);
    select.onChange = () => {};
    select.onComplete = () => {};
    document.body.append(select);
    await select.updateComplete;

    // The selected pill, then the three options.
    expect(texts(select, '[data-testid="tag-name"]')).toEqual([
      UNTITLED,
      UNTITLED,
      UNTITLED,
      'Done',
    ]);

    const input = select.querySelector('input')!;
    // A prefix, in another case, as a reader would type it.
    input.value = 'unt';
    input.dispatchEvent(new InputEvent('input'));
    await select.updateComplete;
    expect(
      texts(select, '[data-testid="tag-option-list"] [data-testid="tag-name"]')
    ).toEqual([UNTITLED, UNTITLED]);
  });

  it('a group title draws the fallback and opens its rename menu', async () => {
    const data$ = signal({ options: OPTIONS });
    const title = new SelectGroupView();
    title.readonly = false;
    title.group = {
      value: 'blank',
      property: { data$ },
      manager: { updateData: () => {} },
    } as never;
    document.body.append(title);
    await title.updateComplete;

    expect(texts(title, '.tag')).toEqual([UNTITLED]);

    title
      .querySelector<HTMLElement>('.data-view-group-title-select-view')!
      .click();
    await new Promise(resolve => requestAnimationFrame(resolve));
    const rename = document.querySelector<HTMLInputElement>(
      'input.affine-menu-input'
    );
    expect(rename, 'the rename menu opens').not.toBeNull();
    expect(rename!.placeholder).toBe(UNTITLED);
    expect(rename!.value).toBe('   ');
    expect(data$.value.options.map(option => option.value)).toEqual([
      '',
      '   ',
      'Done',
    ]);
  });
});
