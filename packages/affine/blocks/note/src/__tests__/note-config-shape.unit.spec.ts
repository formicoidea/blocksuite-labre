/**
 * `NoteConfig` only widens: a config a host typed against 0.58 still
 * compiles.
 *
 * 0.59 made `pageBlockTitle` optional (the page note now draws the document
 * title itself when the host registers none, see
 * `edgeless-page-block-title.unit.spec.ts`) and let it return `nothing`.
 * `NoteConfig` is a type the host implements, so a minor may widen it and
 * never narrow it (docs/lessons.md 33). `config058` below is the 0.58 shape,
 * typechecked by `yarn build` (tests included): narrowing the type again, or
 * making a 0.58 field required in a new way, fails the build here.
 */
import type { NoteBlockModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { html, nothing, type TemplateResult } from 'lit';
import { describe, expect, test } from 'vitest';

import { type NoteConfig, NoteConfigExtension } from '../config.js';

type NoteBlockContext = { note: NoteBlockModel; std: BlockStdScope };

/** The 0.58 type, verbatim. */
type NoteConfig058 = {
  edgelessNoteHeader: (context: NoteBlockContext) => TemplateResult;
  pageBlockTitle: (context: NoteBlockContext) => TemplateResult;
  pageBlockViewportFitAnimation?: (context: NoteBlockContext) => boolean;
};

/** A 0.58 config, as a host wrote it. Compiles or the build fails. */
const config058: NoteConfig058 = {
  edgelessNoteHeader: () => html`<span>header</span>`,
  pageBlockTitle: () => html`<span>title</span>`,
};

const widened: NoteConfig = config058;

/** What 0.59 adds: no title config at all, or a title that draws nothing. */
const withoutTitle: NoteConfig = {
  edgelessNoteHeader: () => html``,
};
const noTitle: NoteConfig = {
  edgelessNoteHeader: () => html``,
  pageBlockTitle: () => nothing,
};

describe('NoteConfig keeps its 0.58 shape', () => {
  test('a 0.58 config registers unchanged', () => {
    expect(NoteConfigExtension(config058)).toBeDefined();
    expect(widened.pageBlockTitle).toBe(config058.pageBlockTitle);
    expect(withoutTitle.pageBlockTitle).toBeUndefined();
    expect(noTitle.pageBlockTitle?.({} as unknown as NoteBlockContext)).toBe(
      nothing
    );
  });
});
