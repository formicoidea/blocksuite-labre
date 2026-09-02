import { findRoleDef, isTypedEdgeRole } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { wardleyCommands } from '../commands';
import { WARDLEY_ROLE, WARDLEY_ROLES } from '../roles';
import { TEMPLATE_CARDS } from './corpus/templates';

/**
 * `docs/adr/0010` — the persisted direction of a typed edge is semantic.
 *
 * This spec pins the CONVENTION itself: what the vocabulary declares, what the
 * shipped corpus does with it, and what the tool says before the user draws.
 * The rule that reads it (W4) is covered in `validation.unit.spec.ts`; the
 * mechanisms that show and reverse it live in `gfx/connector`.
 */

const vocabularies = [WARDLEY_ROLES];

describe('the vocabulary states the convention', () => {
  it('gives every EDGE role a verb, and every node role none', () => {
    for (const def of Object.values(WARDLEY_ROLES)) {
      if (def.kind === 'edge') {
        // Tier 1: an edge role names a relation with a verb, `source` is its
        // subject and `target` its object. A role that declares no verb leaves
        // the reveal with nothing to say.
        expect(def.direction?.verbKey, def.id).toBeTruthy();
        expect(def.direction?.verbFallback, def.id).toBeTruthy();
        expect(def.direction?.verbKey).toMatch(/^com\.labre\./);
      } else {
        expect(def.direction, def.id).toBeUndefined();
      }
    }
  });

  it('tells the user which way to DRAW each typed edge (M1)', () => {
    for (const def of Object.values(WARDLEY_ROLES)) {
      if (def.kind !== 'edge') continue;
      expect(def.direction?.gestureHintKey, def.id).toBeTruthy();
      expect(def.direction?.gestureHintFallback, def.id).toBeTruthy();
    }
  });

  it('says the dependency verb is "needs", and the arrow’s is not', () => {
    // Tier 2, and the whole of what W4 reads: the source of a dependency is the
    // CONSUMER. The change arrow is oriented too and means something else — a
    // rule may only read "consumer / provider" out of an edge whose verb says
    // so.
    //
    // The verb read "depends on" until the PO recette of 02/09/2026. The KEY is
    // what a host catalogue binds and it did not move; only the English
    // fallback did, which is exactly the seam this pin is here to protect.
    const dependency = findRoleDef(vocabularies, WARDLEY_ROLE.dependency);
    const arrow = findRoleDef(vocabularies, WARDLEY_ROLE.changeArrow);

    expect(dependency?.direction?.verbKey).toBe(
      'com.labre.wardley.role.dependency.verb'
    );
    expect(dependency?.direction?.verbFallback).toBe('needs');
    expect(arrow?.direction?.verbFallback).not.toBe('needs');
  });

  it('paints the dependency chip in the house primary, and nothing else', () => {
    // The PO asked for THIS relation to stand out (recette of 02/09/2026). A
    // colour declared on the role rather than on the reveal is what keeps that
    // decision from repainting every other framework's typed edges, so the pin
    // is two-sided: the dependency asks for a colour, and no other Wardley edge
    // role does.
    const dependency = findRoleDef(vocabularies, WARDLEY_ROLE.dependency);
    expect(dependency?.direction?.chipColor).toBe('#2563eb');

    for (const def of Object.values(WARDLEY_ROLES)) {
      if (def.id === WARDLEY_ROLE.dependency) continue;
      expect(def.direction?.chipColor, def.id).toBeUndefined();
    }
  });

  it('answers "is this a typed edge" for edges, nodes and strangers alike', () => {
    expect(isTypedEdgeRole(vocabularies, WARDLEY_ROLE.dependency)).toBe(true);
    expect(isTypedEdgeRole(vocabularies, WARDLEY_ROLE.changeArrow)).toBe(true);
    expect(isTypedEdgeRole(vocabularies, WARDLEY_ROLE.component)).toBe(false);
    // A neutral element, and a role no loaded framework declares: neither
    // claims anything about its two ends. The stranger is DELIBERATELY
    // fictional — naming another framework's real edge here would make this
    // test a statement about which vocabularies the fixture happens to load,
    // and it would start failing the day someone loads that one.
    expect(isTypedEdgeRole(vocabularies, undefined)).toBe(false);
    expect(isTypedEdgeRole(vocabularies, 'nowhere:made-up-edge')).toBe(false);
  });
});

