import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  checkedNudges,
  isNudgeChecked,
  setNudgeChecked,
} from '../extensions/map-quality.js';
import {
  backgroundElementIds,
  checkupRules,
  evaluateCheckup,
  evaluateRules,
  frameworksOfRole,
  toneOf,
  type ValidationFrameworkDef,
  type ValidationProfile,
  type ValidationRule,
  verdictPropsOf,
} from '../extensions/validation.js';

/**
 * Map quality, engine half: the on-demand MOMENT (PF5.14), the two families it
 * was built for (PF13.8) and the checklist state (PF7.10).
 *
 * What only a real editor can answer — the panel, the toolbar entry, the round
 * trip through a Y.Doc, the flag cycle — is in the integration suite.
 */

const ROLES: RoleDefs = {
  'test:frame': { id: 'test:frame', kind: 'node', labelKey: 'test.frame' },
  'test:node': { id: 'test:node', kind: 'node', labelKey: 'test.node' },
};

/**
 * A frame declaring the three convention tones. Palette entries, never colours
 * in the rule — the indirection is what lets a host restyle both together.
 */
const BACKGROUND = {
  type: 'test',
  role: 'test:frame',
  geometry: {
    width: 1000,
    height: 1000,
    lockAspectRatio: true,
    resizable: false,
    margin: { left: 0, right: 0, top: 0, bottom: 0 },
  },
  chrome: {
    palette: {
      landscape: '#6b7280',
      change: '#d6455d',
      benefit: '#2f9e63',
    },
  },
} as unknown as FrameworkBackgroundDef;

const REALTIME: ValidationRule = {
  id: 'test.node-outside-frame',
  framework: 'test',
  family: 'element-in-background',
  severity: 'warning',
  appliesTo: 'test:node',
  roles: ROLES,
  messageKey: 'com.labre.test.node-outside-frame',
  version: 1,
  backgroundRole: 'test:frame',
};

const TONE: ValidationRule = {
  id: 'test.tone-off-convention',
  framework: 'test',
  family: 'tone-convention',
  moment: 'on-demand',
  severity: 'audit',
  appliesTo: 'test:node',
  roles: ROLES,
  messageKey: 'com.labre.test.tone',
  version: 1,
  backgroundRole: 'test:frame',
  background: BACKGROUND,
  tone: { palette: ['landscape'] },
};

const MAJORITY: ValidationRule = {
  id: 'test.majority-nature',
  framework: 'test',
  family: 'majority-fact',
  moment: 'on-demand',
  severity: 'audit',
  appliesTo: 'test:node',
  roles: ROLES,
  messageKey: 'com.labre.test.majority',
  version: 1,
  backgroundRole: 'test:frame',
  background: BACKGROUND,
  majority: { fact: 'nature', value: 'activity' },
};

/** Element stand-in; every prop the families read is a plain property here. */
function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    ...props,
    clearField(prop: string) {
      delete (stub as Record<string, unknown>)[prop];
    },
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const frame = (id = 'frame') =>
  element(id, [0, 0, 1000, 1000], { role: 'test:frame' });

const node = (id: string, props: Record<string, unknown> = {}) =>
  element(id, [100, 100, 20, 20], { role: 'test:node', ...props });

