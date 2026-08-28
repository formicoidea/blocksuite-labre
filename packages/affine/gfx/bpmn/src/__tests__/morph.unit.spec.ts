import type { BpmnNodeKind } from '@labre/affine-model';
import { StrokeStyle, TextVerticalAlign } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { BPMN_MORPH_FAMILIES, BPMN_MORPH_SPEC } from '../morph';
import { bpmnMorphClears, bpmnMorphProps, NODE_PRESETS } from '../presets';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from '../roles';

/**
 * BPMN's morph declaration: the families it offers, and the patch each kind is
 * worth.
 *
 * The generic module's own logic — when the dropdown appears, what one pick
 * writes — is proved next door in the surface package. What is proved HERE is
 * everything only this framework can answer: that the table names real kinds,
 * that the patch is the shipped creation preset and not a hopeful `{kind, role}`
 * pair, and that the artefacts with nothing to become say so.
 */

const EVERY_KIND = Object.keys(NODE_PRESETS) as BpmnNodeKind[];
const MORPHABLE = BPMN_MORPH_FAMILIES.flat();

describe('the BPMN morph families', () => {
  it('names only real kinds, each in exactly one family', () => {
    for (const kind of MORPHABLE) {
      expect(EVERY_KIND).toContain(kind);
    }
    expect(new Set(MORPHABLE).size).toBe(MORPHABLE.length);
  });

  it('offers nothing for the two artefacts drawn ON the picture', () => {
    // BPMN 2.0.2 §10.4 exempts the group from every constraint there is, and an
    // annotation is commentary: neither has a more precise version of itself to
    // become, so neither is in a family and the dropdown never appears on one.
    expect(MORPHABLE).not.toContain('textAnnotation');
    expect(MORPHABLE).not.toContain('group');
    expect(BPMN_MORPH_FAMILIES.some(family => family.includes('group'))).toBe(
      false
    );
  });

  it('never crosses the activity families that the role tree would have', () => {
    // `roleIsA` makes `bpmn:task` and `bpmn:sub-process` both `bpmn:activity`,
    // so a derivation from the role tree would offer the swap. The table does
    // not: an atomic unit of work and a stand-in for a whole process are not
    // the same artefact said more precisely.
    const activities = BPMN_MORPH_FAMILIES.find(family =>
      family.includes('task')
    );
    expect(activities).toEqual(['task', 'taskUser', 'taskService']);
    expect(activities).not.toContain('subProcess');
  });

  it('opens each family on its plain member', () => {
    // Declaration order is menu order: the undecorated artefact is the honest
    // first draft, and the variant is the refinement.
    expect(BPMN_MORPH_FAMILIES.map(family => family[0])).toEqual([
      'task',
      'startEvent',
      'endEvent',
      'gatewayExclusive',
      'dataObject',
      'subProcess',
    ]);
  });

  it('gives every morphable kind a role, a wording and an icon', () => {
    for (const kind of MORPHABLE) {
      expect(BPMN_MORPH_SPEC.roleOf(kind)).toBe(BPMN_ROLE_OF_KIND[kind]);
      const label = BPMN_MORPH_SPEC.labelOf(kind);
      // Reused from the creation command, so the dropdown and the palette
      // cannot disagree about what a user task is called.
      expect(label.key).toMatch(/^com\.labre\.commands\.bpmn\./);
      expect(label.fallback).not.toBe(kind);
      expect(BPMN_MORPH_SPEC.iconOf(kind)).toBeDefined();
    }
  });
});

describe('bpmnMorphProps — the patch a kind is worth', () => {
  it('never carries identity, geometry or the user text', () => {
    for (const kind of EVERY_KIND) {
      const keys = Object.keys(bpmnMorphProps(kind));
      expect(keys).not.toContain('type');
      expect(keys).not.toContain('xywh');
      expect(keys).not.toContain('text');
    }
  });

  it('always carries the kind and the role together', () => {
    // `role` is in `VERDICT_PROPS`, so writing it is what makes the validation
    // engine re-judge the board; `kind` is what the renderer reads. Writing
    // either without the other leaves the document saying two things.
    for (const kind of EVERY_KIND) {
      const props = bpmnMorphProps(kind);
      expect(props.kind).toBe(kind);
      expect(props.role).toBe(BPMN_ROLE_OF_KIND[kind]);
    }
  });

  it('rewrites the appearance keys a naive {kind, role} patch would leave', () => {
    // The hazard, stated as an assertion: a task is a filled, solidly stroked
    // rectangle and a data object is a glyph-bodied artefact that paints
    // nothing natively. Morphing between them with two keys leaves the folded
    // page filled and stroked.
    const task = bpmnMorphProps('task');
    const dataObject = bpmnMorphProps('dataObject');

    expect(task.filled).toBe(true);
    expect(task.strokeStyle).toBe(StrokeStyle.Solid);
    expect(dataObject.filled).toBe(false);
    expect(dataObject.strokeStyle).toBe(StrokeStyle.None);
    // …and the group is the third case: hollow, dashed, and unfilled for a
    // reason of its own (it must not steal a click from what it encloses).
    const group = bpmnMorphProps('group');
    expect(group.filled).toBe(false);
    expect(group.strokeStyle).toBe(StrokeStyle.Dash);
  });
});

describe('bpmnMorphClears — the keys a target does not write', () => {
  it('clears textVerticalAlign for every kind but the group', () => {
    // `textVerticalAlign` is spread conditionally by `bpmnNodeProps`, and the
    // group is the only kind that asks for one. A patch cannot express absence,
    // so morphing away from the group has to DELETE the key or `Top` stays in
    // force over a preset that means "centred".
    expect(NODE_PRESETS.group.textVerticalAlign).toBe(TextVerticalAlign.Top);
    expect(bpmnMorphClears('group')).toEqual([]);

    for (const kind of EVERY_KIND) {
      if (kind === 'group') continue;
      expect(bpmnMorphClears(kind)).toEqual(['textVerticalAlign']);
    }
  });

  it('is derived, so it stays right when a preset gains a conditional key', () => {
    // Computed as "every key any kind writes, minus the ones this one writes",
    // never listed — so nothing has to be remembered on the day a preset starts
    // spreading a second key.
    for (const kind of EVERY_KIND) {
      const written = new Set(Object.keys(bpmnMorphProps(kind)));
      for (const cleared of bpmnMorphClears(kind)) {
        expect(written.has(cleared)).toBe(false);
      }
    }
  });
});

describe('the spec handed to the generic module', () => {
  it('reports under the framework wire key and the declared families', () => {
    expect(BPMN_MORPH_SPEC.framework).toBe('bpmn');
    expect(BPMN_MORPH_SPEC.families).toBe(BPMN_MORPH_FAMILIES);
  });

  it('reads a kind off a node and nothing off anything else', () => {
    expect(BPMN_MORPH_SPEC.kindOf({ kind: 'task' } as never)).toBeUndefined();
  });

  it('morphs a task to a user task without leaving the activity family', () => {
    const props = bpmnMorphProps('taskUser');
    expect(props.role).toBe(BPMN_ROLE.taskUser);
    // Same rounded rectangle, same stroke: only the meaning and the glyph move.
    expect(props.shapeType).toBe(bpmnMorphProps('task').shapeType);
    expect(props.radius).toBe(bpmnMorphProps('task').radius);
  });
});
