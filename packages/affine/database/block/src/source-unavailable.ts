import { LoadingIcon } from '@labre/affine-components/icons';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { html, type TemplateResult } from 'lit';

import {
  databaseSourceMissingHintStyles,
  databaseSourceMissingStyles,
} from './database-block-styles.js';
import type { HostedSourceUnavailableState } from './external-data-source.js';
import {
  DATABASE_SOURCE_MISSING,
  DATABASE_SOURCE_MISSING_HINT,
  DATABASE_SOURCE_NOT_OPEN,
  DATABASE_SOURCE_NOT_OPEN_HINT,
  DATABASE_SOURCE_TRASHED,
  DATABASE_SOURCE_TRASHED_HINT,
  DATABASE_SOURCE_UNSHARED,
  DATABASE_SOURCE_UNSHARED_HINT,
} from './translations.js';

/**
 * The title and hint of each reason a view's source cannot be read (ADR 0035
 * amendments of 2026-10-30 and 2026-11-20). Typed by every state but
 * `'loading'`, so a reason appended without its wording does not compile.
 * `'unknown'`, a reason this build does not know, reads as the neutral
 * "Source not found": a host newer than the library never gets an error nor
 * "Connect a source".
 */
type NoticeWordings = Readonly<
  Record<
    Exclude<HostedSourceUnavailableState, 'loading'>,
    readonly [ChromeWording, ChromeWording]
  >
>;

// `satisfies` checks the keys: `Object.create(null)` is `any`, which alone
// would let a missing reason through.
const NOTICE_WORDINGS: NoticeWordings = Object.assign(Object.create(null), {
  unshared: [DATABASE_SOURCE_UNSHARED, DATABASE_SOURCE_UNSHARED_HINT],
  trashed: [DATABASE_SOURCE_TRASHED, DATABASE_SOURCE_TRASHED_HINT],
  'not-open': [DATABASE_SOURCE_NOT_OPEN, DATABASE_SOURCE_NOT_OPEN_HINT],
  unknown: [DATABASE_SOURCE_MISSING, DATABASE_SOURCE_MISSING_HINT],
} satisfies NoticeWordings);

/**
 * What a view draws under its title and view bar in place of its body when
 * the host says its source cannot be read now: a spinner for `'loading'`,
 * else the reason's title and hint, `data-testid="database-source-<state>"`.
 * A status, never an error, and no button: the gesture that gives the
 * source back (share it, open it, restore it) is the host's. Writes nothing.
 */
export function sourceUnavailableNotice(
  std: BlockStdScope,
  state: HostedSourceUnavailableState
): TemplateResult {
  if (state === 'loading') {
    return html`<div
      class="${databaseSourceMissingStyles}"
      data-testid="database-source-loading"
      role="status"
      aria-busy="true"
    >
      ${LoadingIcon()}
    </div>`;
  }
  const [title, hint] = NOTICE_WORDINGS[state];
  return html`<div
    class="${databaseSourceMissingStyles}"
    data-testid="database-source-${state}"
    role="status"
  >
    <div>${translateKey(std, ...title)}</div>
    <div class="${databaseSourceMissingHintStyles}">
      ${translateKey(std, ...hint)}
    </div>
  </div>`;
}
