/**
 * Guard for the flavour patterns of a schema's `parent` / `children` lists
 * (issue #667).
 *
 * `Schema` matched those patterns with `minimatch`, which pulled
 * `brace-expansion` (and its advisories) into the published core bundle. The
 * matcher is now a few lines of code, and this spec pins the behaviour
 * minimatch had on the patterns the schemas actually use, through the public
 * `isValid`, so both directions of the match are covered: a parent's
 * `children` pattern against the child's flavour, and a child's `parent`
 * pattern against the parent's flavour.
 *
 * What it would have caught: a matcher that forgets to anchor (`test:leaf`
 * accepting `test:leafy`), to escape (`.` matching any character), that
 * ignores case, that lets `*` cross a `/`, or that drops the negated
 * extglob `!(…)` — `affine:edgeless-text` declares
 * `affine:embed-!(synced-doc)` among its children, so losing it would refuse
 * every embed inside an edgeless text, or accept the synced doc.
 */
import { describe, expect, it } from 'vitest';

import { defineBlockSchema } from '../model/block/zod.js';
import { Schema } from '../schema/schema.js';

function block(
  flavour: string,
  metadata: { role?: string; parent?: string[]; children?: string[] } = {}
) {
  return defineBlockSchema({
    flavour,
    props: () => ({}),
    metadata: { version: 1, role: 'content', ...metadata },
  });
}

const schema = new Schema().register([
  block('test:root', { role: 'root' }),
  block('test:host', {
    role: 'hub',
    parent: ['test:root'],
    children: [
      'test:leaf',
      'test:dot.ted',
      'test:embed-*',
      'test:item-!(secret)',
    ],
  }),
  // Children with no `parent` list accept any parent: only the host's
  // `children` pattern decides.
  block('test:leaf'),
  block('test:leafy'),
  block('test:LEAF'),
  block('test:dot.ted'),
  block('test:dotXted'),
  block('test:embed-'),
  block('test:embed-video'),
  block('test:embedx'),
  block('test:embed-a/b'),
  block('test:item-public'),
  block('test:item-secret'),
  block('test:item-secrets'),
  block('test:item-secret/x'),
  // The other direction: the child's `parent` pattern against a host whose
  // `children` accept anything.
  block('test:box-a', { role: 'hub' }),
  block('test:boxx', { role: 'hub' }),
  block('test:box-other', { role: 'hub' }),
  block('test:box-b', { role: 'hub' }),
  block('test:in-box', { parent: ['test:box-*'] }),
  block('test:in-box-but-b', { parent: ['test:box-!(b)'] }),
  // Both sides declared: both patterns must match.
  block('test:pen', { role: 'hub', children: ['test:kid-*'] }),
  block('test:kid-a', { parent: ['test:pen'] }),
  block('test:kid-b', { parent: ['test:elsewhere'] }),
]);

describe('schema flavour patterns', () => {
  it('matches an exact flavour, anchored and case-sensitive', () => {
    expect(schema.isValid('test:leaf', 'test:host')).toBe(true);
    expect(schema.isValid('test:leafy', 'test:host')).toBe(false);
    expect(schema.isValid('test:LEAF', 'test:host')).toBe(false);
  });

  it('reads a dot as a dot', () => {
    expect(schema.isValid('test:dot.ted', 'test:host')).toBe(true);
    expect(schema.isValid('test:dotXted', 'test:host')).toBe(false);
  });

  it('lets a star match any run of characters but a slash', () => {
    expect(schema.isValid('test:embed-video', 'test:host')).toBe(true);
    expect(schema.isValid('test:embed-', 'test:host')).toBe(true);
    expect(schema.isValid('test:embedx', 'test:host')).toBe(false);
    expect(schema.isValid('test:embed-a/b', 'test:host')).toBe(false);
  });

  it('excludes exactly the alternatives of a trailing !(…)', () => {
    expect(schema.isValid('test:item-public', 'test:host')).toBe(true);
    expect(schema.isValid('test:item-secret', 'test:host')).toBe(false);
    expect(schema.isValid('test:item-secrets', 'test:host')).toBe(true);
    expect(schema.isValid('test:item-secret/x', 'test:host')).toBe(false);
  });

  it("matches the child's parent pattern against the parent's flavour", () => {
    expect(schema.isValid('test:in-box', 'test:box-a')).toBe(true);
    expect(schema.isValid('test:in-box', 'test:boxx')).toBe(false);
    expect(schema.isValid('test:in-box-but-b', 'test:box-other')).toBe(true);
    expect(schema.isValid('test:in-box-but-b', 'test:box-b')).toBe(false);
  });

  it('requires both patterns when both sides declare one', () => {
    expect(schema.isValid('test:kid-a', 'test:pen')).toBe(true);
    expect(schema.isValid('test:kid-b', 'test:pen')).toBe(false);
    expect(schema.isValid('test:leaf', 'test:pen')).toBe(false);
  });
});
