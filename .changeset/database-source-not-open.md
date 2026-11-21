---
'@labre/affine-database-block': minor
---

A view's source may now be unavailable because it is not open to the page the
reader reads (#693): a resolver (`DatabaseDataSourceProvider`'s
`resolveSource`) may answer `{ unavailable: 'not-open' }`, appended to
`HostedSourceUnavailableReason`. The view keeps its title and view bar and
draws "Source not open" in place of its body, exactly as for `'unshared'`
(`data-testid="database-source-not-open"`, `role="status"`): no row, even one
your answer still carries, no "New", no cell to edit, never "Connect a source",
even with `requireSource`, nothing written, and no button (opening the source
is yours). A mounted view whose answer flips to `'not-open'` drops its rows and
a cell selected before the flip writes nothing. The host decides the state; the
library holds no rights logic. Two new keys, with their English fallbacks:

- `com.labre.database.source-not-open`: "Source not open"
- `com.labre.database.source-not-open.hint`: "This view reads a source that is
  not open to this page. Open the source to this page to see its rows."

The fallback names no role, since the library has no rights model: the line
saying who may open the source (in Labre, an owner or a member of the
workspace) belongs to your catalogue, in every language you ship.

An `{ unavailable }` answer whose reason the library does not know no longer
reads as a missing source, which `requireSource` answered with "Connect a
source": it draws the neutral "Source not found" wording
(`com.labre.database.source-missing`, `.hint`) in the same layout,
`data-testid="database-source-unknown"`. A falsy non-object answer (`false`,
`0`, `''`) reads as a missing source instead of throwing.

Upgrade order: send `'not-open'` only once you run the library version that
ships this change. An older library reads a reason it does not know as a
missing source, which under `requireSource` draws "No source connected" with
"Connect a source". Keep `'unshared'` for that state until then.

`sourceUnavailable$` now also answers `'not-open'` and `'unknown'` (typed by
the new `HostedSourceUnavailableState`): code that handles its values
exhaustively sees the two new members. `isHostedSourceUnavailable` still
recognises only the reasons a host sends.
