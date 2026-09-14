import {
  RULE_SCOPES,
  scopeOf,
  type ValidationRule,
} from '@labre/affine-block-surface';
import { BPMN_RULES } from '@labre/affine-gfx-bpmn';
import { C4_RULES } from '@labre/affine-gfx-c4';
import { CONTEXT_MAP_RULES } from '@labre/affine-gfx-ddd-context-map';
import { CORE_DOMAIN_RULES } from '@labre/affine-gfx-ddd-core-domain';
import { EVENT_STORMING_RULES } from '@labre/affine-gfx-ddd-event-storming';
import { EDGY_RULES } from '@labre/affine-gfx-edgy';
import { UML_RULES } from '@labre/affine-gfx-uml';
import { WARDLEY_RULES } from '@labre/affine-gfx-wardley';
import { describe, expect, test } from 'vitest';

/**
 * GUARD — every rule the library SHIPS resolves to a dependency scope (PF5.3).
 *
 * `RULE_SCOPES` is typed `Record<RuleFamily, RuleScope>`, so a family with no
 * entry is a build error inside the engine. This is the other half: a framework
 * shipping a rule on a family the table never heard of would otherwise fall
 * through to `'surface'` in silence, and PF5.4 would quietly stop
 * incrementalising it. The packs are the only place that can happen, and they
 * are only reachable from here.
 */

const PACKS: Readonly<Record<string, readonly ValidationRule[]>> = {
  wardley: WARDLEY_RULES,
  bpmn: BPMN_RULES,
  c4: C4_RULES,
  uml: UML_RULES,
  edgy: EDGY_RULES,
  'ddd-event-storming': EVENT_STORMING_RULES,
  'ddd-context-map': CONTEXT_MAP_RULES,
  'ddd-core-domain': CORE_DOMAIN_RULES,
};

describe('shipped rules carry a dependency scope', () => {
  for (const [framework, rules] of Object.entries(PACKS)) {
    test(`${framework} (${rules.length} rules)`, () => {
      expect(rules.length).toBeGreaterThan(0);
      for (const rule of rules) {
        expect(
          Object.hasOwn(RULE_SCOPES, rule.family),
          `${rule.id} is on family "${rule.family}", which RULE_SCOPES does not declare`
        ).toBe(true);
        expect(['element', 'relations', 'frame', 'surface']).toContain(
          scopeOf(rule)
        );
      }
    });
  }
});