describe('the on-demand moment (PF5.14)', () => {
  const rules = [REALTIME, TONE, MAJORITY];
  const surface = [frame(), node('n1', { strokeColor: '#d6455d' })];

  it('keeps an on-demand rule out of the real-time pass entirely', () => {
    // Not "filtered from the results" — never evaluated. The node is red, which
    // the tone rule would indict, and it is inside the frame, which the
    // real-time rule would not.
    expect(evaluateRules(rules, surface)).toEqual([]);
  });

  it('runs exactly those rules on a check-up, and no others', () => {
    const remarks = evaluateCheckup(rules, surface);

    expect(remarks.map(r => r.ruleId)).toEqual(['test.tone-off-convention']);
  });

  it('defaults to real time when a rule says nothing', () => {
    // Every rule written before PF5.14 carries no `moment` and must keep being
    // evaluated while the user draws.
    const outside = [frame(), node('n1')];
    outside[1] = element('n1', [5000, 5000, 20, 20], { role: 'test:node' });

    expect(evaluateRules([REALTIME], outside).map(v => v.ruleId)).toEqual([
      'test.node-outside-frame',
    ]);
    // ...and never on a check-up: the two moments partition the rules, they do
    // not overlap.
    expect(evaluateCheckup([REALTIME], outside)).toEqual([]);
  });

  it('names the rules a check-up would walk', () => {
    expect(checkupRules(rules, surface).map(r => r.id)).toEqual([
      'test.tone-off-convention',
      'test.majority-nature',
    ]);
  });

  /**
   * `audit` severity IMPLIES the on-demand moment (PF7.6).
   *
   * An audit finding is dropped by `userFacingViolations` before anything draws
   * it, so computing one on every gesture bought the user nothing and cost the
   * frame budget a full surface walk per rule. Declaring the severity is now
   * enough — no framework has to remember to write `moment` next to it.
   */
  describe('audit severity implies on-demand', () => {
    /** Same rule as REALTIME, only quieter — and that alone moves it. */
    const AUDIT: ValidationRule = {
      ...REALTIME,
      id: 'test.audit-node-outside-frame',
      severity: 'audit',
    };
    /** …and saying `'realtime'` out loud does not bring it back. */
    const AUDIT_CLAIMING_REALTIME: ValidationRule = {
      ...AUDIT,
      id: 'test.audit-claiming-realtime',
      moment: 'realtime',
    };
    const outside = [
      frame(),
      element('n1', [5000, 5000, 20, 20], { role: 'test:node' }),
    ];

    it('keeps an audit rule that says nothing about its moment off the gesture path', () => {
      expect(evaluateRules([AUDIT], outside)).toEqual([]);
      expect(evaluateCheckup([AUDIT], outside).map(v => v.ruleId)).toEqual([
        'test.audit-node-outside-frame',
      ]);
      expect(checkupRules([AUDIT], outside).map(r => r.id)).toEqual([
        'test.audit-node-outside-frame',
      ]);
    });

    it('ignores an explicit `realtime` on an audit rule', () => {
      expect(evaluateRules([AUDIT_CLAIMING_REALTIME], outside)).toEqual([]);
      expect(checkupRules([AUDIT_CLAIMING_REALTIME], outside)).toHaveLength(1);
    });

    it('does not move a non-audit rule that says nothing', () => {
      expect(evaluateRules([REALTIME], outside).map(v => v.ruleId)).toEqual([
        'test.node-outside-frame',
      ]);
      expect(checkupRules([REALTIME], outside)).toEqual([]);
    });

    /**
     * The one thing that brings an audit rule back: a level IN FORCE that shows
     * it.
     *
     * `userFacingViolations` reads the severity a profile rewrote, not the one
     * the rule declared, so an audit rule a level promotes to `warning` is drawn
     * on the canvas — and a canvas verdict has to be computed while the user
     * draws. What decides it is the level the surface's own frames are ON: the
     * framework default, and every profile a frame has CHOSEN. A `c4.strict`
     * nobody has switched a board to costs that board nothing.
     */
    describe('unless a level in force shows it', () => {
      const SKETCH: ValidationProfile = {
        id: 'test.sketch',
        framework: 'test',
        labelKey: 'com.labre.test.sketch',
        fallback: 'Sketch',
        isDefault: true,
        rules: { 'test.audit-node-outside-frame': 'audit' },
      };
      const STRICT: ValidationProfile = {
        id: 'test.strict',
        framework: 'test',
        labelKey: 'com.labre.test.strict',
        fallback: 'Strict',
        rules: { 'test.audit-node-outside-frame': 'warning' },
      };
      const SILENT: ValidationProfile = {
        id: 'test.silent',
        framework: 'test',
        labelKey: 'com.labre.test.silent',
        fallback: 'Silent',
        rules: { 'test.audit-node-outside-frame': 'off' },
      };
      const PACK = [SKETCH, STRICT, SILENT];

      /** The same board, with the frame switched to a level. */
      const on = (profileId?: string) => [
        element('frame', [0, 0, 1000, 1000], {
          role: 'test:frame',
          ...(profileId === undefined ? {} : { validationProfile: profileId }),
        }),
        element('n1', [5000, 5000, 20, 20], { role: 'test:node' }),
      ];

      it('keeps the rule off the drawing path while every frame is on the default', () => {
        // `test.strict` is REGISTERED and promotes the rule — and promotes it
        // for nobody, because no frame on this surface is on it.
        expect(evaluateRules([AUDIT], on(), PACK)).toEqual([]);
        expect(checkupRules([AUDIT], on(), PACK).map(r => r.id)).toEqual([
          'test.audit-node-outside-frame',
        ]);
      });

      it('puts it back the moment a frame chooses a level that shows it', () => {
        const raised = on('test.strict');

        expect(evaluateRules([AUDIT], raised, PACK).map(v => v.ruleId)).toEqual(
          ['test.audit-node-outside-frame']
        );
        expect(evaluateRules([AUDIT], raised, PACK)[0].severity).toBe(
          'warning'
        );
        expect(checkupRules([AUDIT], raised, PACK)).toEqual([]);
      });

      it('evaluates for the whole surface when only one frame is raised', () => {
        // Two frames, one level each: the pass has ONE answer, and it errs
        // towards evaluating — the sketch frame's findings are re-judged back
        // to `audit` afterwards, which is what `applyProfiles` is for.
        const mixed = [
          element('sketchy', [0, 0, 1000, 1000], { role: 'test:frame' }),
          element('raised', [2000, 0, 1000, 1000], {
            role: 'test:frame',
            validationProfile: 'test.strict',
          }),
          element('n1', [5000, 5000, 20, 20], { role: 'test:node' }),
        ];

        expect(
          evaluateRules([AUDIT], mixed, PACK).map(v => v.ruleId)
        ).toContain('test.audit-node-outside-frame');
      });

      it('does not count `off` as a level that shows it', () => {
        // A level that SILENCES a rule is not a level that shows it — the rule
        // stays a check-up rule, and the silent frame simply raises nothing.
        expect(
          checkupRules([AUDIT], on('test.silent'), PACK).map(r => r.id)
        ).toEqual(['test.audit-node-outside-frame']);
      });

      it('guards the frames of an audit rule all the same', () => {
        // `backgroundElementIds` reads the moment STATICALLY and never a chosen
        // level: an extra guarded frame costs one id and can never make a
        // verdict wrong.
        expect([...backgroundElementIds([AUDIT], on())]).toEqual(['frame']);
      });
    });
  });

  /**
   * **Specification IS the check-up** (PO recette of 2026-09-16).
   *
   * The arbitration above, for the rule that declares the second moment OUT
   * LOUD. Until that recette an explicit `moment: 'on-demand'` won against any
   * table, on the argument that a framework which made the declaration is not
   * overruled by one. The consequence was a rule a level had explicitly raised
   * to `'warning'` that was then drawn by nothing, ever: `uml.strict` promotes
   * nine of them, the PO chose Specification, emptied a lifeline's head, and the
   * canvas stayed silent.
   *
   * So a level that NAMES the rule at a drawn severity now decides the moment
   * too. The narrow reading is the point: a promotion is a framework writing
   * `'warning'` beside an id, and a rule a table merely fails to mention keeps
   * whatever it declared, however its own severity happens to resolve.
   */
  describe('a level that PROMOTES a declared on-demand rule', () => {
    const SKETCH: ValidationProfile = {
      id: 'test.quality.sketch',
      framework: 'test',
      labelKey: 'com.labre.test.quality.sketch',
      fallback: 'Sketch',
      isDefault: true,
      rules: {
        'test.tone-off-convention': 'audit',
        'test.majority-nature': 'audit',
      },
    };
    const SPEC: ValidationProfile = {
      id: 'test.quality.spec',
      framework: 'test',
      labelKey: 'com.labre.test.quality.spec',
      fallback: 'Specification',
      rules: {
        'test.tone-off-convention': 'warning',
        'test.majority-nature': 'audit',
      },
    };
    const PACK = [SKETCH, SPEC];

    /** The same board, with the frame switched to a level. A red node: the
     *  tone convention sanctions greys, so it has something to say. */
    const board = (profileId?: string) => [
      element('frame', [0, 0, 1000, 1000], {
        role: 'test:frame',
        ...(profileId === undefined ? {} : { validationProfile: profileId }),
      }),
      element('n1', [100, 100, 20, 20], {
        role: 'test:node',
        strokeColor: '#d6455d',
      }),
    ];

    it('leaves it on demand while every frame is on the default', () => {
      // `test.quality.spec` is registered and promotes it — for nobody, because
      // no frame on this surface has chosen it.
      expect(evaluateRules([TONE], board(), PACK)).toEqual([]);
      expect(checkupRules([TONE], board(), PACK).map(r => r.id)).toEqual([
        'test.tone-off-convention',
      ]);
    });

    it('puts it on the drawing path the moment a frame chooses that level', () => {
      const raised = board('test.quality.spec');
      const drawn = evaluateRules([TONE], raised, PACK);

      expect(drawn.map(v => v.ruleId)).toEqual(['test.tone-off-convention']);
      // …at the severity the level rewrote, which is what the canvas draws.
      expect(drawn[0].severity).toBe('warning');
      // …and it MOVES rather than doubling: a promoted rule leaves the check-up
      // at the same moment it joins the gesture path.
      expect(checkupRules([TONE], raised, PACK)).toEqual([]);
    });

    it('is not promoted by a level that stays silent about it', () => {
      // A rule whose OWN severity is drawn, that no table mentions. The
      // fallback resolves to `warning` — and a fallback is not a decision, so
      // the framework's `'on-demand'` stands.
      const LOUD: ValidationRule = {
        ...TONE,
        id: 'test.tone-loud',
        severity: 'warning',
      };

      expect(evaluateRules([LOUD], board('test.quality.spec'), PACK)).toEqual(
        []
      );
      expect(
        checkupRules([LOUD], board('test.quality.spec'), PACK).map(r => r.id)
      ).toEqual(['test.tone-loud']);
    });

    it('keeps `off` out of it, at either level', () => {
      const SILENCED = [
        SKETCH,
        { ...SPEC, rules: { 'test.tone-off-convention': 'off' as const } },
      ];

      expect(
        checkupRules([TONE], board('test.quality.spec'), SILENCED).map(
          r => r.id
        )
      ).toEqual(['test.tone-off-convention']);
    });

    /**
     * The frame bookkeeping and the watched props follow, or the promotion
     * would raise the finding once — on the switch — and then never again.
     *
     * Both are computed ONCE, against the registry, before any frame has chosen
     * anything, so they ask the static question: could ANY registered level
     * promote this rule. Over-answering costs one id or one watched property;
     * under-answering costs a verdict that never reappears.
     */
    it('guards the promoted rule’s frames, and watches the words it reads', () => {
      // No registry: the declaration is the whole answer, exactly as before.
      expect([...backgroundElementIds([TONE], board())]).toEqual([]);
      // With the registry that promotes it: the frame is remembered.
      expect([...backgroundElementIds([TONE], board(), PACK)]).toEqual([
        'frame',
      ]);

      const NAMING: ValidationRule = {
        ...TONE,
        id: 'test.unnamed-node',
        family: 'label-presence',
      };
      // Nobody promotes it: typing costs nothing, as it did before.
      expect(verdictPropsOf([NAMING]).has('text')).toBe(false);
      expect(verdictPropsOf([NAMING], PACK).has('text')).toBe(false);
      // A level promotes it: `text` joins the props a keystroke re-judges on.
      const promoting: ValidationProfile[] = [
        SKETCH,
        {
          ...SPEC,
          rules: { ...SPEC.rules, 'test.unnamed-node': 'warning' as const },
        },
      ];
      expect(verdictPropsOf([NAMING], promoting).has('text')).toBe(true);
    });
  });

  /**
   * The gesture path is `evaluateRules` AND the frame bookkeeping the manager
   * does around it, and only the first of the two was filtered by moment. The
   * second is a full surface walk per rule, once per tick, so leaving the
   * on-demand rules in it handed the drawing budget back exactly what the second
   * moment had just taken away — and a bench timing `evaluateRules` alone cannot
   * see it.
   *
   * Counted rather than timed: a walk either happens or it does not, and a
   * counter says so on any machine, at any load.
   */
  describe('the frame bookkeeping is filtered by moment too', () => {
    /** Elements whose `role` read is counted — one tick over the surface. */
    const counting = () => {
      const reads = { count: 0 };
      const make = (
        id: string,
        role: string,
        box: [number, number, number, number]
      ) => {
        const stub = {
          id,
          type: 'test',
          get role() {
            reads.count += 1;
            return role;
          },
          get elementBound() {
            return new Bound(...box);
          },
        };
        return stub as unknown as GfxPrimitiveElementModel;
      };
      return {
        reads,
        elements: [
          make('frame', 'test:frame', [0, 0, 1000, 1000]),
          make('n1', 'test:node', [100, 100, 20, 20]),
          make('n2', 'test:node', [200, 200, 20, 20]),
        ],
      };
    };

    it('walks the surface for the real-time rules and no others', () => {
      const only = counting();
      backgroundElementIds([REALTIME], only.elements);

      const both = counting();
      backgroundElementIds([REALTIME, TONE, MAJORITY], both.elements);

      // Three rules registered, one walk: the two on-demand ones cost exactly
      // nothing on the tick.
      expect(both.reads.count).toBe(only.reads.count);
    });

    it('and an on-demand rule’s frames are not in the real-time memory', () => {
      // `_backgrounds` exists to decide whether an incremental REAL-TIME pass
      // must fall back to a full sweep. A rule that never takes part in that
      // pass has nothing to invalidate in it.
      const { elements } = counting();

      expect([...backgroundElementIds([REALTIME], elements)]).toEqual([
        'frame',
      ]);
      expect([...backgroundElementIds([TONE, MAJORITY], elements)]).toEqual([]);
    });
  });
});

