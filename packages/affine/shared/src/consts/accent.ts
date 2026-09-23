/**
 * The one accent Labre chose for itself.
 *
 * **Why it exists at all.** `DESIGN.md` ("The Borrowed Blue Rule") records that
 * the chrome's accent — the borrowed blue — is AFFiNE's, inherited and due to be
 * replaced, and that it must always be reached through a token so the re-skin is
 * a token change. That rule covers everything the DOM can theme. It cannot cover
 * the places that resolve a colour in JS — the canvas and the session
 * affordances drawn over it — because those never read a CSS variable. Those
 * places used to restate the borrowed hex, and restating it is how two marks
 * about the same board end up different blues.
 *
 * **The value is a product decision, not a shade picked here.** `#2563eb`
 * entered the repository with PR #203 as the colour of the Wardley dependency
 * chip — the only blue in this library chosen by the product owner rather than
 * inherited. PR #395 confirmed it as the accent for every direction chip, so the
 * value moved out of that one role and into this module.
 *
 * **It is also the accessible one.** The marks that use it carry white text, and
 * against white (WCAG 2.1 relative luminance):
 *
 * | Background | Contrast with white text | AA, normal text (4.5:1) |
 * |---|---|---|
 * | `#2563eb` — this accent | **5.17:1** | passes |
 * | the borrowed blue (`DESIGN.md`, The Borrowed Blue Rule) | 3.17:1 | fails |
 *
 * So the chips that kept the borrowed blue were not only a second blue, they
 * were under the threshold.
 *
 * **What this is not.** It is not a theme, and it does not override the chrome:
 * toolbars, buttons and focus rings keep reading `--affine-*`, and nothing here
 * changes what a document stores. It is the single named place a JS-resolved
 * mark reaches for the house accent, so the day the accent is settled for good
 * (`DESIGN.md`, "The Distinct Accent Rule") there is one literal to change
 * rather than a hex per framework.
 */
export const LABRE_ACCENT = '#2563eb';
