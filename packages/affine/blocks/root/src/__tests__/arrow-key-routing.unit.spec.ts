import { describe, expect, test } from 'vitest';

import {
  type ArrowKey,
  type ArrowKeyContext,
  routeArrowKey,
} from '../edgeless/arrow-key-routing.js';

/**
 * Where an arrow keystroke on the canvas goes: the selection, the open
 * framework sub-menu, or the toolbar.
 *
 * Would have caught recette P7-17 (2026-11-02): with a Wardley sub-menu open,
 * a plain ← / → stepped the menu's highlight instead of nudging the selected
 * component, so the canvas lost its own gesture exactly while the user was
 * placing things from that menu. The arrows move; Alt reaches the chrome.
 *
 * The keystrokes themselves need an editor to press and are held by
 * `integration-test/.../edgeless/canvas-arrows-move-first.spec.ts`.
 */

const ctx = (over: Partial<ArrowKeyContext>): ArrowKeyContext => ({
  key: 'ArrowRight',
  alt: false,
  shift: false,
  editing: false,
  menuOpen: false,
  ...over,
});

const ARROWS: ArrowKey[] = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'];

describe('routeArrowKey', () => {
  test.each(ARROWS)('%s moves the selection with a sub-menu open', key => {
    expect(routeArrowKey(ctx({ key, menuOpen: true }))).toEqual({
      kind: 'move',
      key,
      shift: false,
    });
  });

  test.each(ARROWS)('%s moves the selection with no sub-menu open', key => {
    expect(routeArrowKey(ctx({ key }))).toEqual({
      kind: 'move',
      key,
      shift: false,
    });
  });

  test('Shift keeps the ten-pixel step, menu open or not', () => {
    for (const menuOpen of [true, false]) {
      expect(
        routeArrowKey(ctx({ key: 'ArrowLeft', shift: true, menuOpen }))
      ).toEqual({ kind: 'move', key: 'ArrowLeft', shift: true });
    }
  });

  test('Alt+← / Alt+→ walk the open sub-menu', () => {
    expect(
      routeArrowKey(ctx({ key: 'ArrowRight', alt: true, menuOpen: true }))
    ).toEqual({ kind: 'menu', dir: 1 });
    expect(
      routeArrowKey(ctx({ key: 'ArrowLeft', alt: true, menuOpen: true }))
    ).toEqual({ kind: 'menu', dir: -1 });
  });

  test('Alt+← / Alt+→ walk the toolbar when no sub-menu is open', () => {
    expect(routeArrowKey(ctx({ key: 'ArrowRight', alt: true }))).toEqual({
      kind: 'toolbar',
      dir: 1,
    });
    expect(routeArrowKey(ctx({ key: 'ArrowLeft', alt: true }))).toEqual({
      kind: 'toolbar',
      dir: -1,
    });
  });

  test('Alt+↑ / Alt+↓ and Alt+Shift+arrow are left alone', () => {
    for (const key of ['ArrowUp', 'ArrowDown'] as const) {
      expect(routeArrowKey(ctx({ key, alt: true, menuOpen: true }))).toEqual({
        kind: 'none',
      });
    }
    expect(
      routeArrowKey(ctx({ key: 'ArrowRight', alt: true, shift: true }))
    ).toEqual({ kind: 'none' });
  });

  test('a canvas text editor keeps every arrow', () => {
    for (const alt of [true, false]) {
      expect(
        routeArrowKey(ctx({ key: 'ArrowLeft', alt, editing: true }))
      ).toEqual({ kind: 'none' });
    }
  });
});