/**
 * The GATE the whole per-instance surface hangs off: the profile picker, this
 * checklist and the check-up all ask the same question — "is this element
 * somebody's frame?" — and `frameworksOfRole` is the one place that answers it.
 *
 * Two sources, because a framework with no rule to derive one from still has a
 * background: Estuarine's map is negotiated, not measured, so it ships nudges
 * and nothing computable. Inventing a rule that never fires to make the panel
 * appear would be data claiming an effect it does not have.
 */
describe('what makes an element a root instance', () => {
  const ESTUARINE_ROLES: RoleDefs = {
    'est:map': { id: 'est:map', kind: 'node', labelKey: 'est.map' },
    'est:big-map': {
      id: 'est:big-map',
      parent: 'est:map',
      kind: 'node',
      labelKey: 'est.big-map',
    },
    'est:constraint': {
      id: 'est:constraint',
      kind: 'node',
      labelKey: 'est.constraint',
    },
  };

  const ESTUARINE: ValidationFrameworkDef = {
    framework: 'estuarine',
    backgroundRole: 'est:map',
    roles: ESTUARINE_ROLES,
  };

  const of = (
    role: string | undefined,
    rules: ValidationRule[] = [REALTIME],
    defs: ValidationFrameworkDef[] = []
  ) => [...frameworksOfRole(role, rules, defs)];

  it('derives it from a rule that frames against the role', () => {
    expect(of('test:frame')).toEqual(['test']);
    expect(of('test:node')).toEqual([]);
  });

  it('knows nothing about a framework that ships no rule…', () => {
    expect(of('est:map')).toEqual([]);
  });

  it('…until that framework declares its root instance outright', () => {
    expect(of('est:map', [REALTIME], [ESTUARINE])).toEqual(['estuarine']);
  });

  it('reads BOTH sources, and says each framework once', () => {
    // The same role can be a rule's frame and a declaration's, and two
    // frameworks can claim one role — an answer per framework, never per
    // source.
    const alsoDeclared: ValidationFrameworkDef = {
      framework: 'test',
      backgroundRole: 'test:frame',
      roles: ROLES,
    };
    const other: ValidationFrameworkDef = {
      framework: 'other',
      backgroundRole: 'test:frame',
      roles: ROLES,
    };

    expect(of('test:frame', [REALTIME], [alsoDeclared, other]).sort()).toEqual([
      'other',
      'test',
    ]);
  });

  it('follows a specialisation, from either source', () => {
    // A declaration written on the parent role covers the board that
    // specialises it, exactly as a rule's `backgroundRole` does.
    expect(of('est:big-map', [], [ESTUARINE])).toEqual(['estuarine']);
    expect(of('est:constraint', [], [ESTUARINE])).toEqual([]);
  });

  it('answers nothing for a neutral element', () => {
    // No role, no framework, no tooling — and for a background authored
    // before its role existed, the same.
    expect(of(undefined, [REALTIME], [ESTUARINE])).toEqual([]);
  });

  it('ignores a rule that frames against nothing', () => {
    // `no-overlap` may ship without a `backgroundRole`: it frames nothing, so
    // it makes no element a root instance.
    const frameless: ValidationRule = {
      ...REALTIME,
      backgroundRole: undefined,
    };

    expect(of('test:frame', [frameless])).toEqual([]);
  });
});

