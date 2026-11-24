/**
 * Reproduction for issue #737 (upstream toeverything/AFFiNE#15911, commit
 * 2198970): in the mobile keyboard toolbar's Highlight panel, the two
 * "Default Color" entries (group Color and group Background) carry no
 * `action`, so tapping them does nothing and a highlight cannot be removed on
 * mobile (`keyboard-tool-panel.ts` only calls `item.action` when present).
 *
 * The spec reads the real `defaultKeyboardToolbarConfig` and runs each entry
 * against a recording command chain: the coloured entries must request their
 * colour, the Default entries must request `null` (clear the attribute), the
 * same payload the desktop highlight menu sends.
 */
import { describe, expect, test } from 'vitest';

import {
  defaultKeyboardToolbarConfig,
  type KeyboardToolbarActionItem,
  type KeyboardToolbarContext,
  type KeyboardToolPanelGroup,
} from '../config.js';

function highlightItem(
  groupName: 'Color' | 'Background',
  name: string
): KeyboardToolbarActionItem {
  const groups = defaultKeyboardToolbarConfig.items
    .flatMap(item => ('items' in item ? item.items : [item]))
    .flatMap(item => ('groups' in item ? item.groups : []))
    .filter(
      (group): group is KeyboardToolPanelGroup => typeof group !== 'function'
    );
  const item = groups
    .find(group => group.name === groupName)
    ?.items.find(entry => entry.name === name);
  if (!item) throw new Error(`no highlight item ${groupName}/${name}`);
  return item as KeyboardToolbarActionItem;
}

/** A context whose command chain records every payload piped through it. */
function recordingContext() {
  const payloads: unknown[] = [];
  const link = {
    pipe: (_command: unknown, payload?: unknown) => {
      if (payload !== undefined) payloads.push(payload);
      return link;
    },
  };
  const chain = {
    try: (build: (c: typeof link) => unknown) => {
      build(link);
      return chain;
    },
    pipe: link.pipe,
    run: () => [true, {}],
  };
  const ctx = {
    std: { command: { chain: () => chain } },
    rootComponent: {},
    closeToolbar: () => {},
    closeToolPanel: () => {},
  } as unknown as KeyboardToolbarContext;
  return { ctx, payloads };
}

describe('keyboard toolbar highlight panel (#737)', () => {
  test.each([
    ['Color', 'color'],
    ['Background', 'background'],
  ] as const)('the Red entry of %s requests a red %s', async (group, key) => {
    const { ctx, payloads } = recordingContext();
    await highlightItem(group, 'Red').action?.(ctx);
    expect(payloads.length).toBeGreaterThan(0);
    expect(payloads).toEqual(
      payloads.map(() => ({
        styles: { [key]: expect.stringContaining('red') },
      }))
    );
  });

  test.each([
    ['Color', 'color'],
    ['Background', 'background'],
  ] as const)(
    'the Default Color entry of %s clears the %s highlight',
    async (group, key) => {
      const item = highlightItem(group, 'Default Color');
      expect(item.action, 'Default Color has no action').toBeTypeOf('function');

      const { ctx, payloads } = recordingContext();
      await item.action?.(ctx);
      expect(payloads.length).toBeGreaterThan(0);
      expect(payloads).toEqual(
        payloads.map(() => ({ styles: { [key]: null } }))
      );
    }
  );
});
