import {
  DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
  recordAction,
  selectBoardSvgParts,
  type SvgExportCandidate,
} from '@labre/affine-block-surface';
import type { AnyCommandDescriptor } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getCommands } from '../../commands.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * PARITY — the three switches of "Export SVG" hold for every framework.
 *
 * "Framework elements" is decided by data, never by framework code: an element
 * belongs to the board's framework when its role shares the board's role
 * namespace, or when it is a role-less part of a group holding such an element
 * (`parts.ts`). That is only true if every framework stamps its board and its
 * artefacts the way the rule reads them — and a framework that drew its board
 * role-less, or named its artefacts under another namespace, would export its
 * own artefacts as "other shapes" without a single test noticing.
 *
 * So, for every framework descriptor, this spec RUNS the framework's real
 * board command and one of its real artefact commands against the recording
 * fake (`recordAction`, as `legend-subscription.unit.spec.ts` does), puts a
 * plain shape, a plain canvas text and an edgeless text beside them, and asserts
 * that each switch removes exactly its part. The artefact comes with every part
 * its command creates — a name text, a group — so a role-less part filed under
 * the wrong switch fails here.
 */

const commands = getCommands();
const INVOCATION = {
  surface: 'senior-menu',
  source: 'toolbar:general',
} as const;

/** A recorded element: the props its command passed, read as the rule reads a model. */
type Rec = Record<string, unknown> & {
  role?: string;
  type?: string;
  childElements?: SvgExportCandidate[];
};

function recordsOf(command: AnyCommandDescriptor): Rec[] {
  try {
    return recordAction(std => {
      const running = command.run(std, INVOCATION) as void | Promise<void>;
      if (running instanceof Promise) running.catch(() => {});
    }).records as Rec[];
  } catch {
    return [];
  }
}

const namespaceOf = (role: unknown) =>
  typeof role === 'string' ? role.split(':')[0] : undefined;

/**
 * One board and one artefact of the same drawing. A framework with two boards
 * (Cynefin / Estuarine) answers with the one its artefacts are drawn on: the
 * Cynefin board stamps no role and paints its domains itself, so nothing is
 * ever its artefact (`export-svg-parts.unit.spec.ts` in the surface package
 * pins that it still owns itself).
 */
function boardAndArtefact(owner: string) {
  const owned = commands.filter(command => command.owner === owner);
  const boards = owned
    .filter(command => command.telemetry?.board)
    .map(command => recordsOf(command)[0])
    .filter((record): record is Rec => !!record);
  const artefacts = owned
    .filter(command => command.kind === 'artefact' && !command.telemetry?.board)
    .map(recordsOf)
    // The artefact with the most parts: a role-less name or dot in a group is
    // exactly what the rule has to get right, so the richest one is tested.
    .sort((a, b) => b.length - a.length);
  for (const board of boards) {
    const namespace = namespaceOf(board.role);
    if (!namespace) continue;
    const artefact = artefacts.find(records =>
      records.some(record => namespaceOf(record.role) === namespace)
    );
    if (artefact) return { board, artefact };
  }
  return null;
}

/** The recorded groups an element sits in, outermost last. */
function groupsIn(records: readonly Rec[]) {
  const byId = new Map(records.map(record => [record['id'], record]));
  const parentOf = (record: Rec) =>
    records.find(
      group =>
        group.type === 'group' &&
        Object.keys((group['children'] as object) ?? {}).includes(
          String(record['id'])
        )
    );
  for (const group of records) {
    if (group.type !== 'group') continue;
    // The shape the rule reads off a real `GroupElementModel`.
    group.childElements = Object.keys((group['children'] as object) ?? {})
      .map(id => byId.get(id))
      .filter((child): child is Rec => !!child);
  }
  return (record: Rec) => {
    const chain: Rec[] = [];
    for (let up = parentOf(record); up; up = parentOf(up)) chain.push(up);
    return chain;
  };
}

describe('the "Export SVG" switches hold for every framework', () => {
  test.each(FRAMEWORK_DESCRIPTORS.map(descriptor => descriptor.id))(
    '%s',
    owner => {
      const pair = boardAndArtefact(owner);
      expect(
        pair,
        `${owner}: no board shares a namespace with an artefact`
      ).not.toBeNull();
      const { board, artefact } = pair!;

      const shape: Rec = { id: 'plain-shape', type: 'shape' };
      const text: Rec = { id: 'plain-text', type: 'text' };
      const textBlock = { flavour: 'affine:edgeless-text' };
      const elements = [board, ...artefact, shape, text];
      const groupsOf = groupsIn(elements);

      const select = (off: 'framework' | 'shapes' | 'texts' | null) =>
        selectBoardSvgParts(
          board,
          elements,
          [textBlock],
          off
            ? { ...DEFAULT_BOARD_SVG_EXPORT_OPTIONS, [off]: false }
            : DEFAULT_BOARD_SVG_EXPORT_OPTIONS,
          groupsOf
        );

      expect(select(null)).toEqual({ elements, textBlocks: [textBlock] });
      expect(select('framework')).toEqual({
        elements: [shape, text],
        textBlocks: [textBlock],
      });
      expect(select('shapes')).toEqual({
        elements: [board, ...artefact, text],
        textBlocks: [textBlock],
      });
      expect(select('texts')).toEqual({
        elements: [board, ...artefact, shape],
        textBlocks: [],
      });
    }
  );
});
