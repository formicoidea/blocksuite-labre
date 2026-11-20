---
'@labre/affine-database-block': minor
---

A view's source may now be unavailable because it is not open to the page the
reader reads (#693): a resolver (`DatabaseDataSourceProvider`'s
`resolveSource`) may answer `{ unavailable: 'not-open' }`, appended to
`HostedSourceUnavailableReason`. The view keeps its title and view bar and
draws "Source not open" in place of its body, exactly as for `'unshared'`
(`data-testid="database-source-not-open"`, `role="status"`): no row, no "New",
no cell to edit, never "Connect a source", even with `requireSource`, nothing
written, and no button (opening the source is yours). The host decides the
state; the library holds no rights logic. Two new keys, with their English
fallbacks:

- `com.labre.database.source-not-open`: "Source not open"
- `com.labre.database.source-not-open.hint`: "An owner or a member of the
  workspace must open this source to this page to show its rows."

An `{ unavailable }` answer whose reason the library does not know no longer
reads as a missing source, which `requireSource` answered with "Connect a
source": it draws the neutral "Source not found" wording
(`com.labre.database.source-missing`, `.hint`) in the same layout,
`data-testid="database-source-unknown"`. `sourceUnavailable$` answers
`'unknown'` for it (typed by the new `HostedSourceUnavailableState`, which
`'not-open'` also widens); `isHostedSourceUnavailable` still recognises only
the reasons a host sends.

Do not send `'not-open'` before upgrading: 4.0 reads it as a missing source
("No source connected" and its "Connect a source" under `requireSource`,
"Source not found" otherwise). Keep `'unshared'` for that state until then.