describe('classifying a colour into a tone', () => {
  it('reads a hex it can see', () => {
    expect(toneOf('#d6455d')).toBe('red');
    expect(toneOf('#2f9e63')).toBe('green');
    expect(toneOf('#6b7280')).toBe('grey');
  });

  it('calls a washed-out or near-black colour a grey, whatever its hue', () => {
    // Hue stops meaning anything at the ends of the lightness scale, and a
    // barely-saturated colour reads as grey to the eye that the convention is
    // written for.
    expect(toneOf('#1f2328')).toBe('grey');
    expect(toneOf('#ffffff')).toBe('grey');
    expect(toneOf('#000000')).toBe('grey');
    expect(toneOf('#7d7f82')).toBe('grey');
  });

  it('accepts the short and alpha forms', () => {
    expect(toneOf('#f00')).toBe('red');
    expect(toneOf('#ff0000ff')).toBe('red');
  });

  it('reads a THEME TOKEN by its name', () => {
    // The one honest way to classify a variable this process has no stylesheet
    // to resolve: the token says what it is.
    expect(toneOf('--affine-palette-shape-red')).toBe('red');
    expect(toneOf('--affine-palette-shape-black')).toBe('grey');
    expect(toneOf('--affine-palette-line-green')).toBe('green');
  });

  it('says nothing about a colour it cannot honestly read', () => {
    // Silence, never a guess: a convention rule that guessed would indict a
    // user over a colour nobody here can see.
    expect(toneOf('transparent')).toBeUndefined();
    expect(toneOf('--affine-palette-transparent')).toBeUndefined();
    expect(toneOf('rgb(1, 2, 3)')).toBeUndefined();
    expect(toneOf('#00000000')).toBeUndefined();
    expect(toneOf(undefined)).toBeUndefined();
    expect(toneOf('')).toBeUndefined();
  });
});

