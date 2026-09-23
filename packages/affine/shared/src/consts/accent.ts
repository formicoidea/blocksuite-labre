/**
 * The one accent Labre chose for itself.
 *
 * **Why it exists at all.** `DESIGN.md` used to record the chrome's accent as
 * borrowed — AFFiNE's, inherited and due to be replaced — and required that it
 * always be reached through a token, so the re-skin would be a token change.
 * The re-skin happened (ADR 0029): the product owner settled the accent on
 * `#2563eb`, and this module is the single place that value is written.
 * Everything else — the `--affine-*` variables the chrome reads, the colours
 * the canvas resolves in JS — is derived from it.
 *
 * **The value is a product decision, not a shade picked here.** `#2563eb`
 * entered the repository with PR #203 as the colour of the Wardley dependency
 * chip — the only blue in this library chosen by the product owner rather than
 * inherited. PR #395 confirmed it as the accent for every direction chip, and
 * the decision of 2026-09-23 confirmed it for the whole editor.
 *
 * **It is also the accessible one.** The marks that use it carry white text,
 * and against white (WCAG 2.1 relative luminance):
 *
 * | Background | Contrast with white text | AA, normal text (4.5:1) |
 * |---|---|---|
 * | `#2563eb` — this accent | **5.17:1** | passes |
 * | the borrowed blue it replaces | 3.17:1 | fails |
 *
 * **What this is not.** It is not a palette and it is not content: no
 * framework notation borrows it, and nothing here changes a colour a document
 * has already stored (`DESIGN.md`, The Untouched Data Rule). A host that wants
 * a different accent registers `ChromeAccentExtension`; see ADR 0029.
 */
export const LABRE_ACCENT = '#2563eb';
