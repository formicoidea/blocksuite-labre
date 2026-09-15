import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ValidationManager } from '@labre/affine/blocks/surface';
import { UML_ROLE } from '@labre/affine-gfx-uml';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * O9 of the PO's recette of 2026-09-14, and the answer to it:
 *
 * > « Il ne se passe rien quand je passe en mode spécification. Il se peut que
 * > je ne comprenne pas bien le test. »
 *
 * The step they ran (recette 5.3) is: drag an actor inside the subject, open
 * the Validation dropdown on the frame, switch to « Specification ». Nothing
 * appeared, and the PO's own second sentence turns out to be the right reading:
 * `uml.actor-inside-subject` is `audit` under BOTH levels, on purpose and by a
 * decision recorded in `gfx/uml/src/profiles.ts` — where a glyph sits on the
 * canvas is a drawing decision with a second reading under which the author is
 * right, so the house rule never bites. The step therefore asks the level of
 * requirement to change an answer it is declared never to change.
 *
 * That is a recette-script defect and not a code one, which is a claim worth a
 * test rather than a paragraph. This suite is that test, and it pins BOTH
 * halves against a real editor:
 *
 *  - the mechanism works — a promoted rule fires the instant the profile
 *    changes, with no gesture, no debounce and no reload in between;
 *  - the membership rule does not, at either level, which is the decision and
 *    not a failure of the mechanism.
 *
 * The unit suite (`gfx/uml/src/__tests__/profiles.unit.spec.ts`) owns the two
 * tables. What only a live editor answers is whether choosing a level actually
 * re-runs the engine, which is exactly what the PO could not tell.
 */
describe('switching a UML diagram to the specification level', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    validation = edgeless.std.get(ValidationManager);
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;

  /** The sheet, as `uml.addDiagram` draws it: born a CLASS diagram. */
  const addDiagram = (kind = 'class') =>
    surfaceModel().addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind,
      xywh: '[0,0,1200,800]',
    });

  const addSubject = () =>
    surfaceModel().addElement({
      type: 'umlDiagram',
      role: UML_ROLE.subject,
      xywh: '[300,200,500,400]',
    });

  /**
   * An actor and its one word, grouped the way `uml.addActor` groups them.
   * `words` empty is an actor nobody named — which is what
   * `uml.unnamed-actor-or-use-case` indicts.
   */
  const addActor = (xywh: string, words: string) => {
    const [x, y, w] = JSON.parse(xywh) as number[];
    const surface = surfaceModel();
    const shape = surface.addElement({
      type: 'umlNode',
      kind: 'actor',
      role: UML_ROLE.actor,
      xywh,
    });
    const label = surface.addElement({
      type: 'text',
      role: UML_ROLE.label,
      text: words,
      xywh: `[${x},${y + 100},${w},24]`,
    });
    surface.addElement({
      type: 'group',
      children: { [shape]: true, [label]: true },
    });
    return shape;
  };

  const settle = async () => {
    await wait(250);
    await edgeless.updateComplete;
  };

  const findingsOn = (ruleId: string) =>
    validation.violations$.value.filter(
      violation => violation.ruleId === ruleId
    );

  const frameOf = (id: string) => surfaceModel().getElementById(id)!;

  test('re-evaluates on the spot, and raises what the level promotes', async () => {
    // A CLASS diagram with an actor on it: the sheet's own heading says what it
    // draws, and `uml.not-admissible-on-kind` is the rule that reads it. It is
    // `audit` on the sketch, `warning` on the specification, and — unlike the
    // naming and spelling rules, which are `on-demand` because they read words
    // a user is still typing — it runs on the drawing path, so promoting it
    // puts a mark on the canvas with no further gesture.
    const diagram = addDiagram('class');
    addActor('[100,100,80,120]', 'Client');
    await settle();

    // THE SKETCH. Not a single user-facing finding: every rule is `audit`, so
    // the engine files them for the panel and the canvas says nothing. This is
    // the state the PO was in.
    expect(validation.profileOf(frameOf(diagram))?.id).toBe('uml.sketch');
    expect(validation.violations$.value).toEqual([]);

    // THE GESTURE, as the dropdown makes it — `setProfile` is what the
    // toolbar's `pickProfile` calls, and the only thing it adds is an undo
    // checkpoint and a telemetry event.
    expect(validation.setProfile(frameOf(diagram), 'uml.strict')).toBe(true);

    // IMMEDIATELY: no `await`, no debounce, no second gesture. `setProfile`
    // re-evaluates before it returns, exactly as granting an exception does,
    // and this assertion is the one that answers the PO's question.
    const raised = findingsOn('uml.not-admissible-on-kind');
    expect(raised.length).toBeGreaterThan(0);
    expect(raised.every(finding => finding.severity === 'warning')).toBe(true);

    // …and the trigger the user reads names the level in force, so the change
    // is visible on the toolbar as well as on the canvas.
    expect(validation.profileOf(frameOf(diagram))?.fallback).toBe(
      'Specification'
    );

    // Back down, and the board goes quiet again in the same breath.
    expect(validation.setProfile(frameOf(diagram), 'uml.sketch')).toBe(true);
    expect(validation.violations$.value).toEqual([]);
  });

  test('says nothing about an actor inside the subject, at EITHER level', async () => {
    // The recette's own step 5.3, drawn: the actor is wholly inside the
    // subject, which is what `uml.actor-inside-subject` is about. A use-case
    // sheet, so the one rule the level DOES promote here has nothing to say and
    // the silence being measured is the membership rule's own.
    const diagram = addDiagram('use-case');
    addSubject();
    addActor('[400,250,80,120]', 'Client');
    await settle();

    for (const profileId of ['uml.sketch', 'uml.strict'] as const) {
      validation.setProfile(frameOf(diagram), profileId);
      await settle();
      expect(
        findingsOn('uml.actor-inside-subject'),
        `${profileId} must stay silent about where the actor sits`
      ).toEqual([]);
    }

    // The rule IS registered and IS in the pack — it is quiet by decision, not
    // by absence, which is the difference the PO could not see from the canvas.
    expect(validation.ruleOf('uml.actor-inside-subject')).toBeDefined();
    expect(
      validation.checkupRulesFor(frameOf(diagram)).map(rule => rule.id)
    ).toContain('uml.actor-inside-subject');
  });
});
