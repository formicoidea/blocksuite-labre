import type { BpmnNodeKind } from '@labre/affine-model';
import { StrokeStyle, TextVerticalAlign } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { bpmnCommandIcons, bpmnCommands } from '../commands';
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
    }
  });

  it('shows each kind the very icon its creation command draws', () => {
    // Reference equality, not "is defined": `iconOf` falls back to the task
    // icon for a kind it cannot resolve, so a lookup that quietly stopped
    // working would still hand back a `TemplateResult` — and every entry in
    // the dropdown would be a rectangle.
    for (const kind of MORPHABLE) {
      const command = bpmnCommands.find(
        candidate => candidate.telemetry?.element === `node:${kind}`
      );
      expect(command?.iconKey, kind).toBeDefined();
      expect(BPMN_MORPH_SPEC.iconOf(kind), kind).toBe(
        bpmnCommandIcons[command!.iconKey!]
      );
    }
  });

  it('draws no two kinds of one family with the same icon', () => {
    // A family whose members were indistinguishable in the menu would be a
    // menu that decides nothing.
    for (const family of BPMN_MORPH_FAMILIES) {
      const icons = new Set(family.map(kind => BPMN_MORPH_SPEC.iconOf(kind)));
      expect(icons.size, family.join(' / ')).toBe(family.length);
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

  it('gives the call activity the border that a two-key patch would not', () => {
    // THE production case for reapplying the whole preset, and the only pair on
    // today's table where the members of one family style themselves
    // differently: same rounded rectangle, and the border is the whole
    // distinction between "a process defined inline" and "one defined
    // elsewhere". A `{kind, role}` morph leaves the call activity wearing the
    // sub-process's thin border — a drawing that says the wrong thing.
    expect(bpmnMorphProps('callActivity').strokeWidth).not.toBe(
      bpmnMorphProps('subProcess').strokeWidth
    );
  });

  it('carries every key a morphable pair disagrees on', () => {
    // Data-driven over the declared table rather than over the pair above: a
    // family gains members by DECLARATION, and this is what asks the question
    // nobody would otherwise be prompted to ask — does the patch actually carry
    // everything the two ends of a legal morph differ in?
    for (const family of BPMN_MORPH_FAMILIES) {
      for (const from of family) {
        for (const to of family) {
          if (from === to) continue;

          const before = bpmnMorphProps(from);
          const after = bpmnMorphProps(to);
          const cleared = new Set(bpmnMorphClears(to));

          // Every key the source writes is either rewritten by the target's
          // patch or explicitly cleared. Anything else is a prop of the OLD
          // artefact left silently in force on the new one.
          for (const key of Object.keys(before)) {
            expect(
              key in after || cleared.has(key),
              `${from} → ${to} leaves "${key}" behind`
            ).toBe(true);
          }
        }
      }
    }
  });

  it('carries the appearance of each kind, not a shared default', () => {
    // Fidelity of `bpmnMorphProps` across kinds: the patch a kind is worth
    // really is that kind's preset, so the three styling families the pack
    // draws — a filled solid body, a glyph-bodied artefact that paints nothing
    // natively, and a dashed hollow outline — come out distinct.
    //
    // These three are NOT a morph between one another: `task`, `dataObject` and
    // `group` sit in different families (and `group` in none), so the table
    // forbids every pair of them. What they prove is the builder, which is what
    // the reachable morphs are then derived from — the pair where that actually
    // changes an element is `subProcess` ⇄ `callActivity`, asserted above.
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
