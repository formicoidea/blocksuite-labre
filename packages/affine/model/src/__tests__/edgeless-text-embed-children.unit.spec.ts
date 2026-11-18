/**
 * Guard for the one schema rule that uses a negated extglob (issue #667).
 *
 * `affine:edgeless-text` lists `affine:embed-!(synced-doc)` among its
 * children: every embed may sit in an edgeless text except the synced doc.
 * The store matches schema patterns itself, without `minimatch`, and supports
 * `*` and a trailing `!(…)` only. This spec would catch
 * a matcher, or an edit of the schema, that refuses every embed in an
 * edgeless text or lets the synced doc in.
 */
import { Schema } from '@labre/store';
import { describe, expect, it } from 'vitest';

import { EdgelessTextBlockSchema } from '../blocks/edgeless-text/edgeless-text-model.js';
import { EmbedIframeBlockSchema } from '../blocks/embed/iframe/iframe-schema.js';
import { EmbedLinkedDocBlockSchema } from '../blocks/embed/linked-doc/linked-doc-schema.js';
import { EmbedSyncedDocBlockSchema } from '../blocks/embed/synced-doc/synced-doc-schema.js';

const schema = new Schema().register([
  EdgelessTextBlockSchema,
  EmbedIframeBlockSchema,
  EmbedLinkedDocBlockSchema,
  EmbedSyncedDocBlockSchema,
]);

describe('edgeless text embed children', () => {
  it('accepts every embed but the synced doc', () => {
    expect(
      schema.isValid('affine:embed-linked-doc', 'affine:edgeless-text')
    ).toBe(true);
    expect(schema.isValid('affine:embed-iframe', 'affine:edgeless-text')).toBe(
      true
    );
    expect(
      schema.isValid('affine:embed-synced-doc', 'affine:edgeless-text')
    ).toBe(false);
  });
});
