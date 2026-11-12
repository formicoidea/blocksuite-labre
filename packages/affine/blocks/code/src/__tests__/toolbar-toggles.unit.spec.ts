/**
 * Clicking "Cancel line number" twice — upstream #14804.
 *
 * The more-menu was rendered once into a portal and never again, so the click
 * handler kept the value it had read at render time. The first click turned
 * line numbers off; every click after that wrote the same value, and the entry
 * looked dead. The handlers now read the current state when they fire.
 */
import { ToggleSwitch } from '@labre/affine-components/toggle-switch';
import {
  EditorMenuAction,
  renderGroups,
} from '@labre/affine-components/toolbar';
import {
  CodeBlockSchemaExtension,
  NoteBlockSchemaExtension,
  RootBlockSchemaExtension,
  type CodeBlockModel,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { type Store, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { render } from 'lit';
import { describe, expect, it, vi } from 'vitest';

import { toggleGroup } from '../code-toolbar/config.js';

let seq = 0;

function aCodeBlock(): { store: Store; model: CodeBlockModel } {
  const collection = new TestWorkspace({ id: `code-toggles-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    CodeBlockSchemaExtension,
  ];
  collection.meta.initialize();

  const store = collection.createDoc().getStore();
  let codeId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    const noteId = store.addBlock('affine:note', {}, rootId);
    codeId = store.addBlock(
      'affine:code',
      { text: new Text('const a = 1;') },
      noteId
    );
  });

  return { store, model: store.getBlock(codeId)!.model as CodeBlockModel };
}

/** A stubbed std with no TranslationProvider registered — the toggle item
 * still renders its English fallback, same as before this wording existed. */
const stubStd = { getOptional: () => undefined } as unknown as BlockStdScope;

/** The slice of CodeBlockComponent the toggle entries actually touch. */
function stubComponent(store: Store, model: CodeBlockModel) {
  return {
    model,
    store,
    std: stubStd,
    get showLineNumbers() {
      return model.props.lineNumber ?? true;
    },
    setWrap(wrap: boolean) {
      store.updateBlock(model, { wrap });
    },
  };
}

/**
 * The click handler of an entry as the portal holds it: taken from a single
 * render, then fired again and again without the menu ever re-rendering.
 */
function clickHandlerOf(type: string, blockComponent: unknown): () => void {
  const item = toggleGroup.items.find(entry => entry.type === type)!;
  const part = item.generate!({ blockComponent } as never)!;
  const handler = part.render!(part as never).values.find(
    value => typeof value === 'function'
  );
  return handler as () => void;
}

describe('code toolbar toggles, clicked more than once', () => {
  it('turns line numbers off, then on again', () => {
    const { store, model } = aCodeBlock();
    const click = clickHandlerOf('line-number', stubComponent(store, model));

    click();
    expect(model.props.lineNumber).toBe(false);
    click();
    expect(model.props.lineNumber).toBe(true);
    click();
    expect(model.props.lineNumber).toBe(false);
  });

  it('turns wrapping on, then off again', () => {
    const { store, model } = aCodeBlock();
    const click = clickHandlerOf('wrap', stubComponent(store, model));

    click();
    expect(model.props.wrap).toBe(true);
    click();
    expect(model.props.wrap).toBe(false);
  });
});

/**
 * Clicking the switch of a toggle row — issue #660, upstream
 * toeverything/AFFiNE#15782.
 *
 * Each row is an `editor-menu-action` holding a `<toggle-switch>`. A click on
 * the switch flipped the switch AND bubbled up to the row, which flipped the
 * setting a second time; and the switch took its state from the `checked`
 * ATTRIBUTE, which a checkbox stops reading once the user has clicked it, so
 * the drawn state drifted away from the model. Both ways in — the switch's
 * checkbox and the row — must flip the setting ONCE and leave the switch
 * drawn as the model says.
 *
 * The rows are drawn by `renderGroups`, as the more menu draws them, and
 * drawn again on each `propsUpdated`, as the more menu does. happy-dom does
 * not pass a click on a `<label>` on to its checkbox, so a click on the
 * visible switch, which is what a mouse hits, is held in Chromium by
 * `integration-test/src/__tests__/page/code-toolbar-toggles.spec.ts`, as is
 * a real click on the row's words (the row's handler does not look at the
 * target, so here the row stands for them).
 */
type Path = 'checkbox' | 'row';

function mountToggles(store: Store, model: CodeBlockModel) {
  if (!customElements.get('toggle-switch')) {
    customElements.define('toggle-switch', ToggleSwitch);
  }
  if (!customElements.get('editor-menu-action')) {
    customElements.define('editor-menu-action', EditorMenuAction);
  }
  const blockComponent = stubComponent(store, model);
  const context = { blockComponent, std: stubStd, doc: store };
  const container = document.createElement('div');
  document.body.append(container);
  const draw = () =>
    render(renderGroups([toggleGroup], context as never), container);
  draw();
  const subscription = model.propsUpdated.subscribe(draw);
  return {
    container,
    dispose: () => {
      subscription.unsubscribe();
      container.remove();
    },
  };
}

function rowOf(container: HTMLElement, label: string) {
  return [...container.querySelectorAll('editor-menu-action')].find(row =>
    row.getAttribute('aria-label')?.toLowerCase().includes(label)
  ) as HTMLElement;
}

async function click(row: HTMLElement, path: Path) {
  const toggle = row.querySelector('toggle-switch') as ToggleSwitch;
  await toggle.updateComplete;
  const target = {
    checkbox: () => toggle.shadowRoot!.querySelector('input')!,
    row: () => row,
  }[path]();
  target.click();
  await toggle.updateComplete;
}

async function drawnState(row: HTMLElement) {
  const toggle = row.querySelector('toggle-switch') as ToggleSwitch;
  await toggle.updateComplete;
  return {
    on: toggle.on,
    checked: toggle.shadowRoot!.querySelector('input')!.checked,
  };
}

const PATHS: Path[] = ['checkbox', 'row'];

describe('code toolbar toggles, clicked on the switch or on the row', () => {
  it.each(PATHS)('flips wrapping once per click on the %s', async path => {
    const { store, model } = aCodeBlock();
    const { container, dispose } = mountToggles(store, model);
    try {
      for (const expected of [true, false, true]) {
        await click(rowOf(container, 'wrap'), path);
        expect(model.props.wrap).toBe(expected);
        expect(await drawnState(rowOf(container, 'wrap'))).toEqual({
          on: expected,
          checked: expected,
        });
      }
    } finally {
      dispose();
    }
  });

  it.each(PATHS)('flips line numbers once per click on the %s', async path => {
    const { store, model } = aCodeBlock();
    const { container, dispose } = mountToggles(store, model);
    try {
      for (const expected of [false, true, false]) {
        await click(rowOf(container, 'line number'), path);
        expect(model.props.lineNumber).toBe(expected);
        expect(await drawnState(rowOf(container, 'line number'))).toEqual({
          on: expected,
          checked: expected,
        });
      }
    } finally {
      dispose();
    }
  });

  it('alternating the switch and the row keeps the drawn state on the model', async () => {
    const { store, model } = aCodeBlock();
    const { container, dispose } = mountToggles(store, model);
    try {
      const paths: Path[] = ['checkbox', 'row', 'checkbox', 'row', 'checkbox'];
      let expected = false;
      for (const path of paths) {
        expected = !expected;
        await click(rowOf(container, 'wrap'), path);
        expect(model.props.wrap).toBe(expected);
        expect(await drawnState(rowOf(container, 'wrap'))).toEqual({
          on: expected,
          checked: expected,
        });
      }
    } finally {
      dispose();
    }
  });

  it('asks for no write on a readonly store', async () => {
    const { store, model } = aCodeBlock();
    const { container, dispose } = mountToggles(store, model);
    // The store refuses a readonly write by logging it: a gesture that asked
    // for one would show here.
    const refused = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      store.readonly = true;
      for (const path of PATHS) {
        await click(rowOf(container, 'wrap'), path);
        await click(rowOf(container, 'line number'), path);
      }
      expect(model.props.wrap).toBe(false);
      expect(model.props.lineNumber).not.toBe(false);
      expect(refused).not.toHaveBeenCalled();
    } finally {
      refused.mockRestore();
      dispose();
    }
  });
});
