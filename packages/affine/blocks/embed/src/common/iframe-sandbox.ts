/**
 * The iframe sandbox policy of every embed block, in one place.
 *
 * Every `<iframe>` this package renders points at a third party, so every one
 * of them is sandboxed. The three values below are the only levels there are;
 * see `docs/adr/0028-iframe-sandbox-policy.md` for why.
 *
 * These constants used to live inside `embed-iframe-block/`, out of reach of
 * the sibling blocks of the same package — which is how the dedicated
 * YouTube / Figma / Loom players were shipped with no sandbox at all until
 * issue #389. The policy belongs to the package, not to one block.
 */

/**
 * Sandbox granted to an embed served by a known provider (spotify, miro, …)
 * through `EmbedIframeConfig`. A provider may widen it through its own
 * `sandbox` option.
 */
export const TRUSTED_SANDBOX =
  'allow-same-origin allow-scripts allow-forms allow-presentation';

/**
 * Sandbox granted to an arbitrary url: the generic provider, or no provider at
 * all. Without `allow-same-origin` the frame runs on an opaque origin.
 */
export const UNTRUSTED_SANDBOX = 'allow-scripts';

/**
 * Sandbox granted to the dedicated third-party players whose `src` is built
 * from a fixed, hard-coded origin (`www.youtube.com`, `www.figma.com`,
 * `www.loom.com`): they never go through `EmbedIframeConfig`, so this is the
 * only place their policy is written.
 *
 * `allow-same-origin` is not negotiable: without it the YouTube player fails
 * to start (`Cache storage is disabled because the context is sandboxed`) and
 * paints a black frame. It is safe here precisely because the origin is fixed
 * and cross-origin to the host — the frame keeps its own origin and cannot
 * reach the host document.
 *
 * It is `TRUSTED_SANDBOX` minus `allow-forms`: none of these three players has
 * a form to submit, so the capability is not granted.
 */
export const PROVIDER_PLAYER_SANDBOX =
  'allow-same-origin allow-scripts allow-presentation';
