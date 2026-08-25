import type { DataViewUILogicBase } from '@labre/data-view';
import { Text } from '@labre/store';
import { signal } from '@preact/signals-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { DatabaseTitle } from '../components/title/index.js';

const TAG = 'test-affine-database-title';

beforeAll(() => {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, DatabaseTitle);
  }
});

/**
 * Minimal stand-in for the view logic the title talks to: the title only reads
 * `view.readonly$` / `selection$` and (used to) call `addRow`.
 */
function createDataViewLogicStub() {
  return {
    addRow: vi.fn(),
    selection$: signal(undefined),
    setSelection: vi.fn(),
    view: { readonly$: signal(false) },
  } as unknown as DataViewUILogicBase & { addRow: ReturnType<typeof vi.fn> };
}

async function mountTitle() {
  const dataViewLogic = createDataViewLogicStub();
  const element = document.createElement(TAG) as DatabaseTitle;
  // The title observes its yText, so it has to belong to a document.
  const doc = new Y.Doc();
  element.titleText = new Text(doc.getText('title'));
  element.titleText.insert('Roadmap', 0);
  element.dataViewLogic = dataViewLogic;
  document.body.append(element);
  await element.updateComplete;
  const input = element.querySelector('textarea');
  if (!input) throw new Error('title textarea not rendered');
  return { dataViewLogic, element, input };
}

describe('database title', () => {
  it('leaves the field on Enter instead of creating a record', async () => {
    const { dataViewLogic, element, input } = await mountTitle();
    const blur = vi.spyOn(input, 'blur');

    input.dispatchEvent(
      new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' })
    );

    expect(blur).toHaveBeenCalledTimes(1);
    expect(dataViewLogic.addRow).not.toHaveBeenCalled();
    element.remove();
  });

  it('keeps typing intact while composing', async () => {
    const { dataViewLogic, element, input } = await mountTitle();
    const blur = vi.spyOn(input, 'blur');

    // An IME confirmation also fires Enter; it must not leave the field.
    const event = new KeyboardEvent('keydown', { bubbles: true, key: 'Enter' });
    Object.defineProperty(event, 'isComposing', { value: true });
    input.dispatchEvent(event);

    expect(blur).not.toHaveBeenCalled();
    expect(dataViewLogic.addRow).not.toHaveBeenCalled();
    element.remove();
  });
});