describe('the link tool announces its gesture (M1)', () => {
  it('puts the role’s own hint on the two connector commands', () => {
    const linkTool = wardleyCommands.find(c => c.id === 'wardley.linkTool');
    const arrowTool = wardleyCommands.find(
      c => c.id === 'wardley.evolutionArrow'
    );

    expect(linkTool?.descriptionKey).toBe(
      WARDLEY_ROLES[WARDLEY_ROLE.dependency].direction?.gestureHintKey
    );
    expect(linkTool?.descriptionFallback).toMatch(/has the need/);
    expect(arrowTool?.descriptionKey).toBe(
      WARDLEY_ROLES[WARDLEY_ROLE.changeArrow].direction?.gestureHintKey
    );
  });

  it('leaves every other TOOLBOX command without a gesture hint', () => {
    // Proportionality: a component button decides no orientation, so it has
    // nothing to announce and must not grow a second tooltip line.
    //
    // Scoped to what you DRAW with, since the OWM pair and the SVG fallback
    // landed. An `action` whose subject is the whole map — import, export —
    // describes what it does to a document, which is a different sentence from
    // "which way round do I drag this": the next assertion is what keeps the
    // two apart. Inside the population this DOES cover, the rule is unchanged
    // and as strict as the day it was written: a tool either announces a
    // gesture or says nothing at all.
    const noisy = wardleyCommands.filter(
      c =>
        c.kind !== 'action' &&
        c.descriptionKey !== undefined &&
        !['wardley.linkTool', 'wardley.evolutionArrow'].includes(c.id)
    );
    expect(noisy.map(c => c.id)).toEqual([]);

    // …and the visual-tier fallback is outside the SUB-MENU by declaration
    // rather than by accident, which is the other half of why its description
    // is proportionate: it never renders a second line in the row at all
    // (`docs/adr/0012`, P2 — the row carries the native format).
    const fallback = wardleyCommands.find(c => c.id === 'wardley.importSvg');
    expect(fallback?.surfaces).not.toContain('senior-menu');
  });

  it('never lends a role’s gesture hint to a command that draws no edge', () => {
    // The other half of the scoping above: an action may carry a description,
    // and it may never be one of the vocabulary's gesture hints — those belong
    // to the tool that stamps the role, and nowhere else (`docs/adr/0010`, M1).
    const hints = new Set(
      Object.values(WARDLEY_ROLES)
        .map(def => def.direction?.gestureHintKey)
        .filter(key => key !== undefined)
    );
    for (const command of wardleyCommands.filter(c => c.kind === 'action')) {
      expect(hints.has(command.descriptionKey!)).toBe(false);
    }
  });
});

/**
 * The convention as an assertion over the only real maps in the repository.
 *
 * A shipped template is factory content: it is the first Wardley map most users
 * ever see, and the day one is authored backwards it teaches the reverse of
 * what W4 enforces to exactly the people who trust it most.
 */
describe('every shipped typed edge respects the convention', () => {
  /** `{ id }` on both ends, read back off the reconstructed cards. */
  const endsOf = (el: unknown) => {
    const edge = el as {
      source?: { id?: string };
      target?: { id?: string };
    };
    return [edge.source?.id, edge.target?.id] as const;
  };

  it('walks BOTH template kits, and finds dependencies to check', () => {
    const dependencies = TEMPLATE_CARDS.flatMap(card =>
      card.elements.filter(el => el.role === WARDLEY_ROLE.dependency)
    );
    // The twelve links of the two shipped maps. If this ever drops to zero the
    // assertions below become vacuous, which is the failure mode a corpus test
    // is most likely to die of.
    expect(dependencies.length).toBeGreaterThanOrEqual(12);
  });

  it('never ships a typed edge with an unbound end', () => {
    const unbound: string[] = [];
    for (const card of TEMPLATE_CARDS) {
      for (const el of card.elements) {
        if (el.role === undefined) continue;
        const def = findRoleDef(vocabularies, el.role);
        if (def?.kind !== 'edge') continue;
        const [source, target] = endsOf(el);
        if (!source || !target) unbound.push(`${card.name}/${el.id}`);
      }
    }
    // This is what keeps the "Link" and "Evolution arrow" swatches de-typed: a
    // stroke in a palette relates nothing, so it must claim nothing.
    expect(unbound).toEqual([]);
  });

  it('puts the consumer ABOVE what it needs, in every one of them', () => {
    const backwards: string[] = [];
    for (const card of TEMPLATE_CARDS) {
      const byId = new Map(card.elements.map(el => [el.id, el]));
      for (const el of card.elements) {
        if (el.role !== WARDLEY_ROLE.dependency) continue;
        const [source, target] = endsOf(el);
        const consumer = source ? byId.get(source) : undefined;
        const provider = target ? byId.get(target) : undefined;
        if (!consumer || !provider) continue;
        // Model space: `y` grows downwards, so "more visible" is a SMALLER y.
        if (
          consumer.elementBound.center[1] >= provider.elementBound.center[1]
        ) {
          backwards.push(`${card.name}/${el.id}`);
        }
      }
    }
    expect(backwards).toEqual([]);
  });
});
