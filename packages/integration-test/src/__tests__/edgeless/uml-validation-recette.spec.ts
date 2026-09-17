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

/**
 * The PO recette of 2026-09-16, and the decision that answers it:
 *
 * > « le check-up ne fonctionne pas », « vérification qui ne fonctionne pas »,
 * > « la vérif ne fonctionne pas » — three steps, one cause.
 *
 * Every rule the three steps expect is `audit` under `uml.sketch`, which is the
 * default, so the canvas said nothing; and nine of them ALSO declare
 * `moment: 'on-demand'`, which until this recette won against any level, so
 * choosing Specification raised their severity and still drew nothing. The
 * findings were computed, filed and shown to nobody.
 *
 * The PO's own arbitration: **Specification IS the check-up.** There is no
 * button to press. Switching the frame's Validation dropdown to «Specification»
 * puts every rule that level promotes on the drawing path — including the ones
 * that declared the second moment — and the findings appear on the canvas like
 * any other warning, on the switch and on every edit afterwards.
 *
 * This suite is the three steps, drawn against a real editor. The UI path each
 * one describes is: select the frame, open Validation, choose Specification.
 */
describe('Specification is the check-up (PO, 2026-09-16)', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let validation!: ValidationManager;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    validation = edgeless.std.get(ValidationManager);
    return cleanup;
  });

  const surfaceModel = () => getSurface(window.doc, window.editor).model;
  const frameOf = (id: string) => surfaceModel().getElementById(id)!;

  const sheet = (kind: string) =>
    surfaceModel().addElement({
      type: 'umlDiagram',
      role: UML_ROLE.diagram,
      kind,
      xywh: '[0,0,1200,800]',
    });

  const settle = async () => {
    await wait(250);
    await edgeless.updateComplete;
  };

  /** The live, user-facing findings of one rule — what the canvas draws. */
  const drawn = (ruleId: string) =>
    validation.violations$.value.filter(
      violation => violation.ruleId === ruleId
    );

  /**
   * The gesture the dropdown makes. `setProfile` is exactly what the entry's
   * `pickProfile` calls; the entry adds an undo checkpoint and a telemetry
   * event and nothing else. The assertion above it is the dropdown STANDING UP:
   * two levels to choose between is what puts the entry on the toolbar.
   */
  const choose = (id: string, profileId: string) => {
    expect(
      validation.profilesFor(frameOf(id)).map(profile => profile.id)
    ).toEqual(['uml.sketch', 'uml.strict']);
    return validation.setProfile(frameOf(id), profileId);
  };

  /**
   * Step 2 of the recette — «vérification qui ne fonctionne pas».
   *
   * A shallow history dropped on a state machine sheet, outside every region.
   * `uml.shallow-history-outside-region` is an `element-in-background` rule whose
   * FRAME is the region, so the finding is filed under the region and not under
   * the sheet — which is also why a check-up run on the sheet alone would have
   * reported a clean diagram (`gfx/uml/src/rules.ts` says so at length). Drawn on
   * the canvas there is no such narrowing: the mark sits on the glyph.
   */
  test('a history outside every region lights up under Specification', async () => {
    const diagram = sheet('stm');
    surfaceModel().addElement({
      type: 'umlRegion',
      role: UML_ROLE.region,
      name: 'Running',
      xywh: '[100,100,400,300]',
    });
    // Well inside the sheet, well outside the region.
    surfaceModel().addElement({
      type: 'umlNode',
      kind: 'shallow-history',
      role: UML_ROLE['shallow-history'],
      xywh: '[800,500,40,40]',
    });
    await settle();

    // THE SKETCH: computed, filed, and the canvas says nothing. This is the
    // state the PO was in.
    expect(validation.profileOf(frameOf(diagram))?.id).toBe('uml.sketch');
    expect(drawn('uml.shallow-history-outside-region')).toEqual([]);

    // THE GESTURE, and no other.
    expect(choose(diagram, 'uml.strict')).toBe(true);

    const raised = drawn('uml.shallow-history-outside-region');
    expect(raised.length).toBeGreaterThan(0);
    expect(raised.every(finding => finding.severity === 'warning')).toBe(true);

    // ...and back down, in the same breath.
    expect(choose(diagram, 'uml.sketch')).toBe(true);
    expect(drawn('uml.shallow-history-outside-region')).toEqual([]);
  });

  /**
   * Step 3 — «la vérif ne fonctionne pas».
   *
   * The three the PO drew on a sequence sheet: a head emptied, a head spelled
   * `: :`, and a message labelled `bad label (`. All three are declared
   * `moment: 'on-demand'` — they read WORDS, and words are what a user is in the
   * middle of typing — and all three are promoted by `uml.strict`. Before this
   * recette that promotion was inert.
   */
  test('the sequence sheet: the three of them light up together', async () => {
    const diagram = sheet('sd');
    const surface = surfaceModel();

    const spine = (x: number) =>
      surface.addElement({
        type: 'umlNode',
        kind: 'lifeline',
        role: UML_ROLE.lifeline,
        xywh: '[' + x + ',100,16,600]',
      });
    const head = (x: number, words: string) =>
      surface.addElement({
        type: 'text',
        role: UML_ROLE['lifeline-ident'],
        text: words,
        xywh: '[' + (x - 70) + ',70,160,24]',
      });

    const caller = spine(200);
    // Emptied — `uml.unnamed-lifeline`'s question.
    const emptied = head(200, '');
    const callee = spine(600);
    // Spelled `: :` — a head `checkLifelineIdent` cannot split, which is
    // `uml.lifeline-ident-syntax`'s.
    head(600, ': :');

    const message = surface.addElement({
      type: 'connector',
      role: UML_ROLE['message-sync'],
      source: { id: caller, position: [1, 0.3] },
      target: { id: callee, position: [0, 0.3] },
      text: 'bad label (',
    });
    expect(message).toBeTruthy();
    await settle();

    const three = [
      'uml.unnamed-lifeline',
      'uml.lifeline-ident-syntax',
      'uml.message-syntax',
    ];

    // THE SKETCH: silence, on all three.
    for (const ruleId of three) {
      expect(drawn(ruleId), ruleId + ' under the sketch').toEqual([]);
    }

    expect(choose(diagram, 'uml.strict')).toBe(true);

    for (const ruleId of three) {
      const raised = drawn(ruleId);
      expect(raised.length, ruleId + ' under Specification').toBeGreaterThan(0);
      expect(raised.every(finding => finding.severity === 'warning')).toBe(
        true
      );
    }

    // ...and the OTHER half of "live": the finding follows the word. Writing a
    // head that parses clears its finding with no second gesture, which is what
    // `verdictPropsOf` watching `text` buys — without it the promotion would
    // raise these once, on the switch, and never speak again.
    // Typed, not replaced: the head's own `Y.Text` is the thing a keystroke
    // mutates, which is exactly the change `verdictPropsOf` has to be watching.
    const head0 = surface.getElementById(emptied) as unknown as {
      text: { insert: (index: number, words: string) => void };
    };
    window.doc.transact(() => head0.text.insert(0, 'c : Customer'));
    await settle();

    expect(drawn('uml.unnamed-lifeline')).toEqual([]);
    // The other head is untouched and still wrong.
    expect(drawn('uml.lifeline-ident-syntax').length).toBeGreaterThan(0);

    expect(choose(diagram, 'uml.sketch')).toBe(true);
    for (const ruleId of three) {
      expect(drawn(ruleId), ruleId + ' back on the sketch').toEqual([]);
    }
  });

  /**
   * Step 1 — «le check-up ne fonctionne pas», the port dragged inside its
   * component.
   *
   * This test used to pin the opposite: `uml.port-on-border` did not exist, and
   * `gfx/uml/src/rules.ts` recorded at length why it could not — §11.3.4's
   * question is "is this small square within a band of that box's outline", and
   * no rule family expressed it. `attachment` measures a distance to a PATH and
   * refuses a node carrier; `element-in-background` demands FULL containment,
   * which the notation's own preferred drawing breaks by construction;
   * `no-overlap` has the opposite polarity and no tolerance. The answer was the
   * family the question needs (`border-proximity`, `docs/adr/0024`) rather than
   * an approximation with a neighbouring one, and the rule is now the pack's
   * forty-third.
   *
   * What only a live editor answers is the same thing it answered for the three
   * sequence rules above: whether choosing a level actually re-runs the engine
   * over a drawing nobody has touched since. The geometry itself is the unit
   * suites' business (`validation-border-proximity.unit.spec.ts` for the family,
   * `gfx/uml/src/__tests__/rules.unit.spec.ts` U43 for the tolerance).
   */
  test('a port dragged inside its component lights up under Specification', async () => {
    const diagram = sheet('cmp');
    const component = surfaceModel().addElement({
      type: 'umlNode',
      kind: 'component',
      role: UML_ROLE.component,
      xywh: '[200,200,300,200]',
    });
    expect(component).toBeTruthy();
    // Wholly inside the component, which is the drawing the PO made: the square
    // is centred at (340, 300), 140 units from the nearest edge of a box that
    // spans x 200…500 and y 200…400 — far past the 16-unit tolerance.
    const port = surfaceModel().addElement({
      type: 'umlNode',
      kind: 'port',
      role: UML_ROLE.port,
      xywh: '[330,290,20,20]',
    });
    await settle();

    // The rule EXISTS now — the difference the PO could not see from the canvas,
    // and the half this test used to pin the other way round.
    expect(validation.ruleOf('uml.port-on-border')).toBeDefined();

    // THE SKETCH: computed, filed, and the canvas says nothing.
    expect(validation.profileOf(frameOf(diagram))?.id).toBe('uml.sketch');
    expect(drawn('uml.port-on-border')).toEqual([]);

    // THE GESTURE, and no other.
    expect(choose(diagram, 'uml.strict')).toBe(true);

    const raised = drawn('uml.port-on-border');
    expect(raised.length).toBeGreaterThan(0);
    expect(raised.every(finding => finding.severity === 'warning')).toBe(true);
    // Both artefacts are indicted: the square has drifted, or the box has grown
    // under it, and the user is shown both brackets.
    expect(raised[0].elementIds.sort()).toEqual([component, port].sort());

    // ...and the other half of "live": the finding follows the GLYPH. Dragging
    // the square back onto the border clears it with no second gesture and no
    // profile change.
    // Centred at (500, 300): exactly on the component's right edge.
    surfaceModel().updateElement(port, { xywh: '[490,290,20,20]' });
    await settle();

    expect(drawn('uml.port-on-border')).toEqual([]);

    // ...and back down to the sketch, where it says nothing either way.
    expect(choose(diagram, 'uml.sketch')).toBe(true);
    expect(drawn('uml.port-on-border')).toEqual([]);
  });
});
