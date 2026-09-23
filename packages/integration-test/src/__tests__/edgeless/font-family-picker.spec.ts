import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { FontFamily, type TextElementModel } from '@labre/affine/model';
import {
  CommunityCanvasTextFonts,
  FontConfigIdentifier,
} from '@labre/affine/shared/services';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import type { ExtensionType } from '@labre/store';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * #396 end to end: the canvas font-family picker offers the families the HOST
 * configured, not every `FontFamily`. Before the fix a host that dropped a
 * family (Satoshi: its licence forbids offering it as a selectable font in a
 * SaaS) still saw it in the picker of every text; this spec would have caught
 * that on the real toolbar, fed by the real DI container.
 *
 * It pins the other half too: a text STORED in a family the host no longer
 * ships keeps that family — the picker names it, greyed and marked
 * unavailable, the renderer still asks for it (and paints the `sans-serif`
 * fallback), and opening its toolbar writes nothing to the document.
 */
describe('font family picker follows the host FontConfig (#396)', () => {
  /** A host that ships Inter and Kalam only. */
  const reducedFonts: ExtensionType = {
    setup: di => {
      di.override(FontConfigIdentifier, () =>
        CommunityCanvasTextFonts.filter(
          face =>
            face.font === FontFamily.Inter || face.font === FontFamily.Kalam
        )
      );
    },
  };

  const mount = async (extensions: ExtensionType[] = []) => {
    const cleanup = await setupEditor('edgeless', extensions);
    const root = getDocRootBlock(
      window.doc,
      window.editor,
      'edgeless'
    ) as EdgelessRootBlockComponent;
    return { cleanup, root, service: root.service };
  };

  const addText = (
    service: EdgelessRootBlockComponent['service'],
    fontFamily: FontFamily
  ) => {
    const id = service.crud.addElement('text', {
      text: new Y.Text('Hello'),
      fontFamily,
      xywh: '[0,0,200,40]',
    });
    if (!id) throw new Error('failed to add a text');
    return service.crud.getElementById(id) as TextElementModel;
  };

  /** Select the text, and read the rows of the family panel its toolbar holds. */
  const pickerRows = async (
    root: EdgelessRootBlockComponent,
    text: TextElementModel
  ) => {
    root.service.gfx.selection.set({ elements: [text.id], editing: false });
    await wait(250);
    await root.updateComplete;

    const toolbar = (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar;
    const panel = toolbar?.querySelector('edgeless-font-family-panel') as
      | (HTMLElement & { updateComplete: Promise<boolean> })
      | null
      | undefined;
    expect(panel, 'the text toolbar has no family picker').toBeTruthy();
    await panel!.updateComplete;

    return [
      ...(panel!.shadowRoot?.querySelectorAll<
        HTMLElement & { disabled: boolean }
      >('[data-font]') ?? []),
    ].map(row => ({
      font: row.dataset.font,
      label: (row.textContent ?? '').replace(/\s+/g, ' ').trim(),
      disabled: row.disabled,
    }));
  };

  test('a host without Satoshi: only its families, the stored Satoshi named unavailable, nothing written', async () => {
    const { cleanup, root, service } = await mount([reducedFonts]);
    try {
      const text = addText(service, FontFamily.Satoshi);

      let writes = 0;
      const subscription = service.surface.elementUpdated.subscribe(
        ({ id }) => {
          if (id === text.id) writes += 1;
        }
      );
      const rows = await pickerRows(root, text);
      subscription.unsubscribe();

      expect(rows.map(row => row.font)).toEqual(['Inter', 'Kalam', 'Satoshi']);
      const satoshi = rows.find(row => row.font === 'Satoshi');
      expect(satoshi?.disabled).toBe(true);
      expect(satoshi?.label).toBe('Satoshi (unavailable)');
      expect(rows.find(row => row.font === 'Kalam')?.disabled).toBe(false);

      // Kept, not rewritten: same stored family, no update on the element.
      expect(text.fontFamily).toBe(FontFamily.Satoshi);
      expect(writes).toBe(0);
      // Still a live element of the surface, painted in its own family's
      // name — the browser falls back to `sans-serif` for want of a face.
      expect(service.surface.getElementById(text.id)).toBe(text);
    } finally {
      cleanup();
    }
  });

  test('the default community list: Plus Jakarta Sans offered, Satoshi not', async () => {
    const { cleanup, root, service } = await mount();
    try {
      const text = addText(service, FontFamily.PlusJakartaSans);
      const rows = await pickerRows(root, text);
      const fonts = rows.map(row => row.font);

      expect(fonts).toContain('Plus Jakarta Sans');
      expect(fonts).not.toContain('Satoshi');
      expect(rows.every(row => !row.disabled)).toBe(true);
    } finally {
      cleanup();
    }
  });
});
