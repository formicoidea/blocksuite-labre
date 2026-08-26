import { ConnectorElementModel } from '@labre/affine-model';
import type { SurfaceBlockModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { edgyCommandIcons, edgyCommands } from '../commands';
import { EDGY_DYNAMIC_RELATIONS } from '../metamodel';
import {
  EDGY_RELATION_LABEL_DISTANCE,
  edgyRelationNaming,
  edgyVerbLabelXYWH,
  resolveEdgyRelations,
} from '../relation';
import { EDGY_ROLE, EDGY_VERB_ROLE, type EdgyElementRole } from '../roles';

/**
 * The hand-drawn EDGY relation: one tool, twenty-two verbs, and a metamodel
 * that decides which. Everything below is about the ONE write this resolver is
 * allowed to make and the six situations in which it must make none.
 */

const roleOf = (name: string) => EDGY_ROLE[name as EdgyElementRole];

/** An element on the board, as the resolver reads one: an id and a role. */
const node = (id: string, role?: string) => ({ id, role });

/**
 * A connector, as the resolver reads one. `Object.setPrototypeOf` rather than a
 * real model: the resolver narrows with `instanceof ConnectorElementModel` (the
 * repository's own guard, so a shape carrying an edge role by accident is never
 * written to), and the own data properties below shadow the class accessors for
 * every read the resolver makes. Nothing here is ever written through the
 * model — the writes go to the surface, which is where the spec watches them.
 */
function edge(
  id: string,
  sourceId: string | null,
  targetId: string | null,
  role?: string,
  options: { locked?: boolean } = {}
): ConnectorElementModel {
  const stub = {
    id,
    role,
    source: sourceId === null ? { position: [0, 0] } : { id: sourceId },
    target: targetId === null ? { position: [10, 10] } : { id: targetId },
    // What the inherited `isLocked()` actually reads.
    lockedBySelf: options.locked ?? false,
    groups: [] as { lockedBySelf?: boolean }[],
  };
  Object.setPrototypeOf(stub, ConnectorElementModel.prototype);
  return stub as unknown as ConnectorElementModel;
}

/**
 * The text of a `Y.Text` that has not been put into a document yet.
 *
 * `new Y.Text('realises')` keeps its content PENDING until it is integrated, so
 * `toString()` on the loose value answers `''`. Integrating it here is not a
 * detour around the assertion — it is the assertion: what matters is that the
 * verb survives the trip into a Yjs document, which is where the resolver's
 * value is going.
 */
function integratedText(value: unknown): string {
  const map = new Y.Doc().getMap('probe');
  map.set('text', value as Y.Text);
  return (map.get('text') as Y.Text).toString();
}

interface Board {
  surface: SurfaceBlockModel;
  /** Every `updateElement` the resolver made, in order. */
  updates: { id: string; props: Record<string, unknown> }[];
  /** How many writes had already happened at each `captureSync`. */
  captures: number[];
}

function board(
  elements: { id: string }[],
  options: { readonly?: boolean } = {}
): Board {
  const updates: Board['updates'] = [];
  const captures: number[] = [];
  const byId = new Map(elements.map(element => [element.id, element]));
  const surface = {
    store: {
      readonly: options.readonly ?? false,
      captureSync: () => captures.push(updates.length),
    },
    getElementById: (id: string) => byId.get(id) ?? null,
    updateElement: (id: string, props: Record<string, unknown>) => {
      updates.push({ id, props });
    },
  };
  return {
    surface: surface as unknown as SurfaceBlockModel,
    updates,
    captures,
  };
}

describe('EDGY relation naming', () => {
  it('gives every canonical pair its own verb, read source-first', () => {
    for (const [source, target, verb] of EDGY_DYNAMIC_RELATIONS) {
      const naming = edgyRelationNaming(roleOf(source), roleOf(target));
      expect(naming, `${source} → ${target}`).not.toBeNull();
      expect(naming!.verb).toBe(verb);
      expect(naming!.role).toBe(EDGY_VERB_ROLE[verb]);
      expect(naming!.reversed).toBe(false);
    }
  });

  /**
   * The metamodel's 24 rows are 24 distinct ORDERED pairs, and no unordered
   * pair appears twice — which is the fact that lets one menu entry stand in
   * for twenty-two verbs. If a future relation broke it, the direct match would
   * start hiding a second, equally legal sentence, so it is pinned here.
   */
  it('knows each pair in one direction only', () => {
    const ordered = new Set(
      EDGY_DYNAMIC_RELATIONS.map(([source, target]) => `${source} ${target}`)
    );
    expect(ordered.size).toBe(EDGY_DYNAMIC_RELATIONS.length);
    for (const [source, target] of EDGY_DYNAMIC_RELATIONS) {
      expect(ordered.has(`${target} ${source}`), `${target} → ${source}`).toBe(
        false
      );
    }
  });

  it('reports a pair it knows only backwards as reversed', () => {
    // "a journey traverses a channel" is EDGY; drawn the other way round it is
    // still the `traverses` relation, and still wrong.
    const naming = edgyRelationNaming(roleOf('channel'), roleOf('journey'));
    expect(naming).toEqual({
      role: EDGY_VERB_ROLE['traverses'],
      verb: 'traverses',
      reversed: true,
    });
  });

  it('says nothing about a pair the metamodel never mentions', () => {
    expect(edgyRelationNaming(roleOf('content'), roleOf('channel'))).toBeNull();
    // ...nor about an end that is not one of the twelve official elements.
    expect(edgyRelationNaming(EDGY_ROLE.object, roleOf('purpose'))).toBeNull();
    expect(edgyRelationNaming(undefined, roleOf('purpose'))).toBeNull();
  });
});

describe('resolving a hand-drawn EDGY relation', () => {
  it('writes the verb role and the verb label on a canonical pair', () => {
    const link = edge('l', 'p', 'c', EDGY_ROLE.relation);
    const { surface, updates, captures } = board([
      node('p', roleOf('process')),
      node('c', roleOf('capability')),
      link,
    ]);

    expect(resolveEdgyRelations(surface, ['l'])).toEqual([
      { role: EDGY_VERB_ROLE['realises'], verb: 'realises', reversed: false },
    ]);
    expect(updates).toHaveLength(1);
    const { id, props } = updates[0];
    expect(id).toBe('l');
    expect(props.role).toBe(EDGY_VERB_ROLE['realises']);
    expect(integratedText(props.text)).toBe('realises');
    expect(props.labelXYWH).toEqual(edgyVerbLabelXYWH('realises'));
    expect(props.labelOffset).toEqual({
      distance: EDGY_RELATION_LABEL_DISTANCE,
    });
    // One undo step for the naming, opened BEFORE anything was written.
    expect(captures).toEqual([0]);
  });

  /**
   * The arbitration of `docs/adr/0010`: a relation drawn backwards is named and
   * NOT turned round. Flipping it would overrule a deliberate gesture; leaving
   * it generic would hide the mistake behind a vaguer finding. Named, E1 reports
   * the exact sentence and M3 (`edge.invert-direction`) fixes it in one click.
   */
  it('names a reversed pair without touching its two ends', () => {
    const link = edge('l', 'ch', 'j', EDGY_ROLE.relation);
    const { surface, updates } = board([
      node('ch', roleOf('channel')),
      node('j', roleOf('journey')),
      link,
    ]);

    expect(resolveEdgyRelations(surface, ['l'])[0].reversed).toBe(true);
    expect(updates[0].props.role).toBe(EDGY_VERB_ROLE['traverses']);
    expect(updates[0].props).not.toHaveProperty('source');
    expect(updates[0].props).not.toHaveProperty('target');
    expect(link.source).toEqual({ id: 'ch' });
    expect(link.target).toEqual({ id: 'j' });
  });

  it('leaves the generic role on a pair the metamodel does not declare', () => {
    const { surface, updates, captures } = board([
      node('co', roleOf('content')),
      node('ch', roleOf('channel')),
      edge('l', 'co', 'ch', EDGY_ROLE.relation),
    ]);

    expect(resolveEdgyRelations(surface, ['l'])).toEqual([]);
    expect(updates).toEqual([]);
    // Nothing to say, so not even an undo entry: an empty capture would turn
    // every stray link into a stop on the way back through one's own history.
    expect(captures).toEqual([]);
  });

  it('stays silent when an end is outside the alphabet', () => {
    const { surface, updates } = board([
      // A base Object, a People node and a bare sticky are all legitimate on an
      // EDGY board and none of them is one of the twelve official elements.
      node('o', EDGY_ROLE.object),
      node('pu', roleOf('purpose')),
      node('plain'),
      edge('l1', 'o', 'pu', EDGY_ROLE.relation),
      edge('l2', 'plain', 'pu', EDGY_ROLE.relation),
    ]);

    expect(resolveEdgyRelations(surface, ['l1', 'l2'])).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('never rewrites a verb role that is already there', () => {
    const { surface, updates } = board([
      node('p', roleOf('process')),
      node('c', roleOf('capability')),
      // Already resolved — or drawn by the metamodel template, or renamed by
      // the user. Either way it is somebody's statement and not ours to redo.
      edge('l', 'p', 'c', EDGY_VERB_ROLE['requires']),
    ]);

    expect(resolveEdgyRelations(surface, ['l'])).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('ignores a connector that carries no EDGY role at all', () => {
    const { surface, updates } = board([
      node('p', roleOf('process')),
      node('a', roleOf('asset')),
      // The free link a workshop actually runs on. It says "these two have
      // something to do with each other" and it must stay that way.
      edge('l', 'p', 'a'),
    ]);

    expect(resolveEdgyRelations(surface, ['l'])).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('leaves a locked relation alone', () => {
    const { surface, updates } = board([
      node('p', roleOf('process')),
      node('c', roleOf('capability')),
      edge('l', 'p', 'c', EDGY_ROLE.relation, { locked: true }),
    ]);

    expect(resolveEdgyRelations(surface, ['l'])).toEqual([]);
    expect(updates).toEqual([]);
  });

  it('waits for both ends to be attached', () => {
    const { surface, updates } = board([
      node('p', roleOf('process')),
      edge('l', 'p', null, EDGY_ROLE.relation),
    ]);

    expect(resolveEdgyRelations(surface, ['l'])).toEqual([]);
    expect(updates).toEqual([]);
  });

  /**
   * `surface.updateElement` THROWS on a read-only store, so this guard is not
   * politeness: without it, opening a shared board read-only would raise once
   * per relation drawn on it.
   */
  it('writes nothing at all on a read-only document', () => {
    const { surface, updates, captures } = board(
      [
        node('p', roleOf('process')),
        node('c', roleOf('capability')),
        edge('l', 'p', 'c', EDGY_ROLE.relation),
      ],
      { readonly: true }
    );

    expect(resolveEdgyRelations(surface, ['l'])).toEqual([]);
    expect(updates).toEqual([]);
    expect(captures).toEqual([]);
  });

  it('names several relations in ONE undo step', () => {
    const { surface, updates, captures } = board([
      node('p', roleOf('process')),
      node('c', roleOf('capability')),
      node('a', roleOf('asset')),
      edge('l1', 'p', 'c', EDGY_ROLE.relation),
      edge('l2', 'c', 'a', EDGY_ROLE.relation),
      // Neither an element the resolver knows nor an element at all.
      edge('l3', 'p', 'ghost', EDGY_ROLE.relation),
    ]);

    expect(resolveEdgyRelations(surface, ['l1', 'l2', 'l3', 'nobody'])).toEqual(
      [
        { role: EDGY_VERB_ROLE['realises'], verb: 'realises', reversed: false },
        { role: EDGY_VERB_ROLE['requires'], verb: 'requires', reversed: false },
      ]
    );
    expect(updates.map(update => update.id)).toEqual(['l1', 'l2']);
    expect(captures).toEqual([0]);
  });
});

describe('the Relation entry in the EDGY toolbox', () => {
  const relation = edgyCommands.find(c => c.id === 'edgy.addRelation');

  it('is ONE entry, not one per verb', () => {
    expect(relation).toBeDefined();
    // Twenty-two verbs behind one button: the metamodel picks, the user does
    // not have to.
    expect(edgyCommands.filter(c => c.category === 'relations')).toHaveLength(
      1
    );
  });

  it('arms a tool rather than dropping an artefact', () => {
    // `kind: 'tool'` is what makes `runCommand` report `FrameworkToolPicked`
    // instead of `FrameworkElementAdded` (ADR 0008's single emission point).
    expect(relation!.kind).toBe('tool');
    expect(relation!.telemetry).toEqual({
      framework: 'edgy',
      element: 'connector:relation',
    });
  });

  it('announces what its gesture means, with an icon and every surface', () => {
    // M1 of `docs/adr/0010`: a tool whose drag decides the orientation of a
    // persisted relation has to SAY which way to drag.
    expect(relation!.descriptionKey).toBe(
      'com.labre.commands.edgy.addRelation.description'
    );
    expect(relation!.descriptionFallback).toBeTruthy();
    expect(relation!.labelKey).toBe('com.labre.commands.edgy.addRelation');
    expect(relation!.surfaces).toEqual([
      'senior-menu',
      'catalogue',
      'palette',
      'agent',
    ]);
    expect(edgyCommandIcons[relation!.iconKey!]).toBeDefined();
  });

  it('leaves the seven original entries artefacts, with no description', () => {
    for (const command of edgyCommands) {
      if (command.id === 'edgy.addRelation') continue;
      expect(command.kind, command.id).toBe('artefact');
      expect(command.descriptionKey, command.id).toBeUndefined();
    }
  });
});
