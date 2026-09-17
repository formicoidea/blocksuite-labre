import {
  createBoardLegend,
  EdgelessCRUDIdentifier,
} from '@labre/affine-block-surface';
import type { WardleyBgVariant } from '@labre/affine-model';
import {
  CommandDescriptorIdentifier,
  type AnyCommandDescriptor,
  type BlockStdScope,
} from '@labre/std';
import { RoleVocabularyIdentifier } from '@labre/std/gfx';
import { vi } from 'vitest';

import { wardleyCommands } from '../commands';
import { WARDLEY_ROLES, type WardleyRoleId } from '../roles';

/**
 * The harness the four legend specs share — one copy of what porter, areas,
 * accelerators and roles each carried their own version of.
 *
 * It runs the REAL platform engine (`createBoardLegend`) over the REAL Wardley
 * commands, which is the whole point of the migration: a spec that built rows
 * by hand would prove the table it wrote rather than the legend the editor
 * draws.
 *
 * The board's doubles carry a ROLE and nothing else. Detection reads
 * `element.role`, never `instanceof` and never a fill colour, so a bare object
 * is a complete fixture — and a `wardleyNode` prototype would now be beside the
 * point.
 */

export type Added = Record<string, unknown>;

/** An element on the map: its role, and no other claim about it. */
export const roled = (role: WardleyRoleId | undefined): { role?: string } => ({
  role,
});

/** The map every case is run against: 1600 × 900 at the origin. */
export const BOARD_XYWH = '[0,0,1600,900]';

/**
 * Generate the legend of a map holding exactly `present`, and hand back every
 * element it posted to the surface, in creation order.
 */
export function legendOf(
  present: readonly unknown[],
  variant: WardleyBgVariant = 'classic'
): Added[] {
  const added: Added[] = [];
  const gfx = {
    surface: { addElement: (props: Added) => (added.push(props), 'x') },
    getElementsByBound: () => present,
    selection: { set: vi.fn() },
    layer: { canvasElements: [] as { type: string }[] },
  };
  const crud = {
    addElement: (_type: string, _props: Added) => 'group-1',
  };
  const registry = new Map<string, AnyCommandDescriptor>(
    wardleyCommands.map((command, index) => [`Command-${index}`, command])
  );
  const std = {
    get: (identifier: unknown) =>
      identifier === (EdgelessCRUDIdentifier as unknown) ? crud : gfx,
    // Every wording is resolved through `translateKey`, which asks for this —
    // absent here, exactly like a playground with no `TranslationProvider`.
    getOptional: () => undefined,
    store: { captureSync: vi.fn() },
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (CommandDescriptorIdentifier as unknown)
          ? registry
          : identifier === (RoleVocabularyIdentifier as unknown)
            ? new Map([['RoleVocabulary-1', WARDLEY_ROLES]])
            : new Map(),
    },
  } as unknown as BlockStdScope;

  createBoardLegend(std, { xywh: BOARD_XYWH, variant } as never, 'wardley');
  return added;
}

/** The words the legend wrote, in creation order. */
export const textsOf = (added: Added[]): string[] =>
  added.filter(el => el.type === 'text').map(el => String(el.text));
