import { LABRE_ACCENT } from '@labre/affine/shared/consts';
import {
  ChromeAccentExtension,
  getChromeAccentColor,
  ThemeProvider,
} from '@labre/affine/shared/services';
import { installAccentStyleSheet } from '@labre/affine/shared/theme';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * What the browser actually paints, now that the editor ships Labre's accent
 * (ADR 0029).
 *
 * This is the half the unit specs cannot see. `accent.unit.spec.ts` pins the
 * rewrite and the generated stylesheet as text; only a mounted editor can say
 * whether that stylesheet reaches a checkbox inside the editor's own
 * `[data-theme]` viewport, a widget in a shadow root, and the JS the canvas
 * paints with — the three places the accent used to come apart.
 *
 * The regression it guards: setting `--affine-primary-color` on `<html>` did
 * nothing, because the upstream theme re-declares the whole variable set on
 * the `[data-theme]` element the editor sits in, below `<html>`.
 */

const LABRE_RGB = 'rgb(37, 99, 235)';
const HOST_ACCENT = '#7c3aed';
const HOST_RGB = 'rgb(124, 58, 237)';

/** The first match, anywhere, shadow roots included. */
function deepQuery(
  selector: string,
  root: ParentNode = document
): HTMLElement | null {
  const direct = root.querySelector(selector);
  if (direct) return direct as HTMLElement;
  for (const el of root.querySelectorAll('*')) {
    if (el.shadowRoot) {
      const found: HTMLElement | null = deepQuery(selector, el.shadowRoot);
      if (found) return found;
    }
  }
  return null;
}

function variableOn(el: Element, name: string) {
  return getComputedStyle(el).getPropertyValue(name).trim();
}

/** The accent as the DOM resolves it, normalised to `rgb(...)`. */
function resolvedAccentOn(el: Element) {
  const probe = document.createElement('div');
  probe.style.color = 'var(--affine-primary-color)';
  el.append(probe);
  const value = getComputedStyle(probe).color;
  probe.remove();
  return value;
}

describe('the editor ships the Labre accent', () => {
  afterEach(() => {
    // The override sheet lives on the document, which every spec in this file
    // shares. Put the default back so a spec that changed the accent cannot
    // decide what the next one sees.
    document.documentElement.removeAttribute('data-theme');
    installAccentStyleSheet(document, LABRE_ACCENT);
  });

  describe('in page mode', () => {
    beforeEach(async () => {
      const cleanup = await setupEditor('page');
      return cleanup;
    });

    test('the host and the editor viewport both resolve the accent', async () => {
      await wait(50);
      const host = window.editor.host!;
      expect(variableOn(host, '--affine-primary-color')).toBe(LABRE_ACCENT);
      expect(variableOn(host, '--affine-brand-color')).toBe(LABRE_ACCENT);
      expect(variableOn(host, '--affine-v2-button-primary')).toBe(LABRE_ACCENT);
      expect(resolvedAccentOn(host)).toBe(LABRE_RGB);

      // The element the upstream theme re-declares everything on — the one an
      // override on `<html>` could never reach.
      const viewport = deepQuery('[data-theme]');
      expect(viewport).not.toBeNull();
      expect(resolvedAccentOn(viewport!)).toBe(LABRE_RGB);
    });

    test("a ticked todo's checkbox is painted with it", async () => {
      const noteId = addNote(window.doc);
      window.doc.addBlock(
        'affine:list',
        { type: 'todo', checked: true, text: new Text('done') },
        noteId
      );
      await wait(100);

      const check = deepQuery('.affine-list-block__todo-prefix svg');
      expect(check).not.toBeNull();
      expect(getComputedStyle(check!).color).toBe(LABRE_RGB);
    });

    test('the canvas resolves the same accent, in both themes', async () => {
      const std = window.editor.std;
      const theme = std.get(ThemeProvider);

      expect(getChromeAccentColor(std)).toBe(LABRE_ACCENT);
      expect(theme.getCssVariableColor('--affine-primary-color')).toBe(
        LABRE_ACCENT
      );

      document.documentElement.dataset.theme = 'dark';
      await wait(50);
      expect(getChromeAccentColor(std)).toBe(LABRE_ACCENT);
    });

    test('the dark theme resolves it too', async () => {
      document.documentElement.dataset.theme = 'dark';
      await wait(100);
      const viewport = deepQuery('[data-theme]');
      expect(viewport?.getAttribute('data-theme')).toBe('dark');
      expect(resolvedAccentOn(viewport!)).toBe(LABRE_RGB);
    });
  });

  describe('in edgeless mode', () => {
    beforeEach(async () => {
      const cleanup = await setupEditor('edgeless');
      return cleanup;
    });

    test('the selection handles are painted with it', async () => {
      const surface = getSurface(window.doc, window.editor);
      const id = surface.model.addElement({
        type: 'shape',
        shapeType: 'rect',
        xywh: '[0, 0, 120, 80]',
      });
      await wait(100);
      const gfx = window.editor.std.get(GfxControllerIdentifier);
      gfx.selection.set({ elements: [id], editing: false });
      await wait(200);

      const rect = deepQuery('.affine-edgeless-selected-rect');
      expect(rect).not.toBeNull();
      expect(getComputedStyle(rect!).borderColor).toBe(LABRE_RGB);
    });
  });

  describe('a host that registers its own accent', () => {
    beforeEach(async () => {
      const cleanup = await setupEditor('page', [
        ChromeAccentExtension(HOST_ACCENT),
      ]);
      return cleanup;
    });

    test('moves the chrome AND the canvas, with one value', async () => {
      await wait(50);
      const host = window.editor.host!;
      const std = window.editor.std;

      // chrome
      expect(variableOn(host, '--affine-primary-color')).toBe(HOST_ACCENT);
      expect(resolvedAccentOn(host)).toBe(HOST_RGB);
      const viewport = deepQuery('[data-theme]');
      expect(resolvedAccentOn(viewport!)).toBe(HOST_RGB);

      // canvas
      expect(getChromeAccentColor(std)).toBe(HOST_ACCENT);
      expect(
        std.get(ThemeProvider).getCssVariableColor('--affine-primary-color')
      ).toBe(HOST_ACCENT);
    });
  });
});
