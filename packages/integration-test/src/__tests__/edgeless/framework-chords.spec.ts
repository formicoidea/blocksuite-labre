/**
 * The framework chord prefixes of `docs/adr/0055`, driven by the REAL keyboard
 * on a real edgeless editor: `b`, `u`, `g`, `y` and the shared DDD `d` each
 * place an artefact, the way `w c` has placed a Wardley component since PF3
 * (`wardley-shortcuts.spec.ts`).
 *
 * The unit parity tests prove the declarations (`chord-prefixes`,
 * `keymap-golden`); only this spec proves the path a user takes — the
 * dispatcher's chord arming, the edgeless-scope keymap the framework's gated
 * view extension feeds, the command run at the viewport centre. It also holds
 * the two refusals that matter most: a letter typed into a note being edited
 * stays a letter, and a framework switched off by its flag binds nothing.
 *
 * Real keystrokes go to whatever holds the focus, and the suite shares one
 * page, so every test blurs the focus first.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { BlockFlags } from '@labre/affine/flags';
import { SurfaceSelection } from '@labre/std';
import { userEvent } from '@vitest/browser/context';
import { describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

type Service = EdgelessRootBlockComponent['service'];

async function mount(flags?: BlockFlags) {
  const cleanup = await setupEditor('edgeless', [], { flags });
  const service: Service = getDocRootBlock(
    window.doc,
    window.editor,
    'edgeless'
  ).service;
  // The dispatcher only runs keyDown handlers while active (normally set by a
  // pointerdown, click or focusin on the host).
  service.std.event.active = true;
  (document.activeElement as HTMLElement | null)?.blur();
  return { cleanup, service };
}

const chord = async (keys: string) => {
  await userEvent.keyboard(keys);
  await wait(50);
};

/** One chord per framework that ships some, and the artefact it places. */
const CASES = [
  { chord: 'bp', what: 'a BPMN pool' },
  { chord: 'uc', what: 'a UML class' },
  { chord: 'gp', what: 'an EDGY People' },
  { chord: 'yh', what: 'an Estuarine hexagon' },
  { chord: 'db', what: 'a Context Map bounded context' },
  { chord: 'dc', what: 'a Core Domain Chart' },
] as const;

describe('framework chords on the real keyboard', () => {
  test.each(CASES)('$chord places $what', async ({ chord: keys }) => {
    const { cleanup, service } = await mount();
    try {
      expect(service.gfx.gfxElements.length).toBe(0);
      await chord(keys);
      expect(service.gfx.gfxElements.length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });

  test('a chord typed into a note being edited is text, not a shortcut', async () => {
    const { cleanup, service } = await mount();
    try {
      const noteId = addNote(window.doc);
      await wait();
      const paragraphId = window.doc.getModelById(noteId)!.children[0]!.id;
      const surfaceId = window.doc.getModelsByFlavour('affine:surface')[0]!.id;
      service.std.selection.setGroup('gfx', [
        new SurfaceSelection(surfaceId, [noteId], true),
      ]);
      const paragraph = window.editor.host!.view.getBlock(
        paragraphId
      ) as unknown as HTMLElement & {
        inlineEditor?: { focusEnd(): void };
      };
      paragraph.inlineEditor!.focusEnd();
      await wait(50);
      const before = service.gfx.gfxElements.length;

      await chord('bp');

      const text = window.doc.getModelById(paragraphId) as unknown as {
        props: { text: { toString(): string } };
      };
      expect(text.props.text.toString()).toBe('bp');
      expect(service.gfx.gfxElements.length).toBe(before);
    } finally {
      cleanup();
    }
  });

  test('a framework switched off by its flag binds no chord', async () => {
    const { cleanup, service } = await mount({ bpmn: false });
    try {
      await chord('bp');
      expect(service.gfx.gfxElements.length).toBe(0);
      // …while a framework still on keeps its own.
      await chord('uc');
      expect(service.gfx.gfxElements.length).toBeGreaterThan(0);
    } finally {
      cleanup();
    }
  });
});
