import {
  ReadingProfileIdentifier,
  type ReadingProfile,
} from '@labre/affine-block-surface';
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { Container } from '@labre/global/di';
import {
  RoleVocabularyIdentifier,
  roleIsA,
  type RoleDef,
  type RoleDefs,
} from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../extensions/view.js';
import { FRAMEWORK_DESCRIPTORS } from '../frameworks.js';

/**
 * GUARD — every framework's artefacts are READABLE, not only Wardley's.
 *
 * ## What it would have caught
 *
 * Seven frameworks shipped with a reading panel that opened only for Wardley.
 * `ReadingProfileExtension` and the generic engine landed in August 2026;
 * `gfx/wardley/src/view.ts` was the ONE file that ever called
 * `context.register(ReadingProfileExtension(…))`. Nothing failed: the panel is
 * gated on a registered profile, so an EDGY element, a BPMN task, a C4
 * container and an Estuarine constraint simply had no "Read this component"
 * entry at all, and no test anywhere named the absence. The product owner found
 * it by clicking.
 *
 * ## How it checks
 *
 * By MOUNTING the edgeless view extensions for real — the same
 * `ViewExtensionManager` + `Container` the flag suites use — and reading the DI
 * container back. That is deliberate and is the whole point: importing each
 * framework's exported profile constant would prove the DECLARATION exists and
 * would stay green if somebody deleted the `context.register(…)` line beside
 * it, which is exactly the bug above. Here, a profile that is declared but never
 * registered is invisible, and the framework's roles come out unread.
 *
 * The role vocabularies come out of the same container
 * (`RoleVocabularyIdentifier`), so the list of roles to check is the library's
 * own runtime data — a role added to any `roles.ts` is covered here without
 * anybody remembering to add it.
 *
 * ## The exclusion list, and why it is spelled out
 *
 * A frame is not an artefact: a reading is about what is drawn ON the sheet,
 * never about the sheet. And Wardley reads only its value chain — an anchor is a
 * need, a Porter's force is a pressure from outside, an area is a region — which
 * is a product decision (`gfx/wardley/src/reading.ts`), not an oversight.
 * Everything else must resolve. The list is PINNED rather than derived: a node
 * role added to any framework fails this test until somebody decides, in
 * writing, whether it is readable.
 */

/**
 * Node roles that deliberately have NO reading, with the reason in one word.
 *
 * `kind: 'edge'` and `kind: 'text'` roles are excluded by construction — a
 * reading is about a node — so only nodes are listed.
 */
const UNREAD_NODE_ROLES: Readonly<Record<string, string>> = {
  // Frames: the sheet, not what is drawn on it.
  'wardley:map': 'frame',
  'edgy:background': 'frame',
  'edgy:facets': 'frame',
  'edgy:board': 'frame',
  'estuarine:map': 'frame',
  'bpmn:pool': 'frame',
  'core-domain:chart': 'frame',
  'context-map:board': 'frame',
  'es:board': 'frame',
  'c4:board': 'frame',
  'c4:boundary': 'frame',
  'c4:system-boundary': 'frame',
  'c4:container-boundary': 'frame',
  'uml:diagram': 'frame',
  'uml:subject': 'frame',
  // §15.6.4's swimlane and §14.2.4's composite state: both are rectangles drawn
  // ROUND part of the drawing, and what belongs to one is read back from where
  // an element sits. A band is not an artefact any more than a sheet is.
  'uml:partition': 'frame',
  'uml:region': 'frame',
  // §17.6.4's combined fragment and the operand bands inside it: the same
  // answer, one clause later. A fragment is a rectangle drawn ROUND part of an
  // interaction and an operand is a slice of its plot, and what is inside
  // either is read back from where an occurrence sits.
  'uml:fragment': 'frame',
  'uml:operand': 'frame',
  // Declared, never stamped: `uml:classifier` is §9.2's own generalisation, the
  // parent `uml:class`, `uml:interface` and `uml:enumeration` hang off so a
  // rule about classifiers reaches all three. No command creates it and no
  // element carries it, so there is nothing for a profile to read — and the
  // three concrete children each have one of their own.
  'uml:classifier': 'an abstract parent nothing is ever drawn as',
  // Wardley's own product decision: the reading is about the VALUE CHAIN.
  // A need has a demand, not a nature; a force and an accelerator press on the
  // chain from outside it; an area is a region; a pipeline's connections go
  // through its handle; an inertia bar is a mark on a divider.
  'wardley:anchor': 'not a link in the value chain',
  'wardley:pipeline': 'not a link in the value chain',
  'wardley:handle': 'not a link in the value chain',
  'wardley:method': 'not a link in the value chain',
  'wardley:porter': 'not a link in the value chain',
  'wardley:accelerator': 'not a link in the value chain',
  'wardley:decelerator': 'not a link in the value chain',
  'wardley:area': 'not a link in the value chain',
  'wardley:inertia': 'not a link in the value chain',
};