describe('the tone convention (Q5)', () => {
  const remarks = (elements: GfxPrimitiveElementModel[]) =>
    evaluateCheckup([TONE], elements).map(r => r.elementIds.join('+'));

  it('lets the landscape be drawn in greys', () => {
    expect(
      remarks([
        frame(),
        node('a', { strokeColor: '#1f2328', fillColor: '#ffffff' }),
      ])
    ).toEqual([]);
  });

  it('remarks on a component drawn outside the sanctioned tones', () => {
    expect(remarks([frame(), node('a', { strokeColor: '#d6455d' })])).toEqual([
      'a',
    ]);
  });

  it('says nothing about a colour it cannot classify', () => {
    expect(
      remarks([frame(), node('a', { strokeColor: 'rgb(200, 20, 20)' })])
    ).toEqual([]);
  });

  it('ignores the fill of an unfilled shape', () => {
    // Stored, never painted. A rule about what the map LOOKS like has no
    // business reading a colour that is not on screen.
    expect(
      remarks([
        frame(),
        node('a', { filled: false, fillColor: '#d6455d', strokeColor: '#333' }),
      ])
    ).toEqual([]);
  });

  it('treats a light/dark pair as ONE colour', () => {
    // Two members of one decision: it offends only when NEITHER lands on a
    // sanctioned tone.
    expect(
      remarks([
        frame(),
        node('a', { strokeColor: { light: '#1f2328', dark: '#eeeeee' } }),
      ])
    ).toEqual([]);
    expect(
      remarks([
        frame(),
        node('b', { strokeColor: { light: '#d6455d', dark: '#e0607a' } }),
      ])
    ).toEqual(['b']);
  });

  it('never touches an element with no role', () => {
    // Proportionality: a generalist rectangle is not part of anybody's
    // landscape.
    expect(
      remarks([
        frame(),
        element('free', [10, 10, 20, 20], { fillColor: '#d6455d' }),
      ])
    ).toEqual([]);
  });

  it('evaluates nothing when the frame declares no such palette entry', () => {
    const broken: ValidationRule = { ...TONE, tone: { palette: ['nope'] } };
    // A convention with no reference colour is not a convention. Silence beats
    // indicting the whole board over a broken declaration.
    expect(
      evaluateCheckup(
        [broken],
        [frame(), node('a', { strokeColor: '#d6455d' })]
      )
    ).toEqual([]);
  });
});