/** Mount the edgeless view extensions for real and read the DI container back. */
function mountEdgeless() {
  const manager = new ViewExtensionManager(getInternalViewExtensions({}));
  const container = new Container();
  manager.get('edgeless').forEach(ext => ext.setup(container));
  const provider = container.provider();
  return {
    profiles: Array.from(
      provider.getAll(ReadingProfileIdentifier).values()
    ) as ReadingProfile[],
    vocabularies: Array.from(
      provider.getAll(RoleVocabularyIdentifier).values()
    ) as RoleDefs[],
  };
}

const readable = (roleId: string, profiles: readonly ReadingProfile[]) =>
  profiles.some(profile => roleIsA(roleId, profile.appliesTo, profile.roles));

describe('every framework ships a reading, not only Wardley', () => {
  const { profiles, vocabularies } = mountEdgeless();
  const nodeRoles: RoleDef[] = vocabularies
    .flatMap(defs => Object.values(defs))
    .filter(def => def.kind === 'node');

  test('the nine frameworks each register at least one profile', () => {
    // Nine descriptors, nine role vocabularies, and every one of them
    // represented among the registered profiles. The count is derived on both
    // sides, so a tenth framework arrives here with its own row.
    expect(vocabularies).toHaveLength(FRAMEWORK_DESCRIPTORS.length);

    const owners = new Set(profiles.map(profile => profile.framework));
    expect(
      FRAMEWORK_DESCRIPTORS.map(d => d.id).filter(id => !owners.has(id))
    ).toEqual([]);
  });

  test('every role-carrying NODE resolves to a registered profile', () => {
    const unread = nodeRoles
      .map(def => def.id)
      .filter(id => !(id in UNREAD_NODE_ROLES))
      .filter(id => !readable(id, profiles))
      .sort();
    expect(unread, 'node roles no reading profile covers').toEqual([]);
  });

  test('the exclusions are all real roles, and all genuinely unread', () => {
    // The other direction: an exclusion that no longer names a role is a stale
    // waiver, and one that a profile HAS started covering is a line nobody
    // deleted. Either way the list stops meaning what it says.
    const declared = new Set(nodeRoles.map(def => def.id));
    expect(
      Object.keys(UNREAD_NODE_ROLES)
        .filter(id => !declared.has(id))
        .sort(),
      'exclusions that name no declared node role'
    ).toEqual([]);
    expect(
      Object.keys(UNREAD_NODE_ROLES)
        .filter(id => readable(id, profiles))
        .sort(),
      'exclusions a profile now covers'
    ).toEqual([]);
  });

  test('profile ids are unique — the DI keys on them', () => {
    const ids = profiles.map(profile => profile.id);
    expect(new Set(ids).size, ids.join(', ')).toBe(ids.length);
  });

  test('only Wardley claims a vertical reading of its board', () => {
    // `geometry` turns on the contradiction note and the value-flow section,
    // both of which are statements about a VALUE CHAIN. Everybody else declares
    // none and the panel keeps quiet — the decision, pinned.
    expect(
      profiles
        .filter(profile => profile.relation?.geometry === 'vertical')
        .map(profile => profile.id)
    ).toEqual(['wardley']);
  });

  test('a profile that reads a relation names both of its sides', () => {
    // A side with no wording is a group of names under no heading. The engine
    // hides it rather than inventing one, so the omission would be silent.
    for (const profile of profiles) {
      const relation = profile.relation;
      if (!relation) continue;
      for (const side of ['consumer', 'supplier'] as const) {
        const wording = relation.sides[side];
        expect(wording?.labelKey, `${profile.id}/${side}`).toMatch(
          /^com\.labre\./
        );
        expect(wording?.labelFallback, `${profile.id}/${side}`).toBeTruthy();
      }
    }
  });
});