describe('the majority fact (Q6)', () => {
  const remarks = (elements: GfxPrimitiveElementModel[]) =>
    evaluateCheckup([MAJORITY], elements);

  /**
   * THE condition this rule ships under, written down as a test rather than as
   * a comment: Wardley's `nature` does not exist yet, nothing writes it, and
   * the rule has to be inert until it does — silently, with no flag to flip.
   */
  it('says NOTHING while no element carries the fact', () => {
    expect(remarks([frame(), node('a'), node('b'), node('c')])).toEqual([]);
  });

  it('starts working by itself the day a majority carries it', () => {
    const found = remarks([
      frame(),
      node('a', { nature: 'activity' }),
      node('b', { nature: 'activity' }),
      node('c', { nature: 'practice' }),
    ]);

    expect(found).toHaveLength(1);
    // The remark is about the MAP: it names the background and nobody else. No
    // single component is at fault, and a badge on one of them would be an
    // accusation aimed at a bystander.
    expect(found[0].elementIds).toEqual(['frame']);
    expect(found[0].backgroundId).toBe('frame');
  });

  it('needs a majority of the SUBJECTS, not of the ones that are classified', () => {
    // Two activities out of five components is not a mandate, even if the other
    // three carry no nature at all.
    expect(
      remarks([
        frame(),
        node('a', { nature: 'activity' }),
        node('b', { nature: 'activity' }),
        node('c'),
        node('d'),
        node('e'),
      ])
    ).toEqual([]);
  });

  it('counts per MAP, never over the whole board', () => {
    // A board carrying a map of activities beside a map of practices holds two
    // different answers, and a tally over the surface would give both the wrong
    // one.
    const far = element('other', [5000, 5000, 1000, 1000], {
      role: 'test:frame',
    });
    const there = (id: string, nature: string) =>
      element(id, [5100, 5100, 20, 20], { role: 'test:node', nature });

    const found = remarks([
      frame(),
      node('a', { nature: 'activity' }),
      node('b', { nature: 'activity' }),
      far,
      there('c', 'practice'),
      there('d', 'practice'),
    ]);

    expect(found.map(r => r.elementIds[0])).toEqual(['frame']);
  });

  it('says nothing on a board with no frame at all', () => {
    expect(remarks([node('a', { nature: 'activity' })])).toEqual([]);
  });
});

describe('the checklist state (PF7.10)', () => {
  it('starts empty, and writes NO key for an untouched instance', () => {
    const bg = frame();

    expect(checkedNudges(bg)).toEqual([]);
    expect(bg.qualityChecklist).toBeUndefined();
  });

  it('ticks and unticks', () => {
    const bg = frame();

    expect(setNudgeChecked(bg, 'q1', true)).toBe(true);
    expect(isNudgeChecked(bg, 'q1')).toBe(true);
    expect(setNudgeChecked(bg, 'q2', true)).toBe(true);
    expect(checkedNudges(bg)).toEqual(['q1', 'q2']);

    expect(setNudgeChecked(bg, 'q1', false)).toBe(true);
    expect(checkedNudges(bg)).toEqual(['q2']);
  });

  it('reports a no-op as a no-op', () => {
    // Nothing changed => nothing to undo, and nothing to report to telemetry.
    const bg = frame();

    expect(setNudgeChecked(bg, 'q1', false)).toBe(false);
    setNudgeChecked(bg, 'q1', true);
    expect(setNudgeChecked(bg, 'q1', true)).toBe(false);
  });

  it('CLEARS the key when the last tick is taken back', () => {
    // Not `[]`: an empty array left in the Y.Map is invisible in the panel and
    // real for every peer and every snapshot. The same contract
    // `revokeException` honours (PF8).
    const bg = frame();
    setNudgeChecked(bg, 'q1', true);
    setNudgeChecked(bg, 'q1', false);

    expect(bg.qualityChecklist).toBeUndefined();
    expect(checkedNudges(bg)).toEqual([]);
  });

  it('survives whatever a peer wrote', () => {
    // The value comes out of a Y.Map: a client that got it wrong must not break
    // the panel on this one.
    expect(checkedNudges(frame())).toEqual([]);
    expect(
      checkedNudges(
        element('bg', [0, 0, 10, 10], { qualityChecklist: 'not-an-array' })
      )
    ).toEqual([]);
    expect(
      checkedNudges(
        element('bg', [0, 0, 10, 10], { qualityChecklist: ['q1', 7, null] })
      )
    ).toEqual(['q1']);
  });

  it('refuses to write into a read-only document, at the SEAM', () => {
    // Not "the panel disables the box" — this function, so an agent or a host
    // calling it directly meets the same guard. `clearField` goes through
    // `Store.transact`, which carries no read-only guard of its own, so an
    // untick would genuinely delete the key from a document nobody may edit.
    const store = { readonly: true };
    const bg = element('bg', [0, 0, 10, 10], {
      role: 'test:frame',
      surface: { store },
    });

    expect(setNudgeChecked(bg, 'q1', true)).toBe(false);
    expect(bg.qualityChecklist).toBeUndefined();

    store.readonly = false;
    expect(setNudgeChecked(bg, 'q1', true)).toBe(true);
    expect(checkedNudges(bg)).toEqual(['q1']);

    // ...and the untick is guarded too, which is the destructive direction.
    store.readonly = true;
    expect(setNudgeChecked(bg, 'q1', false)).toBe(false);
    expect(checkedNudges(bg)).toEqual(['q1']);
  });

  it('keeps ids no framework declares any more', () => {
    // The flag takes the CHECKLIST away, never the decisions recorded on it:
    // that is the whole reason this is document data and not tooling state.
    const bg = element('bg', [0, 0, 10, 10], {
      qualityChecklist: ['gone.q9', 'q1'],
    });
    setNudgeChecked(bg, 'q2', true);

    expect(checkedNudges(bg)).toEqual(['gone.q9', 'q1', 'q2']);
  });
});
